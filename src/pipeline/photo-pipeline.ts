import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import sharp from 'sharp';
import { fetch as undicicFetch } from 'undici';
import { env } from '../config/env.js';
import { blurRegions, detectFaces, plateHeuristicRect } from '../lib/face-models.js';
import type { Database } from '../types/database.js';

const MAX_WIDTH = 1200;
const WEBP_QUALITY = 75;
const DOWNLOAD_TIMEOUT_MS = 30_000;

export interface PhotoJobInput {
  listingId: number;
  position: number;
  sourceUrl: string;
  runId: number;
}

/**
 * Process a single listing photo:
 *   download → resize/WebP → blur faces + plate → upload → mark processed
 *
 * Privacy contract: blur MUST complete before upload — no exceptions.
 * If blur throws, photo is NOT uploaded and privacy_processed_at stays NULL.
 */
export async function processPhoto(
  input: PhotoJobInput,
  deps: { supabase: SupabaseClient<Database>; logger: Logger },
): Promise<void> {
  const { supabase, logger } = deps;
  const log = logger.child({
    listingId: input.listingId,
    position: input.position,
    sourceUrl: input.sourceUrl,
  });

  // 1. Download
  let rawBuf: Buffer;
  try {
    const res = await undicicFetch(input.sourceUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, 'photo download failed — skipping');
      await insertErrorRow(
        supabase,
        input.runId,
        input.sourceUrl,
        'photo_download_failed',
        `HTTP ${res.status}`,
      );
      return;
    }
    rawBuf = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    log.warn({ err }, 'photo download error');
    await insertErrorRow(
      supabase,
      input.runId,
      input.sourceUrl,
      'photo_download_error',
      String(err),
    );
    return;
  }

  // 2. Resize + WebP
  let resizedBuf: Buffer;
  try {
    resizedBuf = await sharp(rawBuf)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (err) {
    log.warn({ err }, 'sharp resize error');
    await insertErrorRow(supabase, input.runId, input.sourceUrl, 'photo_resize_error', String(err));
    return;
  }

  // 3. Face detection
  let faceRects: import('../lib/face-models.js').Rect[];
  try {
    faceRects = await detectFaces(resizedBuf);
  } catch (err) {
    // Blur failure → abort upload (spec R9: blur MUST complete before upload)
    log.error({ err }, 'face detection error — aborting photo upload');
    await insertErrorRow(supabase, input.runId, input.sourceUrl, 'blur_failed', String(err));
    return;
  }

  // 4. Plate heuristic rect
  const meta = await sharp(resizedBuf).metadata();
  const plateRect = plateHeuristicRect(meta.width ?? 0, meta.height ?? 0);

  // 5. Apply blur to ALL regions BEFORE upload
  let processedBuf: Buffer;
  try {
    processedBuf = await blurRegions(resizedBuf, [...faceRects, plateRect]);
  } catch (err) {
    log.error({ err }, 'blur regions error — aborting photo upload');
    await insertErrorRow(supabase, input.runId, input.sourceUrl, 'blur_failed', String(err));
    return;
  }

  // 6. Upload (only after blur confirmed)
  const storagePath = `listings/${input.listingId}/${input.position}.webp`;
  const { error: uploadErr } = await supabase.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, processedBuf, { contentType: 'image/webp', upsert: true });

  if (uploadErr) {
    log.error({ err: uploadErr }, 'storage upload failed');
    await insertErrorRow(
      supabase,
      input.runId,
      input.sourceUrl,
      'photo_upload_error',
      uploadErr.message,
    );
    return;
  }

  // 7. Update listing_photos: set storage_path + privacy_processed_at
  const { error: updateErr } = await supabase
    .from('listing_photos')
    .update({
      storage_path: storagePath,
      width: meta.width ?? null,
      height: meta.height ?? null,
      privacy_processed_at: new Date().toISOString(),
    })
    .eq('listing_id', input.listingId)
    .eq('position', input.position);

  if (updateErr) {
    log.error({ err: updateErr }, 'listing_photos update failed');
    return;
  }

  log.info({ storagePath, faces: faceRects.length }, 'photo processed');
}

async function insertErrorRow(
  supabase: SupabaseClient<Database>,
  runId: number,
  url: string,
  errorType: string,
  message: string,
): Promise<void> {
  await supabase.from('scrape_errors').insert({
    run_id: runId,
    url,
    error_type: errorType,
    message,
  });
}
