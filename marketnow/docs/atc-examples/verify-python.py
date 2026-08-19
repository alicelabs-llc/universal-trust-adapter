"""
MarketNow ATC (Agent Trust Card) — Python verification example.

Verifies an ATC signature independently using the CA public key.
No MarketNow SDK needed — just standard library + requests.

Requirements: pip install requests
"""
import json
import requests
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.backends import default_backend

def verify_atc(card_id: str) -> dict:
    """Verify an ATC and return the result."""
    # 1. Fetch the CA public key
    ca_resp = requests.get("https://marketnow.site/api/atc?action=ca-key", timeout=10)
    ca_data = ca_resp.json()
    ca_public_key_pem = ca_data["public_key_pem"]
    
    # 2. Load the CA public key
    ca_public_key = serialization.load_pem_public_key(
        ca_public_key_pem.encode(),
        backend=default_backend()
    )
    
    # 3. Fetch the ATC record
    atc_resp = requests.get(
        f"https://marketnow.site/api/atc?action=verify&card_id={card_id}",
        timeout=10
    )
    result = atc_resp.json()
    
    if not result.get("valid"):
        return {"valid": False, "reason": result.get("reason", "unknown")}
    
    # 4. Fetch the full ATC record (with signature) for independent verification
    # The verify endpoint returns a summary; for full signature check,
    # fetch the raw record from GitHub
    raw_url = f"https://raw.githubusercontent.com/edgarfloresguerra2011-a11y/marketnow/master/_data/atc/{card_id}.json"
    raw_resp = requests.get(raw_url, timeout=10)
    if raw_resp.status_code != 200:
        return {"valid": False, "reason": "could_not_fetch_record"}
    
    atc_record = raw_resp.json()
    payload = atc_record["payload"]
    signature_hex = atc_record["signature"]["value"]
    
    # 5. Canonical JSON (sorted keys, no whitespace)
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    
    # 6. Verify the Ed25519 signature
    signature_bytes = bytes.fromhex(signature_hex)
    try:
        ca_public_key.verify(signature_bytes, canonical)
        signature_valid = True
    except Exception:
        signature_valid = False
    
    return {
        "valid": result["valid"],
        "card_id": card_id,
        "agent_id": result.get("agent_id"),
        "sentinel_score": result.get("sentinel_score"),
        "risk_level": result.get("risk_level"),
        "signature_valid": signature_valid,
        "expires_at": result.get("expires_at"),
    }

if __name__ == "__main__":
    # Example: verify the MarketNow Discovery Agent's ATC
    result = verify_atc("ATC-2026-00001")
    print(json.dumps(result, indent=2))
