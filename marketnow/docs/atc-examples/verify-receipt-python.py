#!/usr/bin/env python3
"""
MarketNow — Action Receipt verification example (Python)

Verifies a MarketNow action-receipt cryptographically against the
MarketNow CA public key. No server-side trust required — fetch the
receipt + CA key, verify the Ed25519 signature client-side.

Receipts are signed delivery proofs for completed purchases.
Use this to confirm that a purchase actually completed end-to-end.

Interop with Vibe (doteyeso-ops):
    receipt_id   ↔ vibe_action_receipt (offline-verifiable delivery proof)
    mandate_id   ↔ vibe_decision_ref  (content-addressed auth citation)
    settle_txhash ↔ vibe_settle_coordinate (orthogonal to receipt)

Requirements:
    pip install cryptography requests

Usage:
    python verify-receipt-python.py rcpt_c8b9dc67f88e4da5bd3a
    python verify-receipt-python.py  # uses default demo receipt
"""

import sys
import json
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature


# ─── RFC 8785 JCS Canonical JSON ────────────────────────────────────────────
# Minimal implementation matching MarketNow's lib/canonical-json.mjs
# Full spec: https://tools.ietf.org/html/rfc8785

def canonicalize(value):
    """Serialize a Python value as RFC 8785 JCS canonical JSON."""
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return serialize_number(value)
    if isinstance(value, str):
        return serialize_string(value)
    if isinstance(value, list):
        return '[' + ','.join(canonicalize(v) for v in value) + ']'
    if isinstance(value, dict):
        return serialize_object(value)
    return serialize_string(str(value))


def serialize_number(num):
    """RFC 8785 number serialization (simplified)."""
    if not isinstance(num, float) or num != num or num in (float('inf'), float('-inf')):
        return 'null'
    if num == int(num):
        return str(int(num))
    # Python's repr is close to RFC 8785 for most cases
    s = repr(num)
    return s


def serialize_string(s):
    """RFC 8785 string serialization with required escapes."""
    result = '"'
    for ch in s:
        code = ord(ch)
        if ch == '"':
            result += '\\"'
        elif ch == '\\':
            result += '\\\\'
        elif code == 0x08:
            result += '\\b'
        elif code == 0x09:
            result += '\\t'
        elif code == 0x0a:
            result += '\\n'
        elif code == 0x0c:
            result += '\\f'
        elif code == 0x0d:
            result += '\\r'
        elif code < 0x20:
            result += '\\u%04x' % code
        else:
            result += ch
    return result + '"'


def serialize_object(obj):
    """RFC 8785 object serialization — keys sorted by UTF-16 code unit."""
    keys = sorted(obj.keys(), key=lambda k: [ord(c) for c in k])
    if not keys:
        return '{}'
    parts = []
    for k in keys:
        parts.append(serialize_string(k) + ':' + canonicalize(obj[k]))
    return '{' + ','.join(parts) + '}'


# ─── Receipt verification ───────────────────────────────────────────────────

API_BASE = 'https://marketnow.site'
DEFAULT_RECEIPT_ID = 'rcpt_c8b9dc67f88e4da5bd3a'  # first real receipt on the ledger


def fetch_ca_public_key():
    """Fetch the MarketNow CA Ed25519 public key (SPKI PEM)."""
    r = requests.get(f'{API_BASE}/api/atc?action=ca-key', timeout=10)
    r.raise_for_status()
    pem = r.json()['public_key_pem']
    return serialization.load_pem_public_key(pem.encode('utf-8'))


def fetch_receipt(receipt_id):
    """Fetch a receipt from the public GitHub ledger via the API."""
    r = requests.get(
        f'{API_BASE}/api/atc?action=verify-receipt&receipt_id={receipt_id}',
        timeout=10,
    )
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


def verify_receipt_signature(receipt, ca_public_key):
    """Verify the Ed25519 signature on a receipt object.

    The signature is over the receipt fields EXCLUDING the `signature` field,
    canonicalized via RFC 8785 JCS.
    """
    if not isinstance(ca_public_key, Ed25519PublicKey):
        raise ValueError('CA key must be Ed25519')

    # Strip signature field to reconstruct the signed payload
    signature_block = receipt.get('signature')
    if not signature_block:
        raise ValueError('Receipt missing signature block')

    payload = {k: v for k, v in receipt.items() if k != 'signature'}

    # Canonicalize via RFC 8785 JCS
    canonical = canonicalize(payload).encode('utf-8')

    # Signature is hex-encoded
    signature = bytes.fromhex(signature_block['value'])

    try:
        ca_public_key.verify(signature, canonical)
        return True
    except InvalidSignature:
        return False


def main():
    receipt_id = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RECEIPT_ID

    print(f'Verifying receipt: {receipt_id}')
    print(f'API: {API_BASE}')
    print()

    # Step 1: Fetch CA public key
    print('[1/3] Fetching CA public key...')
    ca_key = fetch_ca_public_key()
    print(f'      ✓ CA key loaded (Ed25519)')

    # Step 2: Fetch receipt
    print('[2/3] Fetching receipt from ledger...')
    receipt = fetch_receipt(receipt_id)
    if receipt is None:
        print(f'      ✗ Receipt not found in ledger')
        sys.exit(1)
    if not receipt.get('valid'):
        print(f'      ✗ Receipt invalid: {receipt.get("reason")}')
        sys.exit(1)
    print(f'      ✓ Receipt found, signature_valid={receipt.get("signature_valid")}')

    # Step 3: Verify signature locally (don't trust the server's word)
    print('[3/3] Verifying signature locally against CA key...')
    # Fetch the raw receipt JSON from GitHub for client-side verification
    raw_url = (
        f'https://raw.githubusercontent.com/edgarfloresguerra2011-a11y/'
        f'marketnow/master/_data/receipts/{receipt_id}.json'
    )
    raw_r = requests.get(raw_url, timeout=10)
    raw_r.raise_for_status()
    raw_receipt = raw_r.json()

    sig_valid = verify_receipt_signature(raw_receipt, ca_key)
    if sig_valid:
        print('      ✓ Signature verified (Ed25519, RFC 8785 JCS)')
    else:
        print('      ✗ Signature INVALID — receipt may have been tampered with')
        sys.exit(1)

    print()
    print('═══════════════════════════════════════════════════════════')
    print(f'  ✓ RECEIPT VERIFIED: {receipt_id}')
    print('═══════════════════════════════════════════════════════════')
    print(f'  Issued at:    {receipt.get("issued_at")}')
    print(f'  Mandate ID:   {receipt.get("mandate_id")}')
    print(f'  Settle txHash: {receipt.get("settle_txhash")}')
    print(f'  ATC card ID:  {receipt.get("atc_card_id")}')
    print(f'  Delivered:')
    delivered = receipt.get('delivered', {})
    print(f'    Skill ID:    {delivered.get("skill_id")}')
    print(f'    License key: {delivered.get("license_key")}')
    print(f'    SHA-256:     {delivered.get("content_sha256")}')
    print(f'  Amount:       ${receipt.get("amount_usd")} ({receipt.get("network")})')
    print()
    print('  Interop (Vibe join-key map):')
    interop = receipt.get('interop', {})
    print(f'    vibe_decision_ref:     {interop.get("vibe_decision_ref")}')
    print(f'    vibe_settle_coordinate: {interop.get("vibe_settle_coordinate")}')
    print(f'    vibe_action_receipt:   {interop.get("vibe_action_receipt")}')
    print('═══════════════════════════════════════════════════════════')


if __name__ == '__main__':
    main()
