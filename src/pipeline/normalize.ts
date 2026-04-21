import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import type { ZodError } from 'zod';
import {
  type ListingInput,
  ListingInputSchema,
  type ResolvedTaxonomy,
} from '../types/canonical.js';
import type { Database } from '../types/database.js';

// In-memory cache keyed by "make:model:generation:trim"
const taxonomyCache = new Map<string, ResolvedTaxonomy>();

export class NormalizeError extends Error {
  constructor(public readonly zodError: ZodError) {
    super('ListingInput normalize failed');
  }
}

export class TaxonomyResolutionError extends Error {
  constructor(
    public readonly slug: string,
    public readonly field: string,
  ) {
    super(`Cannot resolve ${field}: '${slug}'`);
  }
}

/**
 * Parse raw scraped data into a validated ListingInput.
 * Throws NormalizeError on validation failure.
 */
export function normalize(raw: unknown, logger: Logger): ListingInput {
  const parsed = ListingInputSchema.safeParse(raw);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.flatten() }, 'normalize failed');
    throw new NormalizeError(parsed.error);
  }
  return parsed.data;
}

/**
 * Resolve taxonomy slugs to IDs against the database.
 * - Unknown generation_id → throws TaxonomyResolutionError (item skipped)
 * - Unknown trim_id → returns null (not an error)
 */
export async function resolveTaxonomy(
  supabase: SupabaseClient<Database>,
  input: ListingInput,
): Promise<ResolvedTaxonomy> {
  const cacheKey = `${input.makeSlug}:${input.modelSlug}:${input.generationSlug}:${input.trimSlug ?? ''}`;
  const cached = taxonomyCache.get(cacheKey);
  if (cached) return cached;

  // Resolve make
  const { data: makeRow, error: makeErr } = await supabase
    .from('makes')
    .select('id')
    .eq('slug', input.makeSlug)
    .single();
  if (makeErr || !makeRow) throw new TaxonomyResolutionError(input.makeSlug, 'make');

  // Resolve model
  const { data: modelRow, error: modelErr } = await supabase
    .from('models')
    .select('id')
    .eq('slug', input.modelSlug)
    .eq('make_id', makeRow.id)
    .single();
  if (modelErr || !modelRow) throw new TaxonomyResolutionError(input.modelSlug, 'model');

  // Resolve generation (required)
  const { data: genRow, error: genErr } = await supabase
    .from('generations')
    .select('id')
    .eq('slug', input.generationSlug)
    .eq('model_id', modelRow.id)
    .single();
  if (genErr || !genRow) throw new TaxonomyResolutionError(input.generationSlug, 'generation');

  // Resolve trim (optional — null on miss)
  let trimId: number | null = null;
  if (input.trimSlug) {
    const { data: trimRow } = await supabase
      .from('trims')
      .select('id')
      .eq('slug', input.trimSlug)
      .eq('generation_id', genRow.id)
      .single();
    trimId = trimRow?.id ?? null;
  }

  const result: ResolvedTaxonomy = {
    makeId: makeRow.id,
    modelId: modelRow.id,
    generationId: genRow.id,
    trimId,
  };

  taxonomyCache.set(cacheKey, result);
  return result;
}

/** Clear the taxonomy cache (for testing) */
export function clearTaxonomyCache(): void {
  taxonomyCache.clear();
}
