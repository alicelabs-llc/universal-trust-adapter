# 🏆 Free MCP Security Challenge

## Submit your MCP server. Get a free 10-layer audit + signed trust card + catalog listing.

Everything is free. No payment, no subscription, no catch.

## How it works

1. **You submit your GitHub repo** via `POST /api/submit-skill` with your `repo_url`
2. **L1.5 + L1.7 run synchronously** (~5 seconds) — metadata checks + malware pattern detection
3. **L2 Docker sandbox audit queues** (~2 minutes, GitHub Actions) — gVisor, network=none, fs=read-only
4. **If it passes (score ≥ 7):**
   - Your server is promoted to the catalog (9,248+ skills)
   - A signed Agent Trust Card (ATC) is issued — Ed25519, RFC 8785 JCS, schema v1.1.0
   - A Sentinel certificate with per-layer scores is generated
5. **Everything is public** — the audit ledger is on GitHub, the ATC is verifiable by anyone

## What the audit checks (10 layers)

| Layer | What it checks |
|-------|---------------|
| L1.5 | Metadata (README, license, not archived, not stale) |
| L1.6 | 36 Semgrep rules + 18 secret patterns + OSV dependencies |
| L1.7 | 8 malware patterns + binary/launcher detection |
| L1.8 | 28 malware family signatures (Emotet, LockBit, Cobalt Strike, etc.) |
| L1.9 | 32 prompt injection defense rules |
| L2 | Docker sandbox (gVisor, network=none, fs=read-only, caps dropped) |
| L3 | Continuous runtime monitoring (weekly re-audit, drift detection) |
| WAF | 38 attack signatures |
| Honeypot | 50+ fake paths with 24h auto-ban |
| Threat Intel | abuse.ch feeds (URLhaus + MalwareBazaar + ThreatFox) |

## How to submit

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

Or use the MCP server (11 tools, free):
```bash
npx -y marketnow-mcp@1.7.0
```

## What's already in the catalog

18 community-submitted servers, including:
- n8n (198k stars)
- worldmonitor (74k stars)
- Scrapling (71k stars)
- context7 (59k stars)
- chrome-devtools-mcp (47k stars)
- Vibe (our first real external user — mutual hop verified)

## The challenge

- **Goal**: 100 community-submitted MCP servers by end of August 2026
- **Current**: 18
- **Reward**: Free ATC + Sentinel certificate + catalog listing for every server that passes
- **Bonus**: The top 3 servers by Sentinel score get a "Featured" badge in the catalog

## Everything is free

- Submit: free
- Audit: free
- ATC: free
- Catalog listing: free
- MCP server: free
- API: free
- Verification: free

**No payment required for anything in the marketplace.**

## Links

- Submit: https://marketnow.site/submit
- Spec: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm: https://www.npmjs.com/package/marketnow-mcp
- Blog post: https://dev.to/edison_flores_6d2cd381b13

## Labels
challenge, good-first-issue, help-wanted, community, free, mcp, security
