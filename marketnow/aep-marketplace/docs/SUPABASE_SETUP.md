# MarketNow — Supabase + Upstash Setup Guide (Phase 1)

This guide walks you through migrating MarketNow's persistence layer from
the GitHub `_data/` directory (used as a database) to **Supabase
PostgreSQL** for durability and **Upstash Redis** for distributed rate
limiting. Both services have free tiers that cover MarketNow's current
traffic.

| Component                | Free tier covers                        | Used for                                  |
| ------------------------ | --------------------------------------- | ----------------------------------------- |
| Supabase (Postgres)      | 500 MB DB, 50k MAU, paused after 7 days | ATC cards, mandates, quarantine, licenses |
| Upstash Redis            | 10k commands/day, 256 MB                | Distributed rate limiting                 |

---

## 1. Create a Supabase account (free)

1. Go to <https://supabase.com>.
2. Click **Start your project** → sign in with GitHub (recommended) or email.
3. Accept the terms of service.

> **Free tier note:** Supabase pauses projects after 7 days of inactivity.
> A paused project can be un-paused from the dashboard with one click.
> MarketNow's daily traffic will keep the project active.

## 2. Create a project

1. From the dashboard, click **New project**.
2. Choose an organization (your personal org is fine).
3. Fill in:
   - **Name:** `marketnow-prod` (or `marketnow-dev` for staging).
   - **Database password:** generate a strong password and store it in a
     password manager. You won't need it for day-to-day API use (we use
     the service role key, not the postgres password) but you'll need it
     for direct DB access / SQL shell.
   - **Region:** pick the same region as your Vercel deployment
     (`iad1` — Washington DC for most MarketNow traffic).
   - **Pricing plan:** Free.
4. Click **Create new project** and wait ~2 minutes for provisioning.

## 3. Get the URL + anon key + service_role key

Once the project is ready:

1. In the left sidebar, click the **Project Settings** gear icon → **API**.
2. You'll see three values you need:

   | Value                    | Env var                      | Where it's used                |
   | ------------------------ | ---------------------------- | ------------------------------ |
   | **Project URL**          | `SUPABASE_URL`               | All clients (anon + service)  |
   | **anon public key**      | `SUPABASE_ANON_KEY`          | Public reads (subject to RLS) |
   | **service_role secret**  | `SUPABASE_SERVICE_KEY`       | Server-side writes            |

> ⚠️ **NEVER** put `SUPABASE_SERVICE_KEY` in the browser bundle. It bypasses
> RLS and can do anything to your data. Server-side only.

## 4. Run the schema in the SQL Editor

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `db/schema.sql` from this repo, copy its entire contents, paste into
   the editor.
4. Click **Run** (or `Ctrl+Enter`).
5. You should see "Success. No rows returned." in the bottom panel.
6. Verify by running this in the same editor:

   ```sql
   \dt                              -- list tables (8 should appear)
   SELECT * FROM pg_policies;       -- 2 policies: atc_cards_public_read, quarantine_public_read
   ```

   Expected tables: `atc_cards`, `mandates`, `quarantine_decisions`,
   `licenses`, `trust_decisions`, `rate_limit_counters`.

## 5. Run the migration script

The script `scripts/migrate-to-supabase.mjs` reads the existing JSON files
from `_data/{atc,mandates,quarantine_decisions}/` (falling back to the
`public/api/` mirror if `_data/` doesn't exist locally) and upserts them
into Supabase. It is idempotent — re-running it after fixing bad data
simply overwrites the rows.

### 5.1 Install the dependency (one-time)

```bash
cd marketnow/aep-marketplace
npm install @supabase/supabase-js
```

### 5.2 Run a dry run first

```bash
# from marketnow/aep-marketplace/
SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
SUPABASE_SERVICE_KEY=eyJhbGci... \
MIGRATION_DRY_RUN=1 \
node scripts/migrate-to-supabase.mjs
```

You should see output like:

```
=========================================
 MarketNow — Phase 1 migration to Supabase
=========================================
  dry_run    : true
  batch_size : 100
  repo_root  : /home/z/my-project/marketnow/aep-marketplace

— ATC cards —
  [atc] using public/api/atc (55 files)
  prepared 55 rows
  dry-run sample: ATC-2026-3999783 active

— Mandates —
  [mandates] no source files found — skipping
  prepared 0 rows

— Quarantine decisions —
  [quarantine] using public/_data/quarantine_decisions (3 files)
  prepared 3 rows
  dry-run sample: qd_2026_08_15_001 quarantine
```

### 5.3 Run for real

```bash
SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
SUPABASE_SERVICE_KEY=eyJhbGci... \
node scripts/migrate-to-supabase.mjs
```

### 5.4 Verify in Supabase

In the dashboard, go to **Table Editor** → `atc_cards` → you should see
all 55+ cards. Same for `quarantine_decisions`.

## 6. Create an Upstash account (free)

1. Go to <https://upstash.com>.
2. Click **Log In** → sign in with GitHub or Google.
3. Accept the terms.

> **Free tier note:** Upstash free tier = 10,000 commands/day and 256 MB
> storage. Each rate-limit check is 1 pipeline (≈2 commands). So 10k checks
> = ~5k daily requests allowed — more than enough for MarketNow's current
> traffic. Beyond that, upgrade to Pay-As-You-Go ($0.20 per 100k requests).

## 7. Create a Redis database

1. From the Upstash dashboard, click **Create Database**.
2. Fill in:
   - **Name:** `marketnow-rate-limit`
   - **Primary Region:** same as your Vercel + Supabase region (`us-east-1`
     corresponds to Vercel `iad1`).
   - **TLS:** enabled (default).
   - **Type:** Regional (Multi-zone is more expensive and unnecessary here).
3. Click **Create**.

## 8. Get the REST URL + token

1. On the database detail page, click the **REST API** tab (NOT the
   standard Redis tab — we want the HTTP/REST API for serverless use).
2. Copy these two values:

   | Value                     | Env var                          |
   | ------------------------- | -------------------------------- |
   | **UPSTASH_REDIS_REST_URL**   | `UPSTASH_REDIS_REST_URL`     |
   | **UPSTASH_REDIS_REST_TOKEN** | `UPSTASH_REDIS_REST_TOKEN`   |

   (The Upstash dashboard shows them in a copy-paste-ready format under
   "Endpoint" and "REST API Token".)

## 9. Add all env vars to Vercel

In your Vercel project settings → **Environment Variables**, add:

| Key                         | Value                                  | Environments            |
| --------------------------- | -------------------------------------- | ----------------------- |
| `SUPABASE_URL`              | `https://YOUR-PROJECT.supabase.co`     | Production + Preview    |
| `SUPABASE_ANON_KEY`         | `eyJhbGci...` (anon public)           | Production + Preview    |
| `SUPABASE_SERVICE_KEY`      | `eyJhbGci...` (service_role secret)   | Production + Preview    |
| `UPSTASH_REDIS_REST_URL`   | `https://xxx-xxx-xxx.upstash.io`       | Production + Preview    |
| `UPSTASH_REDIS_REST_TOKEN` | `xxxx-xxxx-xxxx`                       | Production + Preview    |

> **Optional debugging flags** (don't enable in production):
> - `SUPABASE_DEBUG=1` — logs Supabase soft-failures to stderr.
> - `RATE_LIMIT_DEBUG=1` — logs every rate-limit decision.

### 9.1 Install runtime dependencies

Add to `package.json` dependencies (one-time):

```bash
npm install @supabase/supabase-js @upstash/redis
```

Or add manually:

```json
"dependencies": {
  "@supabase/supabase-js": "^2.45.0",
  "@upstash/redis": "^1.34.0"
}
```

### 9.2 Local development

Create `.env.local` (already in `.gitignore`):

```bash
# .env.local — local dev only
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxx
```

Vite / Vercel dev automatically loads `.env.local`. The migration script
needs the env vars exported in your shell (since it runs in Node, not
Vite).

## 10. Verify the migration end-to-end

Once the env vars are set and the app is redeployed:

1. **Supabase health check:**
   ```bash
   curl https://marketnow.site/api/health
   ```
   The response should include `"supabase": { "ok": true, "configured": true }`.

2. **ATC read test:**
   ```bash
   curl 'https://YOUR-PROJECT.supabase.co/rest/v1/atc_cards?select=card_id,agent_id,status&limit=5' \
     -H 'apikey: YOUR_ANON_KEY'
   ```
   Should return the first 5 migrated cards.

3. **Redis ping:**
   ```bash
   curl -X POST 'https://xxx.upstash.io/ping' \
     -H "Authorization: Bearer YOUR_REST_TOKEN"
   ```
   Should return `["PONG"]`.

## 11. Phase 2 — what's next?

Phase 1 ships the **schema + migration + client libs**. Phase 2 will:

- Swap the existing GitHub-Contents-API read paths in `api/atc.js` and
  `api/mandates.js` to use `lib/supabase-client.mjs` instead.
- Replace the in-memory `checkRateLimit` in `lib/rate-limit.mjs` with the
  distributed version from `lib/rate-limit-redis.mjs`.
- Wire `/api/trust` audit records into `recordTrustDecision()`.
- Add Supabase real-time subscriptions for cache invalidation.

The migration is intentionally additive: nothing breaks if Supabase / Upstash
env vars are absent. The old paths keep working until Phase 2 lands.

---

## Troubleshooting

### "RLS policy violation" on INSERT from the browser

The browser must NOT use the service role key. Use `SUPABASE_ANON_KEY` for
client-side reads, and route all writes through your own API endpoints
(which use `SUPABASE_SERVICE_KEY` server-side).

### Migration script: "permission denied for table atc_cards"

You're using the anon key instead of the service_role key. Check
`SUPABASE_SERVICE_KEY` — it must start with `eyJhbGciOiJIUzI1NiIsInR5cCI6...`
and the JWT payload's `role` claim must be `service_role`.

### Upstash error: "fetch failed"

The Upstash REST API uses HTTPS on port 443 — make sure your network /
proxy allows outbound HTTPS to `*.upstash.io`. Vercel allows this by
default.

### Migration inserts 0 rows but you see files in the directory

The migration looks for `_data/atc/` first, then `public/api/atc/`. If
both exist but `_data/atc/` is empty (no `.json` files), the fallback
will kick in. Run with `MIGRATION_DRY_RUN=1` to see which directory is
selected.

---

**Document version:** Phase 1 / 2026-08-19
