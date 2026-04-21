/**
 * Pipeline orchestrator — called by BullMQ worker per job.
 *
 * Linear flow:
 *   discover → fetch → parse → normalize → takedown-check → dedupe → persist → photo-pipeline
 *
 * B4: counters are accumulated locally and flushed in a single UPDATE at run end.
 * B8: `items_found` is incremented per parsed item, not per discovered URL.
 * C3: photo pipeline promises are drained via `Promise.allSettled` before the run finalizes.
 * C7: `rate_limit_ms` is hydrated from the DB so operators can tune without a redeploy.
 */
import type { ModelQuery } from '../config/sources.js';
import { SOURCES } from '../config/sources.js';
import { anuncioHash } from '../lib/hash.js';
import { createLogger } from '../lib/logger.js';
import { getSupabaseClient } from '../storage/supabase.js';
import { computeDiff } from './dedupe.js';
import { fetchUrl } from './fetch.js';
import {
  NormalizeError,
  TaxonomyResolutionError,
  normalize,
  resolveTaxonomy,
} from './normalize.js';
import { parsePage } from './parse.js';
import { persistListing } from './persist.js';
import { processPhoto } from './photo-pipeline.js';
import { isTakenDown } from './takedown-check.js';

export interface PipelineJobData {
  sourceSlug: string;
  model: ModelQuery;
}

export async function runPipeline(data: PipelineJobData, jobId: string): Promise<void> {
  const { sourceSlug, model } = data;
  const source = SOURCES[sourceSlug];
  if (!source) throw new Error(`Unknown source: ${sourceSlug}`);

  const supabase = getSupabaseClient();
  const log = createLogger({ sourceSlug, jobId });

  // 0. Resolve source row (C7: hydrate rate_limit_ms from DB).
  const { data: sourceRow, error: sourceErr } = await supabase
    .from('sources')
    .select('id, rate_limit_ms')
    .eq('slug', sourceSlug)
    .single();

  if (sourceErr || !sourceRow) {
    log.error({ err: sourceErr, sourceSlug }, 'source not found in DB');
    throw new Error(
      `Cannot start run: source "${sourceSlug}" is not registered in the sources table.`,
    );
  }
  const sourceId = sourceRow.id;
  const rateLimitMs = sourceRow.rate_limit_ms ?? source.rateLimitMs;

  // 1. Create scrape_run row.
  const { data: runRow, error: runErr } = await supabase
    .from('scrape_runs')
    .insert({
      source_id: sourceId,
      items_found: 0,
      items_new: 0,
      items_updated: 0,
      items_errored: 0,
    })
    .select('id')
    .single();

  if (runErr || !runRow) {
    log.error({ err: runErr }, 'failed to create scrape_runs row');
    throw new Error('Cannot start run: scrape_runs insert failed');
  }

  const runId = runRow.id;
  log.info({ runId, sourceSlug, model }, 'pipeline started');

  // 2. Build scraper.
  const { MilanunciosScraper } = await import('../scrapers/milanuncios.js');
  const { WallapopScraper } = await import('../scrapers/wallapop.js');

  const ctx = { source, model, logger: log, runId };
  const scraper =
    sourceSlug === 'milanuncios' ? new MilanunciosScraper(ctx) : new WallapopScraper(ctx);

  const fetchOpts = {
    sourceSlug,
    strategy: source.fetchStrategy,
    userAgent: source.userAgent,
    robotsUrl: source.robotsUrl,
    rateLimitMs,
    jitterMs: source.jitterMs,
    logger: log,
  };

  const startedAt = Date.now();

  // B4: local counters accumulate; single UPDATE at run end.
  let itemsFound = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;
  let itemsErrored = 0;
  // A1: items_skipped is not a DB column — local counter logged at run end.
  let skippedCount = 0;

  // C3: photo pipeline promises collected so SIGTERM can drain them cleanly.
  const photoPromises: Promise<unknown>[] = [];

  // 3. Discover + process each URL.
  for await (const url of scraper.discover()) {
    const fetchResult = await fetchUrl(url, fetchOpts);
    if (!fetchResult) {
      // fetchUrl either swallowed a non-rate-limit error (return null) or the
      // URL was blocked by robots/takedown. Count as errored only if it was
      // a real failure — the current fetchUrl returns null for all of them.
      itemsErrored++;
      await supabase.from('scrape_errors').insert({
        run_id: runId,
        url,
        error_type: 'fetch_failed',
        message: 'fetchUrl returned null (see upstream logs)',
      });
      continue;
    }

    // Parse (B5: parse errors land in scrape_errors).
    const { items, parseError } = parsePage(scraper, fetchResult, log);
    if (parseError) {
      itemsErrored++;
      await supabase.from('scrape_errors').insert({
        run_id: runId,
        url,
        error_type: parseError.type,
        message: parseError.message,
      });
    }

    for (const rawItem of items) {
      // B8: count one per parsed item.
      itemsFound++;
      try {
        const item = normalize(rawItem, log);

        const hash = anuncioHash(sourceSlug, item.externalId);
        const takenDown = await isTakenDown(supabase, hash);
        if (takenDown) {
          log.debug({ externalId: item.externalId }, 'listing skipped — takedown');
          skippedCount++;
          continue;
        }

        const taxonomy = await resolveTaxonomy(supabase, item);

        const { data: currentRow } = await supabase
          .from('listings')
          .select('price, status, km, location_text')
          .eq('source_id', sourceId)
          .eq('external_id', item.externalId)
          .maybeSingle();

        const isNew = currentRow === null;
        const diffResult = isNew
          ? { changed: true, changedFields: {} }
          : computeDiff(
              {
                price: currentRow.price,
                status: currentRow.status,
                km: currentRow.km,
                locationText: currentRow.location_text,
              },
              item,
            );

        const { listingId } = await persistListing(supabase, sourceId, item, taxonomy, diffResult, {
          runId,
          isNew,
          logger: log,
        });

        if (isNew) itemsNew++;
        else itemsUpdated++;

        // C3: collect promises instead of fire-and-forget.
        for (const photo of item.photos) {
          photoPromises.push(
            processPhoto(
              { listingId, position: photo.position, sourceUrl: photo.sourceUrl, runId },
              { supabase, logger: log },
            ).catch((err) => log.warn({ err, listingId }, 'photo pipeline error')),
          );
        }
      } catch (err) {
        if (err instanceof NormalizeError || err instanceof TaxonomyResolutionError) {
          log.warn({ err: err.message }, 'item skipped');
          await supabase.from('scrape_errors').insert({
            run_id: runId,
            url,
            error_type: err instanceof NormalizeError ? 'normalize' : 'taxonomy_miss',
            message: err.message,
          });
          itemsErrored++;
        } else {
          log.error({ err }, 'unexpected item error');
          itemsErrored++;
        }
      }
    }
  }

  // C3: drain photo pipeline before finalizing the run.
  await Promise.allSettled(photoPromises);

  // 4. Finalize scrape_run — single UPDATE flushes all counters (B4).
  const durationMs = Date.now() - startedAt;
  await supabase
    .from('scrape_runs')
    .update({
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      items_found: itemsFound,
      items_new: itemsNew,
      items_updated: itemsUpdated,
      items_errored: itemsErrored,
    })
    .eq('id', runId);

  log.info(
    { runId, durationMs, itemsFound, itemsNew, itemsUpdated, itemsErrored, skippedCount },
    'pipeline completed',
  );
}
