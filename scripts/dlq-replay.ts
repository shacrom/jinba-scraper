/**
 * scripts/dlq-replay.ts — DLQ management CLI
 *
 * Usage:
 *   npm run dlq:list             — list jobs in the DLQ
 *   npm run dlq:replay           — re-enqueue all DLQ jobs to their original queues
 *   npm run dlq:replay -- <id>   — re-enqueue a specific job by ID
 *
 * Requires REDIS_URL env var.
 */

import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

// Load env manually (no Zod fail-fast here — CLI is resilient)
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const DLQ_NAME = 'jinba-scraper-dlq';

const args = process.argv.slice(2);
const isList = args.includes('--list');
const replayId = args.find((a) => !a.startsWith('--'));

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const dlq = new Queue(DLQ_NAME, { connection });

async function main(): Promise<void> {
  const jobs = await dlq.getFailed(0, 100);

  if (jobs.length === 0) {
    console.log('DLQ is empty.');
    return;
  }

  if (isList) {
    console.log(`\nDLQ: ${DLQ_NAME} — ${jobs.length} job(s)\n`);
    for (const job of jobs) {
      const data = job.data as { originalQueue?: string; failedAt?: string; errorMessage?: string };
      console.log(
        `  [${job.id}] queue=${data.originalQueue ?? '?'} failedAt=${data.failedAt ?? '?'} err=${data.errorMessage ?? '?'}`,
      );
    }
    console.log('');
    return;
  }

  const toReplay = replayId ? jobs.filter((j) => j.id === replayId) : jobs;

  if (toReplay.length === 0) {
    console.log(`No job with id ${replayId} found in DLQ.`);
    return;
  }

  for (const job of toReplay) {
    const data = job.data as {
      originalQueue?: string;
      originalData?: Record<string, unknown>;
      originalJobId?: string;
    };
    const targetQueueName = data.originalQueue ?? 'milanuncios';
    const targetQueue = new Queue(targetQueueName, { connection });

    await targetQueue.add('discover', data.originalData ?? {}, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
    });

    await job.remove();
    console.log(`[replayed] ${job.id} → ${targetQueueName}`);
  }

  console.log(`\n${toReplay.length} job(s) replayed.`);
}

main()
  .catch((err) => {
    console.error('dlq-replay error:', err);
    process.exit(1);
  })
  .finally(() => connection.disconnect());
