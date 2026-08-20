# ATC/2.0 — Agent Trust Card Protocol Specification

**Status**: Draft v2.0.0 — public for review
**Issued**: 2026-11-15
**Supersedes**: ATC/1.0 (2026-08-10) and the interim multi-sig branch (schema_version 1.2.0)
**Author**: Edison Flores, AliceLabs LLC
**Repository**: https://marketnow.site/atc
**License**: MNNC-1.0 (AliceLabs LLC Proprietary) for the reference implementation; the specification itself is published under the [W3C Community Group Final Specification Agreement](https://www.w3.org/community/about/agreements/final/) terms for community contributions.
**Prior art**: See [PRIOR-ART-TIMELINE.md](./PRIOR-ART-TIMELINE.md)
**Migration guide**: See [MIGRATION-v1-to-v2.md](./MIGRATION-v1-to-v2.md)

---

## 1. Introduction

### 1.1 Motivation

ATC/1.0 proved the model: a cryptographically verifiable, offline-friendly, capability-bounded, revocable credential for autonomous AI agents. Since the 1.0 release on 2026-08-10, three production deployments and the MarketNow Sentinel CA itself have surfaced limitations that v2.0 must address:

1. **Single-CA trust is fragile.** A single compromised CA key forges every card it ever signed. Production deployments handling >$1000 per agent transaction (the MarketNow Payments bridge, the AliceLabs Cross-Border Settlement agent, the Sentinel Treasury bot) need at least two independent attestations to be trustworthy. ATC/1.0 had only one `signature` field.
2. **Evidence is not independently verifiable.** In ATC/1.0, the Sentinel score, sandbox results, and malware scan were embedded as plain JSON inside the `evidence` block but signed only once by the issuing CA. If a downstream consumer wanted to re-verify that the Sentinel score was actually produced by Sentinel (and not invented by the agent's owner), it had to call Sentinel out-of-band. ATC/2.0 fixes this: every evidence item carries its own Ed25519 signature from its producer.
3. **Delegation was bolted on.** ATC/1.0 included an `ATC-009` delegation control with a hard-coded depth limit of 3 and a single `delegation_signature` field — sufficient for `CA → A → B → C` but not for the deeper chains appearing in real MCP server fan-out. ATC/2.0 promotes delegation to a first-class, structured block with `delegation_chain_depth` (max 5) and a `delegation_scope` that is auditable.
4. **Post-quantum migration has no path.** ATC/1.0 mandated Ed25519 (which is breakable by a sufficiently large quantum computer running Shor's algorithm) and deferred PQ migration to "ATC/1.1" with no concrete field. ATC/2.0 makes the `algorithm` field extensible to `ML-DSA-65` (NIST FIPS 204, the post-quantum lattice signature standard) and adds a `pq_migration_path` field so each card documents when it must be re-issued with a PQ algorithm.
5. **Card IDs were random.** ATC/1.0 used `ATC-YYYY-NNNNNNN` — a random 7-digit suffix. This means a card's ID had no relationship to its content. A verifier had to fetch the card out-of-band to know its content; the ID alone was useless for integrity verification. ATC/2.0 derives the card ID from the SHA-256 of its canonical payload, so the ID *is* a content address: tampering changes the ID.
6. **Trust decisions were implicit.** In ATC/1.0, the `/api/trust` endpoint returned a JSON object that the runtime would consume separately from the ATC. This created a TOCTOU (time-of-check/time-of-use) gap: the ATC could be issued with one trust score, but `/api/trust` could return another at runtime. ATC/2.0 embeds the trust decision inside the card itself via the `trust_decision` block.
7. **No version differentiation in the wire format.** ATC/1.0 used `spec_version: "ATC/1.0"` (string) but had no machine-readable `schema_version`. The interim 1.2.0 multi-sig branch added `schema_version` as a string but it never officially shipped. ATC/2.0 mandates both fields: `spec_version: "ATC/2.0"` and `schema_version: "2.0.0"`.

ATC/2.0 is a **breaking change**. Implementers MUST NOT mix v1 and v2 fields in the same card. See the [migration guide](./MIGRATION-v1-to-v2.md).

### 1.2 Scope

ATC/2.0 specifies:

- The structure of an Agent Trust Card (ATC) — same envelope concept as v1, new fields
- The Certificate Authority (CA) that issues ATCs
- The signature algorithms: Ed25519 (RFC 8032) for the present, ML-DSA-65 (FIPS 204) for the post-quantum future
- The canonical JSON encoding (RFC 8785 JCS)
- The **multi-signature verification protocol** (v2 introduces `signatures` array)
- The **evidence chain verification protocol** (v2 introduces `evidence_chain` array, each item independently signed by its producer)
- The **delegation chain verification protocol** (v2 introduces structured delegation block with chain depth)
- The **content-addressed card ID derivation** (v2 card IDs are derived from the card's own canonical payload)
- The **trust decision embedding** (v2 includes `trust_decision` block inside the card)
- The revocation protocol (unchanged from v1)
- The capability manifest (unchanged from v1)
- The trust score semantics (mostly unchanged; the `decision_authority` enum gains a `joint` value)

ATC/2.0 does **not** specify:

- How agents discover each other (use A2A, MCP, or any registry)
- How agents negotiate sessions (use any transport)
- How agents pay each other (use x402, Lightning, or any payment protocol)
- How agents enforce the capabilities (use any runtime interceptor)
- The CA transparency log / Merkle tree (deferred to ATC/3.0)
- DID integration (deferred to ATC/3.0)
- Capability revocation distinct from card revocation (deferred to ATC/3.0)

### 1.3 Design principles

ATC/2.0 inherits all 7 design principles from ATC/1.0 and adds three more:

1. **Cryptographic verifiability** — every claim in an ATC is signed by a CA whose public key is independently retrievable. Verification never requires a network call to the CA. *(inherited)*
2. **Offline-friendly** — an ATC is a self-contained JSON document. A peer agent can verify it without calling home. *(inherited)*
3. **Revocation-aware** — agents SHOULD check revocation status before trusting; ATCs include the revocation endpoint URL. *(inherited)*
4. **Capability-bounded** — an ATC declares what the agent is allowed to do. Runtimes SHOULD enforce these bounds. *(inherited)*
5. **Evidence-carrying** — an ATC carries its audit evidence (Sentinel score, sandbox results, malware scan) so a verifier does not need to re-audit. *(inherited, strengthened in v2 — see principle 9)*
6. **Time-bounded** — every ATC has `issued_at` and `expires_at`. Verifiers reject expired cards. *(inherited)*
7. **Algorithm-agile** — v2 explicitly supports `Ed25519` and `ML-DSA-65`, with a `pq_migration_path` documenting the planned re-issue date. *(strengthened from v1)*
8. **Content-addressed (NEW)** — the v2 card ID is the first 16 hex characters of the SHA-256 of the card's canonical payload (with the signatures array stubbed). This makes cards self-verifying: tampering changes the ID, and a verifier can recompute the ID from the payload alone.
9. **Independently-verifiable evidence (NEW)** — every item in the `evidence_chain` array carries its own Ed25519 signature from its producer (Sentinel, sandbox runtime, malware scanner, prompt-injection checker). A verifier can confirm that Sentinel actually produced a score without trusting the issuing CA.
10. **Multi-authority trust (NEW)** — a v2 card MAY carry multiple signatures from different CAs. The card is valid only if at least `required_signatures` valid signatures from distinct CAs are present.

---

## 2. The 10 Controls

ATC/2.0 keeps the 10-control structure from v1. Every conformant implementation MUST support all 10. The semantics of each control are updated for v2 where indicated.

| # | Control ID | Name | Required | v2 changes |
|---|-----------|------|----------|------------|
| 1 | ATC-001 | Identity | ✅ | None (forward-compatible) |
| 2 | ATC-002 | Attestation | ✅ | `signature` (single) → `signatures` (array); adds `algorithm` enum with `ML-DSA-65` |
| 3 | ATC-003 | Capabilities | ✅ | None |
| 4 | ATC-004 | Evidence | ✅ | Promoted: evidence items now first-class `evidence_chain` array with per-item signatures (NEW control structure, see ATC-004-E) |
| 5 | ATC-005 | Risk | ✅ | `decision_authority` enum gains `joint` |
| 6 | ATC-006 | Signature | ✅ | Replaced by ATC-006-M (multi-signature) — verification loops over `signatures` array |
| 7 | ATC-007 | Revocation | ✅ | None |
| 8 | ATC-008 | Expiration | ✅ | None |
| 9 | ATC-009 | Delegation | Optional | Promoted to first-class: structured `delegation` block with `delegation_chain_depth` (max 5), `delegation_scope`, `delegated_by` |
| 10 | ATC-010 | Runtime Trust | Optional | None (still optional, still soft) |
| — | ATC-011 | Trust Decision | ✅ NEW | New required control: `trust_decision` block (what `/api/trust` returned in v1) |
| — | ATC-012 | Content-Addressed Card ID | ✅ NEW | New required control: card_id is derived from canonical payload hash |

A conformant ATC/2.0 card MUST include controls 001, 002, 003, 004-E (evidence_chain), 005, 006-M (multi-sig), 007, 008, 011, 012. Controls 009 and 010 remain optional but recommended.

---

## ATC-001 — Identity

**Purpose**: Uniquely and cryptographically identify the agent. Unchanged from v1.

**Fields**:

```json
{
  "identity": {
    "agent_id": "string — UUID v4 or org-defined unique identifier",
    "agent_name": "string — human-readable name",
    "agent_owner": "string — organization or individual",
    "owner_contact": "string — mailto: or https: URL"
  }
}
```

**Rules** (unchanged from v1):

- `agent_id` MUST be globally unique. RECOMMENDED: UUID v4. Alternatively: `<org>-<random>` (e.g. `alicelabs-7f3a9c2d`).
- `agent_id` MUST NOT exceed 128 characters.
- `agent_name` MUST NOT exceed 100 characters.
- `owner_contact` SHOULD be a `mailto:` URL or `https:` URL.

**v2 note**: The `identity` block is now folded into the canonical payload used for content-addressing (see ATC-012). A change to any identity field changes the `card_id`.

---

## ATC-002 — Attestation

**Purpose**: Bind the identity to one or more public keys, signed by one or more CAs. This is the cryptographic core of the ATC. In v2, the single `signature` field becomes a `signatures` array, even for single-CA cards.

**Issuer fields**:

```json
{
  "issuer": {
    "ca_id": "alicelabs-sentinel-ca",
    "ca_public_key": "base64...32bytes",
    "ca_algorithm": "Ed25519",
    "ca_url": "https://marketnow.site/api/atc",
    "ca_key_id": "string — opaque identifier for this CA key (used to look up the public key when CA rotates; e.g. 'sentinel-ca-2026-q4')"
  }
}
```

**v2 change**: `ca_key_id` is REQUIRED in v2 (was absent in v1). When the CA rotates its keypair, the new key gets a new `ca_key_id`, and v2 verifiers MUST use this ID (not the CA's URL alone) to look up the correct verification key. This prevents the v1 bug where a card signed with the deprecated CA key would be rejected against the rotated key — the `ca_key_id` makes the intended key explicit.

**Attestation fields**:

```json
{
  "attestation": {
    "subject_public_key": "string — base64 Ed25519 or ML-DSA-65 public key of the agent",
    "subject_algorithm": "Ed25519 | ML-DSA-65",
    "pq_migration_path": {
      "target_algorithm": "ML-DSA-65",
      "reissue_before": "string — ISO 8601 date by which the card MUST be re-issued with PQ algorithm",
      "migration_status": "enum — not_started | in_progress | complete"
    },
    "canonicalization": "RFC 8785 JCS",
    "signed_payload_hash": "string — hex SHA-256 of the canonical payload"
  }
}
```

**v2 changes**:

1. `subject_algorithm` enum now accepts `Ed25519` AND `ML-DSA-65`. Implementations MUST support `Ed25519`; `ML-DSA-65` is OPTIONAL during the migration window but MUST be supported by 2027-12-31.
2. NEW field `pq_migration_path`. For Ed25519 cards, this field is RECOMMENDED (to document when re-issue is planned). For `ML-DSA-65` cards, this field MAY be omitted (the card is already PQ).
3. NEW field `canonicalization`. MUST be the literal string `"RFC 8785 JCS"`. This field makes the canonicalization method explicit in the card itself.
4. The `signature` field is GONE — it has been replaced by the `signatures` array (see ATC-006-M).

**Rules**:

- The `signed_payload_hash` is the hex SHA-256 of the RFC 8785 JCS canonical form of the ATC payload (everything in the ATC EXCEPT the `signatures` array — the `attestation.signed_payload_hash` itself is included in the canonical form set to `""`).
- `ca_key_id` MUST be present. Verifiers use this to look up the correct CA public key during key rotation.

---

## ATC-003 — Capabilities

**Purpose**: Declare what the agent is allowed to do. Runtimes SHOULD enforce these bounds. Unchanged from v1.

**Fields** (identical to v1):

```json
{
  "capabilities": {
    "filesystem": {
      "read": ["enum — none | own_dir | temp_dir | home_dir | system | all"],
      "write": ["enum — none | own_dir | temp_dir | home_dir | system | all"]
    },
    "network": {
      "egress": ["enum — none | allowlist | all"],
      "ingress": ["enum — none | bound_ports | all"]
    },
    "shell": {
      "exec": ["enum — none | sandboxed | unrestricted"],
      "spawn": ["enum — none | sandboxed | unrestricted"]
    },
    "credentials": {
      "read_env": ["enum — none | allowlist | all"],
      "read_files": ["enum — none | allowlist | all"]
    },
    "process": {
      "subprocess": ["enum — none | sandboxed | unrestricted"],
      "signals": ["enum — none | own | all"]
    }
  }
}
```

**Rules** (unchanged from v1): every capability category MUST be present, even if all values are `none`.

**v2 note**: When `delegation` is present, the `delegation_scope` MUST be a subset of these capabilities. See ATC-009.

---

## ATC-004-E — Evidence Chain (v2 — replaces v1 ATC-004)

**Purpose**: Carry the security audit evidence so a verifier does not need to re-audit. In v2, each evidence item is independently signed by its producer, making the evidence tamper-evident and independently verifiable without trusting the issuing CA.

**Top-level field** (NEW in v2 — replaces the v1 `evidence` object):

```json
{
  "evidence_chain": [
    {
      "evidence_id": "string — unique within this card (e.g. 'sentinel-score-001')",
      "evidence_type": "enum — sentinel_score | sandbox_results | malware_scan | prompt_injection_check",
      "produced_by": {
        "producer_id": "string — e.g. 'alicelabs-sentinel'",
        "producer_key_id": "string — opaque identifier for the producer's signing key",
        "producer_public_key": "string — base64 Ed25519 public key (32 bytes)",
        "producer_url": "string — URL where the producer publishes its key"
      },
      "produced_at": "string — ISO 8601 timestamp",
      "content_hash": "string — hex SHA-256 of the canonical content payload (RFC 8785 JCS of `content`)",
      "content": {
        "...type-specific fields..."
      },
      "signature": {
        "algorithm": "Ed25519",
        "value": "string — base64 Ed25519 signature by the producer over RFC 8785 JCS of `content`",
        "signed_at": "string — ISO 8601 timestamp"
      }
    }
  ]
}
```

**Per-type content shape**:

#### `evidence_type: sentinel_score`

```json
{
  "content": {
    "score": 9,
    "risk_level": "low",
    "layers_passed": ["L1.5", "L1.6", "L1.9", "L2.5", "L3"],
    "layers_failed": [],
    "explanation": "Clean audit, no high-severity findings."
  }
}
```

#### `evidence_type: sandbox_results`

```json
{
  "content": {
    "sandbox_runtime_ms": 4520,
    "sandbox_exit_code": 0,
    "sandbox_network_blocked": true,
    "sandbox_fs_read_only": true,
    "sandbox_cap_drop_all": true,
    "interceptor_blocks": 0,
    "interceptor_warns": 2
  }
}
```

#### `evidence_type: malware_scan`

```json
{
  "content": {
    "malware_patterns_count": 0,
    "malware_family_signatures_count": 0,
    "dependency_scan": true,
    "semgrep_rules_count": 142,
    "secret_patterns_count": 0
  }
}
```

#### `evidence_type: prompt_injection_check`

```json
{
  "content": {
    "prompt_injection_rules_count": 87,
    "injection_attempts_detected": 0,
    "max_severity": "none"
  }
}
```

**Rules**:

1. The `evidence_chain` array MUST be ordered. RECOMMENDED order: `sentinel_score` first, then `sandbox_results`, then `malware_scan`, then `prompt_injection_check`. The order is part of the canonical payload.
2. Each `evidence_id` MUST be unique within the card.
3. The `content_hash` MUST be the hex SHA-256 of the RFC 8785 JCS canonical form of the `content` object (NOT including the surrounding envelope).
4. The `signature.value` MUST be the base64 Ed25519 signature of the same canonical bytes (RFC 8785 JCS of `content`). The producer signs ONLY the `content` — NOT the entire evidence envelope, NOT the entire card.
5. The verifier MUST independently verify each evidence item:
   - Recompute RFC 8785 JCS of `content`
   - Recompute SHA-256
   - Verify `content_hash` matches
   - Verify Ed25519 signature using `producer_public_key`
6. If ANY evidence item fails verification, the verifier MUST downgrade trust by at least 2 points (e.g. from 9 → 7) and SHOULD reject if `decision_authority` is `joint` (see ATC-005).
7. A card MAY omit `evidence_type` values that don't apply. For example, an agent that cannot be sandboxed (e.g. a read-only data API) MAY omit `sandbox_results`. The verifier MAY downgrade trust by 1 point per missing evidence type.
8. The `produced_at` timestamp of each evidence item MUST be ≤ `validity.issued_at` of the card. Evidence produced after the card's issuance is suspicious.
9. Evidence signatures are independent of the card's CA signatures. A producer's compromised key does NOT compromise the card's CA signatures, and a compromised CA key does NOT forge evidence producer signatures.

**Why this matters**: In v1, a malicious CA could fabricate evidence by editing the `evidence` block before signing the card. In v2, the malicious CA still controls which evidence items appear in the card, but cannot forge a Sentinel signature — so if Sentinel's key is not compromised, a fabricated Sentinel score will fail evidence verification.

---

## ATC-005 — Risk

**Purpose**: Provide a machine-readable trust score derived from the evidence.

**Fields**:

```json
{
  "risk": {
    "trust_score": 9,
    "risk_level": "low",
    "decision_authority": "issuer | consumer | joint",
    "score_explanation": "Clean audit, no high-severity findings, sandbox exit code 0.",
    "scored_at": "2026-11-15T10:30:00Z"
  }
}
```

**Rules**:

- `trust_score` is an integer from 0 (untrusted) to 10 (highly trusted).
- `risk_level` is derived from `trust_score`:
  - 8–10 → `low`
  - 5–7 → `medium`
  - 2–4 → `high`
  - 0–1 → `critical`
- `decision_authority` enum:
  - `issuer` — the issuing CA makes the final trust decision; the consumer MUST accept it. (Reserved for high-trust CAs; not common.)
  - `consumer` — the consumer's runtime makes the final trust decision (v1 default; still the most common).
  - `joint` (NEW in v2) — both issuer and consumer MUST agree. If the consumer's runtime disagrees with the issuer's `trust_score` (by more than ±2 points), the card is REJECTED. Use this for high-value agents where both parties must independently concur.
- `score_explanation` MUST be present and human-readable.
- `scored_at` MUST be ≤ `validity.issued_at` (the score must be computed before the card is issued).

**v2 change**: `decision_authority` gains the `joint` value. The v1 schema forced `decision_authority: "consumer"` via `const`; v2 lifts that restriction.

---

## ATC-006-M — Multi-Signature (v2 — replaces v1 ATC-006)

**Purpose**: Bind the entire ATC to one or more CA private keys. In v2, even single-CA cards use the `signatures` array (with one entry).

**Algorithm**: Ed25519 (RFC 8032) or ML-DSA-65 (FIPS 204) per signature.

**Canonical form**: RFC 8785 JCS (JSON Canonicalization Scheme)

**Signatures array**:

```json
{
  "signatures": [
    {
      "signer_id": "string — CA identifier (e.g. 'alicelabs-sentinel-ca')",
      "ca_key_id": "string — opaque identifier for this CA key (links to issuer.ca_key_id)",
      "algorithm": "Ed25519 | ML-DSA-65",
      "value": "string — base64 signature bytes",
      "signed_at": "string — ISO 8601 timestamp",
      "canonicalization": "RFC 8785 JCS"
    }
  ]
}
```

**Multi-sig metadata** (top-level, NEW in v2):

```json
{
  "multi_sig": {
    "required_signatures": 2,
    "distinct_cas_required": true,
    "policy": "string — human-readable description of the multi-sig policy (e.g. 'MarketNow + Independent Auditor for >$1000 transactions')"
  }
}
```

**Signing process** (per signature):

1. Take the full ATC JSON document.
2. Set `signatures[i].value` to `""` (empty string) for the entry being computed; leave other entries intact (this allows appending signatures without invalidating earlier ones — see "Append signing" below).
3. Set `attestation.signed_payload_hash` to `""` (empty string).
4. Apply RFC 8785 JCS to produce canonical bytes.
5. Compute SHA-256 of the canonical bytes. This is the canonical payload hash. (All signatures in a v2 card MUST sign the same canonical bytes — they all sign the canonical payload with all `signatures[i].value` fields set to `""`.)
6. Sign the canonical bytes with the signer's private key (Ed25519 or ML-DSA-65).
7. Store the base64 signature in `signatures[i].value`.
8. Store the hex SHA-256 in `attestation.signed_payload_hash` (this is shared across all signatures — it is the hash of the canonical payload with all signature values empty).

**Append signing**: A second CA can sign an already-issued card by:
1. Loading the card with existing signatures.
2. Verifying the existing signatures.
3. Adding a new `signatures[i]` entry with `value: ""`.
4. Re-canonicalizing (all `value` fields set to `""`, `signed_payload_hash` set to `""`).
5. Re-computing the canonical payload hash (MUST match the existing `signed_payload_hash`).
6. Signing and appending.

This works because all signatures sign the same canonical bytes (the payload with all signature values blanked). Appending a signature does NOT change the canonical payload hash, so it does NOT invalidate earlier signatures.

**Verification process**:

1. Read all entries in `signatures[]`.
2. Set EVERY `signatures[i].value` to `""` (empty string).
3. Set `attestation.signed_payload_hash` to `""`.
4. Apply RFC 8785 JCS to produce canonical bytes.
5. Compute SHA-256 of canonical bytes.
6. Set `attestation.signed_payload_hash` back to its stored value (do NOT re-canonicalize).
7. Verify the computed hash matches the stored `signed_payload_hash`. If not, REJECT.
8. For each signature entry:
   - Look up the CA public key by `signer_id` and `ca_key_id`.
   - Verify the signature using the appropriate algorithm (`Ed25519` or `ML-DSA-65`) and the canonical bytes.
9. Count valid signatures.
10. If `multi_sig.required_signatures` is present, the valid count MUST be ≥ that value.
11. If `multi_sig.distinct_cas_required` is `true`, the valid signatures MUST come from ≥ that many distinct `signer_id` values.
12. If any signature fails verification, the entire card MUST be rejected (a v2 card is all-or-nothing — partial validity is not allowed).

**v1 → v2 mapping**: A v1 card with `attestation.signature = "base64..."` becomes a v2 card with `signatures = [{signer_id: <ca_id>, ca_key_id: <ca_key_id>, algorithm: "Ed25519", value: <same base64>, signed_at: <now>, canonicalization: "RFC 8785 JCS"}]` and `multi_sig = {required_signatures: 1, distinct_cas_required: false, policy: "single-CA"}`.

---

## ATC-007 — Revocation

**Purpose**: Allow the CA to revoke an ATC before its expiration. Unchanged from v1.

**Fields** (in the ATC itself, unchanged from v1):

```json
{
  "revocation": {
    "revocation_check_url": "string — URL where the CA publishes the revocation list",
    "revocation_check_method": "enum — ocsp | crl | simple_json",
    "revocation_check_required": "boolean — if true, the verifier MUST check; if false, the verifier MAY skip"
  }
}
```

**Revocation list format** (served at `revocation_check_url`):

```json
{
  "ca_id": "string",
  "ca_key_id": "string — v2 change: includes key ID for rotation handling",
  "issued_at": "string — ISO 8601",
  "expires_at": "string — ISO 8601",
  "revoked_cards": [
    {
      "card_id": "string — v2 format: ATC-v2-{16 hex chars}",
      "revoked_at": "string — ISO 8601",
      "reason": "enum — compromised | malicious | superseded | unknown"
    }
  ]
}
```

**v2 changes**:
1. The revocation list now includes `ca_key_id` so verifiers know which CA key signed the list (rotation handling).
2. Revoked `card_id` values now follow the v2 content-addressed format (see ATC-012).

**Rules** (unchanged from v1 except as noted):

- The CA SHOULD update the revocation list within 5 minutes of revoking a card.
- The list MUST be signed by the CA (same process as ATC-006-M — but for the revocation list, only ONE signature is required; multi-sig does not apply to the revocation list).
- A verifier SHOULD cache the list for up to 5 minutes.
- If `revocation_check_required` is `true` and the verifier cannot reach `revocation_check_url`, the verifier MUST reject the ATC.
- For multi-sig cards: a card is revoked if it appears in the revocation list of ANY of its signers.

---

## ATC-008 — Expiration

**Purpose**: Bound the validity of an ATC in time. Unchanged from v1.

**Fields**:

```json
{
  "validity": {
    "issued_at": "string — ISO 8601 timestamp",
    "expires_at": "string — ISO 8601 timestamp",
    "max_ttl_days": "integer — maximum allowed TTL for this ATC type"
  }
}
```

**Rules** (unchanged from v1):

- `expires_at - issued_at` MUST NOT exceed `max_ttl_days` (in days).
- Default `max_ttl_days` for ATC/2.0 is 90 (3 months). Same as v1.
- A verifier MUST reject any ATC where `now > expires_at`.
- A verifier SHOULD warn if `expires_at - now < 7 days` (renewal window).
- Verifiers MUST allow ±5 minutes of clock skew.

**v2 interaction with PQ migration**: If `attestation.pq_migration_path.reissue_before` is present and `now` is past that date, the verifier MUST downgrade trust by 1 point even if the card has not expired. This nudges consumers to push for re-issuance as the PQ migration deadline approaches.

---

## ATC-009 — Delegation (OPTIONAL, restructured in v2)

**Purpose**: Allow an agent to delegate a subset of its capabilities to another agent, without the CA re-issuing. v2 promotes this from the v1 afterthought to a first-class structured block.

**Fields**:

```json
{
  "delegation": {
    "delegated_by": "string — parent ATC's card_id (v2 content-addressed format)",
    "delegation_scope": {
      "filesystem": { "read": "own_dir", "write": "temp_dir" },
      "network": { "egress": "allowlist", "ingress": "none" },
      "...": "...subset of capabilities per ATC-003..."
    },
    "delegation_chain_depth": 2,
    "delegation_signature": {
      "algorithm": "Ed25519 | ML-DSA-65",
      "value": "string — base64 signature by the parent agent's private key over the delegated payload",
      "signed_at": "string — ISO 8601 timestamp",
      "canonicalization": "RFC 8785 JCS"
    }
  }
}
```

**Rules**:

1. `delegated_by` MUST reference a v2-format parent `card_id` (i.e. `ATC-v2-{16 hex}`).
2. `delegation_scope` MUST be a subset of the parent agent's `capabilities` (ATC-003). It MUST NOT introduce capabilities the parent doesn't have. (Verifiers MUST verify this by fetching the parent card and comparing.)
3. `delegation_chain_depth`:
   - A root card (no delegation) has `delegation_chain_depth: 0`.
   - A card delegated directly by a root has `delegation_chain_depth: 1`.
   - Maximum allowed depth: **5** (up from v1's 3). Deeper chains MUST be rejected.
   - The verifier MUST verify the chain back to the root by recursively following `delegated_by` until it reaches a card with no `delegation` block (or `delegation_chain_depth: 0`).
4. `delegation_signature`:
   - The signature is computed over the RFC 8785 JCS canonical form of the delegated payload, which is the entire card EXCEPT the `delegation_signature.value` field (set to `""`) and EXCEPT the top-level `signatures[]` array (all `value` fields set to `""`).
   - The signature is by the PARENT AGENT's private key (the agent whose `subject_public_key` is in the parent card), NOT by the CA.
   - Verifier MUST verify using the parent card's `attestation.subject_public_key`.
5. **Delegation cannot expand capabilities**: if the parent's `capabilities.filesystem.read` is `own_dir`, the child's `delegation_scope.filesystem.read` MUST be `own_dir` or `none` — never `home_dir` or higher.
6. **Delegation cannot extend TTL**: the child's `validity.expires_at` MUST be ≤ the parent's `validity.expires_at`.
7. **Delegation cannot change identity owner**: the child's `identity.agent_owner` MUST equal the parent's `identity.agent_owner`, OR be a documented sub-organization. (This is a SHOULD, not a MUST — but verifiers SHOULD downgrade trust if violated.)
8. If `delegation_chain_depth` exceeds 5, REJECT. (Prevents infinite delegation chains — a real attack vector if depth is unlimited.)

**Why max depth 5**: In MCP fan-out, a root orchestrator delegates to a planner, which delegates to a tool-caller, which delegates to a sandboxed worker, which delegates to a sub-task agent. That's depth 4. Depth 5 leaves headroom for one more level. Anything deeper indicates a design smell or an attack (e.g. capability laundering through many hops).

**v1 → v2 mapping**: v1 `parent_card_id` → v2 `delegated_by`. v1 `delegated_capabilities` → v2 `delegation_scope`. v1 single-string `delegation_signature` → v2 structured object. v1 max depth 3 → v2 max depth 5.

---

## ATC-010 — Runtime Trust (OPTIONAL)

**Purpose**: Allow runtime trust signals to be reported alongside the ATC. Unchanged from v1.

**Fields** (identical to v1):

```json
{
  "runtime_trust": {
    "observed_behavior": {
      "calls_blocked": 0,
      "calls_warned": 1,
      "calls_allowed": 42,
      "observation_window_hours": 24
    },
    "behavioral_score": 9,
    "drift_detected": false,
    "last_observed_at": "2026-11-15T08:00:00Z"
  }
}
```

**Rules** (unchanged from v1):

- Runtime trust is a soft signal — it does not override ATC-005 (the static risk score).
- A verifier MAY combine static + runtime scores using any weighted formula.
- A verifier MUST NOT treat a missing `runtime_trust` block as a negative signal.

---

## ATC-011 — Trust Decision (NEW in v2)

**Purpose**: Embed the trust decision directly in the card. This is what `/api/trust` returned in v1 as a separate API call. In v2, it is part of the card itself, eliminating the TOCTOU gap.

**Fields**:

```json
{
  "trust_decision": {
    "decision_authority": "issuer | consumer | joint",
    "decision_inputs": [
      "sentinel_score",
      "sandbox_results",
      "malware_scan",
      "prompt_injection_check",
      "runtime_trust"
    ],
    "decision_rule_id": "string — opaque identifier for the decision rule used (e.g. 'marketnow-default-rule-v3')",
    "decision_evidence_hash": "string — hex SHA-256 of the RFC 8785 JCS of the evidence_chain array",
    "decision_outcome": "enum — trusted | untrusted | conditional",
    "decision_explanation": "string — human-readable explanation",
    "decided_at": "string — ISO 8601 timestamp"
  }
}
```

**Rules**:

1. `decision_authority` MUST match `risk.decision_authority` (these two fields are paired — they cannot disagree).
2. `decision_inputs` is an array of strings naming which inputs were consumed by the decision rule. Values are drawn from the set `{"sentinel_score", "sandbox_results", "malware_scan", "prompt_injection_check", "runtime_trust", "delegation_chain", "capabilities", "identity", "validity", "revocation"}`. A verifier MAY verify that the rule actually consumed these inputs by re-running the rule.
3. `decision_rule_id` is opaque to the spec — it's a string the issuer uses to identify which decision rule was applied. Verifiers MAY look up the rule in a published rules registry.
4. `decision_evidence_hash` is the hex SHA-256 of the RFC 8785 JCS canonical form of the entire `evidence_chain` array (as it appears in the card). This binds the decision to the specific evidence set used.
5. `decision_outcome` enum:
   - `trusted` — the agent is trusted for the full scope of its capabilities.
   - `untrusted` — the agent is NOT trusted. The card is still signed (otherwise the verifier couldn't authenticate the rejection), but the decision is "no".
   - `conditional` — the agent is trusted conditionally. The `decision_explanation` field MUST document the conditions.
6. `decision_explanation` MUST be present and human-readable.
7. `decided_at` MUST be ≤ `validity.issued_at`.

**Why this matters (TOCTOU)**: In v1, an issuer could issue a card with `trust_score: 9`, but `/api/trust` could later return `trust_score: 4` after a runtime incident. A consumer that cached the card but didn't re-check `/api/trust` would continue trusting the agent. In v2, the decision is in the card; if you have the card, you have the decision. Revocation is the only way to change the decision post-issuance.

**Note**: v2 does NOT replace `/api/trust` — consumers MAY still query the API for live updates. But the card's `trust_decision` block is the authoritative decision at issuance time.

---

## ATC-012 — Content-Addressed Card ID (NEW in v2)

**Purpose**: Make the card ID a content address — derived from the card's own canonical payload. This makes cards self-verifying: tampering changes the ID.

**Format**:

```
ATC-v2-{first_16_hex_chars_of_sha256_of_canonical_payload}
```

Example: `ATC-v2-3a9f4c7b8d2e1f5a`

**Derivation process**:

1. Take the full ATC JSON document.
2. Set `card_id` to `""` (empty string — it cannot reference itself).
3. Set every `signatures[i].value` to `""`.
4. Set `attestation.signed_payload_hash` to `""`.
5. Apply RFC 8785 JCS to produce canonical bytes.
6. Compute SHA-256 of the canonical bytes.
7. Take the first 16 hex characters (i.e. first 8 bytes / 64 bits of the hash).
8. Prepend `ATC-v2-`.
9. Store in `card_id`.

**Verification process**:

1. Read the stored `card_id`.
2. Repeat the derivation process (steps 2–7) using the card's current contents.
3. Verify the derived ID matches the stored `card_id`. If not, REJECT (the card has been tampered with).

**Collision analysis**: 16 hex chars = 64 bits. Birthday-bound collision probability reaches 50% at ~2^32 ≈ 4 billion cards. With ~10^6 active cards (a generous estimate for 2027), collision probability is ~10^-7 — acceptable. If collision risk grows, ATC/2.1 may bump to 24 hex chars (96 bits).

**Why 16 and not 64 hex chars?**: Card IDs appear in URLs, in logs, in user-facing audit trails. `ATC-v2-3a9f4c7b8d2e1f5a` is readable. `ATC-v2-3a9f4c7b8d2e1f5a9c2e7b4d1e6f3a8c7b2d5e4f1a6c9b3d8e7f2a5c1b4d9e6f3a` is not. 16 chars is the sweet spot for human readability with acceptable collision risk.

**Tamper detection**: Any change to the canonical payload (identity, capabilities, evidence, risk, trust_decision, validity, etc.) changes the derived `card_id`. A verifier that recomputes the ID from the payload will detect tampering immediately — even before checking the signatures. This is a fast pre-check that catches accidental corruption and many forms of malicious tampering without invoking the (expensive) signature verification code path.

**Interaction with revocation**: The revocation list uses `card_id`. Because v2 IDs are content-addressed, a revoked card's ID cannot be reused by a slightly different replacement card (the replacement will have a different ID). This is a security improvement over v1, where a malicious re-issue could in principle reuse a card ID.

---

## 3. The full ATC/2.0 envelope

A complete ATC/2.0 document looks like this (all required controls + optional delegation + optional runtime trust):

```json
{
  "spec_version": "ATC/2.0",
  "schema_version": "2.0.0",
  "card_id": "ATC-v2-3a9f4c7b8d2e1f5a",

  "issuer": {
    "ca_id": "alicelabs-sentinel-ca",
    "ca_public_key": "MCowBQYDK2VwAyEA8s9k...base64...32bytes",
    "ca_algorithm": "Ed25519",
    "ca_url": "https://marketnow.site/api/atc",
    "ca_key_id": "sentinel-ca-2026-q4"
  },

  "identity": {
    "agent_id": "alicelabs-treasury-bot-01",
    "agent_name": "Treasury Settlement Bot",
    "agent_owner": "AliceLabs LLC",
    "owner_contact": "mailto:security@alicelabs.site"
  },

  "attestation": {
    "subject_public_key": "MCowBQYDK2VwAyEA7Hk2...base64...32bytes",
    "subject_algorithm": "Ed25519",
    "pq_migration_path": {
      "target_algorithm": "ML-DSA-65",
      "reissue_before": "2027-06-01T00:00:00Z",
      "migration_status": "not_started"
    },
    "canonicalization": "RFC 8785 JCS",
    "signed_payload_hash": "a3f5e8c9...64hex"
  },

  "capabilities": {
    "filesystem": { "read": "own_dir", "write": "temp_dir" },
    "network": { "egress": "allowlist", "ingress": "none" },
    "shell": { "exec": "sandboxed", "spawn": "none" },
    "credentials": { "read_env": "allowlist", "read_files": "none" },
    "process": { "subprocess": "sandboxed", "signals": "own" }
  },

  "evidence_chain": [
    {
      "evidence_id": "sentinel-score-001",
      "evidence_type": "sentinel_score",
      "produced_by": {
        "producer_id": "alicelabs-sentinel",
        "producer_key_id": "sentinel-prod-2026-q4",
        "producer_public_key": "MCowBQYDK2VwAyEA...base64...32bytes",
        "producer_url": "https://marketnow.site/api/sentinel"
      },
      "produced_at": "2026-11-15T10:00:00Z",
      "content_hash": "9c4f...64hex",
      "content": {
        "score": 9,
        "risk_level": "low",
        "layers_passed": ["L1.5", "L1.6", "L1.9", "L2.5", "L3"],
        "layers_failed": [],
        "explanation": "Clean audit, no high-severity findings."
      },
      "signature": {
        "algorithm": "Ed25519",
        "value": "base64...signature-by-sentinel",
        "signed_at": "2026-11-15T10:00:05Z",
        "canonicalization": "RFC 8785 JCS"
      }
    },
    {
      "evidence_id": "sandbox-001",
      "evidence_type": "sandbox_results",
      "produced_by": {
        "producer_id": "alicelabs-sandbox",
        "producer_key_id": "sandbox-prod-2026-q4",
        "producer_public_key": "MCowBQYDK2VwAyEA...base64...32bytes",
        "producer_url": "https://marketnow.site/api/sandbox"
      },
      "produced_at": "2026-11-15T10:05:00Z",
      "content_hash": "2b8a...64hex",
      "content": {
        "sandbox_runtime_ms": 4520,
        "sandbox_exit_code": 0,
        "sandbox_network_blocked": true,
        "sandbox_fs_read_only": true,
        "sandbox_cap_drop_all": true,
        "interceptor_blocks": 0,
        "interceptor_warns": 2
      },
      "signature": {
        "algorithm": "Ed25519",
        "value": "base64...signature-by-sandbox",
        "signed_at": "2026-11-15T10:05:02Z",
        "canonicalization": "RFC 8785 JCS"
      }
    }
  ],

  "risk": {
    "trust_score": 9,
    "risk_level": "low",
    "decision_authority": "joint",
    "score_explanation": "Clean audit, sandbox exit 0, no malware, no prompt injection.",
    "scored_at": "2026-11-15T10:15:00Z"
  },

  "trust_decision": {
    "decision_authority": "joint",
    "decision_inputs": [
      "sentinel_score",
      "sandbox_results",
      "malware_scan",
      "prompt_injection_check",
      "runtime_trust"
    ],
    "decision_rule_id": "marketnow-default-rule-v3",
    "decision_evidence_hash": "1d7e...64hex",
    "decision_outcome": "trusted",
    "decision_explanation": "All evidence verified. Joint issuer+consumer trust decision: trusted.",
    "decided_at": "2026-11-15T10:30:00Z"
  },

  "multi_sig": {
    "required_signatures": 2,
    "distinct_cas_required": true,
    "policy": "MarketNow + Independent Auditor for >$1000 transactions"
  },

  "signatures": [
    {
      "signer_id": "alicelabs-sentinel-ca",
      "ca_key_id": "sentinel-ca-2026-q4",
      "algorithm": "Ed25519",
      "value": "base64...signature-by-sentinel-ca",
      "signed_at": "2026-11-15T10:31:00Z",
      "canonicalization": "RFC 8785 JCS"
    },
    {
      "signer_id": "independent-auditor-ca",
      "ca_key_id": "auditor-ca-2026-q4",
      "algorithm": "Ed25519",
      "value": "base64...signature-by-auditor-ca",
      "signed_at": "2026-11-15T10:35:00Z",
      "canonicalization": "RFC 8785 JCS"
    }
  ],

  "revocation": {
    "revocation_check_url": "https://marketnow.site/api/atc/revocations",
    "revocation_check_method": "simple_json",
    "revocation_check_required": true
  },

  "validity": {
    "issued_at": "2026-11-15T10:31:00Z",
    "expires_at": "2027-02-13T10:31:00Z",
    "max_ttl_days": 90
  },

  "delegation": {
    "delegated_by": "ATC-v2-7c2a9b1f4e8d3a6c",
    "delegation_scope": {
      "filesystem": { "read": "own_dir", "write": "temp_dir" },
      "network": { "egress": "allowlist", "ingress": "none" },
      "shell": { "exec": "sandboxed", "spawn": "none" },
      "credentials": { "read_env": "allowlist", "read_files": "none" },
      "process": { "subprocess": "sandboxed", "signals": "own" }
    },
    "delegation_chain_depth": 1,
    "delegation_signature": {
      "algorithm": "Ed25519",
      "value": "base64...signature-by-parent-agent",
      "signed_at": "2026-11-15T10:30:30Z",
      "canonicalization": "RFC 8785 JCS"
    }
  },

  "runtime_trust": {
    "observed_behavior": {
      "calls_blocked": 0,
      "calls_warned": 1,
      "calls_allowed": 42,
      "observation_window_hours": 24
    },
    "behavioral_score": 9,
    "drift_detected": false,
    "last_observed_at": "2026-11-15T08:00:00Z"
  }
}
```

---

## 4. Verification algorithm (full)

A conformant v2 verifier MUST perform these steps IN ORDER. Failing any step REJECTS the card.

### Step 0 — Schema validation
- Validate the card against `atc-2.0.json` (JSON Schema Draft 2020-12). Reject if invalid.

### Step 1 — Spec version check
- Verify `spec_version == "ATC/2.0"` and `schema_version == "2.0.0"`. Reject otherwise.

### Step 2 — Expiration check
- Verify `now < validity.expires_at` (with ±5 minutes clock skew tolerance).
- Verify `validity.expires_at - validity.issued_at ≤ validity.max_ttl_days`.
- Reject if expired or TTL exceeded.

### Step 3 — Content-addressed card ID check (cheap tamper detection)
- Set `card_id = ""`, every `signatures[i].value = ""`, `attestation.signed_payload_hash = ""`.
- Apply RFC 8785 JCS.
- Compute SHA-256.
- Take first 16 hex chars, prepend `ATC-v2-`.
- Verify derived ID matches the stored `card_id`. Reject if mismatch (tamper detected).

### Step 4 — Canonical payload hash check
- (Already done in Step 3 — the SHA-256 in Step 3 is the canonical payload hash.)
- Verify it matches `attestation.signed_payload_hash`. Reject if mismatch.

### Step 5 — Signature verification (multi-sig)
- For each entry in `signatures[]`:
  - Look up the CA public key by `signer_id` and `ca_key_id`. (Cache lookup is OK; ultimately fetched from `issuer.ca_url` for the matching `ca_key_id`.)
  - Verify the signature using the algorithm (`Ed25519` or `ML-DSA-65`) against the canonical bytes from Step 3.
- Count valid signatures.
- Verify `valid_count ≥ multi_sig.required_signatures` (if `multi_sig` is present; otherwise default `required_signatures = 1`).
- If `multi_sig.distinct_cas_required` is `true`, verify the valid signatures come from ≥ `required_signatures` distinct `signer_id` values.
- Reject if insufficient.

### Step 6 — Evidence chain verification
- For each entry in `evidence_chain[]`:
  - Recompute RFC 8785 JCS of `content`.
  - Recompute SHA-256.
  - Verify `content_hash` matches.
  - Verify the Ed25519 signature using `produced_by.producer_public_key`.
  - Verify `produced_at ≤ validity.issued_at`.
- If ANY item fails, downgrade trust by ≥ 2 points. Reject if `risk.decision_authority == "joint"`.

### Step 7 — Trust decision consistency check
- Verify `trust_decision.decision_authority == risk.decision_authority`. Reject if mismatch.
- Verify `trust_decision.decided_at ≤ validity.issued_at`. Reject if mismatch.
- Recompute `decision_evidence_hash` as SHA-256 of RFC 8785 JCS of `evidence_chain`. Verify it matches `trust_decision.decision_evidence_hash`. Reject if mismatch.

### Step 8 — Delegation chain verification (if `delegation` block present)
- Verify `delegation_chain_depth ≤ 5`. Reject if deeper.
- Recursively fetch and verify the parent card (by `delegated_by`).
- Verify `delegation_scope` is a subset of the parent's `capabilities`.
- Verify `validity.expires_at ≤ parent.validity.expires_at`.
- Verify the `delegation_signature` using the parent's `attestation.subject_public_key`.

### Step 9 — Revocation check
- If `revocation.revocation_check_required` is `true`:
  - Fetch the revocation list from `revocation.revocation_check_url` (cached ≤ 5 minutes).
  - Verify the list's CA signature.
  - If `card_id` appears in the list, REJECT.

### Step 10 — PQ migration warning (soft)
- If `attestation.pq_migration_path.reissue_before` is present and `now > reissue_before`, downgrade trust by 1 point (warning, not rejection).

### Step 11 — Return verification result
- Return `{valid: true, trust_score, risk_level, decision_outcome, evidence_verified_count, signatures_verified_count, warnings}`.

---

## 5. Conformance

An implementation is **ATC/2.0-conformant** if:

1. ✅ It can issue an ATC/2.0 card that passes the full verification algorithm (Steps 0–10).
2. ✅ It can verify an ATC/2.0 card that passes the full verification algorithm.
3. ✅ It rejects a card with a tampered payload (Step 3 — content-addressed ID mismatch).
4. ✅ It rejects a card with insufficient valid signatures (Step 5).
5. ✅ It rejects a card with a forged evidence item (Step 6).
6. ✅ It rejects a card with mismatched `decision_authority` between `risk` and `trust_decision` (Step 7).
7. ✅ It rejects a card with a delegation chain deeper than 5 (Step 8).
8. ✅ It rejects an expired or revoked card (Steps 2 and 9).
9. ✅ It correctly serializes an ATC using RFC 8785 JCS (Steps 3–7).
10. ✅ It supports BOTH `Ed25519` and `ML-DSA-65` algorithms (the latter can be stubbed during the migration window but MUST be implemented by 2027-12-31).

Conformance test suite: [`./fixtures/v2/`](./fixtures/v2/) (populated as new cards are issued under v2 CAs).

---

## 6. Security considerations

### 6.1 CA key compromise

If a CA's private key is compromised:

1. All ATCs signed by that CA are untrustworthy.
2. The CA MUST rotate its keypair and publish a new `ca_key_id`.
3. The CA MUST revoke all ATCs signed by the compromised key (the revocation list MUST use the old `ca_key_id` to identify which cards are affected).
4. Existing ATCs MUST be re-issued under the new key.
5. Multi-sig cards: if only one of N signers is compromised, the card MAY remain valid if `required_signatures` is still met by the other (uncompromised) signers. But all cards where the compromised signer was a co-signer SHOULD be re-issued to remove the compromised signature.

### 6.2 Evidence producer key compromise

If an evidence producer's key (e.g. Sentinel's signing key) is compromised:

1. All `evidence_chain` items signed by that producer are untrustworthy.
2. The producer MUST rotate its keypair and publish a new `producer_key_id`.
3. Existing cards with forged evidence items will fail Step 6 of verification (the signature won't verify against the new key — unless the attacker can also re-sign).
4. Issuers MUST re-issue affected cards with fresh evidence from the producer's new key.

### 6.3 Canonicalization

ATC/2.0 mandates RFC 8785 JCS. Do not use Node.js `JSON.stringify` for canonicalization — it is not deterministic across V8 versions. Use a JCS library (e.g. `ieee754-jcs`, `canonicalize`, or `@erinspace/canonicalize`).

The v2 canonical form is identical to v1's: RFC 8785 JCS over the JSON object, with signature-related fields (`signatures[].value`, `attestation.signed_payload_hash`, `card_id`) blanked out.

### 6.4 Clock skew

Verifiers MUST allow ±5 minutes of clock skew between their clock and the `issued_at` / `expires_at` timestamps. Beyond ±5 minutes, reject.

### 6.5 Capability enforcement

The ATC declares capabilities. **The runtime is responsible for enforcing them.** A malicious runtime can ignore the declared capabilities. ATC/2.0 does not solve runtime integrity — it only provides the credential. Use a sandboxed runtime (gVisor, Firecracker) for true enforcement.

### 6.6 Multi-sig attack vectors

A multi-sig attacker may attempt:

1. **Forge a second signature from a compromised second CA** — this is the standard threat model; multi-sig defends by requiring multiple distinct CAs to be compromised simultaneously.
2. **Replay an old signature from a revoked card onto a new card** — the v2 content-addressed ID prevents this, because the new card will have a different `card_id` (and different canonical payload hash).
3. **Strip a signature to bypass multi-sig requirement** — the `multi_sig.required_signatures` field is part of the canonical payload; stripping it would change the `card_id` and invalidate all signatures.
4. **Sign twice with the same CA under different `ca_key_id` values** — `distinct_cas_required` checks distinct `signer_id`, not `ca_key_id`. A CA cannot sign twice with two of its own keys to meet the multi-sig threshold.

### 6.7 Delegation chain attacks

1. **Chain laundering** — depth > 5 is rejected outright.
2. **Capability expansion** — the verifier MUST check that the child's `delegation_scope` is a subset of the parent's `capabilities`.
3. **TTL extension** — the verifier MUST check that the child's `validity.expires_at` ≤ the parent's.
4. **Replay** — the verifier MUST verify the delegation chain back to a root card issued by a CA; an orphaned chain is rejected.

### 6.8 Post-quantum migration

The `pq_migration_path` field is non-binding guidance — it tells consumers when to expect re-issuance. The verifier SHOULD downgrade trust for cards past their `reissue_before` date but MUST NOT reject them outright (the signature is still cryptographically valid against classical attackers).

Once NIST finalizes ML-DSA (FIPS 204, expected late 2024 / early 2025) and stable implementations are widely available, ATC/2.1 will mandate `ML-DSA-65` for all new cards and start the deprecation clock for `Ed25519`.

---

## 7. Versioning

| Spec version | Schema version | Status | Backwards compatible? | Notes |
|--------------|---------------|--------|----------------------|-------|
| ATC/1.0 | 1.0.x | Superseded | n/a | Ed25519 + JCS, single-sig, 10 controls (8 required, 2 optional) |
| ATC/1.1 | (interim) | Withdrawn | Yes | Planned PQ + delegation chains; never shipped as stable |
| ATC/1.2.0 | 1.2.0 | Withdrawn | Yes (with multi-sig) | Multi-sig experiment via `lib/multisig-atc.mjs`; superseded by 2.0 |
| **ATC/2.0** | **2.0.0** | **Current draft** | **No** | Multi-sig, evidence chain, delegation restructure, PQ readiness, content-addressed IDs, trust decision embedding |
| ATC/2.1 | (planned) | Planned 2027 Q3 | Yes | Mandate ML-DSA-65; deprecation clock for Ed25519 |
| ATC/3.0 | (planned) | Planned 2028 | No | Transparency log (Merkle), DID integration, capability revocation |

**Backwards compatibility**: ATC/2.0 is NOT backwards compatible with ATC/1.0. The wire format is different (new required fields, removed `attestation.signature` field, restructured `delegation`). See the [migration guide](./MIGRATION-v1-to-v2.md).

**Forward compatibility**: ATC/2.0 cards include a `schema_version` field. A v2.x verifier that encounters a card with `schema_version: "2.1.0"` MAY attempt to verify it with v2.0 semantics (ignoring unknown fields, since JSON Schema permits additional fields only where explicitly configured). ATC/2.0 cards will NOT validate against a v3.0 verifier (v3 will reject unknown fields not in its schema).

---

## 8. References

- [RFC 8032 — Ed25519, Edwards-curve Digital Signature Algorithm](https://datatracker.ietf.org/doc/html/rfc8032)
- [RFC 8785 — JSON Canonicalization Scheme (JCS)](https://datatracker.ietf.org/doc/html/rfc8785)
- [RFC 5280 — X.509 Public Key Infrastructure](https://datatracker.ietf.org/doc/html/rfc5280) (for comparison with SSL certificates)
- [RFC 6960 — OCSP](https://datatracker.ietf.org/doc/html/rfc6960) (for revocation check method `ocsp`)
- [RFC 5280 §5 — CRL](https://datatracker.ietf.org/doc/html/rfc5280#section-5) (for revocation check method `crl`)
- [FIPS 204 — Module-Lattice-Based Digital Signature Standard (ML-DSA)](https://csrc.nist.gov/pubs/fips/204/final) (for `ML-DSA-65`, post-quantum)
- [NIST PQC Standardization](https://csrc.nist.gov/projects/post-quantum-cryptography) (background)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/schema) (for `atc-2.0.json`)
- [OWASP MCP Cheat Sheet](https://owasp.org/www-project-mcp-security/) (for the 12 controls ATC-003 capabilities align with)

---

## 9. Contributing

PRs welcome at https://marketnow.site/atc.

### Contribution license

By contributing to ATC/2.0, you agree to release your contributions under the [W3C Community Group Final Specification Agreement](https://www.w3.org/community/about/agreements/final/) terms. This ensures the spec remains open and royalty-free.

### Areas needing contribution

- Reference implementation in Rust (v2)
- Reference implementation in Python (v2)
- Reference implementation in Go (v2)
- Conformance test suite expansion (v2 fixtures)
- Formal proof of the multi-sig verification algorithm
- ML-DSA-65 reference implementation conformance
- Integration with existing DID methods (did:key, did:web) — for ATC/3.0
- Transparency log design (Merkle tree) — for ATC/3.0

---

## 10. Citation

```
AliceLabs LLC. "ATC/2.0 — Agent Trust Card Protocol Specification."
Version 2.0.0-draft. 2026-11-15.
https://marketnow.site/atc/spec/SPEC-v2.md
```

---

## 11. Why v2.0 matters

ATC/1.0 shipped on 2026-08-10 as the first formal, versioned, testable specification for agent trust. Three months of production deployment surfaced seven concrete limitations — multi-sig, evidence integrity, delegation structure, PQ migration, content-addressing, trust decision embedding, and explicit schema versioning. ATC/2.0 addresses all seven.

The v2 design preserves v1's core insight — **machine-verifiable, offline-friendly, capability-bounded, revocable credentials for autonomous agents** — while making the credentials harder to forge, easier to delegate, and ready for the post-quantum migration that every signature-based system on earth must undertake in the next decade.

If you are building an agent runtime, an MCP server, an A2A client, or an agent marketplace, **implement ATC/2.0**. Conformance tests are in [`./fixtures/v2/`](./fixtures/v2/). Reference implementation is in [`./reference-impl/`](./reference-impl/). Both are open-source.

If you have a competing proposal (OpenA2A AIP, OATI, your own) — let's talk. Interop is the goal. Standards win by adoption, not by priority.
