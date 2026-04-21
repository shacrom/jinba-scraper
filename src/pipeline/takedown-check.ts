import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.js';

const BLOCKING_STATUSES = ['approved', 'resolved'] as const;

/**
 * Returns true if the listing should be skipped due to a takedown
 * with status 'approved' or 'resolved'.
 *
 * **B9: fails CLOSED.** If the takedowns query errors, we throw so BullMQ
 * retries the job. A transient Supabase failure must NEVER let us publish
 * content that was legally requested to be removed.
 */
export async function isTakenDown(
  supabase: SupabaseClient<Database>,
  anuncioHashValue: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('takedowns')
    .select('id')
    .eq('anuncio_hash', anuncioHashValue)
    .in('status', [...BLOCKING_STATUSES])
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`takedown check failed (fail-closed): ${error.message}`);
  }

  return data !== null;
}
