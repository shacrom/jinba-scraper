import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'pino';
import { sellerHash } from '../lib/hash.js';
import type { ListingInput } from '../types/canonical.js';
import type { ResolvedTaxonomy } from '../types/canonical.js';
import type { Database, Json } from '../types/database.js';
import type { DiffResult } from './dedupe.js';

export interface PersistResult {
  listingId: number;
  isNew: boolean;
  snapshotInserted: boolean;
}

/**
 * Upsert a listing into the database and handle snapshot + photo rows.
 * Idempotent: ON CONFLICT (source_id, external_id) → update.
 *
 * B2/HI3: `first_seen_at` is NEVER included in the payload — the DB's
 * `default now()` handles initial insert, and the listings-immutable
 * trigger in jinba-db rejects any UPDATE that tries to change it.
 * This is the belt + braces against accidental first_seen_at overwrites.
 *
 * Counters (items_new / items_updated) are accumulated in the pipeline
 * orchestrator (`runPipeline`) and flushed at run end (B4) — `persistListing`
 * no longer calls `incrementRunCounter`.
 */
export async function persistListing(
  supabase: SupabaseClient<Database>,
  sourceId: number,
  input: ListingInput,
  taxonomy: ResolvedTaxonomy,
  diffResult: DiffResult,
  opts: { runId: number; isNew: boolean; logger: Logger },
): Promise<PersistResult> {
  const { isNew, logger } = opts;

  // Build the insert/upsert payload. first_seen_at intentionally omitted.
  const listingPayload = {
    source_id: sourceId,
    external_id: input.externalId,
    make_id: taxonomy.makeId,
    model_id: taxonomy.modelId,
    generation_id: taxonomy.generationId,
    trim_id: taxonomy.trimId,
    year: input.year,
    km: input.km,
    price: input.price,
    currency: input.currency,
    location_lat: input.locationLat,
    location_lng: input.locationLng,
    location_text: input.locationText,
    status: input.status,
    seller_hash: sellerHash(input.sellerRaw),
    url: input.url,
    raw_html_ref: input.rawHtmlRef,
    last_seen_at: new Date().toISOString(),
  };

  // UPSERT listings
  const { data: listingRow, error: upsertErr } = await supabase
    .from('listings')
    .upsert(listingPayload, { onConflict: 'source_id,external_id' })
    .select('id')
    .single();

  if (upsertErr || !listingRow) {
    throw new Error(`listings upsert failed: ${upsertErr?.message}`);
  }

  const listingId = listingRow.id;

  // Insert snapshot if any tracked field changed
  let snapshotInserted = false;
  if (isNew || diffResult.changed) {
    // A2: listing_snapshots schema holds only (price, status, changed_fields).
    // km + location_text diffs live inside `changed_fields` JSONB.
    const { error: snapErr } = await supabase.from('listing_snapshots').insert({
      listing_id: listingId,
      price: input.price,
      status: input.status,
      // The DB column is JSONB. Our DiffResult shape `{ col: { from, to } }`
      // is JSON-compatible at runtime; cast through unknown because TS can't
      // prove `unknown`-valued leaves are JSON.
      changed_fields: diffResult.changedFields as unknown as Json,
    });

    if (snapErr) {
      logger.warn({ err: snapErr, listingId }, 'snapshot insert failed');
    } else {
      snapshotInserted = true;
    }
  }

  // Insert photo rows (pending — storage_path=null, privacy_processed_at=null).
  for (const photo of input.photos) {
    await supabase.from('listing_photos').upsert(
      {
        listing_id: listingId,
        position: photo.position,
        source_url: photo.sourceUrl,
        storage_path: null,
        privacy_processed_at: null,
      },
      { onConflict: 'listing_id,position' },
    );
  }

  logger.debug({ listingId, isNew, snapshotInserted }, 'listing persisted');

  return { listingId, isNew, snapshotInserted };
}

/**
 * Atomic per-field increment of a `scrape_runs` counter.
 *
 * Retained as a utility for cases where the pipeline needs to bump a single
 * counter out-of-band (e.g. tests). The happy path in `runPipeline` keeps
 * counters local and flushes once (B4) — this function is not on the hot path.
 *
 * **C4: throws if the run row is missing** (previously swallowed silently,
 * which hid orphaned-run bugs).
 */
export async function incrementRunCounter(
  supabase: SupabaseClient<Database>,
  runId: number,
  // A1: items_skipped is NOT a DB column — track locally in the pipeline if needed.
  field: 'items_new' | 'items_updated' | 'items_errored' | 'items_found',
): Promise<void> {
  const { data, error } = await supabase.from('scrape_runs').select(field).eq('id', runId).single();

  if (error || !data) {
    throw new Error(
      `incrementRunCounter(${field}): scrape_runs row ${runId} not found — ${error?.message ?? 'null row'}`,
    );
  }

  const current = (data as Record<string, number>)[field] ?? 0;
  const next = current + 1;

  type UpdatePayload = Database['public']['Tables']['scrape_runs']['Update'];
  let payload: UpdatePayload;
  if (field === 'items_new') payload = { items_new: next };
  else if (field === 'items_updated') payload = { items_updated: next };
  else if (field === 'items_errored') payload = { items_errored: next };
  else payload = { items_found: next };

  await supabase.from('scrape_runs').update(payload).eq('id', runId);
}
