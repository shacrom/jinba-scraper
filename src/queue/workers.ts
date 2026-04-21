import { type Job, Worker } from 'bullmq';
import { SOURCES } from '../config/sources.js';
import { createLogger } from '../lib/logger.js';
import { runPipeline } from '../pipeline/index.js';
import { connection } from './connection.js';
import { moveToDlq } from './dlq.js';

const workers: Worker[] = [];

export async function startWorkers(): Promise<void> {
  for (const source of Object.values(SOURCES)) {
    const log = createLogger({ sourceSlug: source.slug });

    const worker = new Worker(
      source.slug,
      async (job: Job) => {
        log.info({ jobId: job.id, jobName: job.name }, 'job started');
        await runPipeline(job.data, job.id ?? 'unknown');
        log.info({ jobId: job.id }, 'job completed');
      },
      {
        connection,
        concurrency: 1, // Strict: ≤1 concurrent job per source
        autorun: true,
        settings: {
          // Matches spec R10: 1m / 5m / 15m on attempts 1 / 2 / 3.
          backoffStrategy: (attemptsMade: number): number => {
            const delays = [60_000, 300_000, 900_000];
            return delays[attemptsMade - 1] ?? 900_000;
          },
        },
      },
    );

    worker.on('completed', (job) => {
      log.debug({ jobId: job.id }, 'job completed event');
    });

    worker.on('failed', async (job, err) => {
      if (!job) return;
      log.warn({ jobId: job.id, err: err.message, attempt: job.attemptsMade }, 'job failed');

      // Move to DLQ after all retries exhausted
      if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
        await moveToDlq(job, err);
      }
    });

    worker.on('stalled', (jobId) => {
      log.warn({ jobId }, 'job stalled');
    });

    workers.push(worker);
    log.info({ concurrency: 1 }, 'worker started');
  }
}

export async function stopWorkers(): Promise<void> {
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
}
