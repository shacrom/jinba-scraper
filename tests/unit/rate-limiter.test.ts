import { afterEach, describe, expect, it } from 'vitest';
import { acquire, resetBucket } from '../../src/lib/rate-limiter.js';

describe('rate-limiter', () => {
  afterEach(() => {
    resetBucket('test-source');
  });

  it('first acquire resolves immediately (no previous grant)', async () => {
    const before = Date.now();
    await acquire('test-source', { rateLimitMs: 5000, jitterMs: 0 });
    const elapsed = Date.now() - before;
    // First acquire should be fast (< 200ms)
    expect(elapsed).toBeLessThan(200);
  });

  it('second acquire is delayed by approximately rateLimitMs', async () => {
    // Use a small rate limit for test speed
    const rateLimitMs = 100;
    const jitterMs = 0;

    await acquire('test-source', { rateLimitMs, jitterMs });

    const before = Date.now();
    await acquire('test-source', { rateLimitMs, jitterMs });
    const elapsed = Date.now() - before;

    // Should wait close to rateLimitMs (allow 50ms tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(rateLimitMs - 10);
    expect(elapsed).toBeLessThan(rateLimitMs + 200);
  }, 10_000);

  it('serializes concurrent acquires', async () => {
    const rateLimitMs = 50;
    const timestamps: number[] = [];

    const jobs = [0, 1, 2].map(async () => {
      await acquire('test-source', { rateLimitMs, jitterMs: 0 });
      timestamps.push(Date.now());
    });

    await Promise.all(jobs);

    // Each acquire should be at least rateLimitMs after the previous
    for (let i = 1; i < timestamps.length; i++) {
      const gap = (timestamps[i] ?? 0) - (timestamps[i - 1] ?? 0);
      expect(gap).toBeGreaterThanOrEqual(rateLimitMs - 15);
    }
  }, 10_000);
});
