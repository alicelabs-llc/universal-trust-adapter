# ATC/1.0 Conformance Fixtures — v1

> Frozen, signed, immutable test vectors for Agent Trust Card (ATC/1.0) implementations.

## What this is

This directory contains a set of test fixtures that any ATC/1.0 implementation can use to verify conformance with the spec. The fixtures are:

- **Frozen**: Once published, they never change. New versions get new directories (v2/, v3/, ...).
- **Signed**: The MANIFEST.json is content-addressed (SHA-256 of itself is the version ID).
- **Immutable**: Any change creates a new version, so old test results stay valid.

## Why this exists

The bug @anp2network found on 2026-08-13 — where JSON.stringify(payload, Object.keys(payload).sort()) dropped nested objects out of the preimage, so an altered trust.sentinel_score produced signed bytes identical to the honest card and verify returned true — passed every "valid signature verifies" test by construction.

That class of bug can only be caught by **must-fail** fixtures: tampered cards that the verifier MUST reject. If a verifier returns true for any must-fail fixture, it has the bug.

## Directory structure

```
fixtures/v1/
├── MANIFEST.json                  # signed manifest with all fixture metadata
├── README.md                     # this file
├── must-pass/                     # valid cards that MUST verify as true
│   ├── 01-minimal-card.json
│   ├── 02-high-trust-card.json
│   ├── ...
│   └── 20-realistic-full.json
├── must-fail/                     # tampered cards that MUST verify as false
│   ├── 01-tampered-nested-field.json     # THE BUG @anp2network found
│   ├── 02-rotated-key.json
│   ├── 03-revoked-card.json
│   ├── 04-canonicalization-mismatch.json
│   ├── 05-expired-card.json
│   ├── 06-tampered-agent-id.json
│   ├── 07-tampered-public-key.json
│   ├── 08-tampered-wallet-address.json
│   ├── 09-invalid-signature-format.json
│   ├── 10-wrong-signature-algorithm.json
│   ├── 11-card-id-mismatch.json
│   └── 12-future-issued-at.json
└── expected/                      # expected canonical bytes + digests + outcomes
    ├── 01-minimal-card.verify.json
    ├── 01-tampered-nested-field.verify.json
    └── ...
```

## How to use

### 1. Fetch the CA public key

```bash
curl -s https://marketnow.site/api/atc?action=ca-key | jq -r .public_key_pem > ca.pub
```

### 2. Run the fixtures against your verifier

```python
# Python example
import json, hashlib
from cryptography.hazmat.primitives.serialization import load_pem_public_key

ca_key = load_pem_public_key(open('ca.pub').read().encode())

with open('fixtures/v1/MANIFEST.json') as f:
    manifest = json.load(f)

for fixture in manifest['fixtures']:
    card = json.load(open(f'fixtures/v1/{fixture["file"]}'))
    expected = json.load(open(f'fixtures/v1/{fixture["expected_file"]}'))
    
    # Canonicalize using RFC 8785 JCS
    canonical_bytes = your_canonicalizer(card)
    
    # Verify signature
    result = your_verify(ca_key, canonical_bytes, card['signature']['value'])
    
    assert result == expected['expected_verify_result'], f"{fixture['id']}: expected {expected['expected_verify_result']}, got {result}"
    assert canonical_bytes == expected['expected_canonical_bytes'], f"{fixture['id']}: canonical bytes mismatch"
    
    print(f"✅ {fixture['id']}: passed")
```

## Reporting results

If your verifier passes all fixtures, publish the result with:
- Your implementation name + version
- The MANIFEST.json SHA-256 you tested against
- Your canonical bytes for fixture 01-minimal-card (for cross-implementation verification)

## Adding new fixtures

If you find a new attack vector not covered by these fixtures, contact security@alicelabs.site. We'll add it to a new version (v2/) without modifying v1.

## License

MNNC-1.0 — see https://marketnow.site/LICENSE

## Contact

- Spec: https://marketnow.site/atc/spec/SPEC.md
- Issues: security@alicelabs.site
- CA key: https://marketnow.site/api/atc?action=ca-key
