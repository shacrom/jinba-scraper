import type { Job, UnrecoverableError } from 'bullmq';
import { logger } from '../lib/logger.js';
import { DLQ_NAME, queues } from './queues.js';

/**
 * Move a failed job to the DLQ after all retry attempts are exhausted.
 * Called from the Worker `failed` event handler.
 *
 * DLQ does NOT auto-re-enqueue. Operator must use scripts/dlq-replay.ts.
 */
export async function moveToDlq(job: Job, err: Error): Promise<void> {
  const dlq = queues.get(DLQ_NAME);
  if (!dlq) {
    logger.error('DLQ queue not found — cannot move failed job');
    return;
  }

  await dlq.add(
    'failed',
    {
      originalQueue: job.queueName,
      originalJobId: job.id,
      originalData: job.data,
      failedAt: new Date().toISOString(),
      errorMessage: err.message,
      errorStack: err.stack,
    },
    {
      removeOnComplete: false,
      removeOnFail: false,
      // No retries on DLQ — manual only
      attempts: 1,
    },
  );

  logger.warn({ jobId: job.id, queue: job.queueName, err: err.message }, 'job moved to DLQ');
}

export type { UnrecoverableError };
