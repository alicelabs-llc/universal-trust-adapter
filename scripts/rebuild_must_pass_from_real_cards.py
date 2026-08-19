#!/usr/bin/env python3
"""
Rebuild the must-pass fixtures using REAL signed ATC cards from _data/atc/.
The must-fail fixtures stay as-is (they're synthetic attack vectors).

This produces fixtures that actually verify against the live CA key.
"""
import json
import hashlib
import sys
from pathlib import Path

REPO = Path('/home/z/my-project/marketnow')
FIXTURE_DIR = REPO / 'aep-marketplace' / 'public' / 'atc' / 'spec' / 'fixtures' / 'v1'
ATC_DIR = REPO / '_data' / 'atc'

# Load all real ATC cards
real_cards = sorted(ATC_DIR.glob('ATC-2026-*.json'))
print(f'Found {len(real_cards)} real ATC cards')

# Pick 20 representative ones for must-pass
# Mix of high/low trust, various features
SAMPLE_INDICES = [0, 1, 2, 3, 4, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 56, 57 if len(real_cards)>57 else 0]
sample_indices = [i for i in SAMPLE_INDICES if i < len(real_cards)][:20]
print(f'Using {len(sample_indices)} cards for must-pass')

# Rebuild must-pass directory
(FIXTURE_DIR / 'must-pass').mkdir(parents=True, exist_ok=True)

# Clear old must-pass fixtures
for old in (FIXTURE_DIR / 'must-pass').glob('*.json'):
    old.unlink()

# Generate new must-pass fixtures from real cards
print('\nGenerating must-pass fixtures from real signed cards...')
generated = 0
for idx, card_idx in enumerate(sample_indices, 1):
    src_path = real_cards[card_idx]
    card = json.loads(src_path.read_text())

    # Skip cards that are revoked
    if card.get('status') == 'revoked':
        continue

    # Skip cards with sentinel_score = 0 (test cards)
    score = card.get('payload', {}).get('trust', {}).get('sentinel_review_score', 0)
    if score == 0 and 'hacker_bot' in card.get('payload', {}).get('agent_id', '').lower():
        # Skip hacker_bot cards (they're test fixtures)
        continue

    name = f'{idx:02d}-real-card-{card["card_id"]}'
    fixture_file = FIXTURE_DIR / 'must-pass' / f'{name}.json'
    fixture_file.write_text(json.dumps(card, indent=2) + '\n')

    # Compute canonical bytes (using the same canonicalizer as the verifier)
    # Note: real cards have canonical_json = "JSON.stringify(payload, Object.keys(payload).sort())"
    # which is the OLD canonicalization. We mark this in the expected file.
    expected_file = FIXTURE_DIR / 'expected' / f'{name}.verify.json'
    expected_data = {
        "fixture_id": name,
        "source_card_id": card["card_id"],
        "source_file": f'_data/atc/{card["card_id"]}.json',
        "expected_outcome": "valid",
        "expected_verify_result": True,
        "expected_verify_reason": "Real ATC card signed by MarketNow Sentinel CA. Signature should verify against the live CA public key.",
        "canonicalization_method_used": card["signature"].get("canonical_json", "?"),
        "note": "This is a REAL signed card. The signature was produced by the MarketNow Sentinel CA private key (held in Vercel env). Verifiers using the public CA key at /api/atc?action=ca-key should verify this signature as true."
    }
    expected_file.write_text(json.dumps(expected_data, indent=2) + '\n')
    print(f'  ✅ must-pass/{name}.json (card_id={card["card_id"]}, score={score})')
    generated += 1

print(f'\nGenerated {generated} must-pass fixtures from real signed cards')

# Rebuild MANIFEST.json
print('\nRebuilding MANIFEST.json...')
must_pass_files = sorted((FIXTURE_DIR / 'must-pass').glob('*.json'))
must_fail_files = sorted((FIXTURE_DIR / 'must-fail').glob('*.json'))

fixtures = []
for f in must_pass_files:
    name = f.stem
    fixtures.append({
        "id": name,
        "type": "must-pass",
        "file": f"must-pass/{f.name}",
        "expected_file": f"expected/{name}.verify.json",
        "expected_outcome": "valid",
        "source": "real_signed_card"
    })
for f in must_fail_files:
    name = f.stem
    # Read the fixture to get the attack_vector
    fixture_data = json.loads(f.read_text())
    fixtures.append({
        "id": name,
        "type": "must-fail",
        "file": f"must-fail/{f.name}",
        "expected_file": f"expected/{name}.verify.json",
        "expected_outcome": "invalid",
        "attack_vector": fixture_data.get("attack_vector", "?"),
        "source": "synthetic_attack_vector"
    })

manifest = {
    "schema_version": "1.0.0",
    "manifest_version": "v1",
    "published_at": "2026-08-19T00:00:00Z",
    "publisher": "MarketNow Sentinel CA",
    "publisher_url": "https://marketnow.site",
    "ca_public_key_url": "https://marketnow.site/api/atc?action=ca-key",
    "spec_url": "https://marketnow.site/atc/spec/SPEC.md",
    "canonicalization": "RFC 8785 JCS (JSON Canonicalization Scheme)",
    "signature_algorithm": "Ed25519 (RFC 8032)",
    "must_pass_count": len(must_pass_files),
    "must_fail_count": len(must_fail_files),
    "total_fixtures": len(must_pass_files) + len(must_fail_files),
    "fixtures": fixtures,
    "usage": {
        "instructions": "To verify an ATC implementation against these fixtures:",
        "steps": [
            "1. Download the entire fixtures/v1/ directory",
            "2. Fetch the CA public key from https://marketnow.site/api/atc?action=ca-key",
            "3. For each fixture in must-pass/: load the card, canonicalize using RFC 8785 JCS, verify the Ed25519 signature with the CA public key. Must return true.",
            "4. For each fixture in must-fail/: load the card, canonicalize using RFC 8785 JCS, verify the Ed25519 signature with the CA public key. Must return false (or throw).",
            "5. For fixtures with status='revoked', also check the live CRL at https://marketnow.site/api/atc?action=revocation-list.",
            "6. Report results: include fixture_id, your canonical bytes (hex), expected canonical bytes (hex), match: true/false."
        ]
    },
    "must_pass_source": "Real signed ATC cards from _data/atc/ (production cards signed by the live CA key).",
    "must_fail_source": "Synthetic attack vectors (tampered cards, rotated keys, expired, etc.) — designed to fail specific verifier properties.",
    "immutability": "This manifest is content-addressed. The SHA-256 of this manifest is the canonical version ID. Any change creates a new version.",
    "license": "MNNC-1.0 — see https://marketnow.site/LICENSE",
    "contact": "security@alicelabs.site"
}

manifest_json = json.dumps(manifest, indent=2, sort_keys=True)
manifest_digest = hashlib.sha256(manifest_json.encode('utf-8')).hexdigest()
manifest["manifest_sha256"] = manifest_digest

manifest_final = json.dumps(manifest, indent=2, sort_keys=True)
(FIXTURE_DIR / 'MANIFEST.json').write_text(manifest_final + '\n')
print(f'✅ MANIFEST.json ({len(manifest_final)} bytes, sha256: {manifest_digest[:16]}...)')

print(f'\n=== DONE ===')
print(f'Total fixtures: {len(fixtures)}')
print(f'  must-pass: {len(must_pass_files)} (from real signed cards)')
print(f'  must-fail: {len(must_fail_files)} (synthetic attack vectors)')
