import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { NormalizeError, normalize } from '../../src/pipeline/normalize.js';

const logger = pino({ level: 'silent' });

const VALID_RAW = {
  sourceSlug: 'milanuncios',
  externalId: '991234567',
  makeSlug: 'mazda',
  modelSlug: 'mx-5',
  generationSlug: 'na',
  trimSlug: null,
  year: 1990,
  km: 120000,
  price: 8500,
  currency: 'EUR',
  locationLat: null,
  locationLng: null,
  locationText: 'Madrid',
  status: 'active',
  sellerRaw: 'anon',
  url: 'https://www.milanuncios.com/coches/mazda-991234567.htm',
  rawHtmlRef: null,
  photos: [],
};

describe('normalize', () => {
  it('returns a valid ListingInput for valid raw data', () => {
    const result = normalize(VALID_RAW, logger);
    expect(result.externalId).toBe('991234567');
    expect(result.price).toBe(8500);
    expect(result.currency).toBe('EUR');
  });

  it('strips unrecognized fields', () => {
    const raw = { ...VALID_RAW, unknownField: 'should be stripped' };
    const result = normalize(raw, logger);
    expect((result as Record<string, unknown>).unknownField).toBeUndefined();
  });

  it('throws NormalizeError on missing required fields', () => {
    const raw = { ...VALID_RAW, externalId: undefined };
    expect(() => normalize(raw, logger)).toThrow(NormalizeError);
  });

  it('throws NormalizeError on invalid year', () => {
    const raw = { ...VALID_RAW, year: 1800 };
    expect(() => normalize(raw, logger)).toThrow(NormalizeError);
  });

  it('defaults status to active if not provided', () => {
    const raw = { ...VALID_RAW, status: undefined };
    const result = normalize(raw, logger);
    expect(result.status).toBe('active');
  });

  it('allows trimSlug to be null', () => {
    const raw = { ...VALID_RAW, trimSlug: null };
    const result = normalize(raw, logger);
    expect(result.trimSlug).toBeNull();
  });

  it('allows km to be null', () => {
    const raw = { ...VALID_RAW, km: null };
    const result = normalize(raw, logger);
    expect(result.km).toBeNull();
  });

  it('rejects invalid currency format', () => {
    const raw = { ...VALID_RAW, currency: 'euros' }; // must be 3 uppercase letters
    expect(() => normalize(raw, logger)).toThrow(NormalizeError);
  });
});
