# ATC Migration Guide: v1 → v2.0

> ATC v2.0 introduces breaking changes. Read this guide before upgrading.

## What's new in v2.0

### Required fields (were optional in v1)

1. **`signature.ca_key_id`** — identifies which CA key signed the card
   - v1: optional (cards could be signed without it)
   - v2: **required** (every card must identify its signing key)

2. **`signature.evidence_hash`** — tamper-evident hash of (payload + signature)
   - v1: optional
   - v2: **required** (computed as `sha256(canonical_payload + signature_value)`)

3. **`signature.policy_version`** — semver of the policy that issued the card
   - v1: optional
   - v2: **required** (must be valid semver like "2026-08-19")

### Removed in v2.0

1. **`canonical_json: "JSON.stringify(payload, Object.keys(payload).sort())"`** — the old ad-hoc canonicalization
   - v1: accepted (with known bug — see fixture 01-tampered-nested-field)
   - v2: **rejected** (only `RFC_8785_JCS` is accepted)

## Migration steps

### For card issuers (MarketNow)

1. Bump `payload.schema_version` from `1.1.0` → `2.0.0`
2. Add `ca_key_id` to every `signature` block (the CA key's SPKI prefix)
3. Add `evidence_hash` to every `signature` block (computed from payload + sig)
4. Add `policy_version` to every `signature` block (semver)
5. Ensure `canonical_json` is `"RFC_8785_JCS"` (not the old method)
6. Re-sign all cards with the v2 schema

### For card verifiers (third parties)

1. Add a v2 schema validation step before signature verification
2. Reject cards missing `ca_key_id`, `evidence_hash`, or `policy_version`
3. Reject cards with `canonical_json != "RFC_8785_JCS"`
4. Compute `evidence_hash` locally and compare to the card's value
5. Accept v1 cards only if explicitly enabled (backwards compat mode)

## Backwards compatibility

- v1 cards continue to verify against v1 verifiers (no breaking change for existing consumers)
- v2 verifiers SHOULD reject v1 cards by default, with an opt-in flag `--accept-v1` for migration
- v1 cards will be migrated to v2 by 2026-09-15 (one month)

## Test your implementation

Use the v2 fixture set:

```bash
curl -s https://marketnow.site/atc/spec/fixtures/v2/verify-fixtures.mjs > verify.mjs
node verify.mjs
```

Expected: 32/32 pass (16 must-fail v2-specific + 16 must-fail-against-orphaned-ca)
