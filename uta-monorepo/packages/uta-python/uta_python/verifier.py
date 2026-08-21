"""
UTA Verifier — main verification module.

Mirrors packages/core/crypto.ts + packages/conformance/run-vectors.js.
"""

import base64
import hashlib
import json
import math
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa, padding
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from cryptography.exceptions import InvalidSignature


# ============================================================================
# Constants
# ============================================================================

DOMAINS = {
    "ATC_V3_CREDENTIAL": "UTA-ATC-V3-CREDENTIAL",
    "ATC_V3_POP": "UTA-ATC-V3-POP",
    "TRUST_DECISION": "UTA-TRUST-DECISION",
    "W3C_VC_DATA_INTEGRITY": "W3C-VC-DATA-INTEGRITY",
    "EAT_AI": "UTA-EAT-AI",
    "ZTA_CARD": "UTA-ZTA-CARD",
    "MCP_CARD": "UTA-MCP-CARD",
}


# ============================================================================
# RFC 8785 JCS Canonicalization
# ============================================================================

def canonicalize(value: Any) -> str:
    """Canonicalize a value per RFC 8785 (JSON Canonicalization Scheme)."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, bool):
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
        items = list(value.items())
        items.sort(key=lambda kv: _utf16_code_units(kv[0]))
        return "{" + ",".join(
            _serialize_string(k) + ":" + canonicalize(v) for k, v in items
        ) + "}"
    raise TypeError(f"Cannot canonicalize {type(value)}")


def _serialize_number(num: float) -> str:
    if math.isnan(num) or math.isinf(num):
        raise ValueError(f"JCS: {num} is not a valid JSON number")
    if num == int(num) and abs(num) < 2**53:
        return str(int(num))
    s = repr(num)
    if "e" in s or "E" in s:
        s = s.replace("E", "e").replace("e+", "e")
        s = re.sub(r"e0*(\d)", r"e\1", s)
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
    units = []
    for cp in s:
        code = ord(cp)
        if code > 0xFFFF:
            offset = code - 0x10000
            units.append(0xD800 + (offset >> 10))
            units.append(0xDC00 + (offset & 0x3FF))
        else:
            units.append(code)
    return units


def canonical_hash(value: Any) -> str:
    """SHA-256 of canonicalize(value)."""
    return hashlib.sha256(canonicalize(value).encode("utf-8")).hexdigest()


# ============================================================================
# Ed25519 verification
# ============================================================================

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


# ============================================================================
# Format-specific verifiers
# ============================================================================

@dataclass
class VerifyResult:
    valid: bool = False
    format: str = "unknown"
    issues: list = field(default_factory=list)
    credential_id: Optional[str] = None
    issuer: Optional[str] = None
    subject: Optional[str] = None
    expires_at: Optional[str] = None
    trust_score: Optional[int] = None


def _b64url_decode(s: str) -> bytes:
    """Decode base64url, padding with '=' if needed."""
    padding_needed = 4 - (len(s) % 4)
    if padding_needed < 4:
        s += "=" * padding_needed
    return base64.urlsafe_b64decode(s)


def verify_atc_v3(cred: dict, ca_public_key_pem: str, skip_expiry: bool = False) -> VerifyResult:
    """Verify an ATC v3 credential's Ed25519 signature."""
    result = VerifyResult(format="atc-v3")

    if not cred.get("atc_version", "").startswith("3."):
        result.issues.append(f"wrong atc_version: {cred.get('atc_version')}")
        return result

    sigs = cred.get("signatures") or []
    if not sigs:
        result.issues.append("no signatures found")
        return result

    sig = sigs[0]
    sig_value = sig.get("value", "")
    if len(sig_value) != 128 or not re.match(r"^[0-9a-f]+$", sig_value, re.I):
        result.issues.append(f"malformed signature: {len(sig_value)} chars")
        return result

    if sig.get("domain") != DOMAINS["ATC_V3_CREDENTIAL"]:
        result.issues.append(f"wrong domain: {sig.get('domain')}")

    payload = {k: v for k, v in cred.items() if k != "signatures"}
    if not ed25519_verify(payload, sig_value, ca_public_key_pem, DOMAINS["ATC_V3_CREDENTIAL"]):
        result.issues.append("Ed25519 signature verification failed")

    # evidence_hash check
    canonical = canonicalize(payload)
    expected_evidence_hash = "sha256:" + hashlib.sha256(
        (canonical + sig_value).encode("utf-8")
    ).hexdigest()
    if sig.get("evidence_hash") != expected_evidence_hash:
        result.issues.append("evidence_hash mismatch")

    # Expiry
    if not skip_expiry:
        expires_at = cred.get("lifecycle", {}).get("expires_at")
        if expires_at:
            from datetime import datetime, timezone
            try:
                exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if exp < datetime.now(timezone.utc):
                    result.issues.append(f"expired: {expires_at}")
            except Exception:
                pass

    # Revocation (inline check)
    if cred.get("lifecycle", {}).get("revoked"):
        result.issues.append("revoked (inline)")

    result.credential_id = cred.get("credential_id")
    result.issuer = cred.get("issuer", {}).get("did")
    result.expires_at = cred.get("lifecycle", {}).get("expires_at")
    result.valid = len(result.issues) == 0
    return result


def verify_jwt(jwt: str, public_key_pem: str, skip_expiry: bool = False) -> VerifyResult:
    """Verify a JWT (EdDSA / RS256 / ES256)."""
    result = VerifyResult(format="jwt")
    parts = jwt.split(".")
    if len(parts) != 3:
        result.issues.append("invalid JWT format (expected 3 parts)")
        return result

    header_b64, payload_b64, sig_b64 = parts
    try:
        header = json.loads(_b64url_decode(header_b64))
        claims = json.loads(_b64url_decode(payload_b64))
    except Exception as e:
        result.issues.append(f"decode error: {e}")
        return result

    if header.get("alg") == "none":
        result.issues.append('algorithm "none" is forbidden')
        return result
    if header.get("alg") == "HS256":
        result.issues.append("HS256 not supported")
        return result

    if not skip_expiry and claims.get("exp"):
        if time.time() > claims["exp"]:
            result.issues.append(f"expired: {claims['exp']}")

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    signature = _b64url_decode(sig_b64)

    public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    sig_valid = False
    alg = header.get("alg")

    try:
        if alg == "EdDSA":
            if isinstance(public_key, ed25519.Ed25519PublicKey):
                public_key.verify(signature, signing_input)
                sig_valid = True
        elif alg == "RS256":
            if isinstance(public_key, rsa.RSAPublicKey):
                public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
                sig_valid = True
        elif alg == "ES256":
            if isinstance(public_key, ec.EllipticCurvePublicKey):
                if len(signature) != 64:
                    result.issues.append(f"ES256 sig wrong length: {len(signature)}")
                else:
                    r = int.from_bytes(signature[:32], "big")
                    s = int.from_bytes(signature[32:], "big")
                    der_sig = encode_dss_signature(r, s)
                    public_key.verify(der_sig, signing_input, ec.ECDSA(hashes.SHA256()))
                    sig_valid = True
        else:
            result.issues.append(f"unsupported alg: {alg}")
    except InvalidSignature:
        pass

    if not sig_valid:
        result.issues.append(f"{alg} signature verification failed")

    result.issuer = claims.get("iss")
    result.subject = claims.get("sub")
    result.expires_at = (
        time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(claims["exp"]))
        if claims.get("exp")
        else None
    )
    result.valid = len(result.issues) == 0
    return result


def verify_w3c_vc(vc: dict, public_key_pem: str, skip_expiry: bool = False) -> VerifyResult:
    """Verify a W3C VC with Ed25519Signature2020 proof."""
    result = VerifyResult(format="vc")

    proof = vc.get("proof")
    if not proof:
        result.issues.append("missing proof")
        return result

    if proof.get("type") != "Ed25519Signature2020":
        result.issues.append(f"unsupported proof type: {proof.get('type')}")
        return result

    proof_value = proof.get("proofValue", "")
    try:
        signature = _b64url_decode(proof_value)
    except Exception:
        result.issues.append("invalid proofValue encoding")
        return result

    if len(signature) != 64:
        result.issues.append(f"signature wrong length: {len(signature)}")
        return result

    payload = {k: v for k, v in vc.items() if k != "proof"}
    canonical = canonicalize(payload)
    signing_input = f"{DOMAINS['W3C_VC_DATA_INTEGRITY']}:{canonical}".encode("utf-8")

    public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    if not isinstance(public_key, ed25519.Ed25519PublicKey):
        result.issues.append("not an Ed25519 key")
        return result

    try:
        public_key.verify(signature, signing_input)
    except InvalidSignature:
        result.issues.append("Ed25519Signature2020 verification failed")

    if not skip_expiry and vc.get("expirationDate"):
        from datetime import datetime, timezone
        try:
            exp = datetime.fromisoformat(vc["expirationDate"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                result.issues.append(f"expired: {vc['expirationDate']}")
        except Exception:
            pass

    result.credential_id = vc.get("id")
    result.issuer = vc.get("issuer") if isinstance(vc.get("issuer"), str) else (vc.get("issuer") or {}).get("id")
    result.expires_at = vc.get("expirationDate")
    result.valid = len(result.issues) == 0
    return result


def verify_pop(
    response: dict,
    challenge: dict,
    public_key_pem: str,
) -> VerifyResult:
    """Verify a PoP response against a stored challenge."""
    result = VerifyResult(format="pop")

    if response.get("nonce") != challenge.get("nonce"):
        result.issues.append("nonce mismatch")
        return result
    if response.get("credential_id") != challenge.get("credential_id"):
        result.issues.append("credential_id mismatch")
        return result
    if response.get("audience") != challenge.get("audience"):
        result.issues.append("audience mismatch")
        return result

    # Expiry
    expires_at = challenge.get("expires_at")
    if expires_at:
        from datetime import datetime, timezone
        try:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                result.issues.append(f"challenge expired: {expires_at}")
        except Exception:
            pass

    pop_msg = {
        "credential_id": response["credential_id"],
        "nonce": response["nonce"],
        "audience": response["audience"],
        "timestamp": response["timestamp"],
    }
    if not ed25519_verify(pop_msg, response["signature"], public_key_pem, DOMAINS["ATC_V3_POP"]):
        result.issues.append("PoP Ed25519 signature verification failed")

    result.valid = len(result.issues) == 0
    return result


def verify_receipt(receipt: dict, public_key_pem: str) -> VerifyResult:
    """Verify a signed action receipt."""
    result = VerifyResult(format="receipt")

    sig = receipt.get("signature")
    if not sig:
        result.issues.append("no signature in receipt")
        return result

    # Verify evidence_hash
    receipt_no_sig = {k: v for k, v in receipt.items() if k != "signature"}
    receipt_for_hash = dict(receipt_no_sig)
    receipt_for_hash["evidence_hash"] = ""
    expected_hash = "sha256:" + hashlib.sha256(
        canonicalize(receipt_for_hash).encode("utf-8")
    ).hexdigest()
    if receipt.get("evidence_hash") != expected_hash:
        result.issues.append("evidence_hash mismatch")

    # Verify Ed25519 signature
    if not ed25519_verify(receipt_no_sig, sig["value"], public_key_pem, sig["domain"]):
        result.issues.append("receipt signature verification failed")

    result.credential_id = receipt.get("credential_id")
    result.valid = len(result.issues) == 0
    return result


# ============================================================================
# Main verifier — auto-detects format
# ============================================================================

class UTAVerifier:
    """
    Main UTA verifier. Auto-detects credential format and verifies it
    using the appropriate algorithm.
    """

    def __init__(self, ca_public_key_pem: str):
        self.ca_public_key_pem = ca_public_key_pem

    def verify_credential(self, credential: Any, skip_expiry: bool = False) -> VerifyResult:
        """Verify any credential format. Auto-detects from the structure."""
        cred = credential

        # Unwrap UTA test vector format
        if isinstance(cred, dict) and "input" in cred and "vector_id" in cred:
            cred = cred["input"]

        # Auto-detect format
        if isinstance(cred, dict) and cred.get("jwt"):
            return verify_jwt(cred["jwt"], self.ca_public_key_pem, skip_expiry)
        if isinstance(cred, dict) and cred.get("atc_version", "").startswith("3."):
            return verify_atc_v3(cred, self.ca_public_key_pem, skip_expiry)
        if isinstance(cred, dict) and isinstance(cred.get("@context"), list) and \
           "https://www.w3.org/2018/credentials/v1" in cred["@context"]:
            return verify_w3c_vc(cred, self.ca_public_key_pem, skip_expiry)
        if isinstance(cred, dict) and (cred.get("agentCard") or
           (cred.get("name") and cred.get("url") and cred.get("capabilities"))):
            card = cred.get("agentCard") or cred
            from .a2a import verify_a2a_card
            return verify_a2a_card(card, self.ca_public_key_pem, skip_expiry)
        if isinstance(cred, dict) and cred.get("payload") and cred.get("signature") and cred.get("alg"):
            from .eat import verify_eat
            return verify_eat(cred, self.ca_public_key_pem, skip_expiry)
        if isinstance(cred, dict) and cred.get("agent_id") and cred.get("identity") and \
           cred.get("trust") and cred.get("signature"):
            from .zta import verify_zta_card
            return verify_zta_card(cred, self.ca_public_key_pem, skip_expiry)
        if isinstance(cred, dict) and cred.get("name") and cred.get("tools") and \
           (cred.get("transport") or cred.get("url")):
            from .mcp import verify_mcp_card
            return verify_mcp_card(cred, self.ca_public_key_pem)

        return VerifyResult(
            valid=False,
            format="unknown",
            issues=["cannot auto-detect credential format"],
        )

    def verify_credential_file(self, path: str, skip_expiry: bool = False) -> VerifyResult:
        """Verify a credential from a JSON file."""
        with open(path, "r") as f:
            cred = json.load(f)
        return self.verify_credential(cred, skip_expiry)
