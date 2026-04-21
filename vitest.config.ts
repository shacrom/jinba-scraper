import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Stub env so top-level `env.parse` in src/config/env.ts doesn't fail
    // when a test transitively imports a module that touches the env config.
    // Real values come from the CI workflow / local .env.
    env: {
      SUPABASE_URL: 'https://placeholder.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key-at-least-20-chars',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
    // timeout per test
    testTimeout: 30_000,
  },
  resolve: {
    // Allow TS path imports used in test files
    conditions: ['import'],
  },
});
