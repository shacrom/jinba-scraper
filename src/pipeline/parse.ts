import type { Logger } from 'pino';
import type { BaseScraper, FetchResult } from '../scrapers/base.js';
import type { ListingInput } from '../types/canonical.js';

/**
 * A structured error a scraper's `parse()` can signal to the pipeline.
 * B5: Wallapop "empty __NEXT_DATA__" is the canonical use case — the
 * caller inserts a row in `scrape_errors` with this type/message so
 * DOM drift is observable in telemetry.
 */
export interface ParseError {
  type: 'parse_empty' | 'parse_failed';
  message: string;
}

export interface ParseOutcome {
  items: ListingInput[];
  parseError: ParseError | null;
}

/**
 * Orchestrates scraper.parse() with per-item error isolation.
 * Returns successfully parsed items + an optional structured error.
 */
export function parsePage(scraper: BaseScraper, result: FetchResult, logger: Logger): ParseOutcome {
  try {
    const items = scraper.parse(result);
    return { items, parseError: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ url: result.url, message }, 'parse error');
    // Throwing a PageEmptyError from a scraper signals "expected layout missing";
    // other errors are treated as generic parse failures.
    const type = message.toLowerCase().includes('empty') ? 'parse_empty' : 'parse_failed';
    return { items: [], parseError: { type, message } };
  }
}
