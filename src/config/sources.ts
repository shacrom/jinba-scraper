import { env } from './env.js';

export type FetchStrategy = 'cheerio' | 'playwright';

export interface ModelQuery {
  readonly make: string; // slug
  readonly model: string; // slug
  readonly generation: string; // slug
  readonly trim: string | null; // slug (nullable)
  readonly searchPath: string; // path relative to baseUrl
  readonly searchParams: Record<string, string>;
}

export interface SourceConfig {
  readonly slug: 'milanuncios' | 'wallapop';
  readonly displayName: string;
  readonly baseUrl: string;
  readonly fetchStrategy: FetchStrategy;
  readonly rateLimitMs: number; // base interval between requests
  readonly jitterMs: number; // random +/- applied to rateLimitMs
  readonly userAgent: string;
  readonly robotsUrl: string;
  readonly cron: string; // BullMQ repeatable cron pattern
  readonly models: ModelQuery[];
}

const MVP_MODEL_CORES = [
  { make: 'mazda', model: 'mx-5', generation: 'na', trim: '1-6' },
  { make: 'datsun', model: '240z', generation: 's30', trim: 'l24' },
  { make: 'seat', model: 'leon', generation: 'mk1', trim: 'cupra-r' },
  { make: 'volkswagen', model: 'golf', generation: 'mk4', trim: 'r32' },
  { make: 'audi', model: 'a3', generation: '8p', trim: 's3' },
] as const;

function milanunciosModels(): ModelQuery[] {
  return MVP_MODEL_CORES.map((m) => ({
    make: m.make,
    model: m.model,
    generation: m.generation,
    trim: m.trim,
    searchPath: '/motor-de-ocasion/',
    searchParams: {
      s: `${m.make} ${m.model} ${m.generation}`,
      orden: 'relevancia',
    },
  }));
}

function wallapopModels(): ModelQuery[] {
  return MVP_MODEL_CORES.map((m) => ({
    make: m.make,
    model: m.model,
    generation: m.generation,
    trim: m.trim,
    searchPath: '/app/search',
    searchParams: {
      keywords: `${m.make} ${m.model}`,
      category_ids: '100', // motor
    },
  }));
}

export const SOURCES: Record<string, SourceConfig> = {
  milanuncios: {
    slug: 'milanuncios',
    displayName: 'Milanuncios',
    baseUrl: 'https://www.milanuncios.com',
    fetchStrategy: 'cheerio',
    rateLimitMs: 7000,
    // W7: jitter = ±20% of rateLimitMs (spec R4).
    jitterMs: 1400,
    userAgent: env.USER_AGENT,
    robotsUrl: 'https://www.milanuncios.com/robots.txt',
    cron: '0 */4 * * *', // every 4h
    models: milanunciosModels(),
  },
  wallapop: {
    slug: 'wallapop',
    displayName: 'Wallapop',
    baseUrl: 'https://es.wallapop.com',
    fetchStrategy: 'playwright',
    rateLimitMs: 8000,
    // W7: jitter = ±20% of rateLimitMs.
    jitterMs: 1600,
    userAgent: env.USER_AGENT,
    robotsUrl: 'https://es.wallapop.com/robots.txt',
    cron: '30 */6 * * *', // every 6h, offset 30min
    models: wallapopModels(),
  },
};
