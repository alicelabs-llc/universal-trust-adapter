# ATC/1.4 — Unified Verification Profile (UVP)

**Status**: Production (2026-09-17) — formalizes what the ledger already serves
**Supersedes**: the informal "atc-v2" wire shape; verification gap found in the 2026-09-17 audit
**Not to be confused with**: [ATC/2.0 draft](./SPEC-v2.md) (content-addressed IDs, multi-sig) — a forward-looking proposal that no production card implements yet
**Schema**: [atc-1.4-uvp.json](./atc-1.4-uvp.json)
**Live endpoint**: `GET /api/atc?action=spec`

---

## 1. Why this profile exists

The 2026-09-17 integral audit found that **five card shapes coexisted** and that
the *real* cards — the 57 in the production ledger — could only be verified by
one internal path (`/api/atc`), while every other public verifier rejected them:

| Shape | Where it lives | Who verified it (before 1.4) |
|-------|----------------|------------------------------|
| ATC/1.0 spec card (`spec_version: "ATC/1.0"`) | SDK `issueATC`, test vectors | atc-sdk `verifyATCSync`, `marketnow_verify_atc_spec` |
| Production envelope (`schema_version: "1.1.0"`) | **the 57 real ledger cards** | only `/api/atc` (internal) |
| atc-v3 multi-sig (`atc_version: "3.0.0"`) | `/api/trust?action=issue` | `/api/trust` (structure + Ed25519) |
| atc-v2 (trust.js notion) | trust.js adapter | structure-only, and it **rejected** the real cards on a documentation-string mismatch |
| ATC/2.0 draft | SPEC-v2.md | nothing (draft) |

ATC/1.4 does not invent a new shape. It declares the **production envelope
canonical**, hardens it, and makes **every public verification surface accept
it**:

1. `GET /api/atc?action=verify&card_id=…` — served bytes, real Ed25519 (unchanged, the reference path)
2. `POST /api/trust {action:"verify", payload:<card>}` — now performs the same real Ed25519 verification for atc-v2 (was structure-only and rejected real cards)
3. `npm agent-trust-card` ≥ 1.2.0 — `verifyATCSync()` auto-detects ATC/1.0 spec cards **and** production 1.4 envelopes, real crypto on both
4. `npm marketnow-mcp` ≥ 1.12.0 — `marketnow_verify_atc_spec` accepts both formats; `marketnow_verify_trust` unchanged (calls the reference endpoint)

## 2. The canonical envelope

```
{
  "card_id": "ATC-2026-1509360",
  "status": "active" | "revoked" | "superseded",
  "payload": {
    "card_id": "ATC-2026-1509360",        // mirrors envelope
    "schema_version": "1.1.0",
    "decision_authority": "consumer",     // the card is evidence, not a verdict
    "agent_id": "skill.mn-sub-51326",
    "identity":   { "public_key": ..., "key_algorithm": "Ed25519" },
    "trust":      { "sentinel_review_score": 0-10, ... },   // evidence block
    "capabilities": { "provides": [...], "protocol_language": "mcp", "translate": true },
    "payment":    { "method": ..., "wallet_address": ... },
    "metadata":   { "issued_at": ..., "expires_at": ..., "issuer": ..., "revocation_url": ... }
  },
  "signature": {
    "algorithm": "Ed25519 (RFC 8032)",
    "value": "<64-byte hex over JCS(payload)>",
    "signed_by": "MarketNow Sentinel CA",
    "signed_at": "...",
    "canonicalization_method": "RFC_8785_JCS",   // authoritative marker
    "canonical_json": "RFC 8785 JCS",            // documentation spellings accepted
    "signed_payload_hash": "<sha256 hex of canonical bytes>",
    "ca_key_id": "mn-ca-003"                      // resolve via /api/atc?action=ca-key
  }
}
```

## 3. Verification algorithm (normative)

1. **Fetch the bytes** a stranger would fetch (served bytes, not reconstructed objects).
2. Parse; confirm the envelope fields (`card_id`, `status`, `payload`, `signature`).
3. Canonicalize **only** `payload` with RFC 8785 JCS.
4. `sha256(utf8(canonical))` must equal `signature.signed_payload_hash` (when present).
5. Ed25519-verify the canonical bytes against the CA key resolved from `signature.ca_key_id` via the CA key registry. **Unknown key ids and the retired-compromised mn-ca-002 fail closed.**
6. Lifecycle: `status` must be active; `expires_at` in the future; subject absent from the CRL (`GET /api/crl` or OCSP `GET /api/ocsp?card_id=…`).
7. Consume: the `trust` block is review evidence — **the consumer decides** (`decision_authority: "consumer"`).

**Golden rule**: `UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY`.

## 4. Security properties

- **Signature over canonical bytes only** (no domain prefix in the historical 1.x line — documented honestly; the CRL and atc-v3 use domain separation and must not be confused with card signatures).
- **Hash pre-check** (`signed_payload_hash`) lets a stranger diff canonicalizations byte-for-byte before touching crypto.
- **CA key registry awareness** — rotation history (`ca-key-001` retired → `mn-ca-002` retired-compromised → `mn-ca-003` active) is part of verification, not an afterthought.
- **Fail-closed everywhere** — malformed inputs, unknown keys, unknown formats, and responder errors all end in DENY, never in a success-shaped default.

## 5. Legacy compatibility

| Input | Behavior |
|-------|----------|
| ATC/1.0 spec card | Verifies via the 8-control conformance path; warning that it is a legacy shape |
| atc-v3 envelope | First signature verified with domain separation (`UTA-ATC-V3-CREDENTIAL:` prefix) |
| Bare production payload (no envelope) | Detected, then rejected with the precise reason: pass the complete card |

## 6. Test vectors

- Real ledger card: `GET /api/atc/ATC-2026-1509360.json` (revoked — also a revocation-path vector)
- Envelope bytes: `GET /api/atc?action=envelope&card_id=ATC-2026-1509360`
- CA keys: `GET /api/atc?action=ca-key`
- CRL: `GET /api/crl` (registry key `mn-revoc-002`, rotated 2026-09-17)
