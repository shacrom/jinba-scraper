/**
 * scripts/sync-db-types.ts
 *
 * Copies types/database.ts from jinba-db into src/types/database.ts.
 *
 * Usage:
 *   npm run types:sync
 *   JINBA_DB_PATH=../jinba-db npm run types:sync  (local dev, skips git clone)
 *
 * In CI (jinba-db is public):
 *   The script clones the repo to a temp dir and copies the file.
 *   If jinba-db is private, set JINBA_DB_TOKEN env var.
 *
 * If the source file is missing (e.g. during F1 bootstrap), exits 0
 * and keeps the existing shim — never fails the build.
 */

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const JINBA_DB_REPO = 'https://github.com/shacrom/jinba-db.git';
const TARGET = 'src/types/database.ts';

function main(): void {
  const localPath = process.env.JINBA_DB_PATH;

  let srcFile: string;

  if (localPath) {
    srcFile = join(localPath, 'types/database.ts');
    console.log(`[sync-db-types] using local path: ${srcFile}`);
  } else {
    const token = process.env.JINBA_DB_TOKEN;
    const repoUrl = token
      ? JINBA_DB_REPO.replace('https://', `https://oauth2:${token}@`)
      : JINBA_DB_REPO;

    const dir = join(tmpdir(), `jinba-db-sync-${Date.now()}`);
    console.log(`[sync-db-types] cloning jinba-db to ${dir}...`);

    try {
      execSync(`git clone --depth=1 --quiet ${repoUrl} ${dir}`, { stdio: 'inherit' });
    } catch {
      console.warn('[sync-db-types] git clone failed — keeping existing shim');
      process.exit(0);
    }

    srcFile = join(dir, 'types/database.ts');
  }

  if (!existsSync(srcFile)) {
    console.warn(`[sync-db-types] source file not found at ${srcFile} — keeping existing shim`);
    process.exit(0);
  }

  // A3: refuse to overwrite the working shim with an upstream "empty schema"
  // placeholder. Two equivalent patterns exist:
  //   - Hand-written shim: `Tables: Record<string, never>`
  //   - Supabase CLI gen-types against empty DB: `Tables: { [_ in never]: never }`
  // Copying either would wipe the local hand-typed shim and make `tsc` fail
  // with ~80 errors ("Property X does not exist on type never").
  const srcContent = readFileSync(srcFile, 'utf8');
  const hasHandWrittenPlaceholder = srcContent.includes('Record<string, never>');
  const hasSupabaseEmptyPlaceholder =
    srcContent.includes('Tables: {\n      [_ in never]: never') ||
    srcContent.includes('Tables: { [_ in never]: never');
  if (hasHandWrittenPlaceholder || hasSupabaseEmptyPlaceholder) {
    console.warn(
      `[sync-db-types] upstream file at ${srcFile} has no tables defined — keeping local shim. Apply jinba-db migrations to the Supabase cloud project (\`supabase db push\`) and run \`npm run types:gen\` there first.`,
    );
    process.exit(0);
  }

  mkdirSync('src/types', { recursive: true });
  cpSync(srcFile, TARGET);
  console.log(`[sync-db-types] synced ${srcFile} → ${TARGET}`);
}

main();
