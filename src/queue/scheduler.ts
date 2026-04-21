import { SOURCES } from '../config/sources.js';
import { logger } from '../lib/logger.js';
import { queues } from './queues.js';

/**
 * Register one BullMQ repeatable job per (source, model) pair.
 * Called at boot. Idempotent — BullMQ dedupes by jobId.
 */
export async function scheduleAll(): Promise<void> {
  for (const source of Object.values(SOURCES)) {
    const queue = queues.get(source.slug);
    if (!queue) throw new Error(`queue missing for source: ${source.slug}`);

    for (const model of source.models) {
      const jobId = `${source.slug}:${model.make}-${model.model}-${model.generation}`;

      await queue.add(
        'discover',
        { sourceSlug: source.slug, model },
        {
          jobId,
          repeat: {
            pattern: source.cron,
          },
          removeOnComplete: { age: 86_400, count: 50 },
          removeOnFail: { age: 7 * 86_400 },
          attempts: 3,
          // Custom backoff sequence 1m / 5m / 15m (see workers.ts backoffStrategy).
          backoff: { type: 'custom' },
        },
      );

      logger.info(
        { jobId, cron: source.cron, sourceSlug: source.slug },
        'repeatable job registered',
      );
    }
  }
}
