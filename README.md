# jinba-scraper

> ## Status: archived (reference only) — as of 2026-04-23
>
> Jinba price data is now ingested via a paid scraping provider (Apify) through the `/api/cron/sync-prices` endpoint in [`jinba-web`](https://github.com/shacrom/jinba-web). Apify's pre-built Milanuncios and Wallapop actors handle proxy rotation, anti-bot evasion, and legal indemnification — removing the self-hosted scraper's ongoing maintenance cost.
>
> **This repository is retained for reference only.** The Railway deployment is scheduled for shutdown after Apify's first successful ingest run lands in production.
>
> Rationale — engram `sdd/data-sources-strategy` (project: `jinba-web`):
> - Self-hosted scraper blocked on Milanuncios 403 (CloudFront) + Wallapop `__NEXT_DATA__` parser breakage for weeks.
> - Side-project budget ($100/mo cap) covers Apify's Starter tier with headroom.
> - Single-repo ingest (Vercel cron in jinba-web) reduces infra surface.
>
> For the replacement pipeline, see:
> - `jinba-web/src/pages/api/cron/sync-prices.ts` — ingest orchestrator
> - `jinba-web/src/lib/ingest/*` — Apify client + normalize + upsert modules
> - `jinba-db/supabase/migrations/20260429000000_ingested_price_points.sql` — staging table + MV extension
>
> Contact: marmibas.dev@gmail.com

---

## Historical documentation

The material below describes the scraper as it existed before deprecation. It is preserved so the architecture and policy choices remain discoverable; none of it reflects current operational practice.

---

Worker Node.js/TypeScript que extrae anuncios de Milanuncios y Wallapop, normaliza al schema canónico de [jinba-db](https://github.com/shacrom/jinba-db), procesa imágenes (blur de caras y matrículas) y persiste en Supabase.

---

## Architecture

```
BullMQ Scheduler (cron)
  └─ Worker (concurrency=1 per source)
       └─ Pipeline: discover → fetch → parse → normalize → takedown-check
                    → dedupe → persist → photo-pipeline → telemetry
```

Sources: **Milanuncios** (undici + Cheerio) · **Wallapop** (Playwright/Chromium).

---

## Prerequisites

- Node 24+
- Docker + docker compose (for local dev)
- A Supabase project with schema from [jinba-db](https://github.com/shacrom/jinba-db) applied
- An Upstash Redis instance (or local Redis via Docker)

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/shacrom/jinba-scraper.git
cd jinba-scraper
npm install
```

### 2. Configure environment

```bash
cp env.example .env
# Edit .env with real values (see Env Vars table below)
```

> **Note**: The env file is named `env.example` (without leading dot) for sandbox compatibility.
> Copy it to `.env` for local use. The `.env` file is gitignored.

### 3. Sync DB types (optional — shim is included)

```bash
JINBA_DB_PATH=../jinba-db npm run types:sync
```

### 4. Start with Docker Compose

```bash
docker compose up
```

This starts:
- **redis** — Redis 7 Alpine (port 6379)
- **worker** — jinba-scraper (port 3000, depends on Redis)

### 5. Verify

```bash
curl http://localhost:3000/health
# → {"status":"ok","uptime":...,"timestamp":"..."}
```

Check logs for BullMQ repeatable job registration per source.

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SUPABASE_URL` | Yes | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | — | Service role key (server-only, never expose) |
| `SUPABASE_STORAGE_BUCKET` | No | `listing-photos` | Storage bucket for blurred photos |
| `REDIS_URL` | Yes | — | Redis connection URL (e.g. `redis://localhost:6379`) |
| `USER_AGENT` | No | `JinbaBot/0.1 (+https://jinba.app/bot; contact=marmibas.dev@gmail.com)` | HTTP User-Agent for ethical scraping |
| `SENTRY_DSN` | No | — | Sentry DSN for error tracking |
| `LOG_LEVEL` | No | `info` | Pino log level (trace/debug/info/warn/error/fatal) |
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `3000` | Health server port |
| `JINBA_DB_PATH` | No | — | Local path to jinba-db repo (for `npm run types:sync`) |

---

## Railway Deployment

### 1. Create project

```bash
railway init
railway link
```

### 2. Add Redis

In Railway dashboard: **Add Plugin → Upstash Redis** (free tier, 10k ops/day — enough for MVP).
Copy the `REDIS_URL` from the plugin.

### 3. Set environment variables

In Railway dashboard → Variables, add all required vars from the table above.

### 4. Configure GitHub Actions secret

In GitHub repo → Settings → Secrets and variables → Actions:
- `RAILWAY_TOKEN` — your Railway API token (Railway → Account → Tokens)

### 5. Deploy

```bash
git push origin main
# CI runs lint+typecheck+test, then deploy-railway.yml deploys to Railway
```

Or manually:

```bash
npm i -g @railway/cli
railway up --service jinba-scraper --ci
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start worker (requires `npm run build` first) |
| `npm run dev` | Watch mode via `tsx` (no build needed) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run lint` | Biome lint check |
| `npm run format` | Biome auto-format |
| `npm test` | Run vitest |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run types:sync` | Sync `src/types/database.ts` from jinba-db |
| `npm run dlq:list` | List failed jobs in the DLQ |
| `npm run dlq:replay` | Re-enqueue all DLQ jobs (manual operator action) |

---

## DB Types Sync

`src/types/database.ts` is a hand-rolled shim for F1. To sync from the real jinba-db schema:

```bash
# Local (if jinba-db is checked out next to jinba-scraper)
JINBA_DB_PATH=../jinba-db npm run types:sync

# Or let the script clone from GitHub (public repo)
npm run types:sync
```

CI runs `npm run types:sync || true` before `tsc` — the `|| true` ensures the build doesn't fail
if the upstream repo is temporarily unavailable (shim is already committed as fallback).

---

## Legal & Rate-Limit Policy

This scraper is built with ethical scraping principles:

- **Rate limit**: 1 request every 7–10s (Milanuncios) or 8–12s (Wallapop), randomized ±jitter
- **Concurrency**: ≤1 concurrent request per source
- **User-Agent**: Identified bot UA with contact information
- **robots.txt**: Fetched and respected; paths disallowed by `User-agent: *` are silently skipped
- **Retries**: 3 attempts with exponential backoff (1m/5m/15m), then manual DLQ
- **Privacy**: Faces and licence plates are blurred BEFORE any upload; `privacy_processed_at IS NULL` photos are invisible to anonymous clients (DB RLS)
- **PII ban**: No phone numbers, email addresses, or seller names are stored — only an anonymous sha256 hash

If you are a site operator and want to opt out, contact: marmibas.dev@gmail.com

---

## Architecture Decisions

Key decisions documented in `sdd/scraper-mvp-f1/design` (engram):

| Decision | Choice | Rationale |
|----------|--------|-----------|
| HTTP client | undici | Native Node 24, fastest, keep-alive |
| Browser | playwright-core + Chromium only | 400MB smaller than full bundle |
| Face blur | face-api.js tiny_face_detector | Self-hosted weights, CPU-friendly |
| Plate blur | Heuristic bottom-center mask (F1) | ML plate detector deferred to F2 |
| Queue | BullMQ 5 | Repeatable jobs, retries, DLQ patterns |
| Types | Local shim + CI sync from jinba-db | No submodule, clean boundary |
