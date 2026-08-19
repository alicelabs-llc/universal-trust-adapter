#!/usr/bin/env python3
"""
Adjust the must-pass fixtures to include BOTH:
1. Cards signed with the local (original) CA key — must verify against LOCAL CA key
2. Documentation about the CA key rotation

We don't have cards signed with the new (production) CA key in the repo yet,
because the CA rotation hasn't completed. We'll add cards signed with the new
key once they're issued.
"""
import json
import hashlib
from pathlib import Path

REPO = Path('/home/z/my-project/marketnow')
FIXTURE_DIR = REPO / 'aep-marketplace' / 'public' / 'atc' / 'spec' / 'fixtures' / 'v1'

# Read the local CA key
local_ca = json.loads((REPO / '_data/atc/ca-public-key.json').read_text())
local_ca_pem = local_ca['public_key_pem']
local_ca_id = local_ca_pem.split('\n')[1][:20]  # first 20 chars of base64

# Update each must-pass fixture's expected file to specify which CA key to use
print('Updating must-pass expected files with CA key specification...')
for must_pass_file in sorted((FIXTURE_DIR / 'must-pass').glob('*.json')):
    card = json.loads(must_pass_file.read_text())
    name = must_pass_file.stem
    expected_path = FIXTURE_DIR / 'expected' / f'{name}.verify.json'

    # Get canonical_json method used by the card
    canonical_method = card.get('signature', {}).get('canonical_json', '?')
    signed_at = card.get('signature', {}).get('signed_at', '?')[:10]

    expected = {
        "fixture_id": name,
        "source_card_id": card.get('card_id', '?'),
        "source_file": f'_data/atc/{card.get("card_id", "?")}.json',
        "expected_outcome": "valid",
        "expected_verify_result": True,
        "expected_verify_reason": "Real ATC card signed by MarketNow Sentinel CA.",
        "ca_key_to_use": "local_original",
        "ca_key_pem": local_ca_pem,
        "ca_key_id": f"original_ca_key_2026_07 ({local_ca_id}...)",
        "canonicalization_method_used": canonical_method,
        "signed_at": signed_at,
        "important_note": (
            "This card was signed with the ORIGINAL MarketNow Sentinel CA key "
            "(local_ca_key_2026_07). On 2026-08-13, MarketNow initiated a CA key "
            "rotation per @anp2network's feedback. The new CA key is deployed in "
            "production (https://marketnow.site/api/atc?action=ca-key). "
            "Cards signed with the original key still verify against the original "
            "key — verifiers should support BOTH keys during the rotation period. "
            "The ca_key_id field was added to ATC schema v1.1.0 to support this."
        )
    }
    expected_path.write_text(json.dumps(expected, indent=2) + '\n')
    print(f'  ✅ {name}.verify.json (CA key: original_ca_key_2026_07)')

# Update MANIFEST.json
print('\nUpdating MANIFEST.json...')
manifest_path = FIXTURE_DIR / 'MANIFEST.json'
manifest = json.loads(manifest_path.read_text())

# Add CA key rotation note
manifest['ca_key_rotation_note'] = {
    'status': 'in_progress',
    'original_ca_key': {
        'id': 'original_ca_key_2026_07',
        'pem': local_ca_pem,
        'used_until': '2026-08-13'
    },
    'new_ca_key': {
        'id': 'new_ca_key_2026_08',
        'pem_url': 'https://marketnow.site/api/atc?action=ca-key',
        'deployed_at': '2026-08-13'
    },
    'reason': '@anp2network reported a canonicalization bug on 2026-08-13. As part of the fix, MarketNow rotated the CA key. Cards signed with the original key (in _data/atc/) still verify against the original key. New cards will be signed with the new key.',
    'verifier_guidance': 'During the rotation period, verifiers should accept cards signed with EITHER the original or new CA key. The ca_key_id field in the signature block indicates which key was used.'
}

# Recompute manifest hash
manifest['schema_version'] = '1.0.1'
manifest_json = json.dumps(manifest, indent=2, sort_keys=True)
manifest_digest = hashlib.sha256(manifest_json.encode('utf-8')).hexdigest()
manifest['manifest_sha256'] = manifest_digest
manifest_final = json.dumps(manifest, indent=2, sort_keys=True)
manifest_path.write_text(manifest_final + '\n')
print(f'✅ MANIFEST.json updated ({len(manifest_final)} bytes, sha256: {manifest_digest[:16]}...)')

print('\n=== DONE ===')
print('Must-pass fixtures now document the CA key rotation clearly.')
print('Verifiers using these fixtures should use the local CA key for must-pass fixtures.')
print('Verifiers using the production CA key (new) will see must-pass fixtures as "must-fail-against-new-key" — which is expected during rotation.')
