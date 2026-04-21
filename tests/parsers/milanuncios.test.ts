import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { SOURCES } from '../../src/config/sources.js';
import type { FetchResult } from '../../src/scrapers/base.js';
import { MilanunciosScraper } from '../../src/scrapers/milanuncios.js';

const logger = pino({ level: 'silent' });
const fixtureHtml = readFileSync(
  join(import.meta.dirname, '../fixtures/milanuncios/sample-1.html'),
  'utf-8',
);

const source = SOURCES.milanuncios!;
const model = source.models[0]!; // mazda mx-5 na

const ctx = { source, model, logger, runId: 1 };
const scraper = new MilanunciosScraper(ctx);

const fetchResult: FetchResult = {
  url: 'https://www.milanuncios.com/motor-de-ocasion/?s=mazda+mx-5+na',
  html: fixtureHtml,
  status: 200,
  fetchedAt: new Date('2026-04-20T00:00:00Z'),
};

describe('MilanunciosScraper.parse', () => {
  it('parses the fixture and returns 2 listings', () => {
    const items = scraper.parse(fetchResult);
    expect(items).toHaveLength(2);
  });

  it('first listing has expected fields', () => {
    const items = scraper.parse(fetchResult);
    const first = items[0]!;
    expect(first.sourceSlug).toBe('milanuncios');
    expect(first.externalId).toBe('991234567');
    expect(first.price).toBe(8500);
    expect(first.km).toBe(120000);
    expect(first.year).toBe(1990);
    expect(first.locationText).toBe('Madrid');
    expect(first.photos).toHaveLength(1);
    expect(first.photos[0]?.sourceUrl).toContain('991234567');
  });

  it('second listing has expected photo count', () => {
    const items = scraper.parse(fetchResult);
    const second = items[1]!;
    expect(second.photos).toHaveLength(2);
  });

  it('all listings have sourceSlug milanuncios', () => {
    const items = scraper.parse(fetchResult);
    expect(items.every((i) => i.sourceSlug === 'milanuncios')).toBe(true);
  });

  it('matches snapshot', () => {
    const items = scraper.parse(fetchResult);
    // Strip non-deterministic fields for snapshot
    const normalized = items.map(({ url, ...rest }) => ({ ...rest, url: '[url]' }));
    expect(normalized).toMatchSnapshot();
  });
});
