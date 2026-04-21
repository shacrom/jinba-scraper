import { describe, expect, it } from 'vitest';
import { computeDiff } from '../../src/pipeline/dedupe.js';
import type { ListingInput } from '../../src/types/canonical.js';

const BASE_LISTING: ListingInput = {
  sourceSlug: 'milanuncios',
  externalId: '123',
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
  url: 'https://www.milanuncios.com/coches/test.htm',
  rawHtmlRef: null,
  photos: [],
};

describe('computeDiff', () => {
  it('returns changed=false when all tracked fields are identical', () => {
    const current = {
      price: 8500,
      status: 'active',
      km: 120000,
      locationText: 'Madrid',
    };
    const result = computeDiff(current, BASE_LISTING);
    expect(result.changed).toBe(false);
    expect(result.changedFields).toEqual({});
  });

  it('detects price change', () => {
    const current = { price: 10000, status: 'active', km: 120000, locationText: 'Madrid' };
    const incoming = { ...BASE_LISTING, price: 9500 };
    const result = computeDiff(current, incoming);
    expect(result.changed).toBe(true);
    expect(result.changedFields.price).toEqual({ from: 10000, to: 9500 });
  });

  it('detects km change', () => {
    const current = { price: 8500, status: 'active', km: 100000, locationText: 'Madrid' };
    const result = computeDiff(current, BASE_LISTING);
    expect(result.changed).toBe(true);
    expect(result.changedFields.km).toEqual({ from: 100000, to: 120000 });
  });

  it('detects status change', () => {
    const current = { price: 8500, status: 'sold', km: 120000, locationText: 'Madrid' };
    const result = computeDiff(current, BASE_LISTING);
    expect(result.changed).toBe(true);
    expect(result.changedFields.status).toEqual({ from: 'sold', to: 'active' });
  });

  it('detects location_text change', () => {
    const current = { price: 8500, status: 'active', km: 120000, locationText: 'Barcelona' };
    const result = computeDiff(current, BASE_LISTING);
    expect(result.changed).toBe(true);
    expect(result.changedFields.location_text).toEqual({ from: 'Barcelona', to: 'Madrid' });
  });

  it('detects multiple changes simultaneously', () => {
    const current = { price: 10000, status: 'active', km: 100000, locationText: 'Madrid' };
    const incoming = { ...BASE_LISTING, price: 8500, km: 120000 };
    const result = computeDiff(current, incoming);
    expect(result.changed).toBe(true);
    expect(Object.keys(result.changedFields)).toHaveLength(2);
  });
});
