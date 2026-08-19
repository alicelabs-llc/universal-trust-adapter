**To:** Glama team (via https://glama.ai/contact or support@glama.ai)
**Subject:** Update MarketNow listing — repositioned as Security Infrastructure (v5.0.0, npm v1.9.0)
**From:** Edgar Flores <support@alicelabs.site>
**Date:** 2026-08-10

---

Hi Glama team,

I'm the maintainer of MarketNow (https://glama.ai/mcp/connectors?query=MarketNow+MCP). Our positioning has fundamentally changed and the listing on Glama is now inaccurate. Could you please update it?

## Positioning change (one paragraph)

MarketNow is **no longer a marketplace** — it is **security infrastructure for AI agents**. The marketplace (9,248 MCP skills, all free to install) is **distribution**; the product is **Sentinel**, a 10-layer security audit pipeline that has performed 1,211,488 checks, detected 1,030 threats, and quarantined 80 malicious skills.

## Server metadata (correct v5.0.0 values)

| Field | Value |
|-------|-------|
| Server name | MarketNow — Security Infrastructure for AI Agents |
| Tagline | 12 MCP tools (marketnow_* namespace) backed by Sentinel — a 10-layer security audit pipeline (1.2M checks, 80 quarantined) |
| Transport | stdio only (via `npx -y marketnow-mcp@1.9.0`) |
| npm | marketnow-mcp@1.9.0 |
| GitHub | https://github.com/alicelabs-llc/marketnow |
| License | AliceLabs LLC Proprietary (MNNC-1.0) |
| Categories | Security, Infrastructure, Certification, Marketplace, Aggregator |
| Tags | mcp, security, sentinel, audit, owasp, ed25519, agent-trust, tool-fingerprinting, capability-manifest, interceptor, sandbox, gvisor |

## MCP Config (correct)

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

## Tools (12, all `marketnow_*` namespaced)

The v1.9.0 server enforces 4 golden rules for autonomous agent consumption (full audit at https://github.com/alicelabs-llc/marketnow/blob/master/mcp-server/AUDIT.md):

- **Rule A**: Deterministic `marketnow_` snake_case tool names (no collisions)
- **Rule B**: Intent-oriented descriptions (WHEN/WHY, not WHAT)
- **Rule C**: Strict JSON-Schema (type + enum + pattern + bounds, no `any`)
- **Rule D**: Structured `{ content, isError }` responses with error code taxonomy

The 12 tools:

1. `marketnow_search_skills` — keyword/category/price-bounded search
2. `marketnow_get_skill` — full skill detail by ID/slug
3. `marketnow_list_categories` — marketplace taxonomy with counts
4. `marketnow_get_manifest` — marketplace metadata + security metrics
5. `marketnow_get_install_command` — npx install command for a skill
6. `marketnow_verify_trust` — verify an Agent Trust Card (Ed25519, RFC 8032)
7. `marketnow_verify_receipt` — verify a signed delivery proof (`rcpt_*`)
8. `marketnow_submit_skill` — submit a GitHub repo (L1.5+L1.7 sync, L2 queued)
9. `marketnow_mint_referral` — mint `ref_xxxxxxxx` (5% commission)
10. `marketnow_lookup_referral` — referral stats
11. `marketnow_recommend_skills` — AI-ranked recommendations for a task
12. `marketnow_get_owasp_compliance` — OWASP MCP Cheat Sheet (12 controls) + SHA-256 tool fingerprints + capability manifest

## Verified stats (all real, all public)

- 1,211,488 security checks performed
- 9,248 MCP skills analyzed
- 1,030 threats detected
- 80 skills quarantined (critical)
- 8,288 verified safe (score ≥ 8)
- 257 gVisor sandbox runs
- 57 Agent Trust Cards issued

## Verification URLs (all live)

- Website: https://marketnow.site
- npm: https://www.npmjs.com/package/marketnow-mcp (v1.9.0)
- GitHub: https://github.com/alicelabs-llc/marketnow
- Server metadata: https://marketnow.site/api/manifest
- Transparency report: https://marketnow.site/api/audit-report.json
- OWASP compliance matrix: https://marketnow.site/api/owasp
- Agent Trust Card CA key: https://marketnow.site/api/atc?action=ca-key

## Pricing (5 tiers)

- **Free** ($0): Basic Sentinel scan, trust score, public report
- **Developer** ($49-99): Deep audit + signed report
- **Professional** ($199-499): Runtime testing + Trust Card + re-audit
- **Continuous** ($99-499/mo): Monitoring + CVE tracking + auto re-audit
- **Enterprise** ($5k-50k+/yr): Private audits + API + SLA

Thanks for maintaining Glama — please let me know if you need any additional info.

Best,
Edgar Flores
support@alicelabs.site
AliceLabs LLC (Wyoming, USA)
