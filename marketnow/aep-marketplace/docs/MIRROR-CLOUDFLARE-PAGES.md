# Mirror Platform 2 — Cloudflare Pages

> **Role:** Free static-site hosting for the built Vite `dist/` directory.
> **Cost:** Free, unlimited bandwidth, unlimited requests, 500 builds/month.
> **URL pattern:** `marketnow.pages.dev` (auto-assigned) or any custom domain.
> **Why:** Cloudflare Pages is a Vercel-class static host that doesn't depend
> on GitHub for serving (it deploys directly from `wrangler` CLI or a Git
> branch). This makes it a true second-source-of-truth for the marketplace.

---

## 1. Create a Cloudflare account (free)

1. Go to <https://dash.cloudflare.com/sign-up>.
2. Use a work email (you can use the same email as your Vercel account —
   Cloudflare does not enforce SSO conflicts).
3. No credit card required for the Free plan.

You will land on the Cloudflare dashboard at
`https://dash.cloudflare.com/<account-id>`.

> Record your **Account ID** from the URL — you'll need it for
> `wrangler.toml` if you ever add Workers bindings (not required for Pages).

---

## 2. Authenticate the Wrangler CLI

The `wrangler` CLI is already in `devDependencies` (see `package.json`).
Authenticate locally so deploys work without manual login:

```bash
# Interactive (opens a browser)
npx wrangler login

# OR — non-interactive (CI-friendly) using an API token
export CLOUDFLARE_API_TOKEN="cf_xxx_paste_your_token_here"
# Create the token at:
#   https://dash.cloudflare.com/profile/api-tokens
#   → "Create Token" → "Edit Cloudflare Workers" template
#   → under Account Resources, select your account
#   → under Zone Resources, choose "No zone" (Pages does not need a zone)
```

Verify:

```bash
npx wrangler whoami
# Should print your account email + account ID
```

---

## 3. Create the Pages project

You can create the project either via the dashboard (one-time) or via the
CLI (re-runnable). The CLI is preferred because it is idempotent and works
in CI.

### Option A — Dashboard (one-time, GUI)

1. In the dashboard, click **Workers & Pages** → **Create** → **Pages**.
2. Choose **Upload assets** (not the Git provider flow — we want to deploy
   from the CLI so we are not coupled to GitHub).
3. Project name: `marketnow`.
4. Click **Create project** — you'll see the production URL
   `https://marketnow.pages.dev` immediately.

### Option B — CLI (recommended, idempotent)

The first `wrangler pages deploy` will create the project automatically if it
doesn't exist (it prompts `? Create new project: marketnow? [y/n]` — answer
`y`):

```bash
npx wrangler pages deploy dist --project-name=marketnow --branch=main
```

You only need to do this once; subsequent deploys reuse the same project.

---

## 4. wrangler.toml (project config)

The repo already includes a `wrangler.toml` at
`/home/z/my-project/marketnow/aep-marketplace/wrangler.toml`:

```toml
name = "marketnow"
compatibility_date = "2026-08-19"
pages_build_output_dir = "dist"

[env.production]
name = "marketnow"
```

This lets you skip the `--project-name` and `--branch` flags:

```bash
npx wrangler pages deploy       # uses wrangler.toml + CWD
```

---

## 5. Build + deploy

From the `aep-marketplace/` directory:

```bash
# 1. Build the site (runs generate_skills.cjs → vite build)
npm run build

# 2. Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=marketnow
```

`wrangler` will:

- Upload every file in `dist/` to Cloudflare's edge (content-addressed by
  SHA-256, so unchanged files are skipped — fast incremental deploys).
- Print the unique preview URL (e.g.
  `https://abc123def.marketnow.pages.dev`) and the production URL
  (`https://marketnow.pages.dev`).
- Make the deploy **immutable** — you can always roll back to it later.

### Smoke-test the deploy

```bash
# Should return 200 + the built HTML
curl -sI https://marketnow.pages.dev | head -3

# API routes are static JSON files, so they also work on Pages:
curl -s https://marketnow.pages.dev/api/agent.json | jq .agent.version
```

---

## 6. URLs

| URL                                             | Use case                       |
| ------------------------------------------------ | ------------------------------ |
| `https://marketnow.pages.dev`                   | Auto-assigned production URL   |
| `https://marketnow.pages.dev/api/agent.json`    | Static API JSON                |
| `https://<commit-sha>.marketnow.pages.dev`      | Immutable preview per commit   |
| `https://cdn.marketnow.site` (custom domain)    | Vanity URL — see §7            |

Every `wrangler pages deploy` produces a unique immutable URL even when you
deploy to the production branch — that URL is preserved forever and can be
used for canary testing or rollback.

---

## 7. Custom domain (`cdn.marketnow.site`)

Cloudflare Pages can serve traffic on a custom domain via DNS CNAME.

### If your domain is on Cloudflare (recommended)

1. Dashboard → **Workers & Pages** → `marketnow` project → **Custom domains**
   → **Set up a custom domain**.
2. Enter `cdn.marketnow.site`.
3. Click **Continue** → Cloudflare auto-creates the DNS record (proxied
   CNAME pointing to `marketnow.pages.dev`).
4. Wait ~60s. SSL is auto-provisioned.

### If your domain is on another registrar

Add a CNAME record at your DNS provider:

```dns
cdn  CNAME  marketnow.pages.dev.
```

Then in the dashboard go to **Custom domains** → **Set up** → enter
`cdn.marketnow.site` → Cloudflare will detect the CNAME and issue an SSL
certificate.

> If you want `cdn.marketnow.site` to be the canonical URL, add a redirect
> from `marketnow.pages.dev` to `cdn.marketnow.site` using a `_redirects`
> file in `public/`:

```text
# public/_redirects  (already supported by Cloudflare Pages)
https://marketnow.pages.dev/*  https://cdn.marketnow.site/:splat  301
```

---

## 8. Versioning & rollback

Every Cloudflare Pages deploy is **immutable and addressable**:

```bash
# List all deploys (newest first) — shows commit SHA, time, URL, environment
npx wrangler pages deployment list --project-name=marketnow

# Roll back to a previous deploy by promoting it to production
npx wrangler pages deployment rollback --project-name=marketnow
```

`rollback` interactively prompts you to pick a deployment from the list.

### Tagged deploys

To deploy a specific version as a tagged release, use `--commit-dirty=true`
and a branch name equal to the version:

```bash
git tag v1.10.0
npx wrangler pages deploy dist \
  --project-name=marketnow \
  --branch=v1.10.0 \
  --commit-dirty=true
```

The deployment gets a stable URL like
`https://v1-10-0.marketnow.pages.dev` that you can pin in rollback scripts.

---

## 9. Auto-deploy on `npm publish`

The marketplace is built from sources that are versioned in npm. Whenever
`marketnow-mcp` is published, we want Cloudflare Pages to redeploy so the
site reflects the new version (the marketplace UI reads
`npm_latest_version` from `agent.json`, which is regenerated by
`scripts/sync-versions.js`).

### GitHub Action (when the GitHub shadowban is lifted)

```yaml
# .github/workflows/deploy-cloudflare-pages.yml
name: Deploy to Cloudflare Pages

on:
  registry_package:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=marketnow
```

### Without GitHub (current state — GitHub shadowbanned)

Run a **local cron / systemd timer** that polls npm and redeploys when the
version bumps. See `scripts/deploy-all-platforms.sh` — it skips Cloudflare
if `CLOUDFLARE_API_TOKEN` is unset, so you can also run it manually after
every `npm publish`:

```bash
# After: npm version patch && npm publish
node scripts/sync-versions.js     # bump agent.json + manifest.json
bash scripts/deploy-all-platforms.sh   # builds + deploys everywhere
```

---

## 10. Environment variables (secrets)

Set via CLI or dashboard:

```bash
# CLI
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name=marketnow
npx wrangler pages secret put ATC_SIGNING_KEY --project-name=marketnow

# Dashboard: Workers & Pages → marketnow → Settings → Environment variables
```

Secrets are encrypted at rest, scoped to the project, and never appear in
the deploy logs. They're available to Pages Functions
(`functions/` directory) but **not** to the static build (Vite sees only
`VITE_*` vars).

---

## 11. Pages Functions (server-side, optional)

If you need server-side logic on Cloudflare Pages (e.g. signed URLs, A/B
testing), drop a file at `functions/<route>.js`:

```js
// functions/api/health.js
export const onRequest = async () =>
  new Response(JSON.stringify({ status: 'ok', host: 'cloudflare-pages' }), {
    headers: { 'content-type': 'application/json' },
  });
```

Cloudflare deploys these as Workers behind the same `marketnow.pages.dev`
URL, so the API path stays the same as Vercel.

This repo currently routes all `/api/*` traffic through static JSON files in
`public/api/` — no Pages Functions are required for the MVP.

---

## 12. Cost & limits (Free plan)

| Resource                | Free plan       | Notes                              |
| ----------------------- | --------------- | ---------------------------------- |
| Builds per month        | 500             | More than enough for daily deploys |
| Concurrent builds       | 1               | Queue if exceeded                  |
| Bandwidth              | Unlimited       | No surprise bills                  |
| Requests               | Unlimited       | No rate limit                      |
| File count per deploy   | 20,000          | Our `dist/` is well under          |
| File size              | 25 MB           | Per file                           |
| Functions invocations   | 100k/day        | Only if using Pages Functions      |

---

## 13. Rollback quick-reference

```bash
# List deployments
npx wrangler pages deployment list --project-name=marketnow

# Promote a previous deploy to production (interactive)
npx wrangler pages deployment rollback --project-name=marketnow
```

The rollback is **instant** — it just changes which immutable deploy the
production alias points at. There's no rebuild, no cache flush.

---

## TL;DR

```bash
# One-time setup
npx wrangler login                                  # or set CLOUDFLARE_API_TOKEN

# Every deploy
npm run build
npx wrangler pages deploy dist --project-name=marketnow

# Roll back
npx wrangler pages deployment rollback --project-name=marketnow
```
