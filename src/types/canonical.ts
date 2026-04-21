import { z } from 'zod';

export const PhotoInputSchema = z.object({
  position: z.number().int().min(0),
  sourceUrl: z.string().url(),
});

export const ListingInputSchema = z.object({
  sourceSlug: z.string().min(1),
  externalId: z.string().min(1),

  // Taxonomy (slugs — resolved to IDs in normalize step)
  makeSlug: z.string().min(1),
  modelSlug: z.string().min(1),
  generationSlug: z.string().min(1),
  trimSlug: z.string().nullable(),

  year: z.number().int().min(1950).max(2100),
  km: z.number().int().min(0).nullable(),
  price: z.number().min(0),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default('EUR'),

  locationLat: z.number().nullable(),
  locationLng: z.number().nullable(),
  locationText: z.string().nullable(),

  status: z.enum(['active', 'sold', 'removed', 'expired']).default('active'),

  sellerRaw: z.string().describe('raw contact string; hashed before persist — never stored as-is'),
  url: z.string().url(),
  rawHtmlRef: z.string().nullable(),

  photos: z.array(PhotoInputSchema).default([]),
});

export type ListingInput = z.infer<typeof ListingInputSchema>;
export type PhotoInput = z.infer<typeof PhotoInputSchema>;

// Resolved taxonomy IDs — produced by normalize step
export interface ResolvedTaxonomy {
  makeId: number;
  modelId: number;
  generationId: number;
  trimId: number | null;
}
