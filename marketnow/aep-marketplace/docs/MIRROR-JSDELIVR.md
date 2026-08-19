# Mirror Platform 1 — jsDelivr CDN

> **Role:** Free, unlimited, globally-distributed CDN front for the npm packages.
> **Status:** Already partially used by the marketplace.
> **URL pattern:** `https://cdn.jsdelivr.net/npm/<package>@<version>/<file>`
> **Cost:** Free, no account required, no rate limits (within fair use).

---

## Why jsDelivr

jsDelivr is a public CDN that mirrors the entire npm registry. Every file
inside any of our published npm packages is automatically available via jsDelivr
**within minutes of `npm publish`** — no extra setup, no CI, no API keys.

If GitHub is shadowbanned or unreachable, every npm package we publish is still
served from jsDelivr's multi-CDN backbone (Cloudflare, Fastly, Bunny, GCore).

This makes it our **zero-cost, zero-maintenance first fallback** for any
static asset that lives inside a published npm package.

---

## Packages mirrored via jsDelivr

| npm package           | Source path                                       | Latest version |
| --------------------- | ------------------------------------------------- | -------------- |
| `marketnow-mcp`       | `/home/z/my-project/marketnow/mcp-server/`        | `1.10.0`       |
| `agent-trust-card`    | `/home/z/my-project/marketnow/atc-sdk/`           | `1.1.1`        |
| `marketnow-install-stack` | (alias of `@marketnow/install-stack`)        | `1.0.0`        |

Verify the current version of each package:

```bash
npm view marketnow-mcp version
npm view agent-trust-card version
npm view marketnow-install-stack version 2>/dev/null || \
  npm view @marketnow/install-stack version
```

---

## 1. Serve the latest published version

```text
https://cdn.jsdelivr.net/npm/marketnow-mcp@latest/index.js
https://cdn.jsdelivr.net/npm/agent-trust-card@latest/index.js
https://cdn.jsdelivr.net/npm/marketnow-install-stack@latest/index.js
```

Use `@latest` only for non-pinned references (e.g. dashboards, smoke tests).
For production traffic, **always pin** (see §2).

Quick smoke test (no auth needed):

```bash
curl -sI https://cdn.jsdelivr.net/npm/marketnow-mcp@latest/index.js | head -5
```

You should get `200 OK` and `content-type: application/javascript`.

---

## 2. Pin to a specific version (recommended for production)

Pin every consumer to an explicit version so a broken `npm publish` cannot
take down the marketplace:

```text
https://cdn.jsdelivr.net/npm/marketnow-mcp@1.10.0/index.js
https://cdn.jsdelivr.net/npm/agent-trust-card@1.1.1/index.js
https://cdn.jsdelivr.net/npm/marketnow-install-stack@1.0.0/index.js
```

The version in the URL is **immutable** — jsDelivr caches it forever and the
file content can never change, so it is safe to use as a CDN asset for years.

> Pin the same version everywhere: HTML `<script>` tags, README badges, the
> AEP marketplace `manifest.json`, the `deno-deploy.ts` import map, and any
> downstream SDK. The `scripts/sync-versions.js` helper keeps these in sync.

---

## 3. Combine multiple files into a single request

jsDelivr exposes a `/combine` endpoint that concatenates multiple files into
one HTTP response. This is useful when you want a single `<script>` tag that
loads several packages:

```text
https://cdn.jsdelivr.net/combine/npm/marketnow-mcp@1.10.0/index.js,npm/agent-trust-card@1.1.1/index.js
```

Rules:

- Each path starts with `npm/<package>@<version>/<file>`.
- Paths are separated by commas (no spaces).
- Order is preserved in the output.
- Each file is wrapped in a `//! source` comment so errors are traceable.

Example HTML:

```html
<script src="https://cdn.jsdelivr.net/combine/npm/marketnow-mcp@1.10.0/index.js,npm/agent-trust-card@1.1.1/index.js"></script>
```

Combined requests are cached separately from the individual files, so the
first request is slower than the second.

---

## 4. Use as a fallback for ANY static asset

jsDelivr serves **every file inside the npm tarball**, not just `main`. If a
file is shipped in the package, it is on the CDN:

```text
https://cdn.jsdelivr.net/npm/marketnow-mcp@latest/README.md
https://cdn.jsdelivr.net/npm/marketnow-mcp@latest/LICENSE
https://cdn.jsdelivr.net/npm/marketnow-mcp@1.10.0/lib/atc-verify.mjs
https://cdn.jsdelivr.net/npm/agent-trust-card@latest/src/index.mjs
https://cdn.jsdelivr.net/npm/agent-trust-card@latest/bin/atc.mjs
```

Use this for:

- Embedding the latest README on the marketplace docs page.
- Letting users `curl` the install script from a CDN URL.
- Loading subpath exports (`./verify`, `./issue`, `./keys`) without a bundler.
- Serving the LICENSE to legal/finance tooling without cloning the repo.

### Directory browsing

```text
https://cdn.jsdelivr.net/npm/marketnow-mcp@latest/
```

Visiting that URL in a browser renders an interactive file tree of the
package — handy for debugging "is this file actually in the tarball?".

### Bonus: jsDelivr + GitHub combo fallback

jsDelivr can also serve files directly from a GitHub repo (independent of
npm), which is useful if a file is too big for the npm tarball:

```text
https://cdn.jsdelivr.net/gh/alicelabs-llc/marketnow@master/mcp-server/index.js
```

This is **not** a substitute for the npm mirror (the GitHub org is currently
shadowbanned), but it documents the pattern in case the shadowban is lifted.

---

## 5. Programmatic version pinning (for the marketplace)

The AEP marketplace reads `npm_latest_version` from
`public/api/agent.json` and renders the correct pinned jsDelivr URL:

```js
const v = agentJson.metrics.npm_latest_version; // e.g. "1.10.0"
const url = `https://cdn.jsdelivr.net/npm/marketnow-mcp@${v}/index.js`;
```

Bump the version in `mcp-server/package.json` and run:

```bash
node scripts/sync-versions.js   # updates agent.json + manifest.json + tags git
```

The marketplace then serves the pinned URL with no code change.

---

## 6. Health check / monitoring

jsDelivr exposes a per-package status page:

```text
https://www.jsdelivr.com/package/npm/marketnow-mcp
https://www.jsdelivr.com/package/npm/agent-trust-card
```

For automated checks, hit the CDN URL and assert `200`:

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" \
  https://cdn.jsdelivr.net/npm/marketnow-mcp@1.10.0/index.js
```

Expected: `200`. A `404` means either the version was unpublished (rare) or
jsDelivr's cache has not yet refreshed (wait 60s and retry).

---

## 7. Rollback story

jsDelivr cannot "roll back" — every published version is permanently
available. To roll back:

1. Pick the previous good version (e.g. `1.9.0`).
2. Update the marketplace / `agent.json` to pin to `@1.9.0`.
3. Re-deploy to Vercel / Cloudflare Pages / Deno Deploy so the new pin is live.

The `scripts/rollback.js` helper automates steps 1–2 (see root README).

---

## 8. Limits

- **File size:** 50 MB per file (sufficient for our packages; the biggest
  file is `mcp-server/index.js` at ~50 KB).
- **Package size:** 100 MB total per npm tarball.
- **Fair use:** No hard rate limit; jsDelivr asks that you not use it for
  video streaming or as a generic file host. Our usage (npm packages) is the
  intended use case.
- **Cache TTL:** immutable versions cache forever; `@latest` re-validates
  every ~7 minutes (configurable in `Cache-Control`).

---

## TL;DR

```bash
# Latest
curl https://cdn.jsdelivr.net/npm/marketnow-mcp@latest/index.js

# Pinned
curl https://cdn.jsdelivr.net/npm/marketnow-mcp@1.10.0/index.js

# Combined
curl 'https://cdn.jsdelivr.net/combine/npm/marketnow-mcp@1.10.0/index.js,npm/agent-trust-card@1.1.1/index.js'

# Any file in the tarball
curl https://cdn.jsdelivr.net/npm/marketnow-mcp@1.10.0/README.md
```
