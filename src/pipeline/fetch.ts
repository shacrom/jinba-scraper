import type { Logger } from 'pino';
import { fetch as undicicFetch } from 'undici';
import type { FetchStrategy } from '../config/sources.js';
import { acquire, penalize } from '../lib/rate-limiter.js';
import { isAllowed } from '../lib/robots.js';
import { captureException } from '../lib/sentry.js';
import type { FetchResult } from '../scrapers/base.js';

const FETCH_TIMEOUT_MS = 30_000;

export interface FetchOptions {
  sourceSlug: string;
  strategy: FetchStrategy;
  userAgent: string;
  robotsUrl: string;
  rateLimitMs: number;
  jitterMs: number;
  logger: Logger;
}

/**
 * Fetch a single URL using the configured strategy (cheerio = undici, playwright = shared browser).
 * Respects robots.txt, rate-limiter, and User-Agent policy.
 */
export async function fetchUrl(url: string, opts: FetchOptions): Promise<FetchResult | null> {
  const { sourceSlug, strategy, userAgent, robotsUrl, rateLimitMs, jitterMs, logger } = opts;

  // robots.txt check — skip disallowed paths
  const allowed = await isAllowed(url, robotsUrl, userAgent);
  if (!allowed) {
    logger.warn({ url, sourceSlug }, 'robots.txt disallows URL — skipping');
    return null;
  }

  // Acquire rate-limited slot
  await acquire(sourceSlug, { rateLimitMs, jitterMs });

  if (strategy === 'cheerio') {
    return fetchWithUndici(url, userAgent, logger, sourceSlug);
  }

  // Playwright path
  return fetchWithPlaywright(url, userAgent, logger, sourceSlug);
}

/**
 * A4: Check an HTTP status for rate-limit signals, penalize the bucket,
 * and throw so BullMQ retries the job with the configured backoff.
 */
function maybeHandleRateLimit(
  status: number,
  retryAfter: string | null,
  sourceSlug: string,
  url: string,
  logger: Logger,
): void {
  if (status !== 429 && status !== 503) return;
  handleRateLimit(sourceSlug, retryAfter);
  const err = new Error(`rate limited: HTTP ${status}`);
  logger.warn({ url, status, sourceSlug, retryAfter }, 'rate limited — backing off');
  captureException(err, { url, status });
  throw err;
}

async function fetchWithUndici(
  url: string,
  userAgent: string,
  logger: Logger,
  sourceSlug: string,
): Promise<FetchResult | null> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  try {
    const res = await undicicFetch(url, {
      headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml' },
      signal,
    });

    // A4: throw on 429/503 so BullMQ retries with exp backoff; rate limiter is penalized.
    maybeHandleRateLimit(res.status, res.headers.get('retry-after'), sourceSlug, url, logger);

    const html = await res.text();
    return { url, html, status: res.status, fetchedAt: new Date() };
  } catch (err) {
    logger.warn({ url, err }, 'undici fetch error');
    captureException(err, { url });
    // Propagate rate-limit errors so BullMQ retries; swallow others.
    if (err instanceof Error && err.message.startsWith('rate limited:')) throw err;
    return null;
  }
}

async function fetchWithPlaywright(
  url: string,
  userAgent: string,
  logger: Logger,
  sourceSlug: string,
): Promise<FetchResult | null> {
  // Playwright browser is launched lazily via a shared singleton
  try {
    const { getSharedBrowser } = await import('./playwright-browser.js');
    const browser = await getSharedBrowser();
    const ctx = await browser.newContext({ userAgent });
    const page = await ctx.newPage();

    try {
      const response = await page.goto(url, {
        timeout: FETCH_TIMEOUT_MS,
        waitUntil: 'networkidle',
      });
      const status = response?.status() ?? 200;

      // A4: throw on 429/503 so BullMQ retries with exp backoff.
      maybeHandleRateLimit(
        status,
        response?.headerValue('retry-after') ? null : null,
        sourceSlug,
        url,
        logger,
      );

      const html = await page.content();
      return { url, html, status, fetchedAt: new Date() };
    } finally {
      await ctx.close();
    }
  } catch (err) {
    logger.warn({ url, err }, 'playwright fetch error');
    captureException(err, { url });
    if (err instanceof Error && err.message.startsWith('rate limited:')) throw err;
    return null;
  }
}

/** Handle 429/503: apply penalty to rate-limiter */
export function handleRateLimit(sourceSlug: string, retryAfterHeader: string | null): void {
  const retryAfterSec = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : 60;
  const penaltyMs = Number.isNaN(retryAfterSec) ? 60_000 : retryAfterSec * 1000;
  penalize(sourceSlug, penaltyMs);
}
