"""EAT-AI token verification."""

from .verifier import (
    VerifyResult, canonicalize, DOMAINS,
)
import base64
import time


def verify_eat(token: dict, public_key_pem: str, skip_expiry: bool = False) -> VerifyResult:
    result = VerifyResult(format="eat")

    if not token.get("signature"):
        result.issues.append("missing signature")
        return result

    claims = token.get("payload") or token
    canonical = canonicalize(claims)
    signing_input = f"{DOMAINS['EAT_AI']}:{canonical}".encode("utf-8")

    sig_b64 = token.get("signature", "")
    try:
        signature = base64.urlsafe_b64decode(sig_b64 + "=" * (4 - len(sig_b64) % 4))
    except Exception:
        result.issues.append("invalid signature encoding")
        return result

    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa, padding
    from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
    from cryptography.exceptions import InvalidSignature

    public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    alg = token.get("alg")
    sig_valid = False

    try:
        if alg == "EdDSA":
            if isinstance(public_key, ed25519.Ed25519PublicKey):
                public_key.verify(signature, signing_input)
                sig_valid = True
        elif alg == "ES256":
            if isinstance(public_key, ec.EllipticCurvePublicKey):
                if len(signature) == 64:
                    r = int.from_bytes(signature[:32], "big")
                    s = int.from_bytes(signature[32:], "big")
                    der = encode_dss_signature(r, s)
                    public_key.verify(der, signing_input, ec.ECDSA(hashes.SHA256()))
                    sig_valid = True
        elif alg == "RS256":
            if isinstance(public_key, rsa.RSAPublicKey):
                public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
                sig_valid = True
        else:
            result.issues.append(f"unsupported alg: {alg}")
    except InvalidSignature:
        pass

    if not sig_valid:
        result.issues.append(f"{alg} signature verification failed")

    if not skip_expiry and claims.get("exp"):
        if time.time() > claims["exp"]:
            result.issues.append(f"expired: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(claims['exp']))}")

    result.issuer = claims.get("iss")
    result.subject = claims.get("sub")
    result.valid = len(result.issues) == 0
    return result
