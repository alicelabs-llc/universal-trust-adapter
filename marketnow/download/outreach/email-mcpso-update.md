**To:** support@mcp.so (or via their contact form at https://mcp.so)
**Subject:** Update MarketNow listing — repositioned as Security Infrastructure (v5.0.0, npm v1.9.0)
**From:** Edgar Flores <support@alicelabs.site>
**Date:** 2026-08-10

---

Hi mcp.so team,

I'm the maintainer of MarketNow (https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y).

Our positioning has fundamentally changed and the listing on mcp.so is now inaccurate. Could you please update it?

## Current (OUTDATED) listing

| Field | Current value |
|-------|---------------|
| Tagline | "9,248 verified MCP-compatible skills" |
| Pricing | "Crypto payments (ETH/BSC/SOL/BTC)" |
| Transport | "SSE/WebSocket/JSON-RPC" |
| Config | `"url": "https://marketnow.site/api/mcp"` |
| Tools | 5 tools |

## Correct (CURRENT — v5.0.0 / npm v1.9.0)

| Field | Should be |
|-------|-----------|
| Server Name | **MarketNow — Security Infrastructure for AI Agents** |
| Tagline | **12 MCP tools (marketnow_* namespace) backed by Sentinel — a 10-layer security audit pipeline that has run 1.2M checks, detected 1,030 threats, and quarantined 80 malicious skills.** |
| Pricing | **Free / $49-99 Developer / $199-499 Professional / $99-499/mo Continuous / $5k-50k+/yr Enterprise** (USDC/Stripe, no multi-chain crypto) |
| Transport | **stdio only** (via `npx -y marketnow-mcp@1.9.0`) |
| Config | `{"mcpServers":{"marketnow":{"command":"npx","args":["-y","marketnow-mcp"]}}}` |
| Tools | **12 tools** (all `marketnow_*` namespaced) |

## Positioning change (one paragraph)

MarketNow is **no longer a marketplace** — it is security infrastructure for AI agents. The marketplace (9,248 MCP skills, all free to install) is **distribution**; the product is **Sentinel**, a 10-layer security audit pipeline. We have performed 1,211,488 security checks, detected 1,030 threats, and quarantined 80 malicious skills.

## The 12 MCP tools (v1.9.0 — all `marketnow_*` namespaced)

1. `marketnow_search_skills`
2. `marketnow_get_skill`
3. `marketnow_list_categories`
4. `marketnow_get_manifest`
5. `marketnow_get_install_command`
6. `marketnow_verify_trust`
7. `marketnow_verify_receipt`
8. `marketnow_submit_skill`
9. `marketnow_mint_referral`
10. `marketnow_lookup_referral`
11. `marketnow_recommend_skills`
12. `marketnow_get_owasp_compliance` (NEW — OWASP MCP Cheat Sheet compliance matrix + tool fingerprinting + capability manifest)

## Verification URLs (all live)

- Website: https://marketnow.site
- npm: https://www.npmjs.com/package/marketnow-mcp (v1.9.0 published)
- GitHub: https://github.com/alicelabs-llc/marketnow
- Server metadata: https://marketnow.site/api/manifest
- Transparency report: https://marketnow.site/api/audit-report.json
- OWASP compliance matrix: https://marketnow.site/api/owasp
- Audit document (in npm tarball): https://github.com/alicelabs-llc/marketnow/blob/master/mcp-server/AUDIT.md

## Stats (all real, all public)

- 1,211,488 security checks performed
- 9,248 MCP skills analyzed
- 1,030 threats detected
- 80 skills quarantined (critical — blocked from listing)
- 8,288 verified safe (score ≥ 8)
- 257 gVisor sandbox runs
- 57 Agent Trust Cards issued (Ed25519, RFC 8032)

Thanks for maintaining mcp.so — it's a great resource for the MCP community. Please let me know if you need any additional information to verify the new positioning.

Best,
Edgar Flores
support@alicelabs.site
AliceLabs LLC (Wyoming, USA)
