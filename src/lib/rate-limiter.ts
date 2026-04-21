/**
 * Per-source token bucket rate limiter with configurable jitter.
 *
 * Guarantees ≤1 concurrent request per source slug by serializing
 * acquires with a promise chain. Inter-request delay = rateLimitMs ± jitterMs.
 */

interface BucketState {
  /** Promise that resolves when the slot opens */
  tail: Promise<void>;
  /** Timestamp of the last grant (ms) */
  lastGrantAt: number;
  /** Extra penalty added after 429/503 (ms) */
  penaltyMs: number;
}

const buckets = new Map<string, BucketState>();

function jitter(base: number, jitterRange: number): number {
  return base + (Math.random() * 2 - 1) * jitterRange;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

/**
 * Acquire a rate-limited slot for the given source.
 * Resolves after the appropriate delay has elapsed.
 */
export function acquire(
  slug: string,
  opts: { rateLimitMs: number; jitterMs: number },
): Promise<void> {
  let bucket = buckets.get(slug);
  if (!bucket) {
    bucket = { tail: Promise.resolve(), lastGrantAt: 0, penaltyMs: 0 };
    buckets.set(slug, bucket);
  }

  const current = bucket;
  const next = current.tail.then(async () => {
    const waitMs = jitter(opts.rateLimitMs + current.penaltyMs, opts.jitterMs);
    const elapsed = Date.now() - current.lastGrantAt;
    const remaining = waitMs - elapsed;
    if (remaining > 0) {
      await delay(remaining);
    }
    current.lastGrantAt = Date.now();
    current.penaltyMs = 0; // reset penalty after normal grant
  });

  current.tail = next;
  return next;
}

/**
 * Apply a penalty delay for the given source (called after 429/503).
 * The next acquire will add penaltyMs on top of the normal rate limit.
 */
export function penalize(slug: string, penaltyMs: number): void {
  const bucket = buckets.get(slug);
  if (bucket) {
    bucket.penaltyMs = Math.max(bucket.penaltyMs, penaltyMs);
  }
}

/** Reset a bucket (for testing) */
export function resetBucket(slug: string): void {
  buckets.delete(slug);
}
