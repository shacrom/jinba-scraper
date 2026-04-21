import type { Logger } from 'pino';
import type { ModelQuery, SourceConfig } from '../config/sources.js';
import type { ListingInput } from '../types/canonical.js';

export interface ScraperContext {
  readonly source: SourceConfig;
  readonly model: ModelQuery;
  readonly logger: Logger;
  readonly runId: number;
}

export interface FetchResult {
  readonly url: string;
  readonly html: string;
  readonly status: number;
  readonly fetchedAt: Date;
}

/**
 * Abstract base for all source adapters.
 *
 * Lifecycle per BullMQ job:
 *   1. discover() — yields detail-page URLs from search results
 *   2. The pipeline fetches each URL via `src/pipeline/fetch.ts` (central
 *      rate-limiter + robots + User-Agent + 429/503 handling).
 *   3. parse(result) — extract ListingInput[] from HTML
 *
 * B1: per-adapter `fetch()` was removed — it was dead code (never called)
 * and every scraper benefits from the shared fetch pipeline.
 */
export abstract class BaseScraper {
  constructor(protected readonly ctx: ScraperContext) {}

  /**
   * Yields canonical listing URLs discovered from search result pages.
   * Implementations should paginate as needed.
   */
  abstract discover(): AsyncIterable<string>;

  /**
   * Parses an HTML page into zero or more ListingInput objects.
   * A failure on one item must NOT throw — return [] for that item.
   */
  abstract parse(result: FetchResult): ListingInput[];
}
