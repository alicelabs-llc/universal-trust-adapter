# Reddit Post — Ready to Publish

## For r/MCP

**Title:** Two agent trust systems, zero merged code: the MarketNow ↔ Vibe mutual hop (bidirectional Ed25519 verification, public ledgers, no shared CA)

**Body:**

Just published a writeup on how MarketNow and Vibe achieved bidirectional receipt verification without merging any code between the two repos.

**Blog post:** https://dev.to/edison_flores_6d2cd381b13/two-agent-trust-systems-zero-merged-code-the-marketnow-vibe-mutual-hop-3a8n

## TL;DR

- MarketNow has action-receipts (Ed25519 + RFC 8785 JCS, GitHub ledger)
- Vibe has action-receipts (Ed25519 + pipe-delimited preimage, their own ledger)
- Both have public CA keys at known endpoints
- Both document their preimage format

Result: each system can verify the other's receipts via public endpoints. No shared library, no shared database, no shared CA. Just Ed25519 and documented preimages.

## The curls (run them yourself)

```bash
# MarketNow verifies a Vibe receipt
curl -s "https://marketnow.site/api/atc?action=verify-vibe-receipt" | jq '{valid, mutual_hop: .interop.mutual_hop}'
# → {"valid": true, "mutual_hop": "bidirectional_verified"}

# Vibe verifies a MarketNow receipt
curl -s "https://marketnow.site/api/atc?action=verify-receipt&receipt_id=rcpt_c8b9dc67f88e4da5bd3a" | jq '{valid, signature_valid}'
# → {"valid": true, "signature_valid": true}
```

## The pattern

Brad (@doteyeso-ops) called it "Tier-1 mutual": each side ships on their own, cites the other publicly, verifies via public ledgers, no PRs required. The three components:

1. **Public ledgers** — both persist receipts where anyone can fetch them
2. **Public CA keys** — both publish Ed25519 public keys at known endpoints
3. **Documented preimage format** — both document exactly what bytes get signed

If you have all three, anyone can verify any receipt from either system. Just `crypto.verify()` and the right preimage.

## Honest reality

- 0 paid purchases have used the mutual hop (all skills currently free)
- 0 autonomous agents have verified receipts in production (humans running curl)
- 2 developers in the mutual hop (not 200)

But the infrastructure exists before the use case finds it. When autonomous agents start making purchases and verifying receipts, the mutual hop will already be there.

## Links

- Blog post: https://dev.to/edison_flores_6d2cd381b13/two-agent-trust-systems-zero-merged-code-the-marketnow-vibe-mutual-hop-3a8n
- MarketNow code: https://github.com/alicelabs-llc/marketnow
- MarketNow ATC spec: https://marketnow.site/api/atc?action=spec
- Vibe docs: https://vibes-coded.com/docs/AGENT_INSTALL.md
- Vibe citation-join pattern: https://vibes-coded.com/patterns/CITATION_JOIN.md

If you build MCP servers or agent trust systems and want to join the mutual hop, the endpoints are public and the code is open.

---

**Posting instructions:**

1. Go to https://www.reddit.com/r/MCP/submit
2. Title: "Two agent trust systems, zero merged code: the MarketNow ↔ Vibe mutual hop (bidirectional Ed25519 verification, public ledgers, no shared CA)"
3. URL: https://dev.to/edison_flores_6d2cd381b13/two-agent-trust-systems-zero-merged-code-the-marketnow-vibe-mutual-hop-3a8n
4. Flair: Discussion or Show & Tell

**Alternative subreddits:**
- r/MCP (primary — most targeted)
- r/AI_Agents (cross-post after 24h if traction)
- r/LocalLLaMA (cross-post after 48h if good traction)
- r/cline (mention since MarketNow MCP server works with Cline)

**Title alternatives:**
- "Bidirectional Ed25519 receipt verification between two MCP marketplaces — no shared CA, no merged code"
- "How two independent agent trust systems interop via public ledgers (with runnable curls)"
- "The Tier-1 mutual pattern: cross-agent receipt verification without PRs"
