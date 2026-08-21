"""A2A Agent Card verification."""

from .verifier import (
    VerifyResult, canonicalize, ed25519_verify, DOMAINS,
)
import base64


def verify_a2a_card(card: dict, ca_public_key_pem: str, skip_expiry: bool = False) -> VerifyResult:
    result = VerifyResult(format="a2a")

    proof = card.get("proof")
    if not proof:
        result.issues.append("missing proof")
        return result

    if proof.get("type") != "Ed25519Signature2020":
        result.issues.append(f"unsupported proof type: {proof.get('type')}")
        return result

    proof_value = proof.get("proofValue", "")
    try:
        signature = base64.urlsafe_b64decode(proof_value + "=" * (4 - len(proof_value) % 4))
    except Exception:
        result.issues.append("invalid proofValue")
        return result

    if len(signature) != 64:
        result.issues.append(f"signature wrong length: {len(signature)}")
        return result

    payload = {k: v for k, v in card.items() if k != "proof"}
    canonical = canonicalize(payload)
    signing_input = f"{DOMAINS['W3C_VC_DATA_INTEGRITY']}:{canonical}".encode("utf-8")

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ed25519
    from cryptography.exceptions import InvalidSignature

    try:
        public_key = serialization.load_pem_public_key(ca_public_key_pem.encode("utf-8"))
        if isinstance(public_key, ed25519.Ed25519PublicKey):
            public_key.verify(signature, signing_input)
        else:
            result.issues.append("not an Ed25519 key")
            return result
    except InvalidSignature:
        result.issues.append("A2A signature verification failed")

    if not skip_expiry and card.get("expires_at"):
        from datetime import datetime, timezone
        try:
            exp = datetime.fromisoformat(card["expires_at"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                result.issues.append(f"expired: {card['expires_at']}")
        except Exception:
            pass

    result.credential_id = card.get("url")
    result.issuer = (proof.get("verificationMethod") or "").split("#")[0]
    result.expires_at = card.get("expires_at")
    result.valid = len(result.issues) == 0
    return result
