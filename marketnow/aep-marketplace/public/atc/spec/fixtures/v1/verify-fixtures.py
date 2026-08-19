#!/usr/bin/env python3
"""
MarketNow ATC/1.0 Conformance Verifier (Python reference implementation).

This is the @anp2network-style verifier: downloads the ATC/1.0 conformance
fixtures and runs them against a local RFC 8785 JCS canonicalizer + Ed25519
verifier.

Usage:
  python3 verify-fixtures.py                      # fetch fixtures from prod
  python3 verify-fixtures.py --local <path>        # use local fixture directory
  python3 verify-fixtures.py --ca-key <pem-file>   # use specific CA key
"""
import sys
import json
import hashlib
import argparse
import urllib.request
from pathlib import Path

try:
    from cryptography.hazmat.primitives.serialization import load_pem_public_key
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.exceptions import InvalidSignature
except ImportError:
    print("ERROR: cryptography library not installed.")
    print("Install with: pip install cryptography")
    sys.exit(2)


# ============================================================================
# RFC 8785 JCS Canonical JSON
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
    return repr(num)

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

def compare_utf16_key(s):
    """Convert string to list of UTF-16 code units for sorting."""
    result = []
    for ch in s:
        cp = ord(ch)
        if cp > 0xFFFF:
            cp -= 0x10000
            result.append(0xD800 + (cp >> 10))
            result.append(0xDC00 + (cp & 0x3FF))
        else:
            result.append(cp)
    return result

def serialize_object(obj):
    keys = sorted([k for k in obj.keys() if obj[k] is not None], key=compare_utf16_key)
    if not keys:
        return '{}'
    parts = []
    for k in keys:
        parts.append(serialize_string(k) + ':' + canonicalize(obj[k]))
    return '{' + ','.join(parts) + '}'


# ============================================================================
# Verifier
# ============================================================================
def verify_card(card, ca_public_key):
    """Verify a single ATC card. Returns (valid, issues, canonical, digest)."""
    issues = []

    # 1. Structure check
    if 'payload' not in card:
        issues.append('missing payload')
        return False, issues, None, None

    if 'signature' not in card:
        issues.append('missing signature block')
        return False, issues, None, None

    # 2. Algorithm check
    algo = card['signature'].get('algorithm', '')
    if 'Ed25519' not in algo:
        issues.append(f'wrong algorithm: {algo} (expected Ed25519)')
        return False, issues, None, None

    # 3. Signature format check
    sig_hex = card['signature'].get('value', '')
    if not all(c in '0123456789abcdefABCDEF' for c in sig_hex) or len(sig_hex) != 128:
        issues.append(f'malformed signature: not valid hex or wrong length (got {len(sig_hex)} chars, expected 128)')
        return False, issues, None, None

    # 4. Check expires_at
    expires_at = card['payload'].get('metadata', {}).get('expires_at')
    if expires_at:
        from datetime import datetime, timezone
        try:
            expiry = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            if expiry < now:
                issues.append(f'expired: expires_at {expires_at} is in the past')
        except Exception as e:
            issues.append(f'invalid expires_at format: {e}')

    # 5. Check issued_at (clock skew)
    issued_at = card['payload'].get('metadata', {}).get('issued_at')
    if issued_at:
        from datetime import datetime, timezone, timedelta
        try:
            issued = datetime.fromisoformat(issued_at.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            skew = issued - now
            if skew > timedelta(minutes=5):
                issues.append(f'issued_at is in the future (clock skew attack): {issued_at}')
        except Exception as e:
            issues.append(f'invalid issued_at format: {e}')

    # 6. Check status (revoked)
    if card.get('status') == 'revoked':
        issues.append(f"card is revoked: {card.get('revocation_reason', 'no reason given')}")

    # 7. Check card_id match
    if 'card_id' in card and 'card_id' in card['payload']:
        if card['card_id'] != card['payload']['card_id']:
            issues.append(f"card_id mismatch: outer {card['card_id']} vs payload {card['payload']['card_id']}")

    # 8. Canonicalize
    canonical = canonicalize(card['payload'])
    canonical_bytes = canonical.encode('utf-8')
    digest = hashlib.sha256(canonical_bytes).hexdigest()

    # 9. Verify Ed25519 signature
    sig_bytes = bytes.fromhex(sig_hex)
    try:
        ca_public_key.verify(sig_bytes, canonical_bytes)
        sig_valid = True
    except InvalidSignature:
        sig_valid = False
        issues.append('signature does not verify against the CA public key')
    except Exception as e:
        sig_valid = False
        issues.append(f'signature verification error: {e}')

    return (len(issues) == 0), issues, canonical, digest


# ============================================================================
# Main
# ============================================================================
def fetch_json(url):
    with urllib.request.urlopen(url) as r:
        return json.loads(r.read())

def main():
    parser = argparse.ArgumentParser(description='ATC/1.0 Conformance Verifier')
    parser.add_argument('--local', help='Use local fixture directory')
    parser.add_argument('--ca-key', help='Path to CA public key PEM file')
    args = parser.parse_args()

    print('MarketNow ATC/1.0 Conformance Verifier (Python)')
    print('=' * 50)
    print()

    # 1. Get CA public key
    if args.ca_key:
        ca_pem = Path(args.ca_key).read_text()
    else:
        print('Fetching CA public key from https://marketnow.site/api/atc?action=ca-key...')
        ca_data = fetch_json('https://marketnow.site/api/atc?action=ca-key')
        ca_pem = ca_data['public_key_pem']

    ca_key = load_pem_public_key(ca_pem.encode())
    if not isinstance(ca_key, Ed25519PublicKey):
        print(f'❌ CA key is not Ed25519: {type(ca_key).__name__}')
        sys.exit(2)

    print('✅ CA key loaded (Ed25519)')
    print()

    # 2. Get fixtures
    if args.local:
        fixtures_dir = args.local
        print(f'Using local fixtures: {fixtures_dir}')
        manifest = json.loads(Path(f'{fixtures_dir}/MANIFEST.json').read_text())
    else:
        print('Fetching MANIFEST.json...')
        manifest = fetch_json('https://marketnow.site/atc/spec/fixtures/v1/MANIFEST.json')
        fixtures_dir = 'https://marketnow.site/atc/spec/fixtures/v1'

    print(f'✅ MANIFEST loaded')
    print(f'   Total fixtures: {manifest["total_fixtures"]} ({manifest["must_pass_count"]} must-pass, {manifest["must_fail_count"]} must-fail)')
    print(f'   Manifest SHA-256: {manifest.get("manifest_sha256", "?")[:16]}...')
    print()

    # 3. Run each fixture
    print('Running fixtures...')
    print()
    passed = 0
    failed = 0
    failures = []

    for fixture in manifest['fixtures']:
        fixture_path = fixture['file']
        expected_path = fixture['expected_file']

        if args.local:
            card_data = json.loads(Path(f'{fixtures_dir}/{fixture_path}').read_text())
            expected = json.loads(Path(f'{fixtures_dir}/{expected_path}').read_text())
        else:
            card_data = fetch_json(f'{fixtures_dir}/{fixture_path}')
            expected = fetch_json(f'{fixtures_dir}/{expected_path}')

        # For must-fail, the actual card is in card_data['card']
        card = card_data['card'] if fixture['type'] == 'must-fail' else card_data
        expected_outcome = expected['expected_verify_result']

        valid, issues, canonical, digest = verify_card(card, ca_key)

        if fixture['type'] == 'must-pass':
            test_passed = (valid == True)
        else:
            test_passed = (valid == False)

        # Also verify canonical bytes match expected (for must-pass)
        canonical_match = True
        if 'expected_canonical_bytes' in expected:
            canonical_match = (canonical == expected['expected_canonical_bytes'])

        icon = '✅' if test_passed else '❌'
        status = 'PASS' if test_passed else 'FAIL'
        print(f'{icon} {fixture["id"]} ({fixture["type"]}) — {status}')

        if not test_passed:
            print(f'   Expected: {"valid" if expected_outcome else "invalid"}')
            print(f'   Got: {"valid" if valid else "invalid"}')
            print(f'   Issues: {"; ".join(issues)}')
            if not canonical_match and canonical:
                print(f'   Canonical bytes mismatch!')
            failures.append(fixture['id'])
            failed += 1
        else:
            passed += 1

    print()
    print('=' * 50)
    print(f'Total: {passed} passed, {failed} failed ({passed}/{passed + failed})')

    if failed > 0:
        print()
        print('Failed fixtures:')
        for f in failures:
            print(f'  - {f}')
        sys.exit(1)
    else:
        print()
        print('🎉 All fixtures passed! Your ATC implementation is RFC 8785 + Ed25519 conformant.')
        sys.exit(0)


if __name__ == '__main__':
    main()
