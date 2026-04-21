import { load } from 'cheerio';
import { isAllowed } from '../lib/robots.js';
import type { ListingInput } from '../types/canonical.js';
import { ListingInputSchema } from '../types/canonical.js';
import { BaseScraper, type FetchResult } from './base.js';

const BASE_URL = 'https://es.wallapop.com';

interface WallapopUser {
  id?: string;
}

interface WallapopItem {
  id: string;
  title?: string;
  description?: string;
  price?: { amount: number; currency: string };
  location?: { city?: string; latitude?: number; longitude?: number };
  images?: Array<{ original: string }>;
  web_slug?: string;
  // B3: user.id is the stable seller fingerprint exposed by Wallapop's
  // __NEXT_DATA__ pageProps. Falls back to item id if absent.
  user?: WallapopUser;
}

interface WallapopPageProps {
  items?: WallapopItem[];
}

export class WallapopScraper extends BaseScraper {
  /**
   * Wallapop search yields results via JSON in __NEXT_DATA__.
   * We treat each search page as one "discovery" pass.
   *
   * B1: per-adapter fetch() removed — the pipeline uses `fetchUrl` from
   * `src/pipeline/fetch.ts` for all sources (centralized rate-limit +
   * robots + 429/503 handling).
   */
  async *discover(): AsyncIterable<string> {
    const { model, source } = this.ctx;
    const searchUrl = new URL(model.searchPath, BASE_URL);
    for (const [k, v] of Object.entries(model.searchParams)) {
      searchUrl.searchParams.set(k, v);
    }

    const allowed = await isAllowed(searchUrl.toString(), source.robotsUrl, source.userAgent);
    if (!allowed) {
      this.ctx.logger.warn({ url: searchUrl.toString() }, 'robots.txt disallows Wallapop URL');
      return;
    }

    // For Wallapop we yield the search URL directly; parse() extracts items from __NEXT_DATA__.
    yield searchUrl.toString();
  }

  /**
   * Parses __NEXT_DATA__ JSON embedded in the Wallapop SPA response.
   *
   * **B5: throws** when `__NEXT_DATA__` is absent or malformed. The pipeline
   * catches the throw and records a `scrape_errors` row with `parse_empty`
   * so DOM drift is visible in telemetry — previously this path returned
   * `[]` silently and the run looked healthy.
   */
  parse(result: FetchResult): ListingInput[] {
    const { model } = this.ctx;
    const $ = load(result.html);

    const nextDataRaw = $('#__NEXT_DATA__').text().trim();
    if (!nextDataRaw) {
      throw new Error('__NEXT_DATA__ missing — wallapop layout drifted (empty)');
    }

    let pageProps: WallapopPageProps;
    try {
      const parsed = JSON.parse(nextDataRaw) as { props?: { pageProps?: WallapopPageProps } };
      pageProps = parsed.props?.pageProps ?? {};
    } catch (err) {
      throw new Error(`__NEXT_DATA__ JSON parse failed (empty): ${String(err)}`);
    }

    const wallapopItems = pageProps.items ?? [];
    const listings: ListingInput[] = [];

    for (const item of wallapopItems) {
      try {
        const photos = (item.images ?? []).map((img, idx) => ({
          position: idx,
          sourceUrl: img.original,
        }));

        // B3: prefer the stable per-seller id; fall back to per-listing id.
        const sellerRaw = item.user?.id ? `wallapop:user:${item.user.id}` : `wallapop:${item.id}`;

        const raw = {
          sourceSlug: 'wallapop',
          externalId: item.id,
          makeSlug: model.make,
          modelSlug: model.model,
          generationSlug: model.generation,
          trimSlug: model.trim ?? null,
          // Year often needs to be extracted from title — use 2000 as fallback for MVP.
          year: extractYear(item.title ?? '') ?? 2000,
          km: extractKm(item.description ?? ''),
          price: item.price?.amount ?? 0,
          currency: item.price?.currency ?? 'EUR',
          locationLat: item.location?.latitude ?? null,
          locationLng: item.location?.longitude ?? null,
          locationText: item.location?.city ?? null,
          status: 'active' as const,
          sellerRaw,
          url: item.web_slug ? `${BASE_URL}/item/${item.web_slug}` : `${BASE_URL}/item/${item.id}`,
          rawHtmlRef: null,
          photos,
        };

        const parsedListing = ListingInputSchema.safeParse(raw);
        if (parsedListing.success) {
          listings.push(parsedListing.data);
        } else {
          this.ctx.logger.warn(
            { id: item.id, issues: parsedListing.error.flatten() },
            'wallapop item parse failed',
          );
        }
      } catch (err) {
        this.ctx.logger.warn({ itemId: item.id, err }, 'wallapop item error');
      }
    }

    return listings;
  }
}

function extractYear(text: string): number | null {
  const m = text.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  return m?.[1] ? Number.parseInt(m[1], 10) : null;
}

function extractKm(text: string): number | null {
  const m = text.match(/(\d[\d.]*)[\s]*km/i);
  if (!m || !m[1]) return null;
  const num = Number.parseInt(m[1].replace(/\./g, ''), 10);
  return Number.isNaN(num) ? null : num;
}
