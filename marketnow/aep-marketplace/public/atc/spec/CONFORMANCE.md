# ATC/1.0 Conformance

> A conformant ATC/1.0 implementation MUST pass all 8 required controls.

## Conformance matrix

| # | Control | Required | What it checks |
|---|---------|----------|----------------|
| 1 | ATC-001 Identity | ✅ | `identity` is an object with `agent_id` (3-128 alphanumeric), `agent_name` (1-100), `agent_owner` (1-100). Optional `owner_contact` (mailto:/https: URL). |
| 2 | ATC-002 Attestation | ✅ | `attestation` is an object with `subject_public_key` (base64 Ed25519 SPKI), `subject_algorithm` (`Ed25519`), `signature` (base64 Ed25519), `signed_payload_hash` (hex SHA-256). |
| 3 | ATC-003 Capabilities | ✅ | `capabilities` is an object with 5 categories (`filesystem`, `network`, `shell`, `credentials`, `process`), each with 2-3 sub-fields, every value validated against an enum. |
| 4 | ATC-004 Evidence | ✅ | `evidence` is an object with `audit_pipeline`, `audit_completed_at` (ISO 8601), `static_checks`, `dynamic_checks`, `runtime_checks`, and `findings` (array). |
| 5 | ATC-005 Risk | ✅ | `risk` is an object with `trust_score` (integer 0-10), `risk_level` (low/medium/high/critical), `decision_authority` (`consumer`), `score_explanation`, `scored_at` (ISO 8601). |
| 6 | ATC-006 Signature | ✅ | The Ed25519 signature over RFC 8785 JCS canonical form (with `signature` and `signed_payload_hash` both set to `""`) verifies against `issuer.ca_public_key`. The recomputed SHA-256 matches `attestation.signed_payload_hash`. |
| 7 | ATC-007 Revocation | ✅ | `revocation` is an object with `revocation_check_url` (URI), `revocation_check_method` (ocsp/crl/simple_json), `revocation_check_required` (boolean). |
| 8 | ATC-008 Expiration | ✅ | `validity` is an object with `issued_at` (ISO 8601), `expires_at` (ISO 8601), `max_ttl_days` (1-365). Current time within ±5min of [issued, expires]. Actual TTL ≤ `max_ttl_days`. |
| 9 | ATC-009 Delegation | Optional | If present, `parent_card_id`, `delegated_capabilities`, `delegation_signature`. NOT validated by the v1.0 verifier. |
| 10 | ATC-010 Runtime Trust | Optional | If present, `observed_behavior`, `behavioral_score` (0-10), `drift_detected` (boolean), `last_observed_at`. NOT validated by the v1.0 verifier. |

## Test cases

The conformance test suite is in [`test/conformance.mjs`](./test/conformance.mjs). It runs 23 assertions across 8 test cases:

| # | Test case | Expected |
|---|-----------|---------|
| 1 | Valid ATC verifies all 8 controls | `valid: true`, 8/8 controls passed |
| 2 | Tampered payload (`trust_score` modified) | `valid: false`, ATC-006 failed, hash mismatch |
| 3 | Wrong CA key override | `valid: false`, ATC-006 failed |
| 4 | Invalid `card_id` format (letters instead of digits) | `valid: false`, card_id pattern error |
| 5 | Invalid capability enum (`filesystem.read: 'everything'`) | `valid: false`, ATC-003 failed |
| 6 | Trust score out of range (`trust_score: 15`) | `valid: false`, ATC-005 failed |
| 7 | Expiration in the past | `valid: false`, ATC-008 failed, "ATC expired" |
| 8 | Empty ATC (no fields) | `valid: false`, all 8 controls failed |

Run the suite:

```bash
git clone https://marketnow.site/atc.git
cd marketnow/atc-sdk
npm install
npm test
```

Expected output:

```
=== ATC/1.0 Conformance Test Suite ===

Test 1: A valid ATC verifies all 8 controls
  ✓ Verification succeeds
  ✓ All 8 required controls pass
  ...

=== Summary ===
Passed: 23
Failed: 0
```

## For other implementations

If you are implementing ATC/1.0 in another language (Rust, Python, Go, etc.), use these test vectors:

1. Generate a CA keypair with your implementation
2. Generate an agent keypair with your implementation
3. Issue an ATC with the same payload as `test/conformance.mjs` Test 1
4. Compare your canonical form and signature against the JS reference impl
5. Run the JS verifier against your issued ATC — it should return `valid: true`

If your implementation produces byte-identical canonical forms and signatures, you are ATC/1.0-conformant.

## Public test vectors

The reference implementation's test vectors are in [`docs/atc-spec/test-vectors/`](../docs/atc-spec/test-vectors/):

- `minimal-valid.json` — a minimal valid ATC
- `tampered-payload.json` — a tampered ATC (signature should fail)
- `expired.json` — an expired ATC
- `wrong-ca-key.json` — a valid ATC verified against the wrong CA
- `capability-samples.json` — 3 sample capability manifests

These are CC0 (public domain). Use them freely.

## "ATC Compatible" badge

If your project passes conformance, you can display this badge:

```markdown
[![ATC Compatible](https://marketnow.site/badges/atc-compatible.svg)](https://marketnow.site/atc)
```

The badge SVG is at [`badges/atc-compatible.svg`](./badges/atc-compatible.svg).

## Reporting conformance

If you have implemented ATC/1.0 in another language and passed conformance, open a PR against the [VERIFICATION-LOG.md](../mcp-server/VERIFICATION-LOG.md) with:

- Implementation name
- Language
- GitHub URL
- Date of first conformance pass
- Optional: a link to your CI run

We will list you in the "Implementations" section.

## Limitations of the v1.0 verifier

The v1.0 verifier does NOT:

- Fetch the revocation list (ATC-007 is structural only — the caller must fetch `atc.revocation.revocation_check_url` separately if `revocation_check_required=true`)
- Validate the `delegation` field (ATC-009)
- Validate the `runtime_trust` field (ATC-010)
- Check the CA's identity (any CA public key will be accepted, as long as the signature verifies)

These will be addressed in v1.1.
