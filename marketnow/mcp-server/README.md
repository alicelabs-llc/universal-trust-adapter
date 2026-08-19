# MarketNow MCP Server

> **Security infrastructure for AI agents.** 13 MCP tools — all under the `marketnow_*` namespace — that let Claude Desktop, Cursor, Cline, Continue, LangChain, and LlamaIndex agents search the marketplace, verify trust, consume the OWASP compliance API, and verify ANY Agent Trust Card against the ATC/1.0 spec without execution errors or hallucinations.

[![npm version](https://img.shields.io/npm/v/marketnow-mcp.svg)](https://www.npmjs.com/package/marketnow-mcp)
[![License: AliceLabs Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)
[![Audit: PASS](https://img.shields.io/badge/Audit-v1.10.0%20PASS-brightgreen)](./AUDIT.md)

---

## Why v1.10.0 is a breaking change

Agents do not read human documentation at runtime — they read the JSON-Schema returned by `tools/list`. v1.7.0 had `search_skills`, `get_skill`, etc., with no namespace prefix and several free-form string fields. That ambiguity caused LLM tool-call failures.

v1.10.0 enforces **four golden rules** (see [`AUDIT.md`](./AUDIT.md)) and adds the ATC/1.0 spec verifier:

| # | Rule | What changed |
|---|------|--------------|
| A | Deterministic tool names with `marketnow_` prefix | All 13 tools use the prefix |
| B | Intent-oriented descriptions (WHEN/WHY, not WHAT) | Every description rewritten |
| C | Strict JSON-Schema (`type` + `enum` + `pattern` + bounds) | No `any` left anywhere |
| D | Structured `{ content, isError }` responses with taxonomy | `INVALID_ARGUMENT` / `NOT_FOUND` / `UNKNOWN_TOOL` / `INTERNAL_ERROR` |

---

## Install

```bash
npm install -g marketnow-mcp
# or use without install:
npx -y marketnow-mcp
```

## Configuration

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

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

### Cursor / Cline / VS Code

Same `mcpServers` block — add it under Settings → MCP, or your project's `.mcp.json`.

---

## Tools exposed (13, all `marketnow_*`)

| # | Tool | Purpose |
|---|------|---------|
| 1 | `marketnow_search_skills` | Search marketplace by query / category / price / sort |
| 2 | `marketnow_get_skill` | Full metadata for one skill by ID or slug |
| 3 | `marketnow_list_categories` | Marketplace taxonomy with live counts |
| 4 | `marketnow_get_manifest` | Marketplace metadata + security metrics (1.2M checks, 1,030 threats, 80 quarantined) |
| 5 | `marketnow_get_install_command` | `npx` install command for a skill |
| 6 | `marketnow_verify_trust` | Verify an Agent Trust Card (Ed25519, RFC 8032) |
| 7 | `marketnow_verify_receipt` | Verify a signed delivery proof (`rcpt_*`) |
| 8 | `marketnow_submit_skill` | Submit a GitHub repo to the marketplace (L1.5 + L1.7 sync, L2 queued) |
| 9 | `marketnow_mint_referral` | Mint `ref_xxxxxxxx` (5% commission on referred purchases) |
| 10 | `marketnow_lookup_referral` | Referral stats (clicks, installs, purchases, earnings) |
| 11 | `marketnow_recommend_skills` | AI-ranked recommendations for a natural-language task |
| 12 | `marketnow_get_owasp_compliance` | OWASP MCP Cheat Sheet (12 controls) + SHA-256 tool fingerprint + capability manifest (filesystem/network/shell/credentials/process) |
| 13 | `marketnow_verify_atc_spec` | **ATC/1.0 spec verifier** — accepts ANY Agent Trust Card (any issuer, any CA) and verifies all 8 required controls (ATC-001 Identity through ATC-008 Expiration). Self-contained: uses `node:crypto` + RFC 8785 JCS + Ed25519 (RFC 8032). Makes this package the LIVE REFERENCE IMPLEMENTATION of the ATC/1.0 specification. |

### Strict inputSchema (Rule C in practice)

Every input parameter declares `type` + `description`, plus one of:

- **`enum`** on categorical fields — `category` (11 known values), `sort_by` (5), `sort_order` (2)
- **`pattern`** on IDs — `skill_id`, `card_id`, `receipt_id`, `ref_code`, `agent_id`, `repo_url`
- **`minimum`/`maximum`** on numerics — `limit` (1–50), `max_price` (0–1000)
- **`minLength`/`maxLength`** on free-text — `task` (3–300 chars)

Runtime validates every pattern with the same regex declared in the schema — no schema/runtime drift.

### Structured error envelope (Rule D in practice)

```js
// SUCCESS
{ content: [{ type: 'text', text: JSON.stringify({ success: true, ... }) }] }

// FAILURE — never throws into the agent loop
{
  isError: true,
  content: [{
    type: 'text',
    text: JSON.stringify({
      success: false,
      error: 'INVALID_ARGUMENT',   // or NOT_FOUND / UNKNOWN_TOOL / INTERNAL_ERROR
      tool: 'marketnow_get_skill',
      message: 'Invalid skill_id: must match /^[a-z0-9-]+$/i ...',
      hint: 'Re-read the inputSchema for this tool from ListTools response.'
    })
  }]
}
```

No stack traces are leaked — only `err.message` + `err.code` + a contextual hint.

---

## Example: agent-side usage

After the MCP config is loaded, ask Claude:

- *"Find me a skill to scrape websites and extract prices"*
  → Claude calls `marketnow_search_skills` with `query="scrape websites extract prices"`
- *"Show me all skills in the Security category, sorted by Sentinel score"*
  → Claude calls `marketnow_search_skills` with `category="Security"`, `sort_by="sentinel_desc"`
- *"Verify the ATC for the agent that published this skill"*
  → Claude calls `marketnow_verify_trust` with `card_id="ATC-2026-7777670"`
- *"What OWASP MCP controls does this skill comply with? Does it touch the filesystem?"*
  → Claude calls `marketnow_get_owasp_compliance` with `skill_id="mn-gen-00003"`
- *"Verify this ATC from a third-party CA against the open ATC/1.0 spec"*
  → Claude calls `marketnow_verify_atc_spec` with `atc={...the card envelope...}` — returns per-control pass/fail + signature verification result

---

## How it works

The server fetches `https://marketnow.site/api/skills.json` (cached 1 hour) and proxies reads to the public MarketNow REST API. No API key required for read operations. ATC verification, referral minting, and skill submission hit signed POST endpoints.

- **No API key** for reads
- **1-hour cache** on the skill catalog
- **Strict JSON-Schema** on every tool (Rule C)
- **`isError: true`** on every failure path (Rule D)

---

## Pricing

MarketNow is **security infrastructure**, not a marketplace. The marketplace (9,248 MCP skills, all free to install) is distribution. The product is Sentinel — a 10-layer security audit pipeline.

| Tier | Price | What you get |
|------|-------|--------------|
| Free | $0 | Basic Sentinel scan, trust score, public report |
| Developer | $49–99 | Deep static analysis, dependency analysis, malware scan, prompt injection, sandbox, signed report |
| Professional | $199–499 | Deep audit, runtime testing, remediation, Trust Card, re-audit |
| Continuous | $99–499/mo | Continuous monitoring, CVE tracking, dependency drift, auto re-audit |
| Enterprise | $5k–50k+/yr | Private MCP audits, custom policies, compliance evidence, API, dashboards, SLA |

The MCP server itself is free to install and use. Tools #1–5 are read-only and free. Tools #6–12 hit endpoints that may require payment depending on the action (e.g. issuing an ATC requires a paid Trust Card allocation).

---

## Audit

Full audit report — including the 4-rule checklist, smoke-test commands, and the v1.7 → v1.8 → v1.9 change log — is in [`AUDIT.md`](./AUDIT.md). It ships inside the npm tarball.

---

## Links

- **Website:** https://marketnow.site
- **GitHub:** https://github.com/alicelabs-llc/marketnow
- **npm:** https://www.npmjs.com/package/marketnow-mcp
- **Audit:** https://marketnow.site/api/audit-report.json
- **OWASP compliance:** https://marketnow.site/api/owasp
- **Trust API:** https://marketnow.site/api/trust-score
- **Interceptor:** https://marketnow.site/api/interceptor
- **ATC CA key:** https://marketnow.site/api/atc?action=ca-key

---

## License

AliceLabs LLC Proprietary (MNNC-1.0). For licensing: legal@alicelabs.site

Built by AliceLabs LLC (Wyoming, USA) — founder Edison Flores.

## Timeline

- **2025**: AliceLabs LLC legally founded in Wyoming, USA (founder Edison Flores, Ecuadorian)
- **2026-03-30**: GitHub organization `github.com/alicelabs-llc` created
- **2026-06-29**: MarketNow launched publicly (first npm release: `marketnow-mcp@1.5.1`)
- **2026-08-09**: Current npm latest: `marketnow-mcp@1.10.0` (15 versions total)
- **2026-08-19**: Independent audit by Z.ai (8 findings F1-F8 applied, see REPORT.pdf)

