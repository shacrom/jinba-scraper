import pino from 'pino';
import { env } from '../config/env.js';

export interface LogContext {
  runId?: number;
  sourceSlug?: string;
  listingExternalId?: string;
  jobId?: string;
}

const rootLogger = pino({
  level: env.LOG_LEVEL as pino.LevelWithSilent,
  base: {
    service: 'jinba-scraper',
    env: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  // C1/C2: redact potentially sensitive fields before they leak to log sinks.
  // Paths follow pino's dot-notation; `*` wildcards match any intermediate key.
  redact: {
    paths: [
      '*.headers.authorization',
      '*.headers.cookie',
      '*.headers["set-cookie"]',
      '*.req.headers.authorization',
      '*.req.headers.cookie',
      '*.config.salt',
      '*.SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'env.SUPABASE_SERVICE_ROLE_KEY',
      '*.SENTRY_DSN',
      '*.REDIS_URL',
    ],
    censor: '[REDACTED]',
    remove: false,
  },
});

export function createLogger(ctx: LogContext): pino.Logger {
  return rootLogger.child(ctx);
}

// Default logger for startup/shutdown use
export const logger = rootLogger;
