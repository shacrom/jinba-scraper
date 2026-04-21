import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import type { Database } from '../types/database.js';

let _client: SupabaseClient<Database> | null = null;

/**
 * Returns a singleton Supabase service_role client typed against the
 * Database interface. Uses service_role key — never expose to frontend.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!_client) {
    _client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _client;
}

// Named export alias for convenience
export const db = {
  get client(): SupabaseClient<Database> {
    return getSupabaseClient();
  },
};
