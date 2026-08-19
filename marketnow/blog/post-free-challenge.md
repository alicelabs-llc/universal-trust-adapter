# Dev.to Article 1: Free MCP Security Challenge

## Title: "Free MCP Security Challenge: submit your server, get a 10-layer audit + signed trust card"

Body:

I'm running a free security audit challenge for MCP server developers. Here's the deal:

1. You submit your GitHub repo URL
2. I run a 10-layer security audit (automated, ~2 minutes)
3. If it passes, your server goes into the catalog with a signed Agent Trust Card (Ed25519, RFC 8785)
4. Everything is free. No payment, no subscription, no catch.

## What the audit does

- **L1.5**: Metadata checks (README, license, not archived, not stale)
- **L1.6**: 36 Semgrep rules + 18 secret patterns + OSV dependency scan
- **L1.7**: 8 malware pattern checks + binary/launcher detection
- **L1.8**: 28 malware family signatures (Emotet, LockBit, Cobalt Strike, etc.)
- **L1.9**: 32 prompt injection defense rules (the #1 attack against AI agents)
- **L2**: Docker sandbox (gVisor, network=none, filesystem=read-only, caps dropped)
- **L3**: Continuous runtime monitoring (weekly re-audit, drift detection)
- **WAF**: 38 attack signatures (SQLi, XSS, SSRF, path traversal)
- **Honeypot**: 50+ fake paths with 24h auto-ban
- **Threat Intel**: abuse.ch feeds (URLhaus + MalwareBazaar + ThreatFox)

## How to submit

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

That's it. You get back a `submission_id` and `skill_id`. L1.5 + L1.7 run synchronously (~5 seconds). L2 sandbox audit queues via GitHub Actions (~2 minutes). If it passes (score >= 7), your server is promoted to the catalog automatically within 1 hour.

## What you get

- **Signed Agent Trust Card (ATC)** — Ed25519, RFC 8785 JCS, schema v1.1.0. Verifiable by anyone at `GET https://marketnow.site/api/atc?action=verify&card_id=ATC-2026-XXXXXXX`
- **Sentinel certificate** — SHA-256 signed, with per-layer scores
- **Catalog listing** — your server appears alongside n8n (198k stars), Anthropic's inspector, Google's chrome-devtools-mcp, and Vibe
- **Public audit ledger** — every step is a git commit, visible in the repo

## What's already in the catalog

18 community-submitted servers, all with score 10/10:

- n8n (198k stars) — workflow automation
- worldmonitor (74k stars) — real-time intelligence
- Scrapling (71k stars) — web scraping framework
- ruflo (66k stars) — agent meta-harness
- TrendRadar (60k stars) — trend detection
- context7 (59k stars) — context management
- chrome-devtools-mcp (47k stars) — Chrome DevTools
- UI-TARS-desktop (38k stars) — UI automation
- fastmcp (26k stars) — MCP framework
- vibes-coded-mcp (1 star) — action-receipts (our first real external user!)

## Everything is free

- No payment required
- No subscription
- No API key needed to submit
- No auth needed to verify
- The catalog is public
- The audit ledger is public (GitHub)
- The ATC verification is public
- The MCP server (npx -y marketnow-mcp@1.7.0) is free

## Links

- Submit: https://marketnow.site/submit
- Spec: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/alicelabs-llc/marketnow
- npm: https://www.npmjs.com/package/marketnow-mcp

If you build MCP servers, this is free trust infrastructure. Use it.
