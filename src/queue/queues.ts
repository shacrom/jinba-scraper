import { Queue } from 'bullmq';
import { SOURCES } from '../config/sources.js';
import { connection } from './connection.js';

export const DLQ_NAME = 'jinba-scraper-dlq';

// One queue per source slug + the DLQ
const _queues = new Map<string, Queue>();

for (const source of Object.values(SOURCES)) {
  _queues.set(
    source.slug,
    new Queue(source.slug, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        // Custom backoff sequence 1m / 5m / 15m (see workers.ts backoffStrategy).
        backoff: { type: 'custom' },
        removeOnComplete: { age: 86_400, count: 100 },
        removeOnFail: { age: 7 * 86_400 },
      },
    }),
  );
}

_queues.set(DLQ_NAME, new Queue(DLQ_NAME, { connection }));

export const queues: ReadonlyMap<string, Queue> = _queues;
