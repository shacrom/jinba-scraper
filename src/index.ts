#!/usr/bin/env node
/**
 * jinba-scraper — boot sequence
 *
 * Boot order:
 *   1. Parse env (fail-fast on missing vars)
 *   2. Init logger
 *   3. Init Sentry (no-op if SENTRY_DSN missing)
 *   4. Load face-api models (fail-fast — privacy-first)
 *   5. Start BullMQ workers
 *   6. Register repeatable jobs
 *   7. Start health server
 *   8. Register SIGTERM/SIGINT for graceful shutdown
 */

import { env } from './config/env.js';
import { loadFaceModels } from './lib/face-models.js';
import { startHealthServer, stopHealthServer } from './lib/health.js';
import { logger } from './lib/logger.js';
import { captureException, initSentry } from './lib/sentry.js';
import { closeSharedBrowser } from './pipeline/playwright-browser.js';
import { connection } from './queue/connection.js';
import { scheduleAll } from './queue/scheduler.js';
import { startWorkers, stopWorkers } from './queue/workers.js';

let shuttingDown = false;

async function main(): Promise<void> {
  logger.info({ env: env.NODE_ENV, port: env.PORT }, 'jinba-scraper boot');

  // 3. Sentry
  initSentry();

  // 4. Face models — refuse to start without blur capability
  try {
    await loadFaceModels();
  } catch (err) {
    logger.fatal({ err }, 'face-api model load failed — cannot start (privacy-first policy)');
    process.exit(1);
  }

  // 5. Workers
  await startWorkers();

  // 6. Scheduler
  await scheduleAll();

  // 7. Health server
  startHealthServer(env.PORT);

  logger.info('jinba-scraper ready');
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'graceful shutdown started');

  try {
    stopHealthServer();
    await stopWorkers();
    await closeSharedBrowser();
    await connection.quit();
    logger.info('graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'shutdown error');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  captureException(err);
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  captureException(reason);
  logger.fatal({ reason }, 'unhandledRejection');
  process.exit(1);
});

main().catch((err) => {
  captureException(err);
  logger.fatal({ err }, 'boot failed');
  process.exit(1);
});
