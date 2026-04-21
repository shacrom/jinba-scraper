import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_STORAGE_BUCKET: z.string().default('listing-photos'),

  // Redis / BullMQ
  REDIS_URL: z.string().url(),

  // Scraper identity
  USER_AGENT: z
    .string()
    .default('JinbaBot/0.1 (+https://jinba.app/bot; contact=marmibas.dev@gmail.com)'),

  // Observability
  SENTRY_DSN: z.string().url().optional(),

  // Dev helpers
  JINBA_DB_PATH: z.string().optional(),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
