import { load } from 'cheerio';
import { fetch as undicicFetch } from 'undici';
import { acquire } from '../lib/rate-limiter.js';
import { isAllowed } from '../lib/robots.js';
import type { ListingInput } from '../types/canonical.js';
import { ListingInputSchema } from '../types/canonical.js';
import { BaseScraper, type FetchResult } from './base.js';

// MAX_PAGES is low-ceiling safety; sources.ts could eventually own this per source.

const BASE_URL = 'https://www.milanuncios.com';

export class MilanunciosScraper extends BaseScraper {
  /**
   * Discovers listing detail URLs from Milanuncios search results.
   * Paginates until no more results (max 10 pages for safety).
   */
  async *discover(): AsyncIterable<string> {
    const { model, source } = this.ctx;
    const baseSearch = new URL(model.searchPath, BASE_URL);
    for (const [k, v] of Object.entries(model.searchParams)) {
      baseSearch.searchParams.set(k, v);
    }

    let page = 1;
    const MAX_PAGES = 10;

    while (page <= MAX_PAGES) {
      baseSearch.searchParams.set('pagina', String(page));
      const url = baseSearch.toString();

      const allowed = await isAllowed(url, source.robotsUrl, source.userAgent);
      if (!allowed) {
        this.ctx.logger.warn({ url }, 'robots.txt disallows search URL — stopping discovery');
        break;
      }

      await acquire(source.slug, { rateLimitMs: source.rateLimitMs, jitterMs: source.jitterMs });

      let html: string;
      try {
        const res = await undicicFetch(url, {
          headers: { 'User-Agent': source.userAgent, Accept: 'text/html' },
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) break;
        html = await res.text();
      } catch {
        break;
      }

      const $ = load(html);
      const links = $('a.ma-AdCardV2-titleLink[href]')
        .map((_i, el) => $(el).attr('href'))
        .get()
        .filter(Boolean) as string[];

      if (links.length === 0) break;

      for (const href of links) {
        const absolute = href.startsWith('http') ? href : `${BASE_URL}${href}`;
        yield absolute;
      }

      page++;
    }
  }

  /**
   * Parses a Milanuncios search-results page and extracts listing stubs.
   * Returns one ListingInput per ad card on the page.
   */
  parse(result: FetchResult): ListingInput[] {
    const { model } = this.ctx;
    const $ = load(result.html);
    const items: ListingInput[] = [];

    $('[data-testid="ma-AdCard"]').each((_i, el) => {
      try {
        const card = $(el);
        const titleLink = card.find('a.ma-AdCardV2-titleLink');
        const href = titleLink.attr('href') ?? '';

        // Extract external ID from URL (last numeric segment before .htm)
        const idMatch = href.match(/[^/]+-(\d{8,})\.htm$/);
        if (!idMatch) return;
        const externalId = idMatch[1];
        if (!externalId) return;

        const priceText = card.find('[data-testid="ad-price"]').text().replace(/[^\d]/g, '');
        const kmText = card.find('.ma-AdCardV2-km').text().replace(/[^\d]/g, '');
        const yearText = card.find('.ma-AdCardV2-year').text().trim();
        const locationText = card.find('.ma-AdCardV2-location').text().trim() || null;

        const photos = card
          .find('img.ma-AdCardV2-photo')
          .map((idx, imgEl) => ({
            position: idx,
            sourceUrl: $(imgEl).attr('src') ?? '',
          }))
          .get()
          .filter((p) => p.sourceUrl);

        const raw = {
          sourceSlug: 'milanuncios',
          externalId,
          makeSlug: model.make,
          modelSlug: model.model,
          generationSlug: model.generation,
          trimSlug: model.trim ?? null,
          year: Number.parseInt(yearText || '2000', 10),
          km: kmText ? Number.parseInt(kmText, 10) : null,
          price: priceText ? Number.parseInt(priceText, 10) : 0,
          currency: 'EUR',
          locationLat: null,
          locationLng: null,
          locationText,
          status: 'active' as const,
          // B3: Milanuncios doesn't expose seller on the search card; use the
          // external_id as a surrogate fingerprint so hashes vary per listing.
          // Future: fetch the detail page and extract the seller profile URL.
          sellerRaw: `milanuncios:${externalId}`,
          url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
          rawHtmlRef: null,
          photos,
        };

        const parsed = ListingInputSchema.safeParse(raw);
        if (parsed.success) {
          items.push(parsed.data);
        } else {
          this.ctx.logger.warn(
            { externalId, issues: parsed.error.flatten() },
            'listing parse failed',
          );
        }
      } catch (err) {
        this.ctx.logger.warn({ err }, 'card parse error');
      }
    });

    return items;
  }
}
