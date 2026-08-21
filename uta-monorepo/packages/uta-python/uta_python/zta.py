"""ZTA card verification."""

from .verifier import VerifyResult, ed25519_verify, DOMAINS
from datetime import datetime, timezone


def verify_zta_card(card: dict, public_key_pem: str, skip_expiry: bool = False) -> VerifyResult:
    result = VerifyResult(format="zta")

    sig = card.get("signature")
    if not sig:
        result.issues.append("missing signature")
        return result

    if sig.get("domain") != DOMAINS["ZTA_CARD"]:
        result.issues.append(f"wrong domain: {sig.get('domain')}")
        return result

    sig_value = sig.get("value", "")
    if len(sig_value) != 128:
        result.issues.append(f"malformed signature: {len(sig_value)} chars")
        return result

    payload = {k: v for k, v in card.items() if k != "signature"}
    if not ed25519_verify(payload, sig_value, public_key_pem, DOMAINS["ZTA_CARD"]):
        result.issues.append("ZTA signature verification failed")

    if not skip_expiry:
        expires_at = card.get("metadata", {}).get("expires_at")
        if expires_at:
            try:
                exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                if exp < datetime.now(timezone.utc):
                    result.issues.append(f"expired: {expires_at}")
            except Exception:
                pass

    result.credential_id = card.get("agent_id")
    result.issuer = sig.get("signed_by")
    result.valid = len(result.issues) == 0
    return result
