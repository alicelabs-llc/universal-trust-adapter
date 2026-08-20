# ATC/1.0 → ATC/2.0 Migration Guide

**Status**: Final v1.0 — public for review
**Issued**: 2026-11-15
**Scope**: All v1.0 and v1.0.x implementers
**Supersedes**: n/a (this is the first migration guide)
**Spec reference**: [SPEC-v2.md](./SPEC-v2.md)
**Schema reference**: [atc-2.0.json](./atc-2.0.json)

---

## 1. TL;DR for implementers

ATC/2.0 is a **breaking change** from ATC/1.0. Existing v1 cards will NOT validate against the v2 schema, and existing v1 verifiers will NOT accept v2 cards. You MUST update both your issuer and your verifier.

The minimum viable migration is:

1. **Update your issuer** to produce v2 cards (new required fields, `signatures` array, content-addressed `card_id`, `evidence_chain`, `trust_decision`).
2. **Update your verifier** to accept v2 cards and reject v1 cards after a deprecation window.
3. **Migrate existing v1 cards** by re-issuing them as v2 (no in-place upgrade is possible — the wire formats are incompatible).
4. **Publish your CA key ID** (`ca_key_id`) so verifiers can look it up during rotation.

**Estimated effort**:

- Issuer: 2–4 engineering days
- Verifier: 1–2 engineering days
- Tooling (canonicalization, hashing, multi-sig library): 1–3 engineering days
- Total: ~1 engineering week for a typical deployment

---

## 2. What changed (summary table)

| Area | v1.0 | v2.0 | Breaking? |
|------|------|------|-----------|
| Wire format | `spec_version: "ATC/1.0"` | `spec_version: "ATC/2.0"` + `schema_version: "2.0.0"` | Yes |
| Card ID | `ATC-YYYY-NNNNNNN` (random) | `ATC-v2-{16 hex chars of sha256(canonical payload)}` | Yes |
| CA identifier | `ca_id` only | `ca_id` + `ca_key_id` (REQUIRED) | Yes (new required field) |
| Signature | single `attestation.signature` (string) | `signatures` array (with `signer_id`, `ca_key_id`, `algorithm`, `value`, `signed_at`, `canonicalization`) | Yes |
| Multi-sig policy | n/a | `multi_sig` block (required) | Yes |
| Algorithm | `Ed25519` only | `Ed25519` or `ML-DSA-65` | Forward-compatible (v1 cards won't have ML-DSA but v2 spec allows it) |
| PQ migration | n/a | `attestation.pq_migration_path` (optional, recommended for Ed25519 cards) | No (additive) |
| Evidence | `evidence` object inside the card, signed once by CA | `evidence_chain` array; each item independently signed by its producer | Yes |
| Delegation | `parent_card_id`, `delegated_capabilities`, `delegation_signature` (string) | `delegated_by`, `delegation_scope`, `delegation_chain_depth` (max 5), `delegation_signature` (object) | Yes |
| Trust decision | separate `/api/trust` call | `trust_decision` block embedded in card | Yes (new required field) |
| `risk.decision_authority` | forced to `"consumer"` via `const` | enum `issuer | consumer | joint` | Yes (loosened, but verifier must handle new value) |
| Canonicalization | RFC 8785 JCS | RFC 8785 JCS (unchanged) | No |
| Revocation list `card_id` values | `ATC-YYYY-NNNNNNN` | `ATC-v2-{16 hex}` | Yes (mismatched format) |

---

## 3. Step-by-step migration

### 3.1 Update the issuer

#### 3.1.1 Bump version strings

Replace:
```json
{ "spec_version": "ATC/1.0" }
```

With:
```json
{
  "spec_version": "ATC/2.0",
  "schema_version": "2.0.0"
}
```

#### 3.1.2 Add `ca_key_id` to issuer

The v1 `issuer` block was:
```json
{
  "issuer": {
    "ca_id": "alicelabs-sentinel-ca",
    "ca_public_key": "...",
    "ca_algorithm": "Ed25519",
    "ca_url": "https://marketnow.site/api/atc"
  }
}
```

The v2 `issuer` block adds `ca_key_id`:
```json
{
  "issuer": {
    "ca_id": "alicelabs-sentinel-ca",
    "ca_public_key": "...",
    "ca_algorithm": "Ed25519",
    "ca_url": "https://marketnow.site/api/atc",
    "ca_key_id": "sentinel-ca-2026-q4"
  }
}
```

**What `ca_key_id` should be**: an opaque string identifying this specific CA key. When the CA rotates its keypair, the new key gets a new `ca_key_id` (e.g. `sentinel-ca-2027-q1`). Verifiers use this ID to look up the correct public key — preventing the v1 bug where a card signed with a deprecated key would be rejected against the rotated key.

**Recommendation**: use a `{ca_id}-{year}-{quarter}` format (or similar). Make it human-readable so verifiers can debug.

#### 3.1.3 Replace `attestation.signature` with `signatures` array

The v1 `attestation` block was:
```json
{
  "attestation": {
    "subject_public_key": "...",
    "subject_algorithm": "Ed25519",
    "signature": "base64...",
    "signed_payload_hash": "hex..."
  }
}
```

The v2 `attestation` block drops `signature` and gains `canonicalization` and (optionally) `pq_migration_path`:
```json
{
  "attestation": {
    "subject_public_key": "...",
    "subject_algorithm": "Ed25519",
    "pq_migration_path": {
      "target_algorithm": "ML-DSA-65",
      "reissue_before": "2027-06-01T00:00:00Z",
      "migration_status": "not_started"
    },
    "canonicalization": "RFC 8785 JCS",
    "signed_payload_hash": "hex..."
  }
}
```

The signature itself moves to the top-level `signatures` array (new):
```json
{
  "signatures": [
    {
      "signer_id": "alicelabs-sentinel-ca",
      "ca_key_id": "sentinel-ca-2026-q4",
      "algorithm": "Ed25519",
      "value": "base64...",
      "signed_at": "2026-11-15T10:31:00Z",
      "canonicalization": "RFC 8785 JCS"
    }
  ],
  "multi_sig": {
    "required_signatures": 1,
    "distinct_cas_required": false,
    "policy": "single-CA"
  }
}
```

For a single-CA card (the most common case), `signatures` has one entry and `multi_sig.required_signatures = 1`. For a multi-CA card (high-value agents), add more entries and bump `required_signatures`.

#### 3.1.4 Re-derive the `card_id` as content-addressed

The v1 `card_id` was:
```
ATC-2026-7777670
```

The v2 `card_id` is:
```
ATC-v2-3a9f4c7b8d2e1f5a
```

Where `3a9f4c7b8d2e1f5a` is the first 16 hex characters of the SHA-256 of the RFC 8785 JCS canonical form of the card's payload (with `card_id`, all `signatures[].value`, and `attestation.signed_payload_hash` set to `""`).

**Derivation code (Node.js reference)**:

```javascript
import { createHash } from 'crypto';
import canonicalize from 'canonicalize'; // RFC 8785 JCS

function deriveV2CardId(card) {
  const payload = {
    ...card,
    card_id: '', // blank out
    signatures: (card.signatures || []).map(s => ({ ...s, value: '' })),
    attestation: {
      ...card.attestation,
      signed_payload_hash: ''
    }
  };
  const canonical = canonicalize(payload);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `ATC-v2-${hash.slice(0, 16)}`;
}
```

#### 3.1.5 Restructure `evidence` → `evidence_chain`

The v1 `evidence` block was a single object:
```json
{
  "evidence": {
    "audit_pipeline": "Sentinel L1.5 → L1.9 → L2.5 → L3",
    "audit_completed_at": "...",
    "static_checks": { "..." },
    "dynamic_checks": { "..." },
    "runtime_checks": { "..." },
    "findings": [ "..." ]
  }
}
```

This evidence was signed once by the issuing CA — a downstream consumer had no way to verify that Sentinel actually produced the score.

The v2 `evidence_chain` is an array of independently-signed items:
```json
{
  "evidence_chain": [
    {
      "evidence_id": "sentinel-score-001",
      "evidence_type": "sentinel_score",
      "produced_by": {
        "producer_id": "alicelabs-sentinel",
        "producer_key_id": "sentinel-prod-2026-q4",
        "producer_public_key": "...",
        "producer_url": "https://marketnow.site/api/sentinel"
      },
      "produced_at": "...",
      "content_hash": "...",
      "content": { "..." },
      "signature": {
        "algorithm": "Ed25519",
        "value": "...",
        "signed_at": "...",
        "canonicalization": "RFC 8785 JCS"
      }
    }
  ]
}
```

**Each evidence producer (Sentinel, sandbox runtime, malware scanner, prompt-injection checker) MUST sign its own `content` block.** The signature is over the RFC 8785 JCS canonical form of `content` (NOT the surrounding envelope, NOT the card).

If you control all the producers (e.g. they're all in-house), you'll need to give each producer its own Ed25519 keypair and have each producer sign its `content` before the card is assembled. The card issuer collects the signed evidence items, assembles them into `evidence_chain`, then computes its own signatures over the whole card.

#### 3.1.6 Add `trust_decision` block

This is NEW in v2. In v1, your `/api/trust` endpoint returned a JSON object that the runtime consumed separately from the ATC. In v2, that decision is embedded in the card.

```json
{
  "trust_decision": {
    "decision_authority": "consumer",
    "decision_inputs": ["sentinel_score", "sandbox_results", "malware_scan"],
    "decision_rule_id": "marketnow-default-rule-v3",
    "decision_evidence_hash": "...",
    "decision_outcome": "trusted",
    "decision_explanation": "All evidence verified.",
    "decided_at": "2026-11-15T10:30:00Z"
  }
}
```

**`decision_evidence_hash`** is the SHA-256 of the RFC 8785 JCS of the entire `evidence_chain` array (as it appears in the card). This binds the decision to the specific evidence set used. If you change the evidence after the decision, the hash won't match.

**`decision_authority`** MUST match `risk.decision_authority`. v2 lets you use `"joint"` (new) — for high-value agents where both issuer and consumer must agree.

#### 3.1.7 Restructure `delegation` (if you used it)

The v1 delegation block was:
```json
{
  "delegation": {
    "parent_card_id": "ATC-2026-7777670",
    "delegated_capabilities": { "..." },
    "delegation_signature": "base64..."
  }
}
```

The v2 delegation block restructures this:
```json
{
  "delegation": {
    "delegated_by": "ATC-v2-7c2a9b1f4e8d3a6c",
    "delegation_scope": { "..." },
    "delegation_chain_depth": 1,
    "delegation_signature": {
      "algorithm": "Ed25519",
      "value": "base64...",
      "signed_at": "...",
      "canonicalization": "RFC 8785 JCS"
    }
  }
}
```

**Field renames**:
- `parent_card_id` → `delegated_by`
- `delegated_capabilities` → `delegation_scope`
- `delegation_signature` (string) → `delegation_signature` (object with `algorithm`, `value`, `signed_at`, `canonicalization`)

**New field**: `delegation_chain_depth` (integer 1–5). Set this to the depth of the delegation chain. A card delegated directly by a root has depth 1. Max is 5 (up from v1's 3).

#### 3.1.8 Sign the card (multi-sig process)

After all the above is in place, sign the card:

1. Set `card_id = ""`, all `signatures[i].value = ""`, `attestation.signed_payload_hash = ""`.
2. Apply RFC 8785 JCS.
3. Compute SHA-256 → this is the canonical payload hash.
4. Sign the canonical bytes with the CA's private key (Ed25519 or ML-DSA-65).
5. Set `signatures[0].value = <base64 signature>`.
6. Set `attestation.signed_payload_hash = <hex hash>`.
7. Set `card_id = "ATC-v2-" + first 16 hex chars of hash`.

For multi-sig: repeat steps 4–5 for each additional CA. Each CA signs the same canonical bytes (so the canonical payload hash is the same across all signatures). Appending a signature does NOT invalidate earlier signatures.

---

### 3.2 Update the verifier

#### 3.2.1 Load the new schema

Point your verifier at `atc-2.0.json` instead of `atc-1.0.json`. Use a JSON Schema Draft 2020-12 validator (e.g. ajv v8+, python-jsonschema v4.18+).

```javascript
import Ajv2020 from 'ajv/dist/2020';
import schema from './atc-2.0.json';

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validate = ajv.compile(schema);

function verifyCard(card) {
  if (!validate(card)) {
    return { valid: false, reason: 'schema_invalid', errors: validate.errors };
  }
  // ... continue with cryptographic verification
}
```

#### 3.2.2 Implement the full verification algorithm

Follow the 11-step verification algorithm in [SPEC-v2.md §4](./SPEC-v2.md#4-verification-algorithm-full). The key new steps compared to v1:

- **Step 3 (content-addressed card ID check)**: recompute the `card_id` from the payload and verify it matches the stored `card_id`. This is a cheap pre-check that catches accidental corruption.
- **Step 5 (multi-sig verification)**: loop over the `signatures[]` array; verify each against the canonical bytes; count valid signatures; check against `multi_sig.required_signatures` and `multi_sig.distinct_cas_required`.
- **Step 6 (evidence chain verification)**: for each item in `evidence_chain[]`, verify the producer's signature over the `content` block.
- **Step 7 (trust decision consistency)**: verify `trust_decision.decision_authority` matches `risk.decision_authority`; recompute `decision_evidence_hash` and verify it matches.
- **Step 8 (delegation chain)**: if `delegation` block is present, verify chain depth ≤ 5, recursively verify the parent card, verify `delegation_scope` is a subset of the parent's capabilities.

#### 3.2.3 Support `ML-DSA-65` (planned, not blocking)

You do NOT need to support `ML-DSA-65` to be v2-conformant today. But you MUST plan for it: by 2027-12-31, all v2 verifiers MUST accept `ML-DSA-65` signatures. Use a signature algorithm dispatcher so adding ML-DSA support is a drop-in.

Reference implementations:
- `liboqs` (C library, bindings for most languages)
- `pqcrypto` (Rust crate)
- `oqs-python` (Python bindings)

---

### 3.3 Migrate existing v1 cards

**You cannot upgrade v1 cards in place.** The wire formats are incompatible. You MUST re-issue each v1 card as a v2 card.

The re-issue process:

1. Load the v1 card.
2. Extract: `identity`, `capabilities`, `evidence` (re-organize into `evidence_chain`), `risk`, `validity`, `revocation`.
3. Compute fresh evidence signatures from each producer (Sentinel, sandbox, etc.) — they MUST sign the new v2 `content` shape.
4. Set up the v2 envelope (new `issuer` with `ca_key_id`, new `attestation` with `canonicalization` + `pq_migration_path`, `trust_decision`, `multi_sig`).
5. Sign with the CA's current key (use the new `ca_key_id`).
6. Derive the new v2 `card_id`.
7. Publish the v2 card.
8. Revoke the v1 card (add to revocation list — see §3.4 below for format mismatch handling).

#### 3.3.1 What to do about the v1 evidence

v1 evidence was a single object with `static_checks`, `dynamic_checks`, `runtime_checks`, `findings`. v2 splits this into separate items in `evidence_chain`:

| v1 evidence field | v2 evidence_chain item |
|---|---|
| `static_checks` (metadata, semgrep, secret patterns, dependency scan) | `evidence_type: "malware_scan"` content |
| `static_checks.malware_*` | `evidence_type: "malware_scan"` content |
| `static_checks.prompt_injection_rules_count` | `evidence_type: "prompt_injection_check"` content |
| `dynamic_checks` (sandbox run results) | `evidence_type: "sandbox_results"` content |
| `runtime_checks` | `evidence_type: "sandbox_results"` content (merge) |
| `findings` (array of audit findings) | Encoded in `sentinel_score` content as `layers_failed` |
| (no v1 equivalent — the trust score itself) | `evidence_type: "sentinel_score"` content (NEW — Sentinel's actual score, signed by Sentinel) |

For each item, you'll need the original producer's private key to sign. If you don't have the producer's key (e.g. you only have the v1 evidence as a blob), you have two options:

1. **Re-run the audit** — most reliable. The producer generates fresh evidence in v2 format.
2. **Use a migration signature** — the issuing CA signs a `migration_attestation` that says "this v2 evidence_chain item is derived from v1 evidence {hash}". This is a weaker guarantee but acceptable during the migration window. (This is not standardized — implementers must document their approach.)

---

### 3.4 Update your revocation list

The v1 revocation list used `ATC-YYYY-NNNNNNN` card IDs:
```json
{ "revoked_cards": [ { "card_id": "ATC-2026-7777670", ... } ] }
```

The v2 revocation list uses `ATC-v2-{16 hex}` card IDs and adds `ca_key_id`:
```json
{
  "ca_id": "alicelabs-sentinel-ca",
  "ca_key_id": "sentinel-ca-2026-q4",
  "issued_at": "...",
  "expires_at": "...",
  "revoked_cards": [
    { "card_id": "ATC-v2-3a9f4c7b8d2e1f5a", "revoked_at": "...", "reason": "superseded" }
  ]
}
```

**During the migration window**, your revocation list will contain a mix of v1 and v2 card IDs. Verifiers should accept both formats during this window. After all v1 cards have been revoked or expired, you can drop v1 ID support.

---

### 3.5 Update your CA key registry

If you haven't already, publish your `ca_key_id` alongside your CA public key at `ca_url`. Example response from `https://marketnow.site/api/atc?action=ca-key`:

```json
{
  "ca_id": "alicelabs-sentinel-ca",
  "ca_algorithm": "Ed25519",
  "ca_keys": [
    {
      "ca_key_id": "sentinel-ca-2026-q3",
      "ca_public_key": "...",
      "status": "deprecated",
      "valid_from": "2026-08-10T00:00:00Z",
      "valid_to": "2026-11-15T00:00:00Z",
      "deprecation_reason": "Rotated per ATC/2.0 migration"
    },
    {
      "ca_key_id": "sentinel-ca-2026-q4",
      "ca_public_key": "...",
      "status": "active",
      "valid_from": "2026-11-15T00:00:00Z",
      "valid_to": null
    }
  ]
}
```

Verifiers look up the correct key by `ca_key_id` from the `signatures[]` array.

---

## 4. Common migration pitfalls

### 4.1 Forgetting `ca_key_id`

If you skip `ca_key_id`, your v2 cards won't validate (the schema marks it as required). And functionally, you'll re-introduce the v1 rotation bug.

**Fix**: always include `ca_key_id` in both the `issuer` block and every `signatures[]` entry.

### 4.2 Computing `card_id` BEFORE signatures

If you compute `card_id` from a payload that still has `signatures[].value` filled in, you'll get a different hash than the verifier. The `card_id` MUST be computed from the payload with `signatures[].value = ""` and `attestation.signed_payload_hash = ""`.

**Fix**: in your signing pipeline, blank out signature values BEFORE computing the hash, then compute `card_id` from the same blanked payload.

### 4.3 Signing the wrong canonical bytes for evidence

The v2 evidence item signature is over the RFC 8785 JCS of `content` (NOT the surrounding envelope, NOT the card, NOT the `evidence_chain` array). If you sign the wrong thing, verification will fail.

**Fix**: signature is computed over `canonicalize(evidence_item.content)` only. Verify with the same.

### 4.4 `decision_evidence_hash` mismatch

`trust_decision.decision_evidence_hash` is the SHA-256 of the RFC 8785 JCS of the ENTIRE `evidence_chain` array (all items, including their signatures). If you add or remove evidence items after the decision, the hash won't match.

**Fix**: compute `decision_evidence_hash` LAST, after the `evidence_chain` is finalized. Don't mutate `evidence_chain` after the decision is made.

### 4.5 `risk.decision_authority` ≠ `trust_decision.decision_authority`

These two fields MUST match. If they don't, the verifier rejects the card.

**Fix**: in your issuer, set both fields from the same source. Don't compute them independently.

### 4.6 Delegation scope not a subset of parent capabilities

v2 verifiers strictly check that `delegation_scope` is a subset of the parent's `capabilities`. v1 didn't strictly enforce this (some v1 issuers were sloppy).

**Fix**: when issuing a delegated card, fetch the parent card and compute the intersection of the parent's capabilities and the desired delegated scope. Set `delegation_scope` to that intersection.

### 4.7 Old v1 `card_id` format in the new v2 revocation list

If you keep `ATC-YYYY-NNNNNNN` IDs in the v2 revocation list, v2 verifiers won't match them against v2 cards.

**Fix**: when migrating a v1 card to v2, add the NEW v2 `card_id` to the revocation list (not the old v1 ID). Optionally keep the v1 ID in a `legacy_card_id` field for audit traceability — but the verifier checks the v2 ID only.

### 4.8 Forgetting to sign the canonical payload with ALL `signatures[].value` blanked

For multi-sig: all signatures MUST be over the same canonical bytes. If you sign with `signatures[0].value = ""` but `signatures[1].value = "existing-sig"`, the second signature's canonical bytes will differ from the first's. Verification will fail.

**Fix**: blank ALL `signatures[].value` (and `attestation.signed_payload_hash`, and `card_id`) before canonicalizing, regardless of which signature you're computing. All signers sign the same bytes.

---

## 5. Timeline

| Date | Milestone |
|------|-----------|
| 2026-11-15 | ATC/2.0 spec + schema published (this document + SPEC-v2.md + atc-2.0.json) |
| 2026-11-30 | Reference implementation updated to v2 (Node.js, lib/atc.mjs) |
| 2026-12-15 | First v2 cards issued by MarketNow Sentinel CA (under new `ca_key_id`) |
| 2026-12-31 | All new cards MUST be v2 (v1 issuance ends) |
| 2027-01-31 | v1 cards on revocation list MUST be superseded by v2 cards |
| 2027-03-31 | v1 verifier support deprecated; new verifiers MUST be v2 |
| 2027-06-01 | All Ed25519 cards SHOULD have `pq_migration_path.reissue_before` ≤ this date |
| 2027-12-31 | All v2 verifiers MUST support `ML-DSA-65` algorithm |
| 2028-01-01 | v1 cards on the wire MUST be rejected by all conformant verifiers |

---

## 6. Testing your migration

### 6.1 Use the conformance fixtures

v2 fixtures will be published at `./fixtures/v2/` as new cards are issued. The MANIFEST.json there lists every fixture with its expected outcome (`must-pass` or `must-fail`).

### 6.2 Test vectors

The following v2 test vectors MUST pass:

1. **Minimal v2 card**: a single-CA, single-evidence-item card with `decision_authority: "consumer"`. Expected: valid.
2. **Multi-sig v2 card**: a 2-CA card with `required_signatures: 2`. Expected: valid.
3. **Tampered payload**: same as #1 but with `identity.agent_name` modified. Expected: invalid (card_id mismatch in Step 3 of verification).
4. **Insufficient signatures**: a 2-CA card with one signature stripped. Expected: invalid (Step 5 fails).
5. **Forged evidence**: a card with a `sentinel_score` evidence item whose `signature.value` doesn't verify against the producer's public key. Expected: invalid (Step 6 fails) — and `decision_authority: "joint"` cards are rejected.
6. **`decision_authority` mismatch**: a card where `risk.decision_authority = "consumer"` but `trust_decision.decision_authority = "joint"`. Expected: invalid (Step 7 fails).
7. **Delegation chain too deep**: a card with `delegation_chain_depth: 6`. Expected: invalid (Step 8 fails).
8. **Expired card**: a card with `validity.expires_at < now`. Expected: invalid (Step 2 fails).
9. **Revoked card**: a card whose `card_id` appears in the revocation list. Expected: invalid (Step 9 fails).
10. **PQ migration past due**: an Ed25519 card with `pq_migration_path.reissue_before < now` but otherwise valid. Expected: valid with `trust_score` downgraded by 1 (Step 10).

### 6.3 Cross-implementation interop

Test your v2 cards against:
- The MarketNow reference implementation (Node.js)
- An independent Rust implementation (TBD — seeking contributors)
- An independent Python implementation (TBD)

Cards from one implementation MUST verify against all others. Report interop bugs to `security@alicelabs.site`.

---

## 7. Rollback plan

If v2 deployment encounters critical issues:

1. **Stop v2 issuance** — set the issuer to fall back to v1 format.
2. **Continue accepting v2 cards** in the verifier (don't roll back the verifier — that would invalidate already-issued v2 cards).
3. **Revoke affected v2 cards** via the revocation list.
4. **Publish a post-mortem** at `https://marketnow.site/atc/spec/incidents/`.

You cannot roll back v2 cards to v1 — once a card is v2, it stays v2 (the v1 verifier will reject it). The rollback plan is "stop issuing v2, keep accepting v2, fix forward".

---

## 8. FAQ

**Q: Can a v2 card have only one signature?**
A: Yes. Set `multi_sig.required_signatures: 1` and `multi_sig.distinct_cas_required: false`. The `signatures` array has one entry. This is the v2 equivalent of a v1 card.

**Q: Can a v2 card have no `evidence_chain`?**
A: No. The schema requires `evidence_chain` to be a non-empty array (`minItems: 1`). A card without evidence is not a card.

**Q: Can a v2 card have no `delegation` block?**
A: Yes. `delegation` is optional. A root card (issued directly by a CA, not delegated from another) has no `delegation` block. Add it only when the card is delegated.

**Q: Can a v2 card have no `pq_migration_path`?**
A: Yes, but ONLY if `subject_algorithm: "ML-DSA-65"` (the card is already PQ). For `Ed25519` cards, `pq_migration_path` is RECOMMENDED (not REQUIRED by the schema, but strongly recommended by the spec).

**Q: Can I use `ML-DSA-65` today?**
A: Yes, the schema allows it. But v2 verifiers are not required to support it until 2027-12-31. If you issue a `ML-DSA-65` card today, most verifiers will reject it. Stick with `Ed25519` for now.

**Q: What happens if I issue a v2 card with a v1 `card_id`?**
A: The schema will reject it (the pattern is `^ATC-v2-[a-f0-9]{16}$`). Fix your issuer to derive the v2 ID.

**Q: My v1 cards are still valid for months. Do I have to migrate them now?**
A: No. v1 cards remain valid until their `validity.expires_at` or until they're revoked. But you cannot issue NEW v1 cards after 2026-12-31 (see timeline). Existing v1 cards continue to validate against v1 verifiers; you should keep a v1 verifier around until all your v1 cards have expired.

**Q: Will the MarketNow Sentinel CA re-issue my v1 cards as v2 automatically?**
A: No. The CA issues cards; the agent owner (or their tooling) decides when to re-issue. We will provide a `atc migrate v1-to-v2` CLI command in the reference implementation. Run it on each v1 card to produce a v2 card with fresh evidence signatures.

**Q: What if I have a v1 delegation chain (depth 3)?**
A: v2 supports depth up to 5. Your existing depth-3 chain migrates directly: set `delegation_chain_depth` appropriately and restructure the `delegation` block per §3.1.7.

**Q: What about the interim multi-sig branch (schema_version 1.2.0)?**
A: That branch was an experiment (`lib/multisig-atc.mjs`). It never shipped as a stable schema. If you built on it, your `signatures` array is already close to the v2 shape — but you'll still need to add `card_id` content-addressing, `evidence_chain`, `trust_decision`, and `ca_key_id`. Treat 1.2.0 as v0; do a full v2 migration.

---

## 9. Getting help

- Spec questions: open an issue at https://marketnow.site/atc
- Security-sensitive questions: security@alicelabs.site (PGP key at /api/pgp)
- Migration support: post in `#atc-migration` on the MarketNow Discord
- Commercial support: contact-sales@alicelabs.site

---

## 10. Citation

```
AliceLabs LLC. "ATC/1.0 → ATC/2.0 Migration Guide."
Version 1.0. 2026-11-15.
https://marketnow.site/atc/spec/MIGRATION-v1-to-v2.md
```
