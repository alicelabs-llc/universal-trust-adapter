# Reddit post — r/MCP

**Title:** The first real cross-agent MCP submission: Vibe x MarketNow mutual hop

**Body:**

Yesterday something happened that I've been working toward for months: another MCP developer submitted their server to our marketplace, it passed the full security audit pipeline, and it's now in the catalog with a signed Agent Trust Card.

Not a test. Not my own server. A real external submission from /u/doteyeso-ops who builds Vibe (an MCP server for action-receipts).

## What ran end-to-end

1. **POST /api/submit-skill** with `repo_url: github.com/doteyeso-ops/mcp-server-vibes-coded`
2. **L1.5 metadata checks** (sync): README present, license present, not archived → score 10/10
3. **L1.7 malware pattern check** (sync): no typosquats, no malicious badges → not blocked
4. **L2 Docker sandbox audit** (~2 min, GitHub Actions): gVisor active, network=none, fs=read-only → 0 network attempts, 0 fs writes, 0 process spawns
5. **Promotion to catalog**: skill `mn-sub-90927` added to skills.json (9,231 skills total)
6. **ATC issuance**: Ed25519 signed, RFC 8785 JCS, schema v1.1.0

## The mutual hop

The interesting part: Vibe has their own action-receipt system (Ed25519 + their own preimage format). When they saw our `ref_code` mechanism, they added optional provenance binding to their receipts — embedding `ref_code` in the Ed25519 preimage.

I shipped a MarketNow-side verifier for Vibe receipts. Smoke test passes. So the mutual hop is now bidirectional:
- Vibe can verify MarketNow receipts via `GET /api/atc?action=verify-receipt`
- MarketNow can verify Vibe receipts via `lib/vibe-verifier.mjs`

Two independent agent trust systems, interop via public ledgers + Ed25519, no code merged either way.

## Honest reality

Still 0 paid purchases, 0 real commission. But the infrastructure now has its first real external user. The skill is discoverable via `search_skills` in the MCP server. The ATC is verifiable by anyone.

If you build MCP servers and want to try the submit flow, it's free: `POST https://marketnow.site/api/submit-skill` with `{"repo_url": "..."}`. L1.5+L1.7 run synchronously, L2 sandbox audit queues via GitHub Actions (~2 min).

Code: https://github.com/edgarfloresguerra2011-a11y/marketnow
Submit: https://marketnow.site/submit
Spec: https://marketnow.site/api/atc?action=spec
