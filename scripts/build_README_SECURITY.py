#!/usr/bin/env python3
"""
Generates README.md and .github/SECURITY.md for the MarketNow repo.
"""
from pathlib import Path

BASE = Path('/home/z/my-project/download/marketnow-fixes')

# ============================================================================
# README.md
# ============================================================================
README = """# MarketNow — Trust Infrastructure for AI Agents

> The trust layer that lets AI agents discover, verify, authorize, and transact
> with external tools. **9,248 MCP servers indexed, 1.2M security checks
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
| 1 | **Discovery** | 9,248 MCP servers indexed from the public ecosystem | ✅ Live |
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
| **FREE** | $0 / forever | 3 | Basic Sentinel L1 scan, 24–48h review queue, community support |
| **PRO** | $9.99 / month | 25 | Priority Sentinel scan (<6h), featured badge, analytics dashboard, custom slugs, email support |
| **ENTERPRISE** | $49.99 / month | unlimited | Instant Sentinel scan (<1h), premium placement, advanced analytics, API access, dedicated account manager, priority Slack support |

**Commission**: 20% on seller sales (15% if affiliate is used; 5% to affiliate).

**Storage fee** (FREE tier only): first 3 skills free, then $0.50/skill/month.

> ⚠️ The landing page previously said "$0.99–$9.99 One-Time" (charging buyers).
> This was incorrect — MarketNow charges sellers, not buyers. The landing page
> is scheduled to be updated. See `REPORT.pdf` finding F5.

## Trust Model

Three purchase modes designed for both human oversight and agent autonomy:

| Mode | Applies to | Human action |
|------|-----------|--------------|
| `instant_download` | Free skills (price = 0) | None required |
| `instant_purchase` | Paid skills with valid mandate (price ≤ $50, ≤ cap, ≤ remaining) | Receives notification immediately after |
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
| F5 | P0 | Pricing model triple ($0.99–$9.99 buyer-side vs B2B seller-side) |
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
"""

(BASE / 'README.md').parent.mkdir(parents=True, exist_ok=True)
(BASE / 'README.md').write_text(README)
print(f"Wrote {BASE / 'README.md'} ({(BASE / 'README.md').stat().st_size} bytes)")

# ============================================================================
# .github/SECURITY.md
# ============================================================================
SECURITY = """# Security Policy

## Supported Versions

We actively audit and patch the latest version of `marketnow-mcp` on npm.
Older versions receive security backports on a best-effort basis.

| Version | Supported | Status |
|---------|-----------|--------|
| 1.10.x  | ✅ Yes     | Active — current |
| 1.9.x   | ✅ Yes     | Patch backports |
| 1.8.x   | ⚠️ Best-effort | Critical fixes only |
| < 1.8.0 | ❌ No      | Upgrade required |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Preferred: encrypted disclosure

1. Encrypt your report with our PGP public key (fingerprint below).
2. Send the encrypted report to **security@alicelabs.site**.
3. You will receive an acknowledgment within **48 hours**.
4. We will issue a fix or mitigation within **7 days** for Critical/High,
   **30 days** for Medium, **90 days** for Low.

### PGP key

```
Fingerprint:  [TBD — to be published at /security after audit F-SEC-1]
Algorithm:   Ed25519 (Curve25519)
Created:     2026-08-19
Expires:     2027-08-19
```

> The PGP key is scheduled to be published at https://marketnow.site/security
> as part of audit finding F-SEC-1. Until then, send plaintext reports to
> security@alicelabs.site over an encrypted transport (TLS).

### What to include in your report

- Affected version (e.g. `marketnow-mcp@1.10.0`)
- Affected component (MCP server, Sentinel pipeline, ATC verifier, runtime
  interceptor, mandate ledger, public API, web app)
- Step-by-step reproduction
- Proof of concept (if available)
- Impact assessment (who can be affected, how)
- Suggested mitigation (if you have one)

## Scope

### In scope

- The `marketnow-mcp` npm package and its 13 tools
- The Sentinel audit pipeline (L1.5–L2.5 active layers)
- The ATC/1.0 (Agent Trust Card) schema and verifier
- The runtime interceptor with 8 enforcement rules
- The mandate ledger and on-chain USDC verification flow on Base (chainId 8453)
- The public API at https://marketnow.site/api/*
- The web application at https://marketnow.site

### Out of scope

- Third-party MCP servers indexed in the catalog (report to their respective
  maintainers)
- Vulnerabilities in dependencies (report upstream; we'll upgrade once a fix
  is released)
- Self-hosted forks of MarketNow (we don't control them)
- Issues in the official MCP registry (modelcontextprotocol.io) — that's
  Anthropic's domain
- Social engineering attacks against AliceLabs LLC staff

## Threat Model

### Primary threats (per OWASP MCP Top 10)

1. **Prompt injection** — third-party skill descriptions attempting to
   override agent instructions. Mitigation: Sentinel L1.5 scans for known
   injection patterns; ATC verifier rejects cards with injected payloads.

2. **Tool poisoning** — skills that exfiltrate secrets or perform unintended
   actions. Mitigation: Sentinel L2 static analysis + L2.5 gVisor sandbox;
   runtime interceptor enforces 8 policy rules including `.env` read blocking.

3. **Credential exfiltration** — skills reading `~/.aws/credentials`,
   `~/.ssh/id_*`, `.env`, etc. Mitigation: runtime interceptor blocks these
   reads by default; opt-in only via explicit user consent.

4. **Supply-chain attacks** — malicious updates to dependencies. Mitigation:
   `npm audit` runs on every Sentinel scan; package-lock.json pinned.

5. **Stolen mandate** — attacker who steals a mandate ID and tries to use it.
   Mitigation: mandate IDs are bound to the wallet address that created them;
   on-chain verification rejects mismatches.

6. **Replay attacks** — replaying a valid txHash for a different purchase.
   Mitigation: each txHash is recorded in the public git-backed mandate ledger
   and rejected on second use.

### Roadmap items (not yet implemented)

- `notify_and_veto` mode (5-minute veto window) — documented but not yet
  implemented in the purchase flow
- Third-party Sentinel audit (L3–L10) — currently self-declared, third-party
  audit pending, target 2027
- Public bug bounty program — not yet launched

## Disclosure Timeline

We follow a **coordinated disclosure** model:

1. **Day 0** — you report the vulnerability.
2. **Day 2** — we acknowledge receipt and assign a CVE ID (if applicable).
3. **Day 7 (Critical/High) / Day 30 (Medium) / Day 90 (Low)** — we ship the
   fix and publish a security advisory on GitHub.
4. **Day 14 (Critical/High) / Day 37 (Medium) / Day 97 (Low)** — you may
   publicly disclose the vulnerability if we have not yet patched.

## Hall of Fame

We thank the following researchers for responsibly disclosing vulnerabilities
(listed with their permission, in chronological order):

- _(no reports yet — be the first)_

## Contact

| Role | Email | PGP |
|------|------|-----|
| Security team | security@alicelabs.site | [TBD at /security] |
| Legal (for legal threats) | legal@alicelabs.site | N/A |
| General | info@alicelabs.site | N/A |

## Audit History

| Date | Auditor | Findings | Report |
|------|---------|----------|--------|
| 2026-08-19 | Independent (Z.ai) | 8 findings (3 P0, 3 P1, 2 P2) | `REPORT.pdf` (in this repo) |

---

© 2025–2026 AliceLabs LLC. Security policy version 1.0.
"""

(BASE / '.github' / 'SECURITY.md').parent.mkdir(parents=True, exist_ok=True)
(BASE / '.github' / 'SECURITY.md').write_text(SECURITY)
print(f"Wrote {BASE / '.github' / 'SECURITY.md'} ({(BASE / '.github' / 'SECURITY.md').stat().st_size} bytes)")

# ============================================================================
# NOTICE (attribution file)
# ============================================================================
NOTICE = """MarketNow
Copyright (c) 2025–2026 AliceLabs LLC (Wyoming, USA)

This product includes software and audit methodology licensed under the
MNNC-1.0 (AliceLabs Modified Non-Commercial License). See LICENSE for details.

Third-party components:
  - @modelcontextprotocol/sdk (MIT) — Model Context Protocol SDK
  - canonicalize (Apache-2.0) — JSON Canonicalization Scheme (RFC 8785)

Trademarks:
  "AliceLabs", "AliceLabs LLC", "MarketNow", "Sentinel", "ATC",
  "Agent Trust Card", and "MNNC" are trademarks of AliceLabs LLC.

For inquiries: info@alicelabs.site
"""
(BASE / 'NOTICE').write_text(NOTICE)
print(f"Wrote {BASE / 'NOTICE'} ({(BASE / 'NOTICE').stat().st_size} bytes)")
