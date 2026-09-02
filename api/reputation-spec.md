# UTA Domain Reputation API — Specification

**Version:** 1.1 (engine `uta-reputation-v1.1`)
**Status:** Stable · First consumer in production: [ProdIntel](https://github.com/alicelabs-llc/Scraper)
**Reference implementation:** [`api/reputation.ts`](./reputation.ts) (self-contained, Vercel Edge compatible)
**Live instance:** `https://uta-reputation.vercel.app/api/reputation` (public, keyless — try `?probe=1`)
**Live demo (consumer):** https://uta-reputation.vercel.app/ — ProdIntel with server-confirmed source badges
**Related:** [Universal Trust API](./trust-api-spec.md) (credential verification), ProdIntel Source Safety Gate (client parity)

---

## 1. Purpose

The Universal Trust API verifies trust **credentials**. This endpoint answers a different,
complementary question that every AI app, bot, and autonomous agent faces the moment it
produces output containing external links:

> **"Can I trust this domain before I show it to a human or act on it?"**

Examples:

- An AI product-hunter lists "the 30 best trending products", each with a source URL. Which
  of those sources are legit marketplaces and which are scam traps? *(display gating)*
- An autonomous agent is about to `POST` a purchase to `https://some-shop.example`. Does the
  domain carry risk signals? *(action gating — caller applies fail-closed policy)*
- A chatbot cites references. Are they punycode look-alikes of famous brands?

The endpoint is **free, keyless, and deterministic**: verdicts are computed from transparent
local rules, require no secrets, make no external calls, and cost nothing to serve. Verdicts
carry their **reasons** with them — no black-box scores.

---

## 2. Endpoint

```
GET  /api/reputation?url=<url>          # full URL
GET  /api/reputation?domain=<domain>    # bare domain (scheme optional, defaults to https)
GET  /api/reputation?probe=1            # availability check
POST /api/reputation                    # {"url" | "domain": "..."} in JSON body
OPTIONS /api/reputation                 # CORS preflight
```

- **Auth:** none. Anonymous, rate-limit friendly via CDN caching.
- **CORS:** `Access-Control-Allow-Origin: *` — designed to be callable from any web app.
- **Caching:** responses are deterministic per `(engine version, input domain)`; send
  `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`. Clients SHOULD
  cache locally for 24h.

## 3. Response

**200 OK:**

```json
{
  "engine": "uta-reputation-v1.1",
  "input": "https://bit.ly/petdeal",
  "domain": "bit.ly",
  "verdict": "risky",
  "status": "risky",
  "score": 8,
  "reasons": ["URL shortener (destination hidden)"],
  "checked_at": "2026-09-03T12:00:00.000Z",
  "ttl": 86400
}
```

| Field | Type | Notes |
|-------|------|-------|
| `engine` | string | Engine version that produced the verdict. Never reuse a cache across versions. |
| `domain` | string | Normalized lowercase host assessed. |
| `verdict` | string | `trusted` \| `unknown` \| `caution` \| `risky` |
| `status` | string | Legacy client alias: `trusted`→`marketplace`, `unknown`→`external`, else equal to verdict. |
| `score` | integer | 0–100. Baselines: trusted 95 · unknown 55 · caution 35 · risky 8, minus signal penalties (http −15, redirect param −10, abused TLD −10, low-barrier host −10, unusual structure −5). |
| `reasons` | string[] | Human-readable, transparent. Empty for clean `unknown`. |
| `checked_at` | string | ISO-8601 timestamp. |
| `ttl` | integer | Recommended client cache seconds (86400). |

**Probe 200:** `{ "probe": true, "engine": "...", "spec": "..." }`

**Errors:** `400` missing input or invalid JSON body (with `error` message + `engine`), `405` method not allowed. The endpoint itself never fails closed: it always answers or errors explicitly.

## 4. Verdicts and signals (v1.1)

| Verdict | Baseline | Signals |
|---------|----------|---------|
| `trusted` | 95 | Host matches the known-marketplace allowlist (Amazon, AliExpress, Alibaba, Etsy, eBay, Walmart, Shein, Temu, MercadoLibre, Dhgate, and peers). Penalties capped at 20. |
| `unknown` | 55 | No signals. Neutral by design: absence of evidence is not evidence of safety. |
| `caution` | 35 | `http://` (unencrypted) · open-redirect params (`url=`, `redirect=`, `goto=`, `next=`, `dest=`) · high-abuse TLDs (`.zip`, `.top`, `.click`, `.loan`, `.review`, `.country`, `.download`) · instant-publish hosts (`*.myshopify.com`, `*.blogspot.`, `*.wixsite.`, `*.weebly.`, `*.000webhostapp.`) · unusual structure (≥4 hyphens). |
| `risky` | 8 | Raw IP host · punycode (`xn--`, homoglyph defense) · URL shorteners (destination hidden) · **brand typosquat** (leetspeak lures: `amaz0n`, `paypa1`, `faceb00k`…) · **brand + credential word** (`amazon-secure-login`, `paypal-verify-account`…). |

Ordering: risky checks short-circuit; a host cannot be both marketplace and risky (allowlist
wins except explicit shortener/IP/punycode hosts). `*.myshopify.com` is `caution` (anyone can
publish a store in minutes) while `shopify.com` itself is `trusted`.

## 5. Client parity contract

The reference client (ProdIntel `services/sourceTrust.ts`) runs the **same engine code**
locally. This gives every consumer a graded degradation path:

1. Badge/decision renders **instantly** from the local engine (works offline, zero latency).
2. Asynchronously, the client asks the endpoint for confirmation; a match adds confidence
   (e.g., a "UTA ✓" chip) and fills the 24h cache.
3. Endpoint unreachable → nothing breaks: the local verdict stands. **Display is read-only**
   and never blocks on the network.

## 6. Fail-open vs fail-closed (consumer policy)

- **Display** (badges, citations, source lists): degrade to local/`unknown` on endpoint
  failure. Never block the UI.
- **Actions** (agent clicks "buy", submits a form, transfers funds): the caller SHOULD treat
  `risky` and *unreachable endpoint* as DENY. The endpoint answers a reputation question;
  the fail-closed policy lives in the caller (see the adapters in `integrations/`).

## 7. Deployment

Any host that runs a Web-API request handler works. The reference file is a zero-dependency
Vercel Edge Function: drop `api/reputation.ts` into a project (or import the repo), deploy,
and the endpoint is live at `<deploy>/api/reputation`. No environment variables, no keys,
no egress cost. Self-hosters can adapt the `evaluateDomain(input)` pure function to any
runtime (it is plain string/URL logic).

## 8. Honest limitations (v1.1)

- Deterministic heuristics only: no live threat feeds, no WHOIS/age data, no content
  scanning. A brand-new clean-looking scam domain is `unknown` (55), not `trusted`.
- The allowlist is conservative and peer-reviewed by hand; `unknown` is the default for a
  reason — this endpoint is a *floor* of safety, not a ceiling.
- Planned upgrades (spec'd, not yet shipped): optional Google Safe Browsing hook (key-based,
  off by default), OpenPhish feed sync, RDAP domain-age signal, community-reported verdicts
  signed with UTA credentials.

## 9. Versioning

`engine` never changes semantics silently: any signal, weight, or allowlist change bumps the
version (`uta-reputation-v1.2`, …) and invalidates caches. Consumers key their caches on
`engine` + `domain`.
