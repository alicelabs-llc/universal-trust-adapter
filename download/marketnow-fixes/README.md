# MarketNow — Trust Infrastructure for AI Agents

> The trust layer that lets AI agents discover, verify, authorize, and transact
> with external tools. **9,248 MCP skills indexed, 1.2M security checks
> performed, 80 malicious tools quarantined.** Maintained by AliceLabs LLC
> (Wyoming, USA, founded 2025). Founder: Edison Flores.

[![npm version](https://img.shields.io/npm/v/marketnow-mcp.svg)](https://www.npmjs.com/package/marketnow-mcp)
[![license](https://img.shields.io/badge/license-MNNC--1.0-blue.svg)](./LICENSE)
[![Discord](https://img.shields.io/discord/alicelabs.svg)](https://marketnow.site/discord)
[![GitHub stars](https://img.shields.io/github/stars/alicelabs-llc/marketnow.svg)](https://github.com/alicelabs-llc/marketnow)

---

## What is MarketNow?

MarketNow combines **7 subsystems** into a single trust infrastructure:

| # | Subsystem | Purpose | Status |
|---|-----------|---------|--------|
| 1 | **Discovery** | 9,248 MCP skills indexed from the public ecosystem | ✅ Live |
| 2 | **Sentinel** | 10-layer security audit pipeline (L1.5–L2.5 active, L3–L10 on roadmap) | ✅ L1.5–L2.5 |
| 3 | **ATC/1.0** | Agent Trust Card with Ed25519 signatures (RFC 8032, RFC 8785 JCS) | ✅ Live |
| 4 | **Handshake** | Cross-agent trust negotiation protocol | 🚧 Beta |
| 5 | **Interceptor** | Runtime enforcement with 8 policy rules | ✅ Live |
| 6 | **Mandates** | Delegated authority for agent commerce (x402 + AP2) | ✅ Live |
| 7 | **Audit Log** | Tamper-evident public evidence (git-backed mandate ledger) | ✅ Live |

## Quickstart

### Install the MCP server

```bash
npx -y marketnow-mcp
```

Works with Claude Desktop, Cursor, Cline, Continue, Aider, and any
MCP-compatible runtime.

### Claude Desktop config

```json
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp"]
    }
  }
}
```

### Tools exposed (13 total — v1.10.0)

| Tool | Description |
|------|-------------|
| `search_skills` | Full-text search across 9,248 indexed skills |
| `get_skill` | Fetch full skill record (manifest, install command, trust data) |
| `list_categories` | Browse the category tree (AI/ML, Dev Tools, Data, Web/API, etc.) |
| `get_manifest` | Project manifest (currently returns 404 — see audit finding F7) |
| `get_install_command` | Resolve the install command for a specific skill |
| `verify_trust` | Run a comprehensive trust assessment (Sentinel + ATC + policy + runtime) |
| `verify_receipt` | Verify a signed delivery proof (action-receipt) for a completed purchase |
| `submit_skill` | Submit a new skill to the catalog |
| `recommend_skills` | Get recommended skills for a given task description |
| `marketnow_verify_atc_spec` | Self-contained ATC/1.0 conformance verifier (any issuer) — **new in 1.10.0** |
| `marketnow_verify_trust` | Comprehensive trust assessment (Sentinel + ATC + policy + runtime) — **new in 1.10.0** |
| `marketnow_get_owasp_compliance` | OWASP MCP Top 10 compliance report — **new in 1.10.0** |
| `marketnow_get_sentinel_report` | Full 10-layer Sentinel audit report — **new in 1.10.0** |

## Pricing — B2B (Seller-Side)

**MarketNow does NOT sell skills to buyers.** All 9,248 skills are free to
install. Revenue comes from sellers who want to list and sell skills.

| Seller Tier | Price | Max Skills | Includes |
|-------------|-------|------------|----------|

**Commission**: 20% on seller sales (15% if affiliate is used; 5% to affiliate).

**Storage fee**: none — unlimited free listings.

> ⚠️ The landing page previously said "free One-Time" (charging buyers).
> This was incorrect — MarketNow charges sellers, not buyers. The landing page
> is scheduled to be updated. See `REPORT.pdf` finding F5.

## Trust Model

Three purchase modes designed for both human oversight and agent autonomy:

| Mode | Applies to | Human action |
|------|-----------|--------------|
| `instant_download` | Free skills (price = 0) | None required |
| `instant_purchase` | Moot: all skills are free, nothing is purchased | Not used |
| `requires_human_approval` | Paid skills when no mandate or mandate exhausted | Approves via Stripe Checkout or creates mandate |

**Hard caps (cannot be raised):**
- Max $500 total per mandate
- Max $50 per single purchase
- Default 90-day expiry; mandates auto-expire

**Notification modes:**
- `notify` (default) — agent buys, principal gets email/webhook alert on every purchase
- `notify_and_veto` — agent buys, principal gets alert + 5-min veto window (roadmap)
- `silent` — fully autonomous, no alerts. Requires explicit `confirmSilentAutonomy=true`

## Standards

| Standard | Role | Status |
|----------|------|--------|
| [x402](https://x402.org) | HTTP 402 Payment Required — governed by Linux Foundation (Coinbase, Cloudflare, Stripe, Google, Visa) | Implementing |
| [AP2](https://ap2.dev) | Agent Payments Protocol — by Google (Visa, Mastercard, PayPal, Coinbase + 60 partners) | Implementing |
| [MCP Server Cards](https://modelcontextprotocol.io) | Discovery — will adopt when spec stabilizes | Monitoring |
| MCP Registry namespace verification | Identity via GitHub OAuth or DNS | Planning |

## API Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/agent.json` | Machine-readable instructions, trust model, schema | ✅ Live |
| `GET /api/skills-lite.json` | Lightweight catalog (4.2 MB, 9,248 skills) | ✅ Live |
| `GET /api/skills.json` | Full catalog (~24 MB) | ✅ Live |
| `GET /api/search?q=` | Server-side search with relevance scoring | ✅ Live |
| `GET /api/policies.json` | Terms, refund, dispute, privacy policies | ✅ Live |
| `POST /api/agent-purchase` | Purchase endpoint (instant_download / instant_purchase / requires_human_approval) | ✅ Live |
| `POST /api/trust` | Unified Trust API (Sentinel + ATC + policy + runtime) | ✅ Live |
| `GET /api/manifest.json` | Project manifest | ❌ Returns 404 — see audit finding F7 |

## Audit Status

This repository was independently audited on **2026-08-19** by Z.ai (not
affiliated with AliceLabs LLC). 8 findings were identified (3 P0 Critical,
3 P1 High, 2 P2 Medium). All fixes are documented in `REPORT.pdf` and applied
in this branch as `*.fixed` files and `patches/*.patch`.

| ID | Severity | Finding |
|----|----------|---------|
| F1 | P0 | License triple contradiction (MIT vs AliceLabs Proprietary vs MNNC-1.0) |
| F2 | P0 | GitHub URL dual & both 404 (edgarfloresguerra2011-a11y repo doesn't exist) |
| F3 | P1 | Founding date triple (2024 vs 2025 vs 2026-03-30) |
| F4 | P1 | Skill count inconsistency (5,023 vs 7,063 vs 9,248) |
| F5 | P0 | Pricing model triple (free buyer-side vs B2B seller-side) |
| F6 | P1 | Version drift (npm 1.10.0 vs agent.json mcp_server.version 1.6.0) |
| F7 | P2 | /api/manifest.json returns 404 but is in robots.txt |
| F8 | P2 | Track record disclosure inconsistent with landing page |

## License

**MNNC-1.0 — AliceLabs Modified Non-Commercial License.**

Source-available: code is public for review, audit, and verification. Commercial
use (reselling the audit pipeline, hosting a paid fork of MarketNow) requires a
separate commercial license from AliceLabs LLC.

See [`LICENSE`](./LICENSE) for the full text.

## Contact

| Role | Email |
|------|------|
| Legal | legal@alicelabs.site |
| Support | support@alicelabs.site |
| General | info@alicelabs.site |
| Security | security@alicelabs.site (PGP key on `/security`) |

## Links

- Website: https://marketnow.site
- npm: https://www.npmjs.com/package/marketnow-mcp
- GitHub: https://github.com/alicelabs-llc/marketnow
- Trust roadmap: https://marketnow.site/trust
- Security methodology: https://marketnow.site/security
- ATC playground: https://marketnow.site/playground

---

© 2025–2026 AliceLabs LLC. All rights reserved. Founder: Edison Flores.
