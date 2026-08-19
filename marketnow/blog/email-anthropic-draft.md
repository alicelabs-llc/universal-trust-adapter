# Draft Email to Anthropic — ATC as MCP Trust Standard

**To:** partnerships@anthropic.com, developer-relations@anthropic.com
**Subject:** Agent Trust Cards — free, open trust infrastructure for MCP servers (prior art for MCP security standards)
**From:** Edison Flores <edison@alicelabs.site>

---

Hi Anthropic team,

I'm Edison Flores, founder of AliceLabs LLC. We've built MarketNow — a security-first marketplace for MCP servers with a 10-layer audit pipeline and Ed25519-signed Agent Trust Cards (ATCs).

I'm reaching out because Anthropic created MCP (Model Context Protocol), and we've built trust infrastructure that directly extends it — and we'd like to contribute our schema and reference implementation to the MCP ecosystem.

## What we built

**Agent Trust Cards (ATC)** — Ed25519-signed identity cards for MCP servers, using:
- RFC 8032 (Ed25519) for signatures
- RFC 8785 (JCS) for canonical JSON
- GitHub as a public audit ledger
- Schema v1.1.0 with `decision_authority: "consumer"` (the card is evidence, not a verdict)

**10-layer security audit** for MCP servers:
- L1.5-L1.9: metadata, semgrep, malware patterns, malware families, prompt injection defense (32 rules)
- L2: Docker sandbox (gVisor, network=none, read-only, cap-drop ALL)
- L3: continuous runtime monitoring with drift detection

**Cross-agent verification** — we've demonstrated bidirectional Ed25519 receipt verification with Vibe (vibes-coded.com), two independent CAs, no shared code, public ledgers.

## What we'd like to discuss

1. **ATC as an optional trust layer for MCP** — Anthropic could recommend or require ATC verification for MCP servers listed in the official registry. The schema is open, the CA is independent, and verification is free.

2. **MCP security audit standard** — our 10-layer pipeline (especially L1.9 prompt injection defense and L2 Docker sandbox) could become a reference for MCP server security auditing.

3. **MCP certification program** — Anthropic may be planning a certification program for MCP servers. Our ATC + Sentinel pipeline is a working reference implementation that's been running in production for 3 months.

## Everything is free

We charge $0 for all of this. The audit, the ATC, the catalog, the MCP server (11 tools, 346 downloads/week), the API — all free. Revenue comes from Sentinel subscriptions for sellers who want priority audits and SOC2 mapping.

## Links

- ATC spec: https://marketnow.site/api/atc?action=spec
- CA public key: https://marketnow.site/api/atc?action=ca-key
- Verify an ATC: https://marketnow.site/api/atc?action=verify&card_id=ATC-2026-7777670
- GitHub: https://github.com/alicelabs-llc/marketnow
- npm: https://www.npmjs.com/package/marketnow-mcp
- Blog post (mutual hop with Vibe): https://dev.to/edison_flores_6d2cd381b13/two-agent-trust-systems-zero-merged-code-the-marketnow-vibe-mutual-hop-3a8n

I'd love to schedule a 30-minute call to discuss. I can be reached at edison@alicelabs.site.

Best,
Edison Flores
Founder, AliceLabs LLC (Wyoming, USA)
