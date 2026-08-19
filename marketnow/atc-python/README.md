# agent-trust-card (Python)

> **Issue and verify Agent Trust Cards in Python.** A small, framework-agnostic SDK for the [ATC/1.0 specification](https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/SPEC.md). Works in Python 3.9+.

[![PyPI version](https://img.shields.io/pypi/v/agent-trust-card.svg)](https://pypi.org/project/agent-trust-card/)
[![License: AliceLabs Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)
[![Spec: ATC/1.0](https://img.shields.io/badge/Spec-ATC%2F1.0-brightgreen)](https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/SPEC.md)

## Install

```bash
pip install agent-trust-card
```

## Quick start

```python
from atc_sdk import generate_keypair, issue_atc, verify_atc_sync

# Generate keys
ca = generate_keypair()
agent = generate_keypair()

# Issue a card
atc = issue_atc(ca, agent, {
    "card_id": "ATC-2026-0000001",
    "identity": {
        "agent_id": "my-bot",
        "agent_name": "My Bot",
        "agent_owner": "My Org",
    },
    "capabilities": {
        "filesystem": {"read": "own_dir", "write": "own_dir"},
        "network": {"egress": "allowlist", "ingress": "none"},
        "shell": {"exec": "sandboxed", "spawn": "none"},
        "credentials": {"read_env": "none", "read_files": "none"},
        "process": {"subprocess": "none", "signals": "own"},
    },
    "evidence": { /* ... see spec ... */ },
    "risk": {
        "trust_score": 9,
        "risk_level": "low",
        "score_explanation": "Clean audit",
        "scored_at": "2026-08-10T12:01:00Z",
    },
})

# Verify (sync — no network calls)
result = verify_atc_sync(atc)
print(result["valid"])  # True
print(result["controls_passed"])  # ['ATC-001', 'ATC-002', ..., 'ATC-008']

# Verify (async — with revocation list fetch)
from atc_sdk import verify_atc
result = verify_atc(atc, fetch_revocation=True)
print(result["valid"], result.get("revoked"))
```

## CLI

```bash
atc init                                    # Generate CA + agent keypair
atc issue --ca ca.json --agent agent.json --payload payload.json --out card.json
atc verify card.json                        # Verify an ATC
atc verify card.json --fetch-revocation     # Verify + fetch revocation list
atc inspect card.json                       # Pretty-print
```

## API

| Function | Description |
|---|---|
| `generate_keypair()` | Returns `KeyPair(public_key, private_key, raw_private_key, raw_public_key)` |
| `load_keypair_from_private(b64)` | Reconstruct a keypair from a base64 PKCS8 private key |
| `issue_atc(ca_kp, agent_kp, payload)` | Issue (sign) an ATC |
| `resign_atc(atc, ca_kp)` | Re-sign after editing |
| `verify_atc_sync(atc, ca_public_key=None)` | Sync verify (no network) |
| `verify_atc(atc, ca_public_key=None, fetch_revocation=False, revocation_timeout_ms=5000)` | Async verify with optional revocation fetch |
| `canonicalize_atc(atc)` | RFC 8785 JCS canonical form |
| `compute_payload_hash(atc)` | SHA-256 hex of canonical payload |

## Cross-language compatibility

ATCs issued by the Python SDK verify in the Node.js SDK and vice versa. Both use:
- Ed25519 (RFC 8032) for signatures
- RFC 8785 JCS for canonical JSON
- SHA-256 for payload hashes
- Full SPKI/PKCS8 DER encoding for keys (base64-encoded)

If you issue an ATC in Python and verify it in Node.js (or vice versa), the signature will verify byte-identically. This is enforced by the conformance test suite.

## Conformance tests

```bash
git clone https://github.com/edgarfloresguerra2011-a11y/marketnow.git
cd marketnow/atc-python
pip install cryptography requests
python3 tests/test_conformance.py
```

Expected: 22/22 assertions passing.

## License

MNNC-1.0 (AliceLabs LLC Proprietary). For licensing: legal@alicelabs.site

Built by AliceLabs LLC (Wyoming, USA) — founder Edison Flores.
