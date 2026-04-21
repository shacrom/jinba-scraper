import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { SOURCES } from '../../src/config/sources.js';
import type { FetchResult } from '../../src/scrapers/base.js';
import { WallapopScraper } from '../../src/scrapers/wallapop.js';

const logger = pino({ level: 'silent' });
const fixtureHtml = readFileSync(
  join(import.meta.dirname, '../fixtures/wallapop/sample-1.html'),
  'utf-8',
);

const source = SOURCES.wallapop!;
const model = source.models[0]!; // mazda mx-5 na

const ctx = { source, model, logger, runId: 1 };
const scraper = new WallapopScraper(ctx);

const fetchResult: FetchResult = {
  url: 'https://es.wallapop.com/app/search?keywords=mazda+mx-5',
  html: fixtureHtml,
  status: 200,
  fetchedAt: new Date('2026-04-20T00:00:00Z'),
};

describe('WallapopScraper.parse', () => {
  it('parses __NEXT_DATA__ and returns 2 listings', () => {
    const items = scraper.parse(fetchResult);
    expect(items).toHaveLength(2);
  });

  it('first listing has correct external ID and price', () => {
    const items = scraper.parse(fetchResult);
    const first = items[0]!;
    expect(first.sourceSlug).toBe('wallapop');
    expect(first.externalId).toBe('w5a8b2c1d3e4');
    expect(first.price).toBe(9200);
    expect(first.currency).toBe('EUR');
    expect(first.locationText).toBe('Valencia');
    expect(first.locationLat).toBeCloseTo(39.4699, 3);
    expect(first.locationLng).toBeCloseTo(-0.3763, 3);
  });

  it('second listing parses km from description', () => {
    const items = scraper.parse(fetchResult);
    const second = items[1]!;
    expect(second.km).toBe(140000);
  });

  it('photos are correctly extracted', () => {
    const items = scraper.parse(fetchResult);
    expect(items[0]?.photos).toHaveLength(1);
    expect(items[1]?.photos).toHaveLength(2);
  });

  it('throws (parse_empty) when __NEXT_DATA__ is absent — B5 telemetry hook', () => {
    const emptyResult: FetchResult = {
      ...fetchResult,
      html: '<html><body><p>No data</p></body></html>',
    };
    expect(() => scraper.parse(emptyResult)).toThrow(/__NEXT_DATA__ missing/);
  });

  it('matches snapshot', () => {
    const items = scraper.parse(fetchResult);
    const normalized = items.map(({ url, ...rest }) => ({ ...rest, url: '[url]' }));
    expect(normalized).toMatchSnapshot();
  });
});
