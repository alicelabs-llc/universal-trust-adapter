# 🏆 AliceLabs Partnership Program — Free Alliance for Agent Trust

## What is this?

AliceLabs LLC is building the trust layer for agent commerce. We're inviting agent frameworks, MCP server developers, security researchers, and standards bodies to join a **free alliance** for agent trust infrastructure.

## What we offer (all free)

### For Agent Frameworks (AutoGen, CrewAI, LangChain, Cline, Cursor, etc.)

1. **Free ATC verification** — your agents can verify any MarketNow ATC at `GET /api/atc?action=verify&card_id=...` (no auth, no rate limit)
2. **Free skill discovery** — `GET /api/search?q=...` returns 9,248 audited skills
3. **Free submission** — your users can submit their MCP servers via `POST /api/submit-skill`
4. **Free receipts** — signed delivery proof for any purchase (Ed25519 + RFC 8785 JCS)
5. **Free Vibe cross-verification** — verify Vibe receipts via `GET /api/atc?action=verify-vibe-receipt`
6. **Free referral tracking** — agents earn 5% commission on referred purchases

### For MCP Server Developers

1. **Free 10-layer security audit** — L1.5 → L1.9 → L2 sandbox → L3 monitoring
2. **Free signed ATC** — Ed25519, RFC 8785 JCS, schema v1.1.0
3. **Free catalog listing** — appear alongside n8n, Anthropic, Google, ByteDance servers
4. **Free Sentinel certificate** — SHA-256 signed, per-layer scores
5. **Free public audit ledger** — every step is a git commit, visible on GitHub

### For Security Researchers

1. **Free security review** — audit our code, report findings, get credit
2. **Free bug bounty** — report vulnerabilities in the Sentinel pipeline, get listed as contributor
3. **Free malware samples** — submit malware patterns to L1.8, get credit in the signatures
4. **Free peer review** — review the ATC schema, receipt format, or L2 sandbox design

### For Standards Bodies (CNCF, IETF, W3C)

1. **Free prior art** — our ATC schema, receipt format, and cross-CA verification are open
2. **Free reference implementation** — `lib/vibe-verifier.mjs` shows cross-CA Ed25519 verification
3. **Free test vectors** — real receipts and ATCs verifiable at public endpoints
4. **Free collaboration** — we'll contribute to any standard that needs agent trust examples

## What we ask in return

Nothing. This is a free alliance. No payment, no exclusivity, no lock-in.

If you integrate and want to cite us, great. If you don't, that's fine too. The endpoints are public, the code is open, the ledgers are verifiable.

## Current allies

| Ally | Integration | Status |
|------|-------------|--------|
| **Vibe** (vibes-coded.com) | Bidirectional receipt verification | ✅ Live |
| **@doteyeso-ops** | Mutual hop, ref_code provenance | ✅ Confirmed |
| **@rushabdev** | Security peer review (11 findings) | ✅ Fixed |
| **@angguntrie3-lgtm** | Security review (new) | ⏳ Pending |
| **@Sravan1011** | Cancel API (#22) | ⏳ Assigned |

## How to join

### As an agent framework

Add MarketNow to your MCP config:
```json
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp@1.7.0"]
    }
  }
}
```

Or call our API directly — no library needed.

### As an MCP server developer

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

### As a security researcher

Open an issue at https://github.com/edgarfloresguerra2011-a11y/marketnow/issues with your findings. We review within 24h and credit all contributors.

### As a standards body

Contact us at legal@alicelabs.site or comment on this issue. We'll share schema docs, test vectors, and reference implementations.

## What this is NOT

- ❌ Not a paid partnership
- ❌ Not exclusive
- ❌ Not a subscription
- ❌ Not a token sale
- ❌ Not a data-sharing agreement
- ❌ Not a lock-in

## The goal

**Make agent trust infrastructure free, open, and interoperable.** AliceLabs builds the trust layer. Everyone benefits. No one pays for verification.

## Links

- Spec: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm: https://www.npmjs.com/package/marketnow-mcp
- Contact: legal@alicelabs.site | support@alicelabs.site | info@alicelabs.site
