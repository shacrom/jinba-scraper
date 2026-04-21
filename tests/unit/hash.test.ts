import { describe, expect, it } from 'vitest';
import { anuncioHash, sellerHash } from '../../src/lib/hash.js';

describe('anuncioHash', () => {
  it('is deterministic', () => {
    const a = anuncioHash('milanuncios', '991234567');
    const b = anuncioHash('milanuncios', '991234567');
    expect(a).toBe(b);
  });

  it('produces a 64-char hex string', () => {
    const h = anuncioHash('milanuncios', '991234567');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs for different external IDs', () => {
    const a = anuncioHash('milanuncios', '111111111');
    const b = anuncioHash('milanuncios', '222222222');
    expect(a).not.toBe(b);
  });

  it('differs for different sources', () => {
    const a = anuncioHash('milanuncios', '999');
    const b = anuncioHash('wallapop', '999');
    expect(a).not.toBe(b);
  });
});

describe('sellerHash', () => {
  it('is deterministic', () => {
    expect(sellerHash('seller@example.com')).toBe(sellerHash('seller@example.com'));
  });

  it('differs from anuncioHash for same input', () => {
    expect(sellerHash('milanuncios:999')).not.toBe(anuncioHash('milanuncios', '999'));
  });
});
