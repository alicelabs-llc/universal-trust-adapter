#!/usr/bin/env python3
"""
P3-7: Cross-language verification — Python verifier.

This script loads the test vectors from /home/z/my-project/uta-monorepo/vectors/
and verifies them using ONLY Python + the `cryptography` library. No Node.js
imports. If this script succeeds, it proves the UTA test vectors are truly
cross-language (the canonicalization, hashing, and signature verification all
produce identical results in Python and Node.js).

Run with:
    python3 /home/z/my-project/scripts/uta-python-verifier.py
"""

import base64
import gzip
import hashlib
import json
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import ed25519, rsa, ec, padding
from cryptography.hazmat.primitives.asymmetric.utils import (
    encode_dss_signature,
    decode_dss_signature,
)
from cryptography.exceptions import InvalidSignature


ROOT = Path("/home/z/my-project/uta-monorepo")
VECTORS = ROOT / "vectors"
KEYS = json.loads((VECTORS / "keys" / "manifest.json").read_text())["keys"]

# ============================================================================
# RFC 8785 JCS canonicalization — Python implementation
# ============================================================================

def canonicalize(value: Any) -> str:
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, bool):  # must be after None/True/False checks
        return "true" if value else "false"
    if isinstance(value, int):
        return _serialize_number(float(value))
    if isinstance(value, float):
        return _serialize_number(value)
    if isinstance(value, str):
        return _serialize_string(value)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(v) for v in value) + "]"
    if isinstance(value, dict):
        # RFC 8785: undefined values are excluded, but null is KEPT.
        # In Python, dict values are never "undefined" — they're always present.
        # So we keep all keys (including those with None values, which become "null").
        items = list(value.items())
        items.sort(key=lambda kv: _utf16_code_units(kv[0]))
        return "{" + ",".join(_serialize_string(k) + ":" + canonicalize(v) for k, v in items) + "}"
    raise TypeError(f"Cannot canonicalize {type(value)}")


def _serialize_number(num: float) -> str:
    import math
    if math.isnan(num) or math.isinf(num):
        raise ValueError(f"JCS: {num} is not a valid JSON number")
    if num == int(num) and abs(num) < 2**53:
        return str(int(num))
    # Use repr to get shortest round-trip representation
    s = repr(num)
    # Normalize exponent format
    if "e" in s or "E" in s:
        s = s.replace("E", "e").replace("e+", "e")
        s = re.sub(r"e0*(\d)", r"e\1", s)
    # Strip trailing zeros after decimal point
    if "." in s and "e" not in s:
        s = s.rstrip("0").rstrip(".")
    if s == "-0":
        s = "0"
    return s


def _serialize_string(s: str) -> str:
    out = ['"']
    for ch in s:
        code = ord(ch)
        if code == 0x22:
            out.append('\\"')
        elif code == 0x5C:
            out.append("\\\\")
        elif code == 0x08:
            out.append("\\b")
        elif code == 0x09:
            out.append("\\t")
        elif code == 0x0A:
            out.append("\\n")
        elif code == 0x0C:
            out.append("\\f")
        elif code == 0x0D:
            out.append("\\r")
        elif code < 0x20:
            out.append(f"\\u{code:04x}")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _utf16_code_units(s: str) -> list:
    """Convert a string to its UTF-16 code unit sequence (for RFC 8785 sorting)."""
    units = []
    for cp in s:
        code = ord(cp)
        if code > 0xFFFF:
            # Surrogate pair
            offset = code - 0x10000
            units.append(0xD800 + (offset >> 10))
            units.append(0xDC00 + (offset & 0x3FF))
        else:
            units.append(code)
    return units


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(canonicalize(value).encode("utf-8")).hexdigest()


# ============================================================================
# Ed25519 verification
# ============================================================================

DOMAINS = {
    "ATC_V3_CREDENTIAL": "UTA-ATC-V3-CREDENTIAL",
    "ATC_V3_POP": "UTA-ATC-V3-POP",
    "TRUST_DECISION": "UTA-TRUST-DECISION",
}


def ed25519_verify(payload: Any, signature_hex: str, public_key_pem: str, domain: str) -> bool:
    """Verify an Ed25519 signature over `domain:canonicalize(payload)`."""
    try:
        canonical = canonicalize(payload)
        signing_bytes = f"{domain}:{canonical}".encode("utf-8")
        signature = bytes.fromhex(signature_hex)
        if len(signature) != 64:
            return False
        public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
        if not isinstance(public_key, ed25519.Ed25519PublicKey):
            return False
        public_key.verify(signature, signing_bytes)
        return True
    except (InvalidSignature, Exception):
        return False


def load_public_key_pem(name: str) -> str:
    return KEYS[name]["public_key_pem"]


# ============================================================================
# Test runner
# ============================================================================

passed = 0
failed = 0
failures = []


def check(name: str, fn) -> None:
    global passed, failed
    try:
        result = fn()
        if result is True or (isinstance(result, dict) and result.get("valid") is True):
            passed += 1
            print(f"✅ {name}")
        else:
            failed += 1
            reason = (
                (result.get("reason") if isinstance(result, dict) else None)
                or (result.get("issues", [None])[0] if isinstance(result, dict) and "issues" in result else None)
                or "returned false"
            )
            failures.append((name, reason))
            print(f"❌ {name}: {reason}")
    except Exception as e:
        failed += 1
        failures.append((name, str(e)))
        print(f"❌ {name}: {e}")


def load_vectors(subdir: str):
    d = VECTORS / subdir
    if not d.exists():
        return []
    return [json.loads(f.read_text()) for f in sorted(d.glob("*.json"))]


# ============================================================================
# TEST 1: Cross-language canonicalization (RFC 8785)
# ============================================================================

print("── Cross-language canonicalization ──")
for v in load_vectors("cross-lang"):
    check(
        f"[xlang] {v['vector_id']}: {v['description']}",
        lambda v=v: (
            True if canonicalize(v["payload"]) == v["verification_input"]
            else {
                "valid": False,
                "reason": f"canonical mismatch: expected {v['verification_input'][:80]}…, got {canonicalize(v['payload'])[:80]}…",
            }
        ),
    )

# Also verify SHA-256 matches
for v in load_vectors("cross-lang"):
    check(
        f"[xlang-sha256] {v['vector_id']}",
        lambda v=v: (
            True if hashlib.sha256(canonicalize(v["payload"]).encode("utf-8")).hexdigest() == v["canonical_sha256"]
            else {"valid": False, "reason": "SHA-256 mismatch"}
        ),
    )


# ============================================================================
# TEST 2: ATC v3 signature verification
# ============================================================================

def verify_atc_v3(v):
    cred = v["input"]
    pub = load_public_key_pem(v["public_key_ref"])
    if "signatures" not in cred or not cred["signatures"]:
        return {"valid": False, "reason": "no signatures"}
    sig = cred["signatures"][0]
    payload = {k: val for k, val in cred.items() if k != "signatures"}
    ok = ed25519_verify(payload, sig["value"], pub, sig["domain"])
    return True if ok else {"valid": False, "reason": "signature verification failed"}


def verify_atc_v3_negative(v):
    cred = v["input"]
    pub = load_public_key_pem(v["public_key_ref"])
    if "signatures" not in cred or not cred["signatures"]:
        return True
    sig = cred["signatures"][0]
    payload = {k: val for k, val in cred.items() if k != "signatures"}
    ok = ed25519_verify(payload, sig["value"], pub, sig["domain"])
    return True if not ok else {"valid": False, "reason": "expected INVALID but Python verified as valid"}


print("\n── ATC v3 Ed25519 signature verification ──")
for v in load_vectors("positive"):
    if "atc_version" not in v.get("input", {}) and "signatures" not in v.get("input", {}):
        continue
    check(
        f"[pos] {v['vector_id']}: {v['description']}",
        lambda v=v: verify_atc_v3(v),
    )

for v in load_vectors("negative"):
    if "atc_version" not in v.get("input", {}) and "signatures" not in v.get("input", {}):
        continue
    if v.get("vector_id", "").startswith("neg-003") or v.get("vector_id", "").startswith("neg-004"):
        # Skip expired/revoked-inline — those have valid signatures but fail for lifecycle reasons
        # (Python verifier only checks the signature, not the lifecycle)
        continue
    if v.get("vector_id") in ("neg-016-atc-revoked-via-crl", "neg-017-atc-revoked-via-bitstring"):
        # These have valid signatures but fail due to revocation (CRL/Bitstring).
        # Python verifier confirms the signature is VALID here — revocation is
        # checked separately by the RevocationChecker abstraction.
        check(
            f"[neg-sig-valid] {v['vector_id']}: signature IS valid (revocation handled separately)",
            lambda v=v: verify_atc_v3(v),  # expect valid=true (sig is good)
        )
        continue
    check(
        f"[neg] {v['vector_id']}: {v['description']}",
        lambda v=v: verify_atc_v3_negative(v),
    )


# ============================================================================
# TEST 3: W3C VC verification
# ============================================================================

def verify_w3c_vc(v):
    vc = v["input"]
    pub = load_public_key_pem(v["public_key_ref"])
    proof = vc["proof"]
    proof_value = proof["proofValue"]
    signature = base64.urlsafe_b64decode(proof_value + "=" * (4 - len(proof_value) % 4))
    if len(signature) != 64:
        return {"valid": False, "reason": f"signature wrong length: {len(signature)}"}
    payload = {k: val for k, val in vc.items() if k != "proof"}
    canonical = canonicalize(payload)
    signing_input = f"W3C-VC-DATA-INTEGRITY:{canonical}".encode("utf-8")
    public_key = serialization.load_pem_public_key(pub.encode("utf-8"))
    if not isinstance(public_key, ed25519.Ed25519PublicKey):
        return {"valid": False, "reason": "not an Ed25519 key"}
    try:
        public_key.verify(signature, signing_input)
        return True
    except InvalidSignature:
        return {"valid": False, "reason": "Ed25519Signature2020 verification failed"}


def verify_w3c_vc_negative(v):
    result = verify_w3c_vc(v)
    return True if not (isinstance(result, dict) and result.get("valid") is True) else {"valid": False, "reason": "expected INVALID but Python verified as valid"}


print("\n── W3C VC Ed25519Signature2020 verification ──")
for v in load_vectors("positive"):
    if not v.get("input", {}).get("proof"):
        continue
    if v["input"]["proof"].get("type") != "Ed25519Signature2020":
        continue
    check(
        f"[pos-vc] {v['vector_id']}: {v['description']}",
        lambda v=v: verify_w3c_vc(v),
    )

for v in load_vectors("negative"):
    if not v.get("input", {}).get("proof"):
        continue
    if v["input"]["proof"].get("type") != "Ed25519Signature2020":
        continue
    check(
        f"[neg-vc] {v['vector_id']}: {v['description']}",
        lambda v=v: verify_w3c_vc_negative(v),
    )


# ============================================================================
# TEST 4: JWT EdDSA verification
# ============================================================================

def verify_jwt_eddsa(v):
    jwt = v["input"]["jwt"]
    pub = load_public_key_pem(v["public_key_ref"])
    parts = jwt.split(".")
    if len(parts) != 3:
        return {"valid": False, "reason": "not 3 parts"}
    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = base64.urlsafe_b64decode(sig_b64 + "=" * (4 - len(sig_b64) % 4))
    header = json.loads(base64.urlsafe_b64decode(header_b64 + "=" * (4 - len(header_b64) % 4)))
    public_key = serialization.load_pem_public_key(pub.encode("utf-8"))
    # Support all three algorithms
    if header.get("alg") == "EdDSA":
        if not isinstance(public_key, ed25519.Ed25519PublicKey):
            return {"valid": False, "reason": "not Ed25519 key"}
        try:
            public_key.verify(signature, signing_input)
            return True
        except InvalidSignature:
            return {"valid": False, "reason": "EdDSA signature verification failed"}
    elif header.get("alg") == "RS256":
        if not isinstance(public_key, rsa.RSAPublicKey):
            return {"valid": False, "reason": "not RSA key"}
        try:
            public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
            return True
        except InvalidSignature:
            return {"valid": False, "reason": "RS256 signature verification failed"}
    elif header.get("alg") == "ES256":
        if not isinstance(public_key, ec.EllipticCurvePublicKey):
            return {"valid": False, "reason": "not EC key"}
        # ES256 signature is raw R||S (64 bytes). Convert to DER.
        if len(signature) != 64:
            return {"valid": False, "reason": f"ES256 signature wrong length: {len(signature)}"}
        r = int.from_bytes(signature[:32], "big")
        s = int.from_bytes(signature[32:], "big")
        der_sig = encode_dss_signature(r, s)
        try:
            public_key.verify(der_sig, signing_input, ec.ECDSA(hashes.SHA256()))
            return True
        except InvalidSignature:
            return {"valid": False, "reason": "ES256 signature verification failed"}
    else:
        return {"valid": False, "reason": f"unsupported alg: {header.get('alg')}"}


print("\n── JWT verification (EdDSA / RS256 / ES256) ──")
for v in load_vectors("positive"):
    if not v.get("input", {}).get("jwt"):
        continue
    check(
        f"[pos-jwt] {v['vector_id']}: {v['description']}",
        lambda v=v: verify_jwt_eddsa(v),
    )


# ============================================================================
# TEST 5: PoP verification
# ============================================================================

def verify_pop(v):
    challenge = v["input"]["challenge"]
    response = v["input"]["response"]
    pub = load_public_key_pem(v["public_key_ref"])
    pop_msg = {
        "credential_id": response["credential_id"],
        "nonce": response["nonce"],
        "audience": response["audience"],
        "timestamp": response["timestamp"],
    }
    ok = ed25519_verify(pop_msg, response["signature"], pub, "UTA-ATC-V3-POP")
    return True if ok else {"valid": False, "reason": "PoP verification failed"}


print("\n── PoP verification ──")
for v in load_vectors("positive"):
    if not v.get("input", {}).get("response"):
        continue
    check(
        f"[pos-pop] {v['vector_id']}: {v['description']}",
        lambda v=v: verify_pop(v),
    )


# ============================================================================
# TEST 6: Action receipt verification
# ============================================================================

def verify_receipt(v):
    receipt = v["input"]
    pub = load_public_key_pem(v["public_key_ref"])
    sig = receipt["signature"]
    receipt_no_sig = {k: val for k, val in receipt.items() if k != "signature"}
    receipt_for_hash = dict(receipt_no_sig)
    receipt_for_hash["evidence_hash"] = ""
    expected_hash = "sha256:" + hashlib.sha256(canonicalize(receipt_for_hash).encode("utf-8")).hexdigest()
    if receipt["evidence_hash"] != expected_hash:
        return {"valid": False, "reason": "evidence_hash mismatch"}
    ok = ed25519_verify(receipt_no_sig, sig["value"], pub, sig["domain"])
    return True if ok else {"valid": False, "reason": "receipt signature verification failed"}


print("\n── Action receipt verification ──")
for v in load_vectors("positive"):
    if not v.get("input", {}).get("receipt_id"):
        continue
    check(
        f"[pos-receipt] {v['vector_id']}: {v['description']}",
        lambda v=v: verify_receipt(v),
    )


# ============================================================================
# TEST 7: Cross-domain signature non-reuse
# ============================================================================

print("\n── Cross-domain signature non-reuse ──")


def check_cross_domain():
    """ATC v3 signature must NOT verify when checked in the POP domain."""
    pos_atc = next(v for v in load_vectors("positive") if v["vector_id"] == "pos-001-atc-v3-valid")
    cred = pos_atc["input"]
    pub = load_public_key_pem(pos_atc["public_key_ref"])
    payload = {k: v for k, v in cred.items() if k != "signatures"}
    sig = cred["signatures"][0]["value"]
    # Verify with WRONG domain (POP instead of ATC)
    ok = ed25519_verify(payload, sig, pub, "UTA-ATC-V3-POP")
    return True if not ok else {"valid": False, "reason": "ATC signature verified in POP domain (cross-domain reuse possible!)"}


check("ATC v3 signature does not verify in POP domain (Python)", check_cross_domain)


# ============================================================================
# Summary
# ============================================================================

print("\n" + "=" * 60)
print(f"UTA Python cross-language verification: {passed}/{passed + failed} tests passed")
print(f"Conformant: {'YES ✅' if failed == 0 else 'NO ❌'}")
if failed > 0:
    print("\nFailures:")
    for name, reason in failures:
        print(f"  - {name}: {reason}")
sys.exit(0 if failed == 0 else 1)
