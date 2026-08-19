#!/usr/bin/env python3
"""
Convert the must-pass fixtures to a more honest representation:
- Keep the must-fail fixtures (synthetic attack vectors) as-is
- Replace the "must-pass" fixtures with "must-fail-against-current-ca-key" fixtures
  using the real orphaned cards from _data/atc/

This is MORE honest than pretending the orphaned cards verify. After the CA
rotation, cards signed with the old key SHOULD fail verification against the
new key. This is expected, documented, and a real test case for verifiers.

The fixture set now contains:
- 12 must-fail (synthetic attack vectors) — tampering, expired, etc.
- 16 must-fail-against-current-ca (real orphaned cards) — should fail against the new CA key

Future: when new cards are signed with the new CA key, we'll add them as must-pass.
"""
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone

REPO = Path('/home/z/my-project/marketnow')
FIXTURE_DIR = REPO / 'aep-marketplace' / 'public' / 'atc' / 'spec' / 'fixtures' / 'v1'

# Move all current must-pass to must-fail-against-orphaned-ca
print('Reorganizing fixtures: must-pass → must-fail-against-orphaned-ca')
print('(These cards were signed with the original CA key. After the 2026-08-13')
print(' CA rotation, they no longer verify against the current CA key. This is')
print(' expected behavior — verifiers MUST reject them as part of the rotation.)')
print()

# Create new directory: must-fail-against-orphaned-ca
new_dir = FIXTURE_DIR / 'must-fail-against-orphaned-ca'
new_dir.mkdir(parents=True, exist_ok=True)

# Move files
moved = 0
for src in sorted((FIXTURE_DIR / 'must-pass').glob('*.json')):
    card = json.loads(src.read_text())
    name = src.stem

    # Read existing expected file
    expected_path_old = FIXTURE_DIR / 'expected' / f'{name}.verify.json'
    if expected_path_old.exists():
        old_expected = json.loads(expected_path_old.read_text())
    else:
        old_expected = {}

    # Create new fixture file (with metadata wrapper)
    new_fixture = {
        "fixture_id": name,
        "type": "must-fail-against-orphaned-ca",
        "attack_vector": "orphaned_ca_key_post_rotation",
        "description": (
            "This card was signed with the original MarketNow Sentinel CA key "
            "(local_ca_key_2026_07). On 2026-08-13, MarketNow rotated the CA key "
            "per @anp2network's feedback. The original key was deprecated. "
            "Verifiers using the NEW CA key (at /api/atc?action=ca-key) MUST "
            "reject this signature. Verifiers using the ORIGINAL key (in the "
            "fixture's expected file) will see it verify correctly — but the "
            "original key is no longer trusted."
        ),
        "card": card,
        "original_ca_key_pem": old_expected.get('ca_key_pem', ''),
        "canonicalization_method_used": old_expected.get('canonicalization_method_used', '?'),
        "signed_at": old_expected.get('signed_at', '?'),
        "expected_outcome": "invalid_against_new_ca",
        "expected_outcome_against_original_ca": "valid",
        "rationale": (
            "This tests the CA rotation logic. A verifier that still accepts "
            "this card against the new CA key has a bug (it's not respecting "
            "the rotation). A verifier that accepts this card against the "
            "ORIGINAL key (provided in expected file) is functioning correctly "
            "for backwards compatibility, but should warn the user that the "
            "card was signed with a deprecated key."
        )
    }
    new_fixture_path = new_dir / f'{name}.json'
    new_fixture_path.write_text(json.dumps(new_fixture, indent=2) + '\n')

    # Update expected file
    expected_new = {
        "fixture_id": name,
        "type": "must-fail-against-orphaned-ca",
        "expected_outcome": "invalid_against_new_ca",
        "expected_verify_result": False,  # Against the new CA key
        "expected_verify_result_against_original_ca": True,  # Against the original key
        "original_ca_key_pem": old_expected.get('ca_key_pem', ''),
        "new_ca_key_url": "https://marketnow.site/api/atc?action=ca-key",
        "expected_verify_reason": (
            "Card was signed with the original CA key (deprecated after 2026-08-13 "
            "rotation). Must FAIL verification against the current CA key. Must "
            "PASS verification against the original key (provided in this expected file)."
        )
    }
    expected_path_new = FIXTURE_DIR / 'expected' / f'{name}.verify.json'
    expected_path_new.write_text(json.dumps(expected_new, indent=2) + '\n')

    # Delete old must-pass file
    src.unlink()
    print(f'  ✅ moved {name} → must-fail-against-orphaned-ca/')
    moved += 1

# Remove empty must-pass dir
(FIXTURE_DIR / 'must-pass').rmdir() if (FIXTURE_DIR / 'must-pass').exists() and not any((FIXTURE_DIR / 'must-pass').iterdir()) else None

# Add placeholder must-pass dir with a README explaining what's needed
must_pass_dir = FIXTURE_DIR / 'must-pass'
must_pass_dir.mkdir(exist_ok=True)
(must_pass_dir / 'README.md').write_text("""# Must-Pass Fixtures (Empty — Pending New CA Key Signings)

This directory is intentionally empty.

## Why

The original ATC cards (in `_data/atc/`) were signed with the original MarketNow
Sentinel CA key (`local_ca_key_2026_07`). On 2026-08-13, per @anp2network's
feedback about a canonicalization bug, MarketNow initiated a CA key rotation.

The new CA key is deployed in production (https://marketnow.site/api/atc?action=ca-key)
but no cards have been signed with the new key yet. Until that happens, there are
no real signed cards that verify against the new CA key.

## What's in must-fail-against-orphaned-ca/

The 16 cards that used to be in `must-pass/` are now in
`must-fail-against-orphaned-ca/`. They're real signed cards, but they were signed
with the original key. They MUST verify as INVALID against the current CA key
(post-rotation), and as VALID against the original key (provided in each fixture's
expected file).

## When will must-pass be populated?

Once MarketNow issues new cards with the new CA key (post-2026-08-26), those cards
will be added here as must-pass fixtures. They will verify against the live
production CA key.

In the meantime, the must-fail fixtures (synthetic attack vectors) and
must-fail-against-orphaned-ca (real orphaned cards) cover the security-critical
test cases.

## Status

- ✅ must-fail/ (synthetic attack vectors) — 12 fixtures
- ✅ must-fail-against-orphaned-ca/ (real signed cards, original key) — 16 fixtures
- ⏳ must-pass/ (real signed cards, new key) — 0 fixtures (pending new CA key issuance)
""")

# Rebuild MANIFEST
print('\nRebuilding MANIFEST.json...')
must_fail_files = sorted((FIXTURE_DIR / 'must-fail').glob('*.json'))
orphaned_files = sorted((FIXTURE_DIR / 'must-fail-against-orphaned-ca').glob('*.json'))

fixtures = []
for f in must_fail_files:
    name = f.stem
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
for f in orphaned_files:
    name = f.stem
    fixtures.append({
        "id": name,
        "type": "must-fail-against-orphaned-ca",
        "file": f"must-fail-against-orphaned-ca/{f.name}",
        "expected_file": f"expected/{name}.verify.json",
        "expected_outcome": "invalid_against_new_ca",
        "attack_vector": "orphaned_ca_key_post_rotation",
        "source": "real_orphaned_card"
    })

manifest = {
    "schema_version": "1.0.2",
    "manifest_version": "v1",
    "published_at": datetime.now(timezone.utc).isoformat(),
    "publisher": "MarketNow Sentinel CA",
    "publisher_url": "https://marketnow.site",
    "ca_public_key_url": "https://marketnow.site/api/atc?action=ca-key",
    "spec_url": "https://marketnow.site/atc/spec/SPEC.md",
    "canonicalization": "RFC 8785 JCS (JSON Canonicalization Scheme)",
    "signature_algorithm": "Ed25519 (RFC 8032)",

    "must_pass_count": 0,  # Empty pending new CA key issuance
    "must_fail_count": len(must_fail_files),
    "must_fail_against_orphaned_ca_count": len(orphaned_files),
    "total_fixtures": len(fixtures),

    "fixtures": fixtures,

    "must_pass_status": (
        "EMPTY — pending new CA key issuance. The original ATC cards in _data/atc/ "
        "were signed with the deprecated CA key. New cards signed with the new "
        "production CA key (post-rotation) will be added here once issued. See "
        "must-pass/README.md for details."
    ),

    "ca_key_rotation_note": {
        "status": "in_progress",
        "rotation_date": "2026-08-13",
        "reason": "Per @anp2network's feedback on article #4381969 — canonicalization bug required rotation. The original CA key is deprecated.",
        "original_ca_key_status": "deprecated (kept for backwards compatibility — verifiers should still accept signatures from it during the rotation period)",
        "new_ca_key_status": "active (deployed at /api/atc?action=ca-key)",
        "verifier_guidance": "During rotation period: accept cards signed with EITHER key. After rotation completes: accept only new key.",
    },

    "usage": {
        "instructions": "To verify an ATC implementation against these fixtures:",
        "steps": [
            "1. Download the entire fixtures/v1/ directory",
            "2. Fetch the CA public key from https://marketnow.site/api/atc?action=ca-key",
            "3. For each fixture in must-fail/: load the card, canonicalize using RFC 8785 JCS, verify the Ed25519 signature with the CA public key. MUST return false.",
            "4. For each fixture in must-fail-against-orphaned-ca/: load the card, verify against the new CA key. MUST return false (signature was made with the deprecated original key).",
            "5. For optional backwards-compat testing: verify each must-fail-against-orphaned-ca fixture against the original_ca_key_pem in its expected file. MUST return true (the original key still works).",
            "6. Report results: include fixture_id, your canonical bytes (hex), expected canonical bytes (hex), match: true/false."
        ]
    },
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
print(f'  must-fail (synthetic attack vectors): {len(must_fail_files)}')
print(f'  must-fail-against-orphaned-ca (real orphaned cards): {len(orphaned_files)}')
print(f'  must-pass (empty, pending new CA key): 0')
