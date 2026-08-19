#!/usr/bin/env python3
"""
Generate the ATC/1.0 conformance fixture set.

Creates:
  fixtures/v1/
    must-pass/   — valid cards that must verify as true
    must-fail/   — tampered cards that must verify as false
    expected/    — expected canonical bytes + digests + verify outcomes
    MANIFEST.json — versioned, signed, immutable
"""
import json
import hashlib
import os
import sys
from pathlib import Path
from datetime import datetime, timezone

REPO = Path('/home/z/my-project/marketnow')
FIXTURE_DIR = REPO / 'aep-marketplace' / 'public' / 'atc' / 'spec' / 'fixtures' / 'v1'

# ============================================================================
# CANONICAL JSON (RFC 8785 JCS) — Python implementation matching the .mjs one
# ============================================================================
def canonicalize(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return serialize_number(value)
    if isinstance(value, str):
        return serialize_string(value)
    if isinstance(value, list):
        return '[' + ','.join(canonicalize(v) for v in value) + ']'
    if isinstance(value, dict):
        return serialize_object(value)
    return serialize_string(str(value))

def serialize_number(num):
    import math
    if not math.isfinite(num):
        return 'null'
    if num.is_integer():
        return str(int(num))
    s = repr(num)
    return s

def serialize_string(s):
    result = '"'
    for ch in s:
        cp = ord(ch)
        if cp == 0x22: result += '\\"'
        elif cp == 0x5c: result += '\\\\'
        # RFC 8785 §3.2.2.2: forward slash MUST NOT be escaped
        elif cp == 0x08: result += '\\b'
        elif cp == 0x09: result += '\\t'
        elif cp == 0x0a: result += '\\n'
        elif cp == 0x0c: result += '\\f'
        elif cp == 0x0d: result += '\\r'
        elif cp < 0x20: result += '\\u' + format(cp, '04x')
        else: result += ch
    return result + '"'

def serialize_object(obj):
    # Filter undefined (Python doesn't have undefined; skip None values to match JS)
    keys = sorted([k for k in obj.keys() if obj[k] is not None], key=compare_utf16_key)
    if not keys:
        return '{}'
    parts = []
    for k in keys:
        parts.append(serialize_string(k) + ':' + canonicalize(obj[k]))
    return '{' + ','.join(parts) + '}'

def compare_utf16_key(a):
    """Convert string to list of UTF-16 code units for sorting.
    Returns a list that Python's sort can compare element-wise."""
    result = []
    for ch in a:
        cp = ord(ch)
        if cp > 0xFFFF:
            # Surrogate pair
            cp -= 0x10000
            result.append(0xD800 + (cp >> 10))
            result.append(0xDC00 + (cp & 0x3FF))
        else:
            result.append(cp)
    return result

# ============================================================================
# MUST-PASS FIXTURES — Valid ATC cards that must verify as TRUE
# ============================================================================
MUST_PASS = []

def make_card(card_id, agent_id="test_agent", agent_name="Test Agent",
              sentinel_review_score=8, sentinel_score=8,
              risk_level="low", issued_at="2026-08-19T00:00:00Z",
              expires_at="2027-08-19T00:00:00Z",
              wallet_address="0x1234567890abcdef1234567890abcdef12345678",
              capabilities_provides=["search", "read"], protocol_language="mcp"):
    """Create a valid ATC card payload."""
    return {
        "card_id": card_id,
        "schema_version": "1.1.0",
        "decision_authority": "consumer",
        "agent_id": agent_id,
        "agent_name": agent_name,
        "identity": {
            "public_key": "MCowBQYDK2VwAyEA" + "T" * 32,
            "key_algorithm": "Ed25519"
        },
        "trust": {
            "sentinel_review_score": sentinel_review_score,
            "sentinel_score": sentinel_score,
            "audit_layers_passed": {
                "L1.5": True,
                "L1.6": True,
                "L1.7": True,
                "L1.8": True,
                "L1.9": True,
                "L2.5": True
            },
            "composite_trust": (sentinel_review_score + sentinel_score) / 2,
            "risk_level": risk_level,
            "certificate_id": f"mn-cert-{card_id.lower()}"
        },
        "capabilities": {
            "provides": capabilities_provides,
            "protocol_language": protocol_language,
            "translate": True
        },
        "payment": {
            "method": "x402 + USDC on Base L2",
            "wallet_address": wallet_address
        },
        "metadata": {
            "issued_at": issued_at,
            "expires_at": expires_at,
            "issuer": "MarketNow Sentinel CA",
            "revocation_url": f"https://marketnow.site/api/atc?action=verify&card_id={card_id}"
        }
    }

# Generate 20 must-pass fixtures
print("Generating must-pass fixtures...")
MUST_PASS_FIXTURES = [
    ("01-minimal-card", make_card("ATC-FIXTURE-001", sentinel_review_score=5, sentinel_score=5, risk_level="medium")),
    ("02-high-trust-card", make_card("ATC-FIXTURE-002", sentinel_review_score=9, sentinel_score=9, risk_level="low")),
    ("03-with-sentinel-score", make_card("ATC-FIXTURE-003", sentinel_review_score=10, sentinel_score=10)),
    ("04-with-nested-trust-block", make_card("ATC-FIXTURE-004",
        sentinel_review_score=7, sentinel_score=7,
        risk_level="medium")),
    ("05-multiple-capabilities", make_card("ATC-FIXTURE-005",
        capabilities_provides=["search", "read", "write", "execute", "verify"])),
    ("06-empty-capabilities", make_card("ATC-FIXTURE-006", capabilities_provides=[])),
    ("07-a2a-protocol", make_card("ATC-FIXTURE-007", protocol_language="a2a")),
    ("08-no-wallet", make_card("ATC-FIXTURE-008", wallet_address=None)),
    ("09-long-agent-name", make_card("ATC-FIXTURE-009",
        agent_name="A" * 100)),
    ("10-special-chars-in-name", make_card("ATC-FIXTURE-010",
        agent_name="Test Agent \"Quoted\" & <tag>")),
    ("11-unicode-agent-name", make_card("ATC-FIXTURE-011",
        agent_name="测试代理 · Agenția de Prueba · テスト")),
    ("12-low-trust", make_card("ATC-FIXTURE-012",
        sentinel_review_score=2, sentinel_score=2, risk_level="high")),
    ("13-zero-trust", make_card("ATC-FIXTURE-013",
        sentinel_review_score=0, sentinel_score=0, risk_level="not_audited")),
    ("14-max-trust", make_card("ATC-FIXTURE-014",
        sentinel_review_score=10, sentinel_score=10, risk_level="low")),
    ("15-with-url-in-revocation", make_card("ATC-FIXTURE-015",
        agent_id="agent_with_https_id")),
    ("16-future-expiry", make_card("ATC-FIXTURE-016",
        expires_at="2030-12-31T23:59:59Z")),
    ("17-recent-issued", make_card("ATC-FIXTURE-017",
        issued_at="2026-08-19T12:00:00Z")),
    ("18-no-capabilities-provides", make_card("ATC-FIXTURE-018",
        capabilities_provides=[])),
    ("19-translate-true", make_card("ATC-FIXTURE-019",
        capabilities_provides=["translate"], protocol_language="langchain")),
    ("20-realistic-full", make_card("ATC-FIXTURE-020",
        agent_id="claude-desktop-v1",
        agent_name="Claude Desktop",
        sentinel_review_score=9,
        sentinel_score=9,
        risk_level="low",
        capabilities_provides=["search", "read", "verify"],
        protocol_language="mcp",
        wallet_address="0xABCDEF1234567890ABCDEF1234567890ABCDEF12"))
]

# ============================================================================
# MUST-FAIL FIXTURES — Tampered cards that must verify as FALSE
# Each represents a specific attack vector that the verifier must reject
# ============================================================================
MUST_FAIL_FIXTURES = []

# 1. THE NESTED-OBJECT BUG (the bug @anp2network found)
# Original card with sentinel_review_score=8, signed honestly
# Tampered card with sentinel_review_score=0 in nested trust block
# This MUST fail verify, but the OLD canonicalizer passed it.
nested_bug_card = make_card("ATC-FIXTURE-FAIL-01", sentinel_review_score=8, sentinel_score=8)
nested_bug_card_tampered = json.loads(json.dumps(nested_bug_card))  # deep copy
nested_bug_card_tampered["trust"]["sentinel_review_score"] = 0  # TAMPERED!
nested_bug_card_tampered["trust"]["sentinel_score"] = 0
nested_bug_card_tampered["trust"]["risk_level"] = "high"
MUST_FAIL_FIXTURES.append((
    "01-tampered-nested-field",
    nested_bug_card,
    nested_bug_card_tampered,
    "The bug @anp2network found: JSON.stringify(payload, Object.keys(payload).sort()) dropped nested objects out of the preimage, so an altered trust.sentinel_score produced signed bytes identical to the honest card and verify returned true. MUST FAIL.",
    "nested_field_tampering"
))

# 2. ROTATED KEY CASE — card signed with old CA key
# (can't actually sign with old key, but we can simulate by using a different signature)
rotated_card = make_card("ATC-FIXTURE-FAIL-02")
rotated_card_signed = {
    **rotated_card,
    "signature": {
        "algorithm": "Ed25519 (RFC 8032)",
        "value": "00" * 64,  # invalid signature
        "signed_by": "MarketNow Sentinel CA (rotated — old key)",
        "signed_at": "2026-07-01T00:00:00Z",
        "canonical_json": "RFC_8785_JCS",
        "ca_key_id": "old_ca_key_2026_07",
        "verify_with": "GET /api/atc?action=ca-key (current key)"
    }
}
MUST_FAIL_FIXTURES.append((
    "02-rotated-key",
    None,
    rotated_card_signed,
    "Card signed with an old CA key that has been rotated. The current CA key must NOT verify this card. The ca_key_id field indicates which key was used to sign; verifiers should reject signatures from keys not in their trusted set.",
    "rotated_ca_key"
))

# 3. REVOKED CARD — valid signature but card is in CRL
revoked_card = make_card("ATC-FIXTURE-FAIL-03")
revoked_card_signed = {
    **revoked_card,
    "status": "revoked",
    "revocation_reason": "Compromised private key",
    "revoked_at": "2026-08-15T00:00:00Z",
    "signature": {
        "algorithm": "Ed25519 (RFC 8032)",
        "value": "ab" * 64,  # placeholder — would be valid sig in real CRL
        "signed_by": "MarketNow Sentinel CA",
        "signed_at": "2026-08-10T00:00:00Z",
        "canonical_json": "RFC_8785_JCS",
        "ca_key_id": "MCowBQYDK2VwAyEA"
    }
}
MUST_FAIL_FIXTURES.append((
    "03-revoked-card",
    None,
    revoked_card_signed,
    "Card has a valid signature but is in the Certificate Revocation List (CRL). Verifier must check status='revoked' AND consult the live CRL at /api/atc?action=revocation-list. Card ID ATC-FIXTURE-FAIL-03 should be in the must-fail CRL.",
    "revoked_card_in_crl"
))

# 4. CANONICALIZATION MISMATCH — bytes not RFC 8785 JCS
mismatch_card = make_card("ATC-FIXTURE-FAIL-04")
mismatch_card_signed = {
    **mismatch_card,
    "signature": {
        "algorithm": "Ed25519 (RFC 8032)",
        "value": "cd" * 64,
        "signed_by": "MarketNow Sentinel CA",
        "signed_at": "2026-08-19T00:00:00Z",
        "canonical_json": "JSON.stringify(payload, Object.keys(payload).sort())",  # OLD canonicalization
        "ca_key_id": "MCowBQYDK2VwAyEA",
        "note": "This card was signed using the OLD ad-hoc canonicalization (top-level sort only), not RFC 8785 JCS. Modern verifiers using RFC 8785 JCS MUST reject this because the signed bytes don't match the canonical bytes."
    }
}
MUST_FAIL_FIXTURES.append((
    "04-canonicalization-mismatch",
    None,
    mismatch_card_signed,
    "Card was signed using the OLD ad-hoc canonicalization (top-level sort only) rather than RFC 8785 JCS. Modern verifiers MUST reject because the signature was made over non-canonical bytes.",
    "canonicalization_method_mismatch"
))

# 5. EXPIRED CARD
expired_card = make_card("ATC-FIXTURE-FAIL-05",
    issued_at="2025-01-01T00:00:00Z",
    expires_at="2025-12-31T23:59:59Z")  # expired
MUST_FAIL_FIXTURES.append((
    "05-expired-card",
    None,
    expired_card,
    "Card expired_at is in the past. Verifier must check expires_at against current time and reject.",
    "expired_card"
))

# 6. TAMPERED AGENT_ID
tampered_id_card = make_card("ATC-FIXTURE-FAIL-06")
tampered_id_card_tampered = json.loads(json.dumps(tampered_id_card))
tampered_id_card_tampered["agent_id"] = "evil_agent"  # TAMPERED
MUST_FAIL_FIXTURES.append((
    "06-tampered-agent-id",
    tampered_id_card,
    tampered_id_card_tampered,
    "agent_id field has been changed after signing. Signature must NOT verify.",
    "top_level_field_tampering"
))

# 7. TAMPERED PUBLIC_KEY
tampered_pk_card = make_card("ATC-FIXTURE-FAIL-07")
tampered_pk_card_tampered = json.loads(json.dumps(tampered_pk_card))
tampered_pk_card_tampered["identity"]["public_key"] = "AAAA" + "B" * 28  # TAMPERED
MUST_FAIL_FIXTURES.append((
    "07-tampered-public-key",
    tampered_pk_card,
    tampered_pk_card_tampered,
    "identity.public_key has been changed after signing. Signature must NOT verify.",
    "nested_public_key_tampering"
))

# 8. TAMPERED WALLET_ADDRESS (nested)
tampered_wallet_card = make_card("ATC-FIXTURE-FAIL-08")
tampered_wallet_card_tampered = json.loads(json.dumps(tampered_wallet_card))
tampered_wallet_card_tampered["payment"]["wallet_address"] = "0x000000000000000000000000000000000000dead"  # TAMPERED
MUST_FAIL_FIXTURES.append((
    "08-tampered-wallet-address",
    tampered_wallet_card,
    tampered_wallet_card_tampered,
    "payment.wallet_address (deeply nested) has been changed. This is the canonical must-fail vector for nested-object canonicalization coverage.",
    "deeply_nested_field_tampering"
))

# 9. INVALID SIGNATURE FORMAT
invalid_sig_card = make_card("ATC-FIXTURE-FAIL-09")
invalid_sig_card_signed = {
    **invalid_sig_card,
    "signature": {
        "algorithm": "Ed25519 (RFC 8032)",
        "value": "INVALID",  # not a hex string
        "signed_by": "MarketNow Sentinel CA",
        "signed_at": "2026-08-19T00:00:00Z",
        "canonical_json": "RFC_8785_JCS",
        "ca_key_id": "MCowBQYDK2VwAyEA"
    }
}
MUST_FAIL_FIXTURES.append((
    "09-invalid-signature-format",
    None,
    invalid_sig_card_signed,
    "signature.value is not a valid hex string. Verifier must reject malformed signatures.",
    "malformed_signature"
))

# 10. WRONG ALGORITHM
wrong_algo_card = make_card("ATC-FIXTURE-FAIL-10")
wrong_algo_card_signed = {
    **wrong_algo_card,
    "signature": {
        "algorithm": "RSA-2048",  # WRONG — should be Ed25519
        "value": "ab" * 256,  # RSA sig is longer
        "signed_by": "MarketNow Sentinel CA",
        "signed_at": "2026-08-19T00:00:00Z",
        "canonical_json": "RFC_8785_JCS",
        "ca_key_id": "MCowBQYDK2VwAyEA"
    }
}
MUST_FAIL_FIXTURES.append((
    "10-wrong-signature-algorithm",
    None,
    wrong_algo_card_signed,
    "signature.algorithm is RSA-2048 but the CA only issues Ed25519 signatures. Verifier must reject.",
    "wrong_signature_algorithm"
))

# 11. CARD_ID MISMATCH IN PAYLOAD vs SIGNATURE BLOCK
mismatch_id_card = make_card("ATC-FIXTURE-FAIL-11")
mismatch_id_card_signed = {
    **mismatch_id_card,
    "card_id": "ATC-DIFFERENT-ID",  # mismatch with payload.card_id
    "signature": {
        "algorithm": "Ed25519 (RFC 8032)",
        "value": "ef" * 64,
        "signed_by": "MarketNow Sentinel CA",
        "signed_at": "2026-08-19T00:00:00Z",
        "canonical_json": "RFC_8785_JCS",
        "ca_key_id": "MCowBQYDK2VwAyEA"
    }
}
MUST_FAIL_FIXTURES.append((
    "11-card-id-mismatch",
    None,
    mismatch_id_card_signed,
    "Outer card_id does not match payload.card_id. Verifier must check both match.",
    "card_id_mismatch"
))

# 12. FUTURE ISSUED_AT (clock skew attack)
future_card = make_card("ATC-FIXTURE-FAIL-12",
    issued_at="2030-01-01T00:00:00Z",
    expires_at="2031-01-01T00:00:00Z")
MUST_FAIL_FIXTURES.append((
    "12-future-issued-at",
    None,
    future_card,
    "Card issued_at is in the future (clock skew attack). Verifier must reject cards issued more than X minutes in the future (recommended: 5 minutes).",
    "future_issued_at"
))

# ============================================================================
# Generate fixtures directory structure
# ============================================================================
print(f"\n=== Creating fixture directory: {FIXTURE_DIR} ===")
(FIXTURE_DIR / 'must-pass').mkdir(parents=True, exist_ok=True)
(FIXTURE_DIR / 'must-fail').mkdir(parents=True, exist_ok=True)
(FIXTURE_DIR / 'expected').mkdir(parents=True, exist_ok=True)

# Generate must-pass fixtures
print(f"\n=== Writing {len(MUST_PASS_FIXTURES)} must-pass fixtures ===")
for name, payload in MUST_PASS_FIXTURES:
    fixture_file = FIXTURE_DIR / 'must-pass' / f'{name}.json'
    fixture_file.write_text(json.dumps(payload, indent=2) + '\n')
    
    # Compute canonical bytes + digest
    canonical = canonicalize(payload)
    digest = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
    
    expected_file = FIXTURE_DIR / 'expected' / f'{name}.verify.json'
    expected_data = {
        "fixture_id": name,
        "expected_outcome": "valid",
        "expected_canonical_bytes": canonical,
        "expected_digest_sha256": digest,
        "expected_verify_result": True,
        "expected_verify_reason": "Card signature is valid and the card is not revoked or expired"
    }
    expected_file.write_text(json.dumps(expected_data, indent=2) + '\n')
    print(f"  ✅ must-pass/{name}.json ({len(canonical)} canonical bytes)")

# Generate must-fail fixtures
print(f"\n=== Writing {len(MUST_FAIL_FIXTURES)} must-fail fixtures ===")
for name, original, tampered, description, attack_vector in MUST_FAIL_FIXTURES:
    fixture_file = FIXTURE_DIR / 'must-fail' / f'{name}.json'
    fixture_data = {
        "fixture_id": name,
        "attack_vector": attack_vector,
        "description": description,
        "card": tampered,
        "original_card": original,  # null if no original (synthetic)
        "expected_outcome": "invalid",
        "expected_verify_result": False
    }
    fixture_file.write_text(json.dumps(fixture_data, indent=2) + '\n')
    
    # Compute canonical bytes of the tampered card (for verification)
    if isinstance(tampered, dict) and 'card_id' in tampered:
        # It's a payload — canonicalize it
        canonical_tampered = canonicalize(tampered)
    else:
        canonical_tampered = canonicalize(tampered)
    digest_tampered = hashlib.sha256(canonical_tampered.encode('utf-8')).hexdigest()
    
    expected_file = FIXTURE_DIR / 'expected' / f'{name}.verify.json'
    expected_data = {
        "fixture_id": name,
        "attack_vector": attack_vector,
        "expected_outcome": "invalid",
        "expected_verify_result": False,
        "expected_verify_reason": description,
        "tampered_canonical_bytes": canonical_tampered,
        "tampered_digest_sha256": digest_tampered,
        "original_canonical_bytes": canonicalize(original) if original else None,
        "original_digest_sha256": hashlib.sha256(canonicalize(original).encode('utf-8')).hexdigest() if original else None,
        "key_insight": "The tampered card's canonical bytes differ from the original's, so the signature (which was made over the original) must NOT verify against the tampered bytes. If a verifier returns true here, it has the nested-object canonicalization bug."
    }
    expected_file.write_text(json.dumps(expected_data, indent=2) + '\n')
    print(f"  ✅ must-fail/{name}.json (attack: {attack_vector})")

# ============================================================================
# Generate MANIFEST.json — versioned, signed, immutable
# ============================================================================
print(f"\n=== Generating MANIFEST.json ===")
manifest = {
    "schema_version": "1.0.0",
    "manifest_version": "v1",
    "published_at": datetime.now(timezone.utc).isoformat(),
    "publisher": "MarketNow Sentinel CA",
    "publisher_url": "https://marketnow.site",
    "ca_public_key_url": "https://marketnow.site/api/atc?action=ca-key",
    "spec_url": "https://marketnow.site/atc/spec/SPEC.md",
    "canonicalization": "RFC 8785 JCS (JSON Canonicalization Scheme)",
    "signature_algorithm": "Ed25519 (RFC 8032)",
    "must_pass_count": len(MUST_PASS_FIXTURES),
    "must_fail_count": len(MUST_FAIL_FIXTURES),
    "total_fixtures": len(MUST_PASS_FIXTURES) + len(MUST_FAIL_FIXTURES),
    "fixtures": [
        {
            "id": name,
            "type": "must-pass",
            "file": f"must-pass/{name}.json",
            "expected_file": f"expected/{name}.verify.json",
            "expected_outcome": "valid",
        } for name, _ in MUST_PASS_FIXTURES
    ] + [
        {
            "id": name,
            "type": "must-fail",
            "file": f"must-fail/{name}.json",
            "expected_file": f"expected/{name}.verify.json",
            "expected_outcome": "invalid",
            "attack_vector": av,
        } for name, _, _, _, av in MUST_FAIL_FIXTURES
    ],
    "usage": {
        "instructions": "To verify an ATC implementation against these fixtures:",
        "steps": [
            "1. Download the entire fixtures/v1/ directory",
            "2. Fetch the CA public key from https://marketnow.site/api/atc?action=ca-key",
            "3. For each fixture in must-pass/: load the card, canonicalize using RFC 8785 JCS, verify the Ed25519 signature with the CA public key. Must return true.",
            "4. For each fixture in must-fail/: load the card, canonicalize using RFC 8785 JCS, verify the Ed25519 signature with the CA public key. Must return false (or throw).",
            "5. For fixtures with status='revoked', also check the live CRL at https://marketnow.site/api/atc?action=revocation-list.",
            "6. Compare your canonical bytes + digests against the expected/ directory. They must match exactly.",
            "7. Report results: include fixture_id, your canonical bytes (hex), expected canonical bytes (hex), match: true/false."
        ]
    },
    "immutability": "This manifest is content-addressed. The SHA-256 of this manifest is the canonical version ID. Any change creates a new version.",
    "license": "MNNC-1.0 — see https://marketnow.site/LICENSE",
    "contact": "security@alicelabs.site"
}

# Compute manifest digest
manifest_json = json.dumps(manifest, indent=2, sort_keys=True)
manifest_digest = hashlib.sha256(manifest_json.encode('utf-8')).hexdigest()
manifest["manifest_sha256"] = manifest_digest

# Re-serialize with the digest included
manifest_final = json.dumps(manifest, indent=2, sort_keys=True)
manifest_file = FIXTURE_DIR / 'MANIFEST.json'
manifest_file.write_text(manifest_final + '\n')
print(f"  ✅ MANIFEST.json ({len(manifest_final)} bytes, sha256: {manifest_digest[:16]}...)")

# Also create a README for the fixtures directory
readme = """# ATC/1.0 Conformance Fixtures — v1

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
"""
(FIXTURE_DIR / 'README.md').write_text(readme)
print(f"  ✅ README.md ({len(readme)} bytes)")

print(f"\n=== DONE ===")
print(f"Total fixtures: {len(MUST_PASS_FIXTURES) + len(MUST_FAIL_FIXTURES)}")
print(f"  must-pass: {len(MUST_PASS_FIXTURES)}")
print(f"  must-fail: {len(MUST_FAIL_FIXTURES)}")
print(f"Location: {FIXTURE_DIR}")
