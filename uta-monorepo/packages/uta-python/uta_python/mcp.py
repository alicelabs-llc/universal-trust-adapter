"""MCP card verification."""

from .verifier import VerifyResult, ed25519_verify, DOMAINS


def verify_mcp_card(card: dict, registry_public_key_pem: str = None) -> VerifyResult:
    result = VerifyResult(format="mcp")

    sig = card.get("signature")
    if not sig:
        # Unsigned MCP cards are structurally valid but trust_score=0
        result.valid = True
        result.trust_score = 0
        result.issues = ["unsigned MCP card (trust_score=0)"]
        return result

    if sig.get("domain") != DOMAINS["MCP_CARD"]:
        result.issues.append(f"wrong domain: {sig.get('domain')}")
        return result

    if not registry_public_key_pem:
        result.issues.append("signature present but no registry public key")
        return result

    sig_value = sig.get("value", "")
    if len(sig_value) != 128:
        result.issues.append(f"malformed signature: {len(sig_value)} chars")
        return result

    payload = {k: v for k, v in card.items() if k != "signature"}
    if ed25519_verify(payload, sig_value, registry_public_key_pem, DOMAINS["MCP_CARD"]):
        result.trust_score = 5
        result.valid = True
    else:
        result.issues.append("MCP signature verification failed")
        result.valid = False

    return result
