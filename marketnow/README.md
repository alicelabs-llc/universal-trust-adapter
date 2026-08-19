# MarketNow — Security Infrastructure for AI Agents

> **MarketNow doesn't sell AI tools. It determines whether AI agents should be allowed to trust and execute them.**

[![npm version](https://img.shields.io/npm/v/marketnow-mcp)](https://www.npmjs.com/package/marketnow-mcp)
[![npm downloads](https://img.shields.io/npm/dw/marketnow-mcp)](https://www.npmjs.com/package/marketnow-mcp)
[![License: AliceLabs LLC Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

## What is MarketNow?

MarketNow is **security infrastructure for AI agents**. Not a marketplace.

The marketplace (9,248 MCP skills, all free) is distribution. The product is **Sentinel** — a 10-layer security audit pipeline that determines whether AI agents should be allowed to trust and execute tools.

## Products

### Sentinel — AI Agent Security Engine
10-layer audit pipeline:

| Layer | What it does | Type |
|-------|-------------|------|
| L1.5 | Metadata analysis (auth, CORS, OAuth, rate limiting) | Static |
| L1.6 | Semgrep rules + secret detection + OSV dependency scan | Static |
| L1.7 | Malware pattern detection (binary launchers, install scripts) | Static |
| L1.8 | Malware family signatures (48 YARA-equivalent rules) | Static |
| L1.9 | Prompt injection screening (32 rules, 10 categories) | Static |
| L2.5 | gVisor sandbox (network=none, read-only, cap-drop ALL) | Dynamic |
| L3 | Runtime MCP Interceptor (real-time JSON-RPC guardrail) | Runtime |
| ATC | Agent Trust Card (Ed25519 signed, RFC 8785 JCS) | Identity |
| x402 | Streaming metered billing ($0.01 USDC per call on Base) | Payment |
| A2A | Remote agent execution | Execution |

### Trust Card — Cryptographically verifiable identity
- Ed25519 signatures (RFC 8032)
- RFC 8785 JCS canonical JSON
- Public CA key: `GET https://marketnow.site/api/atc?action=ca-key`
- Verify any card: `GET https://marketnow.site/api/atc?action=verify&card_id=ATC-2026-XXXXX`

### Interceptor — Real-time JSON-RPC guardrail
5 policy rules:
- Block reads of `.env`, `.aws/credentials`, `.ssh/id_rsa`
- Block dangerous commands (`rm -rf`, `DROP TABLE`, `mkfs`)
- Block process spawns (`exec`, `spawn`, `child_process`)
- Block system writes (`/etc/`, `/root/`, `C:\Windows`)
- Warn on non-allowlisted network calls

```bash
curl -X POST https://marketnow.site/api/interceptor \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"execute","arguments":{"command":"rm -rf /"}}}'
# → {"allowed": false, "decision": "block"}
```

### Trust API — Machine-readable trust decisions
```bash
curl https://marketnow.site/api/trust-score?skillId=mn-gen-00003
# → {"trust_score": 8, "recommendation": "safe_to_install"}
```

## Stats (all verified real)

| Metric | Value |
|--------|-------|
| Security checks performed | **1,211,488** |
| MCP skills analyzed | 9,248 |
| Threats detected | **1,030** |
| Skills quarantined (critical) | **80** |
| Skills flagged risky | 71 |
| Skills flagged caution | 879 |
| Verified safe (score ≥ 8) | **8,288** |
| gVisor sandbox runs | 257 |
| Agent Trust Cards issued | 57 |
| CA algorithm | Ed25519 (RFC 8032) |
| npm packages | marketnow-mcp v1.9.0, marketnow-install-stack v1.1.0 |

### What Sentinel caught

80 skills quarantined for:
- Malware patterns (binary launchers, suspicious install scripts)
- Malware family signatures (48 YARA-equivalent rules matched)
- Prompt injection (32 rules, jailbreak attempts detected)
- Hacking tools (Kali Linux, darknet, OSINT attack frameworks)
- Credential exfiltration patterns
- Failed sandbox execution (container crashes, unresponsive)

Full transparency report: `GET https://marketnow.site/api/audit-report.json`

## Quick start

### Install MCP server
```bash
npx -y marketnow-mcp
```

### Install a skill stack
```bash
npx -y marketnow-install-stack security-analyst
npx -y marketnow-install-stack dev-productivity
```

### Check trust score
```bash
curl https://marketnow.site/api/trust-score?skillId=mn-gen-00003
```

### Test the interceptor
```bash
curl -X POST https://marketnow.site/api/interceptor \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"read_file","arguments":{"path":"/.env"}}}'
```

## MCP Server v1.9.0 — Agent Contract

The npm package `marketnow-mcp@1.9.0` exposes **12 tools, all under the `marketnow_*` namespace** so Claude Desktop, Cursor, Cline, LangChain, and LlamaIndex can disambiguate them at tool-choice time.

The four golden rules enforced (full audit in [`mcp-server/AUDIT.md`](./mcp-server/AUDIT.md)):

| # | Rule | What it means |
|---|------|---------------|
| A | Deterministic `marketnow_` snake_case tool names | e.g. `marketnow_search_skills`, never `searchSkills` or `do-stuff` |
| B | Intent-oriented descriptions | Every description states WHEN and WHY an agent should call, not WHAT the code does |
| C | Strict JSON-Schema | `type` + `enum` + `pattern` + `minimum`/`maximum` on every parameter, no `any` |
| D | Structured `{ content, isError }` responses | Errors never throw into the agent loop — they normalize to `INVALID_ARGUMENT` / `NOT_FOUND` / `UNKNOWN_TOOL` / `INTERNAL_ERROR` with contextual hints |

The 12 tools:

1. `marketnow_search_skills` — keyword/category/price-bounded search
2. `marketnow_get_skill` — full skill detail by ID/slug
3. `marketnow_list_categories` — marketplace taxonomy with counts
4. `marketnow_get_manifest` — marketplace metadata + security metrics
5. `marketnow_get_install_command` — npx install command for a skill
6. `marketnow_verify_trust` — verify an Agent Trust Card (ATC)
7. `marketnow_verify_receipt` — verify a signed delivery proof (`rcpt_*`)
8. `marketnow_submit_skill` — submit a GitHub repo (L1.5+L1.7 sync, L2 queued)
9. `marketnow_mint_referral` — mint `ref_xxxxxxxx` (5% commission)
10. `marketnow_lookup_referral` — referral stats
11. `marketnow_recommend_skills` — AI-ranked recommendations for a task
12. `marketnow_get_owasp_compliance` — OWASP MCP Cheat Sheet (12 controls) + SHA-256 tool fingerprints + capability manifest

## Pricing

> **Pricing coherence note (v5.0.0):** MarketNow is **security infrastructure**, not a marketplace. The marketplace (9,248 MCP skills, all free to install) is **distribution**. The paid product is **Sentinel** — the security audit pipeline. The MCP server itself is free to install and use; paid actions kick in when you need a signed Trust Card, runtime testing, or continuous monitoring.

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Basic Sentinel scan, trust score, public report |
| Developer | $49-99 | Deep audit, signed report |
| Professional | $199-499 | Runtime testing, Trust Card, re-audit |
| Continuous | $99-499/mo | Monitoring, CVE tracking, auto re-audit |
| Enterprise | $5k-50k+/yr | Private audits, API, SLA |

## Links

- **Website:** https://marketnow.site
- **GitHub:** https://github.com/alicelabs-llc/marketnow
- **npm:** https://www.npmjs.com/package/marketnow-mcp
- **MCP Server:** `npx -y marketnow-mcp`
- **Trust API:** https://marketnow.site/api/trust-score
- **Interceptor:** https://marketnow.site/api/interceptor
- **ATC Spec:** https://marketnow.site/api/atc?action=spec
- **CA Public Key:** https://marketnow.site/api/atc?action=ca-key

## License

AL code in this repository is PROPRIETARY — property of AliceLabs LLC.

For licensing: legal@alicelabs.site
For support: support@alicelabs.site
General: info@alicelabs.site

Built by AliceLabs LLC (Wyoming, USA) — founder Edison Flores.

## Timeline

- **2025**: AliceLabs LLC legally founded in Wyoming, USA (founder Edison Flores, Ecuadorian)
- **2026-03-30**: GitHub organization `github.com/alicelabs-llc` created
- **2026-06-29**: MarketNow launched publicly (first npm release: `marketnow-mcp@1.5.1`)
- **2026-08-09**: Current npm latest: `marketnow-mcp@1.10.0` (15 versions total)
- **2026-08-19**: Independent audit by Z.ai (8 findings F1-F8 applied, see REPORT.pdf)

