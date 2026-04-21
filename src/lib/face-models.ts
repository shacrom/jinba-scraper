/**
 * face-models.ts — lazy-init face detection + region blur
 *
 * Uses face-api.js (tiny_face_detector). Model weights are vendored
 * under /models/ (~2 MB, committed to repo). On macOS dev the
 * @tensorflow/tfjs-node optional dep provides acceleration; in Docker
 * the same package works on linux/amd64.
 *
 * The plate blur is a HEURISTIC rectangular mask (bottom-center 60%×16%
 * of image height) for F1. Full ML plate detection is deferred to F2.
 * Justification: Spanish plates statistically appear in the bottom-center
 * third of car photos; face-api handles the higher-risk PII (faces).
 * Every plate caught is a win; misses in unusual compositions are
 * acceptable at MVP scale.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { logger } from './logger.js';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

let faceApiLoaded = false;
let faceApiAvailable = false;

// Models directory relative to the repo root
const MODELS_DIR = join(fileURLToPath(new URL('../../models', import.meta.url)));

/**
 * Lazy-init face-api.js.
 *
 * **A5 hard policy**: throws if model weights are missing OR face-api/canvas
 * cannot load. The worker refuses to start without face-blur capability to
 * prevent unblurred photos being uploaded to Storage and served to `anon`
 * via the `privacy_processed_at IS NOT NULL` RLS gate.
 */
export async function loadFaceModels(): Promise<void> {
  if (faceApiLoaded) return;

  if (!existsSync(MODELS_DIR)) {
    throw new Error(
      `face-api model weights directory not found at ${MODELS_DIR}. Download tiny_face_detector_model weights from https://github.com/justadudewhohacks/face-api.js/tree/master/weights and commit to ./models/. The worker refuses to start without face-blur to avoid privacy leaks.`,
    );
  }

  // face-api.js is a hard dependency now. Let the import error propagate.
  const faceapi = await import('face-api.js');

  // @tensorflow/tfjs-node is an optional native accelerator. If it fails to
  // load (e.g. arm64 without prebuilt binaries), fall back to the pure-JS
  // backend that ships with face-api.js.
  try {
    await import('@tensorflow/tfjs-node');
  } catch {
    logger.warn(
      '@tensorflow/tfjs-node unavailable — using pure-JS backend (slower but functional)',
    );
  }

  // canvas is required on Node for face-api.js to decode image buffers.
  // Verify it loads before we claim availability.
  try {
    await import('canvas' as string);
  } catch (err) {
    throw new Error(
      `canvas package unavailable — required for face detection on Node. Install with "npm install canvas" and ensure system deps (libcairo2-dev, libpango1.0-dev, libjpeg-dev, libgif-dev) are present. Original: ${String(err)}`,
    );
  }

  await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_DIR);
  faceApiLoaded = true;
  faceApiAvailable = true;
  logger.info({ modelsDir: MODELS_DIR }, 'face-api models loaded');
}

/**
 * Detect faces in a JPEG/WebP buffer.
 * Caller MUST ensure `loadFaceModels()` has succeeded — throws if not.
 * On detection errors, throws so the caller can abort the photo upload.
 */
export async function detectFaces(buf: Buffer): Promise<Rect[]> {
  if (!faceApiAvailable) {
    throw new Error('detectFaces called before loadFaceModels() — boot order bug');
  }

  const faceapi = await import('face-api.js');
  const canvasMod = await import('canvas' as string);
  const img = await (canvasMod as { loadImage: (b: Buffer) => Promise<unknown> }).loadImage(buf);

  const detections = await faceapi.detectAllFaces(
    img as Parameters<typeof faceapi.detectAllFaces>[0],
    new faceapi.TinyFaceDetectorOptions(),
  );

  return detections.map((d) => ({
    x: Math.floor(d.box.x),
    y: Math.floor(d.box.y),
    width: Math.ceil(d.box.width),
    height: Math.ceil(d.box.height),
  }));
}

/**
 * Apply a heavy Gaussian blur to each rect in the image buffer.
 * Input can be any format sharp accepts; output is the same format (sharp passes through).
 */
export async function blurRegions(buf: Buffer, rects: Rect[]): Promise<Buffer> {
  if (rects.length === 0) return buf;

  const image = sharp(buf);
  const meta = await image.metadata();
  const imgWidth = meta.width ?? 1;
  const imgHeight = meta.height ?? 1;

  // Build composite overlays: for each rect, extract → blur → composite back
  const composites: sharp.OverlayOptions[] = [];

  for (const rect of rects) {
    const safeX = Math.max(0, rect.x);
    const safeY = Math.max(0, rect.y);
    const safeW = Math.min(rect.width, imgWidth - safeX);
    const safeH = Math.min(rect.height, imgHeight - safeY);

    if (safeW <= 0 || safeH <= 0) continue;

    const regionBuf = await sharp(buf)
      .extract({ left: safeX, top: safeY, width: safeW, height: safeH })
      .blur(30)
      .toBuffer();

    composites.push({ input: regionBuf, top: safeY, left: safeX });
  }

  if (composites.length === 0) return buf;

  return sharp(buf).composite(composites).toBuffer();
}

/**
 * Compute the heuristic plate region for a given image size.
 * Bottom-center 60% width × 16% height.
 */
export function plateHeuristicRect(width: number, height: number): Rect {
  return {
    x: Math.floor(width * 0.2),
    y: Math.floor(height * 0.72),
    width: Math.floor(width * 0.6),
    height: Math.floor(height * 0.16),
  };
}
