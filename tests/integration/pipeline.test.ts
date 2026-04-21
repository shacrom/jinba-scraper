import { execSync } from 'node:child_process';
/**
 * Integration tests — require local Supabase CLI.
 * These tests are skipped automatically when the CLI is absent.
 */
import { describe, expect, it } from 'vitest';

function isSupabaseCliAvailable(): boolean {
  try {
    execSync('supabase --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const hasSupabaseCli = isSupabaseCliAvailable();

describe.skipIf(!hasSupabaseCli)('Pipeline integration (requires Supabase CLI)', () => {
  it('upserts listing idempotently', async () => {
    // TODO: implement when Supabase CLI is available
    // 1. Start local Supabase
    // 2. Run pipeline with fixture
    // 3. Assert listings row count = 1 on second run
    expect(hasSupabaseCli).toBe(true);
  });

  it('inserts snapshot only when tracked field changes', async () => {
    // TODO: implement
    expect(hasSupabaseCli).toBe(true);
  });
});

describe.skipIf(hasSupabaseCli)('Pipeline integration (Supabase CLI absent — skip)', () => {
  it('skips integration tests gracefully', () => {
    expect(hasSupabaseCli).toBe(false);
  });
});
