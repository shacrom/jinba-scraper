import { createHash } from 'node:crypto';

// Salt prevents rainbow table attacks on hashed seller identifiers.
// Must stay stable across deploys — any change invalidates existing takedown hashes.
const HASH_SALT = 'jinba-scraper-v1';

/**
 * Computes the canonical anuncio hash used for takedown lookups.
 * Format: sha256(SALT + sourceSlug + ':' + externalId)
 */
export function anuncioHash(sourceSlug: string, externalId: string): string {
  return createHash('sha256')
    .update(`${HASH_SALT + sourceSlug}:${externalId}`)
    .digest('hex');
}

/**
 * Anonymizes a raw seller identifier (phone, nickname, etc.)
 * for storage. The original is never persisted.
 */
export function sellerHash(raw: string): string {
  return createHash('sha256').update(`${HASH_SALT}seller:${raw}`).digest('hex');
}
