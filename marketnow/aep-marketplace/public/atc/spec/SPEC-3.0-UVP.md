# ATC/3.0 — Unified Credential Profile (Core + Extended)

**Status**: Production (2026-09-17) — the single current Agent Trust Card version
**Replaces**: the interim "ATC/1.4" label issued earlier on 2026-09-17 (same envelope, same crypto — this is a re-versioning to converge on one number, not a format change)
**Finalizes**: [RFC-ATC-v3-Draft-00](../../../uta/docs/atc-spec/RFC-ATC-v3-Draft-00.md) (multi-format cryptographic profile, 2026-08-20) — its multi-sig shape becomes the **ATC/3.0-extended** profile below
**Supersedes**: the [ATC/2.0 draft](./SPEC-v2.md) (content-addressed IDs, multi-sig) — never implemented, withdrawn
**Legacy**: ATC/1.0 spec cards and atc-v2 envelopes still verify, with explicit deprecation warnings
**Schema**: [atc-3.0.json](./atc-3.0.json)
**Live endpoint**: `GET /api/atc?action=spec`

---

## 1. One version, two conformance profiles

The 2026-09-17 integral audit found **five card shapes** coexisting (ATC/1.0 spec cards,
the production envelope, the atc-v3 multi-sig shape, the trust.js "atc-v2" notion, and
the ATC/2.0 draft). ATC/3.0 collapses them into **one current version with two profiles**:

| Profile | Shape | Signatures | Who must support it |
|---------|-------|-----------|---------------------|
| **ATC/3.0-core** | `{card_id, status, payload, signature}` — the production envelope (payload `schema_version: "1.1.0"`) | One Ed25519 (RFC 8032) over JCS(payload) | **Every issuer and every verifier** — this is the wire format the MarketNow ledger serves today (57 cards, unchanged) |
| **ATC/3.0-extended** | `{atc_version: "3.0.0", signatures: [...]}` (RFC-ATC-v3-Draft-00 shape) | `atc-ed25519` (required) + `eat-cwt` / `w3c-vc` (optional) | Issuers that need TEE attestation (IETF EAT) or W3C VC interop; verifiers MAY support it |

The mapping follows the RFC's own design principle: *"The minimum required is one valid
signature."* The production envelope **is** that minimum — so it is not a legacy shape to
be apologized for; it is the core of 3.0. The multi-format capability of the v3 RFC draft
is not discarded either; it is the extended profile, opt-in for issuers, never required
for verifiers.

**Version ladder, resolved**: ATC/1.0 (legacy, still verifies) → ATC/2.0 (draft, withdrawn,
never shipped) → **ATC/3.0 (current: core + extended)**. There is no other current number.

## 2. The ATC/3.0-core envelope (normative)

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

Payload `schema_version` stays `"1.1.0"` — the envelope's wire identity is the profile
(ATC/3.0-core), not a new payload schema. The 57 production cards conform as-is; **no
re-issuance is required**.

## 3. The ATC/3.0-extended profile (from RFC-ATC-v3-Draft-00)

An extended credential carries the same subject/evidence semantics plus:

- `atc_version: "3.0.0"` and a `signatures[]` array — each entry signs the same
  canonical payload in a different format (`atc-ed25519`, `eat-cwt`, `w3c-vc`).
- **Artifact binding** (git SHA / npm tarball / OCI digest) as evidence.
- Domain separation: the Ed25519 entry signs with the `UTA-ATC-V3-CREDENTIAL:` prefix.
- Backward compatibility (RFC principle 1): core envelopes remain valid; an extended
  verifier treats a core envelope as a single-signature credential.

Implemented today: `atc-sdk/src/v3/` (`issueATCv3` / `verifyATCv3`), verified by
`/api/trust` (auto-detected, Ed25519 entry verified). TEE attestation (SGX/SEV-SNP/Nitro)
arrives with EAT-CWT adoption — the profile leaves room for it without forcing it.

## 4. Verification algorithm (normative, both profiles)

1. **Fetch the bytes** a stranger would fetch (served bytes, not reconstructed objects).
2. Parse; detect the profile structurally — envelope fields → **3.0-core**;
   `atc_version` "3.x" + `signatures[]` → **3.0-extended**; `spec_version: "ATC/1.0"` → legacy.
3. Canonicalize **only** the payload with RFC 8785 JCS.
4. `sha256(utf8(canonical))` must equal `signature.signed_payload_hash` (when present).
5. Ed25519-verify the canonical bytes against the CA key resolved from `signature.ca_key_id`
   via the CA key registry. **Unknown key ids and the retired-compromised mn-ca-002 fail closed.**
6. Lifecycle: `status` must be active; `expires_at` in the future; subject absent from the CRL
   (`GET /api/crl` or OCSP `GET /api/ocsp?card_id=…`).
7. Consume: the `trust` block is review evidence — **the consumer decides**
   (`decision_authority: "consumer"`).

**Golden rule**: `UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY`.

## 5. Security properties

- **Signature over canonical bytes only** in the core profile (no domain prefix in the
  historical line — documented honestly; the CRL and the extended profile use domain
  separation and must not be confused with core card signatures).
- **Hash pre-check** (`signed_payload_hash`) lets a stranger diff canonicalizations
  byte-for-byte before touching crypto.
- **CA key registry awareness** — rotation history (`ca-key-001` retired → `mn-ca-002`
  retired-compromised → `mn-ca-003` active) is part of verification, not an afterthought.
- **Fail-closed everywhere** — malformed inputs, unknown keys, unknown formats, and
  responder errors all end in DENY, never in a success-shaped default.
- **One canonical number** — verifiers report `spec_version: "ATC/3.0"` with
  `profile: "core" | "extended"`; anything else is legacy with a warning.

## 6. Verification surfaces (all accept 3.0-core)

1. `GET /api/atc?action=verify&card_id=…` — served bytes, real Ed25519 (reference path)
2. `POST /api/trust {action:"verify", payload:<card>}` — same crypto, envelope auto-detected
3. `npm agent-trust-card` ≥ 1.3.0 — `verifyATCSync()` auto-detects ATC/3.0-core envelopes and ATC/1.0 spec cards, real crypto on both
4. `npm marketnow-mcp` ≥ 1.13.0 — `marketnow_verify_atc_spec` accepts both formats; `marketnow_verify_trust` calls the reference endpoint

## 7. Legacy compatibility

| Input | Behavior |
|-------|----------|
| ATC/1.0 spec card | Verifies via the 8-control conformance path; warning that it is a legacy shape |
| atc-v3 draft envelope (`atc_version: "3.0.0"`, `signatures[]`) | Verified as **ATC/3.0-extended** (first signature, domain-separated) |
| Bare production payload (no envelope) | Detected, then rejected with the precise reason: pass the complete card |

## 8. Test vectors

- Real ledger card: `GET /api/atc/ATC-2026-1509360.json` (revoked — also a revocation-path vector)
- Envelope bytes: `GET /api/atc?action=envelope&card_id=ATC-2026-1509360`
- CA keys: `GET /api/atc?action=ca-key`
- CRL: `GET /api/crl` (registry key `mn-revoc-002`, rotated 2026-09-17)
- Extended profile: `atc-sdk` `src/v3` test vectors (issue → verify → mutate → verify breaks)
