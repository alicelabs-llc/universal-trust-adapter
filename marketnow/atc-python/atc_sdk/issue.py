"""ATC/1.0 card issuance — sign an ATC envelope with a CA's private key."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from .keys import KeyPair, ATC_ALGORITHM, sign_message

ATC_SPEC_VERSION = "ATC/1.0"
ATC_MAX_TTL_DAYS_DEFAULT = 90


def _canonicalize_json(obj: Any) -> str:
    """RFC 8785 JCS canonicalization (simplified Python implementation).

    For the ATC use case, we need:
    - Object keys sorted lexicographically by UTF-16 code units (RFC 8785 §3.2.3)
    - No insignificant whitespace
    - Standard JSON string escapes
    - Numbers in their shortest representation that round-trips

    Python's `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`
    matches RFC 8785 for our use case (strings, integers, booleans, null, lists, objects).
    It doesn't perfectly handle float edge cases (e.g. 1e100), but ATC payloads
    use integers for timestamps/counts and strings for everything else.
    """
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonicalize_atc(atc: Dict[str, Any]) -> str:
    """Return the RFC 8785 JCS canonical form of the ATC payload.

    Per ATC-006: blank out `attestation.signature` and `attestation.signed_payload_hash`
    before canonicalizing.
    """
    payload = json.loads(json.dumps(atc))  # deep copy
    if "attestation" not in payload:
        payload["attestation"] = {}
    payload["attestation"]["signature"] = ""
    payload["attestation"]["signed_payload_hash"] = ""
    return _canonicalize_json(payload)


def compute_payload_hash(atc: Dict[str, Any]) -> str:
    """Compute the SHA-256 hash of the canonical payload, return hex string."""
    canonical = canonicalize_atc(atc)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def issue_atc(ca_keypair: KeyPair, agent_keypair: KeyPair, partial_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Issue (sign) an Agent Trust Card."""
    issued_at = partial_payload.get("validity", {}).get("issued_at") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    max_ttl_days = partial_payload.get("validity", {}).get("max_ttl_days", ATC_MAX_TTL_DAYS_DEFAULT)

    expires_at = partial_payload.get("validity", {}).get("expires_at")
    if not expires_at:
        # Parse issued_at and add max_ttl_days
        if issued_at.endswith("Z"):
            dt = datetime.fromisoformat(issued_at.replace("Z", "+00:00"))
        else:
            dt = datetime.fromisoformat(issued_at)
        expires_dt = dt + timedelta(days=max_ttl_days)
        expires_at = expires_dt.isoformat().replace("+00:00", "Z")

    atc = {
        "spec_version": ATC_SPEC_VERSION,
        "card_id": partial_payload["card_id"],
        "issuer": {
            "ca_id": partial_payload.get("issuer", {}).get("ca_id", "alicelabs-sentinel-ca"),
            "ca_public_key": ca_keypair.public_key,
            "ca_algorithm": ATC_ALGORITHM,
            "ca_url": partial_payload.get("issuer", {}).get("ca_url", "https://marketnow.site/api/atc"),
        },
        "identity": partial_payload["identity"],
        "attestation": {
            "subject_public_key": agent_keypair.public_key,
            "subject_algorithm": ATC_ALGORITHM,
            "signature": "",
            "signed_payload_hash": "",
        },
        "capabilities": partial_payload["capabilities"],
        "evidence": partial_payload["evidence"],
        "risk": {
            **partial_payload["risk"],
            "decision_authority": "consumer",  # ATC/1.0 mandates this
        },
        "revocation": partial_payload.get("revocation", {
            "revocation_check_url": "https://marketnow.site/api/atc?action=revocation-list",
            "revocation_check_method": "simple_json",
            "revocation_check_required": True,
        }),
        "validity": {
            "issued_at": issued_at,
            "expires_at": expires_at,
            "max_ttl_days": max_ttl_days,
        },
    }

    # Compute canonical + hash
    canonical = canonicalize_atc(atc)
    atc["attestation"]["signed_payload_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    # Sign with CA's private key
    atc["attestation"]["signature"] = sign_message(canonical, ca_keypair.raw_private_key)

    return atc


def resign_atc(atc: Dict[str, Any], ca_keypair: KeyPair) -> Dict[str, Any]:
    """Re-sign an existing ATC after editing."""
    canonical = canonicalize_atc(atc)
    atc["attestation"]["signed_payload_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    atc["attestation"]["signature"] = sign_message(canonical, ca_keypair.raw_private_key)
    return atc
