# Mirror Platform 3 — Deno Deploy

> **Role:** Free serverless fallback for the Vercel Edge / API routes.
> **Cost:** Free tier: 1M requests/month, 100 GiB-hours/month egress.
> **URL pattern:** `<project>.deno.dev` (auto-assigned) or custom domain.
> **Why:** Deno Deploy is a globally distributed edge runtime that runs
> TypeScript directly without a build step. It is independent of both
> GitHub and npm, so even if both go down we still serve `/api/*` traffic.

---

## 1. Create a Deno Deploy account (free)

1. Sign up at <https://dash.deno.com> using GitHub or email.
2. No credit card required for the Free plan.
3. After signing in you'll see the dashboard at `https://dash.deno.com`.

> Deno Deploy is **not** owned by GitHub — even though it accepts GitHub
> login, the underlying platform is independently operated by Deno Land
> Inc. This is what makes it a true third-party fallback for Vercel.

---

## 2. Create a project

1. Dashboard → **New Project**.
2. Choose **Playground** or **Import from URL** — we will **not** link a
   GitHub repo (the whole point of this mirror is to decouple from GitHub).
3. Project name: `marketnow-fallback` (or whatever you want — keep it short).
4. The dashboard will show the production URL
   `https://marketnow-fallback.deno.dev` immediately, even before you
   deploy anything.

Record:

- **Project name:** `marketnow-fallback`
- **Access token:** Dashboard → Account Settings → Access Tokens →
  **Create token** → name it `cli-deploy` → scope `Read+Write`. Save the
  token in your env:

  ```bash
  export DENO_DEPLOY_TOKEN="ddo_xxxxx_xxxxxxxxxxxxx"
  ```

  (Without the token you can only deploy via the in-browser playground.)

---

## 3. Entry point — `deno-deploy.ts`

The entry point lives at
`/home/z/my-project/marketnow/aep-marketplace/deno-deploy.ts`.

It uses [Hono](https://hono.dev/) — the same web framework the Vercel Edge
Function uses — but imports it via Deno URLs (`https://deno.land/x/hono/...`)
instead of `npm:` packages. This is the only real difference between the
Vercel and Deno entry points.

```typescript
// deno-deploy.ts
import { Hono } from "https://deno.land/x/hono/mod.ts";
import { cors } from "https://deno.land/x/hono/middleware/cors.ts";

const app = new Hono();
app.use("*", cors({ origin: "*" }));

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    service: "MarketNow (Deno Deploy fallback)",
    version: "5.0.0",
  })
);

// ...mirror all routes from the Vercel Edge Function...

export default app;
```

Deno Deploy auto-detects the default export as the fetch handler and routes
HTTP requests through it. There is no build step — Deno compiles TypeScript
in memory on the first request.

---

## 4. Deploy

Install the Deno CLI (one-time):

```bash
# macOS
brew install deno

# Linux (Homebrew not available)
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex
```

Verify:

```bash
deno --version
# deno 2.x or newer
```

Deploy:

```bash
deno deploy --project=marketnow-fallback deno-deploy.ts
```

`deploy` (alias: `deployctl deploy`) will:

1. Bundle `deno-deploy.ts` and all its URL imports.
2. Push the bundle to Deno Deploy's edge (multi-region).
3. Atomic swap — old version stays live until the new one is ready, then
   traffic flips in <1s with zero dropped requests.

### Smoke test

```bash
# Production URL — should return JSON
curl -s https://marketnow-fallback.deno.dev/api/health | jq .

# Expect:
# {
#   "status": "ok",
#   "service": "MarketNow (Deno Deploy fallback)",
#   "version": "5.0.0"
# }
```

---

## 5. URL

```text
https://marketnow-fallback.deno.dev
```

Every route in the Hono app is reachable under this URL. The marketplace
fallback strategy is:

| Primary (Vercel)              | Fallback (Deno Deploy)                       |
| ----------------------------- | -------------------------------------------- |
| `https://marketnow.site/api/*`| `https://marketnow-fallback.deno.dev/api/*`  |

The SPA's error handler (in `src/utils/fetchWithFallback.ts` — to be added)
will retry any failed `/api/*` request against the Deno Deploy URL before
showing an error.

---

## 6. Versioning — deploy with `--branch`

Deno Deploy tracks deployments by **branch** and treats each branch as an
independent deploy target. We use the branch name to version:

```bash
# Latest (always points at the most recent deploy on this branch)
deno deploy --project=marketnow-fallback --branch=main deno-deploy.ts

# Tagged version
deno deploy --project=marketnow-fallback --branch=v1.10.0 deno-deploy.ts
```

Branches are **independent URLs** — every branch gets a stable preview URL
of the form:

```text
https://marketnow-fallback-v1-10-0.deno.dev
https://marketnow-fallback-main.deno.dev       (same as root)
```

This means every tagged version is **always reachable at a stable URL** —
perfect for rollback.

### Tagging convention

| Branch       | Meaning                          |
| ------------ | -------------------------------- |
| `main`       | Latest production deploy         |
| `v1.10.0`    | Tagged release                   |
| `preview`    | Pre-prod smoke test              |
| `rollback`   | Temporary branch used to revert  |

---

## 7. Rollback

To roll back to a previous version:

```bash
# Option A — redeploy the old version under the `main` branch
deno deploy --project=marketnow-fallback --branch=main \
  --version=v1.10.0  # hypothetical, see note below

# Option B (recommended) — just promote the old tag's URL
# Point DNS / CDN at the stable per-branch URL:
#   https://marketnow-fallback-v1-9-0.deno.dev
```

> Deno Deploy does not currently expose a `--version=` flag for arbitrary
> past deploys. The convention is therefore: **always deploy tagged
> versions as branches** (e.g. `--branch=v1.9.0`) so the rollback is just a
> DNS / fetch-base-URL change. The `scripts/rollback.js` helper automates
> this — it sets the marketplace's fallback URL to the per-branch URL of the
> version you name.

Listing past deployments:

```bash
deno deploy deployments list --project=marketnow-fallback
```

This prints every deploy with timestamp, commit, branch, and URL.

---

## 8. Environment variables / secrets

Set via the dashboard or CLI:

```bash
# CLI
deno deploy env set STRIPE_SECRET_KEY --project=marketnow-fallback
deno deploy env set ATC_SIGNING_KEY   --project=marketnow-fallback

# Dashboard: Project → Settings → Environment Variables
```

Secrets are encrypted at rest, scoped per-project, and visible only at
runtime. They are **not** exposed in deploy logs.

In code:

```typescript
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
```

---

## 9. Custom domain

1. Dashboard → Project → **Settings** → **Domains** → **Add Domain**.
2. Enter `deno.marketnow.site`.
3. Add a CNAME at your DNS provider:

   ```dns
   deno  CNAME  marketnow-fallback.deno.dev.
   ```

4. SSL is auto-issued within ~60 seconds.

> Custom domains can target any **branch**, not just `main`. You can
> therefore pin `deno.marketnow.site` to a specific tagged version
> (e.g. `v1.10.0`) by setting the domain's target branch to `v1.10.0` —
> this is the cleanest rollback story.

---

## 10. Free tier limits

| Resource            | Free tier         | Notes                              |
| ------------------- | ----------------- | ---------------------------------- |
| Requests / month    | 1,000,000          | Plenty for a fallback              |
| Egress              | 100 GiB-hours/mo   | Only counts for dynamic responses |
| CPU time / request  | 30s wall, 50ms CPU| Plenty for JSON API routes         |
| Static file size    | 25 MB              | Per file                           |
| Concurrent deploys  | unlimited          | Atomic, no downtime                |
| Secrets            | unlimited          | Encrypted at rest                  |

For a fallback that only handles traffic during Vercel outages, this is
effectively unlimited. If traffic ramps up to where the free tier is too
small, you have bigger problems (Vercel has been down for hours).

---

## 11. What this mirror covers

The Deno Deploy entry point mirrors every **stateless GET** endpoint of the
Vercel API:

| Route                | Deno Deploy implementation                          |
| -------------------- | -------------------------------------------------- |
| `GET /api/health`    | Static JSON                                         |
| `GET /api/manifest`  | Static JSON (mirrored from `public/api/manifest.json`) |
| `GET /api/agent`     | Static JSON (mirrored from `public/api/agent.json`)   |
| `GET /api/search`    | Reads `search-index.json` from jsDelivr CDN         |
| `GET /api/categories`| Reads `categories.json` from jsDelivr CDN           |

**Stateful POST routes** (`/api/atc` for issue/verify, `/api/stripe-webhook`,
`/api/agent-purchase`) are **not mirrored** because they require KV
storage and signed keys. They are the last routes that would fail in a
Vercel-only outage — and they're rare enough that we accept the downtime.

---

## 12. CI / auto-deploy

The `scripts/deploy-all-platforms.sh` helper deploys to Deno Deploy
unconditionally when `DENO_DEPLOY_TOKEN` is set:

```bash
export DENO_DEPLOY_TOKEN="ddo_xxx"
bash scripts/deploy-all-platforms.sh
```

If the token is missing or `deno` is not installed, the step is skipped
with a warning — the deploy does not fail.

---

## TL;DR

```bash
# Install (one-time)
brew install deno                                 # or curl installer
export DENO_DEPLOY_TOKEN="ddo_xxxxxxxxxxxxx"

# Deploy latest
deno deploy --project=marketnow-fallback --branch=main deno-deploy.ts

# Deploy tagged version
deno deploy --project=marketnow-fallback --branch=v1.10.0 deno-deploy.ts

# Rollback = point traffic at the old branch URL:
#   https://marketnow-fallback-v1-9-0.deno.dev

# Smoke test
curl -s https://marketnow-fallback.deno.dev/api/health
```
