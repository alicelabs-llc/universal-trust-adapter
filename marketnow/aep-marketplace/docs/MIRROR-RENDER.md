# Mirror Platform 4 — Render

> **Role:** Free-tier long-running server mirror — runs the Node.js MCP
> server / API as a single long-lived process (no edge split).
> **Cost:** Free tier: 750 hours/month, 512 MB RAM, sleeps after 15 min.
> **URL pattern:** `<service>.onrender.com` (auto-assigned) or custom domain.
> **Why:** Render runs the same `node index.js` that runs locally — no
> edge runtime, no Hono. This makes it a sanity-check mirror: if the Node
> runtime itself misbehaves on Vercel/Deno, the Render instance will tell
> you whether it's a code bug or a platform bug.

---

## 1. Create a Render account (free)

1. Sign up at <https://dashboard.render.com/register> using GitHub, GitLab,
   or email.
2. No credit card required for the Free plan.
3. Land on the dashboard at `https://dashboard.render.com`.

> Render is owned by Render Labs, Inc. and is **independent** of Vercel,
> Cloudflare, and Deno — making it a true fourth-party fallback.

---

## 2. Create a Web Service

We deploy from the **npm package** rather than a Git repo, so the GitHub
shadowban does not affect us.

### Option A — From an existing npm package (preferred)

1. Dashboard → **New +** → **Web Service**.
2. Under "Source", choose **Existing service** → **Deploy from npm** (this
   option is available on Render for any package that exposes a `start`
   script).
3. Fill in:

   | Field             | Value                                                |
   | ----------------- | ---------------------------------------------------- |
   | Name              | `marketnow`                                          |
   | Package           | `marketnow-mcp`                                      |
   | Version           | `@latest` (or pin e.g. `@1.10.0`)                    |
   | Region            | Oregon (closest to npm registry)                      |
   | Branch            | N/A (npm-based, not Git-based)                       |
   | Runtime           | Node 20                                               |
   | Build Command     | `npm install --omit=dev`                             |
   | Start Command     | `npm start`                                          |
   | Instance Type     | Free (512 MB RAM, 0.1 CPU)                           |

4. Click **Create Web Service**.

Render will:

- Pull the npm tarball from the public npm registry.
- Run `npm install --omit=dev` (only production deps).
- Run `npm start` (which executes `node index.js` — the MCP server entry
  point).
- Assign the URL `https://marketnow.onrender.com`.

### Option B — From a Dockerfile

If you want full control, drop a `Dockerfile` in the repo and point Render
at the GitHub URL (when the shadowban is lifted) or use Render's "Public
Docker image" mode pointing at a public registry like GHCR.

For the MVP, Option A is sufficient.

---

## 3. URL

```text
https://marketnow.onrender.com
```

The MCP server exposes a stdio transport by default, so for a Render
deployment you will want to add an HTTP transport shim. The simplest
approach: create a tiny wrapper that exposes the MCP server over HTTP
using the `@modelcontextprotocol/sdk` HTTP transport. (TODO: split this
shim into `mcp-server/http.mjs`.)

For now, Render's primary purpose is **smoke-testing**: a successful boot
of `npm start` proves the package is well-formed and runnable, which is a
useful signal during npm rollback / unpublish scenarios.

---

## 4. Free tier sleep behavior

> **Important:** the free Render tier **sleeps after 15 minutes of
> inactivity** (no incoming HTTP requests). The first request after sleep
> takes ~30 seconds to wake the service (cold start).

This is acceptable for a fallback because:

1. The marketplace primary (Vercel) handles 100% of normal traffic.
2. Render only gets traffic when an operator manually points a fetch at it
   (during an outage drill).
3. The 30-second cold start is shorter than the average Vercel outage.

If 30 seconds is too slow, upgrade to Render's **Starter** plan at
$7/month, which keeps the service always-on.

---

## 5. Health check + smoke test

Render pings `https://marketnow.onrender.com/health` (or the path you
configure) every 60 seconds during awake hours. If the endpoint returns
non-2xx, Render marks the service unhealthy.

Configure:

1. Dashboard → Service → **Settings** → **Health Check**.
2. Health Check Path: `/health` (or `/api/health` if you wire the MCP
   server to expose it).
3. Health Check Grace Period: 60s.

Smoke test:

```bash
# First request wakes the service (cold start ~30s)
curl -s https://marketnow.onrender.com/api/health

# Subsequent requests are fast (<100ms)
curl -s https://marketnow.onrender.com/api/health | jq .
```

---

## 6. Environment variables

Dashboard → Service → **Environment** → add secrets:

| Key                   | Value                                |
| --------------------- | ------------------------------------ |
| `NODE_ENV`            | `production`                          |
| `MARKETNOW_BASE_URL`  | `https://marketnow.site`             |
| `ATC_SIGNING_KEY`     | (Ed25519 private key, base64)        |
| `STRIPE_SECRET_KEY`   | `sk_live_...`                         |

Variables are encrypted at rest. They are visible in deploy logs only if you
explicitly `console.log` them.

---

## 7. Auto-deploy

### From npm publish (preferred)

Render does not natively support npm-publish webhooks, but you can wire it
via a GitHub Action that calls the Render Deploy Hook URL:

```yaml
# .github/workflows/deploy-render.yml
name: Deploy Render
on:
  registry_package:
    types: [published]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "$RENDER_DEPLOY_HOOK"
        env:
          RENDER_DEPLOY_HOOK: ${{ secrets.RENDER_DEPLOY_HOOK }}
```

Get the Deploy Hook URL from:
Dashboard → Service → **Settings** → **Auto-Deploy** → **Deploy Hook**.

### Manual

```bash
# Trigger a redeploy without changing the package version
curl -X POST "$RENDER_DEPLOY_HOOK"
```

---

## 8. Versioning & rollback

Render tracks deploys by commit (Git) or by npm version (npm-based
services). Each deploy is **immutable** — you can roll back to any
previous deploy.

### Roll back

1. Dashboard → Service → **Deploys**.
2. Find the deploy you want to roll back to.
3. Click **Roll back to this deploy**.
4. Render performs an atomic swap — traffic flips to the old version with
   no downtime.

### Pin to a specific npm version

Edit the service → change the Version field from `@latest` to
`@1.10.0` → **Save**. Render redeploys from that exact npm tarball.

```bash
# Trigger manual redeploy after changing the version
curl -X POST "$RENDER_DEPLOY_HOOK"
```

---

## 9. Cost & limits (Free plan)

| Resource                | Free plan         | Notes                              |
| ----------------------- | ----------------- | ---------------------------------- |
| RAM                     | 512 MB            | Enough for `node index.js`         |
| CPU                     | 0.1 vCPU          | Sufficient for low-traffic         |
| Awake hours / month     | 750               | Sleeps after 15 min idle            |
| Bandwidth              | 100 GB / month    |                                    |
| Build minutes / month   | 500               |                                    |
| Concurrent services     | 1                 |                                    |
| Sleep cold start        | ~30 seconds       | First request after sleep           |

---

## 10. What this mirror covers

| Coverage                              | Render (npm `marketnow-mcp`)      |
| ------------------------------------- | ---------------------------------- |
| `node index.js` boots without error   | Yes                                |
| MCP `tools/list` works over stdio     | Yes (but Render has no stdio)      |
| HTTP `/api/health` route              | Needs the HTTP shim (TODO)         |
| Verifies the npm tarball integrity    | Yes (npm is the only source)      |

The Render mirror's main value is the last row: it proves the npm package
is installable and runnable from a clean checkout, which is a strong signal
during incident response.

---

## TL;DR

```bash
# 1. Sign up at https://dashboard.render.com
# 2. New Web Service → Deploy from npm → package: marketnow-mcp → start: npm start
# 3. URL: https://marketnow.onrender.com
# 4. Cold start: ~30s after 15 min idle (free tier only)
# 5. Roll back: Dashboard → Deploys → Roll back to this deploy
```
