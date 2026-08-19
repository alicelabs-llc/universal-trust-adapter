# Two agent trust systems, zero merged code: the MarketNow ↔ Vibe mutual hop

**How two independently-developed MCP marketplace trust systems achieved bidirectional cryptographic receipt verification using only public ledgers and Ed25519 — with no PRs merged either way.**

---

Last week, something happened that I've been working toward since I started building MarketNow: another developer's agent trust system verified one of my receipts, and my system verified one of theirs. No code was merged between our repos. No shared database. No shared CA. Just two public ledgers, two Ed25519 keypairs, and a documented preimage format.

This is the story of how the MarketNow ↔ Vibe mutual hop came together, what it proves about cross-agent interoperability, and why the "Tier-1 mutual" pattern matters for the broader MCP ecosystem.

## The setup

**MarketNow** is an MCP marketplace with a 10-layer security audit pipeline (Sentinel). Every paid purchase emits an **action-receipt** — an Ed25519-signed delivery proof, canonicalized via RFC 8785 JCS, persisted to a public GitHub ledger at `_data/receipts/{receipt_id}.json`. The MarketNow CA keypair lives in Vercel env vars; the public key is fetchable at `GET /api/atc?action=ca-key`.

**Vibe** (built by Brad at doteyeso-ops / vibes-coded.com) is an MCP server for action-receipts with its own Ed25519 CA, its own preimage format, and its own public ledger. Vibe's preimage format is pipe-delimited:

```
agent_id|action|payload_digest|nonce|quote|ts|rt:<receipt_type>(|decision_ref)(|ref:<ref_code>)
```

Both systems use Ed25519 (RFC 8032). Both use public ledgers (GitHub for MarketNow, Vibe's own API for Vibe). Both have public CA keys. But they were developed independently, with different schemas, different persistence layers, and different preimage formats.

## The problem

The question was: **can these two systems verify each other's receipts without merging code?**

The traditional approach would be:
1. Pick one system as the "standard"
2. The other system implements a client library for it
3. Submit PRs back and forth
4. Maintain the integration forever

That's slow, fragile, and creates ownership disputes. We wanted something lighter.

## The Tier-1 mutual pattern

Brad proposed what he called "Tier-1 mutual": each side ships on their own, cites the other publicly, verifies via public ledgers, no PRs required. The pattern has three components:

1. **Public ledgers** — both sides persist receipts where anyone can fetch them
2. **Public CA keys** — both sides publish their Ed25519 public key at a known endpoint
3. **Documented preimage format** — both sides document exactly what bytes get signed

If you have all three, anyone can verify any receipt from either system. You don't need a shared library — you just need `crypto.verify()` and the right preimage.

## What we shipped

### Step 1: Vibe adds ref_code provenance binding

Brad added optional `ref_code` provenance to Vibe receipts. When `ref_bound: true`, the ref_code is embedded in the Ed25519 preimage as trailing `ref:<code>`. This means changing the ref_code changes the signature — tamper-evident provenance.

Vibe's sample endpoint demonstrates this:
```bash
curl -s "https://vibes-coded.com/api/v1/outcomes/action-receipt/sample?with_ref=true" | jq .receipt.ref_bound
# → true
```

### Step 2: MarketNow ships a Vibe receipt verifier

I wrote `lib/vibe-verifier.mjs` — 180 lines of Node.js that:
- Fetches Vibe's CA public key from their API (with 1-hour cache)
- Builds the preimage string from receipt fields per Vibe's documented format
- Verifies the Ed25519 signature using Node's built-in `crypto.verify()`
- Checks `ref_bound` (the ref_code must match the trailing preimage bytes)

```javascript
import { verifyVibeReceipt } from './lib/vibe-verifier.mjs';
const result = await verifyVibeReceipt(receipt, { ref_bound: true });
// → { valid: true, ref_bound_match: true }
```

### Step 3: MarketNow exposes a public verifier endpoint

```
GET https://marketnow.site/api/atc?action=verify-vibe-receipt
```

This endpoint fetches Vibe's sample receipt, verifies it locally, and returns the result. Anyone can run it — no auth, no API key, no payment.

### Step 4: Vibe verifies MarketNow receipts

Vibe can verify MarketNow receipts via:
```
GET https://marketnow.site/api/atc?action=verify-receipt&receipt_id=rcpt_c8b9dc67f88e4da5bd3a
```

MarketNow's receipts use RFC 8785 JCS canonicalization (a different format than Vibe's pipe-delimited preimage), but the same Ed25519 algorithm. Vibe's verifier fetches the receipt JSON, canonicalizes it, and verifies the signature.

## The mutual verification

Both directions now work. Here's the proof — run these yourself:

```bash
# MarketNow verifies a Vibe receipt
curl -s "https://marketnow.site/api/atc?action=verify-vibe-receipt" | jq '{valid, mutual_hop: .interop.mutual_hop}'
# → {"valid": true, "mutual_hop": "bidirectional_verified"}

# Vibe verifies a MarketNow receipt
curl -s "https://marketnow.site/api/atc?action=verify-receipt&receipt_id=rcpt_c8b9dc67f88e4da5bd3a" | jq '{valid, signature_valid}'
# → {"valid": true, "signature_valid": true}
```

Brad confirmed both directions from his side:

> "Re-ran both public curls from here. Confirmed: valid=true · signature_valid=true · ref_code=ref_f92d4211 · mutual_hop=bidirectional_verified. Mutual hop is live without merging code either way."

## What this proves

1. **Cross-CA receipt verification works.** Two independent CAs, two independent preimage formats, one crypto algorithm (Ed25519). No shared library required — just `crypto.verify()` and a documented preimage.

2. **Public ledgers are sufficient audit infrastructure.** GitHub's Contents API serves as our receipt ledger. Vibe's API serves as theirs. Anyone can fetch and verify — no database queries, no auth tokens, no rate limits that matter for verification.

3. **The Tier-1 mutual pattern scales.** We can add a third agent trust system tomorrow. They publish their CA key, document their preimage format, and ship a verifier endpoint. MarketNow and Vibe each add a verifier for the new system. No coordination meetings, no standards body, no shared repo. Just public endpoints and Ed25519.

4. **"No unpaid PRs" is the right frame.** Brad said it first: "No unpaid joint PR needed." Neither of us owes the other a PR. We each ship on our side, cite each other publicly, and the verification happens at the API boundary. This is lighter than a library dependency and more durable than a merged codebase.

## The honest part

This is still infrastructure, not product-market fit. The mutual hop is technically real and cryptographically verified, but:

- **0 paid purchases** have used the mutual hop (all skills are currently free)
- **0 autonomous agents** have verified receipts in production (the verifiers are called by humans running curl)
- **2 developers** are in the mutual hop (Brad and me) — not 200

The infrastructure exists before the use case finds it. When autonomous agents start making purchases and verifying receipts, the mutual hop will already be there. If we waited until "real" autonomous agents existed to build the interop, we'd be six months behind.

## What's next

- **More agent trust systems** can join the mutual hop by publishing CA keys + preimage formats + verifier endpoints
- **More MCP servers** can submit to MarketNow via `POST /api/submit-skill` — the L1.5 → L1.7 → L2 → promote → ATC pipeline is fully automated
- **The catalog** now has 15 community-submitted skills alongside 9,230 auto-discovered ones, including servers from Anthropic, Google, ByteDance, n8n, and Vibe

If you build MCP servers or agent trust systems and want to join the mutual hop, the endpoints are public and the code is open:

- MarketNow ATC spec: `https://marketnow.site/api/atc?action=spec`
- MarketNow CA public key: `https://marketnow.site/api/atc?action=ca-key`
- Vibe docs: `https://vibes-coded.com/docs/AGENT_INSTALL.md`
- Vibe citation-join pattern: `https://vibes-coded.com/patterns/CITATION_JOIN.md`

The mutual hop is live. The curls work. The ledgers are public. The rest is adoption.

---

*MarketNow is built by AliceLabs LLC (Wyoming, USA). The code is at [github.com/alicelabs-llc/marketnow](https://github.com/alicelabs-llc/marketnow). Vibe is at [vibes-coded.com](https://vibes-coded.com). Thanks to Brad (@doteyeso-ops) for the collaboration and the "Tier-1 mutual" framing — it turned out to be exactly right.*
