"""ATC/1.0 card verifier — verify any Agent Trust Card against the spec."""

from __future__ import annotations

import base64
import hashlib
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
import json

from .keys import verify_signature
from .issue import canonicalize_atc, compute_payload_hash, ATC_SPEC_VERSION

ATC_ALGORITHM = "Ed25519"

CARD_ID_PATTERN = re.compile(r"^ATC-\d{4}-\d{6,}$")
BASE64_PUBLIC_KEY_PATTERN = re.compile(r"^[A-Za-z0-9+/]{43,90}={0,2}$")
BASE64_SIGNATURE_PATTERN = re.compile(r"^[A-Za-z0-9+/]{86,400}={0,3}$")
HEX_SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")

CAPABILITY_ENUMS = {
    "filesystem": {
        "read": ["none", "own_dir", "temp_dir", "home_dir", "system", "all"],
        "write": ["none", "own_dir", "temp_dir", "home_dir", "system", "all"],
    },
    "network": {
        "egress": ["none", "allowlist", "all"],
        "ingress": ["none", "bound_ports", "all"],
    },
    "shell": {
        "exec": ["none", "sandboxed", "unrestricted"],
        "spawn": ["none", "sandboxed", "unrestricted"],
    },
    "credentials": {
        "read_env": ["none", "allowlist", "all"],
        "read_files": ["none", "allowlist", "all"],
    },
    "process": {
        "subprocess": ["none", "sandboxed", "unrestricted"],
        "signals": ["none", "own", "all"],
    },
}

REQUIRED_CONTROLS = ["ATC-001", "ATC-002", "ATC-003", "ATC-004", "ATC-005", "ATC-006", "ATC-007", "ATC-008"]


def _is_object(v: Any) -> bool:
    return isinstance(v, dict)


def _has_fields(obj: Dict, fields: List[str]) -> bool:
    return all(f in obj for f in fields)


def _check_atc_001_identity(atc: Dict) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    id_obj = atc.get("identity", {})

    if not _is_object(atc.get("identity")):
        errors.append("ATC-001: identity must be an object")
        return errors, warnings

    if not _has_fields(id_obj, ["agent_id", "agent_name", "agent_owner"]):
        errors.append("ATC-001: identity must include agent_id, agent_name, agent_owner")

    agent_id = id_obj.get("agent_id", "")
    if not isinstance(agent_id, str) or not (3 <= len(agent_id) <= 128) or not re.match(r"^[a-zA-Z0-9_-]+$", agent_id):
        errors.append("ATC-001: identity.agent_id must be 3-128 alphanumeric chars")

    agent_name = id_obj.get("agent_name", "")
    if not isinstance(agent_name, str) or not (1 <= len(agent_name) <= 100):
        errors.append("ATC-001: identity.agent_name must be 1-100 chars")

    agent_owner = id_obj.get("agent_owner", "")
    if not isinstance(agent_owner, str) or not (1 <= len(agent_owner) <= 100):
        errors.append("ATC-001: identity.agent_owner must be 1-100 chars")

    contact = id_obj.get("owner_contact")
    if contact is not None and (not isinstance(contact, str) or not (contact.startswith("mailto:") or contact.startswith("https:"))):
        warnings.append("ATC-001: identity.owner_contact should be a mailto: or https: URL")

    return errors, warnings


def _check_atc_002_attestation(atc: Dict) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    att = atc.get("attestation", {})

    if not _is_object(atc.get("attestation")):
        errors.append("ATC-002: attestation must be an object")
        return errors, warnings

    if not _has_fields(att, ["subject_public_key", "subject_algorithm", "signature", "signed_payload_hash"]):
        errors.append("ATC-002: attestation must include subject_public_key, subject_algorithm, signature, signed_payload_hash")

    if att.get("subject_algorithm") != ATC_ALGORITHM:
        errors.append(f"ATC-002: subject_algorithm must be '{ATC_ALGORITHM}' (got {att.get('subject_algorithm')})")

    spk = att.get("subject_public_key", "")
    if isinstance(spk, str) and not BASE64_PUBLIC_KEY_PATTERN.match(spk):
        errors.append("ATC-002: attestation.subject_public_key is not a valid base64 Ed25519 SPKI key")

    sig = att.get("signature", "")
    if isinstance(sig, str) and not BASE64_SIGNATURE_PATTERN.match(sig):
        errors.append("ATC-002: attestation.signature is not a valid base64 Ed25519 signature")

    sph = att.get("signed_payload_hash", "")
    if isinstance(sph, str) and not HEX_SHA256_PATTERN.match(sph):
        errors.append("ATC-002: attestation.signed_payload_hash is not a valid hex SHA-256")

    return errors, warnings


def _check_atc_003_capabilities(atc: Dict) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    caps = atc.get("capabilities", {})

    if not _is_object(atc.get("capabilities")):
        errors.append("ATC-003: capabilities must be an object")
        return errors, warnings

    for category, sub_fields in CAPABILITY_ENUMS.items():
        sub = caps.get(category, {})
        if not _is_object(sub):
            errors.append(f"ATC-003: capabilities.{category} must be an object")
            continue
        for field, allowed in sub_fields.items():
            v = sub.get(field)
            if v is None:
                errors.append(f"ATC-003: capabilities.{category}.{field} is missing")
            elif v not in allowed:
                errors.append(f"ATC-003: capabilities.{category}.{field} must be one of: {', '.join(allowed)} (got {json.dumps(v)})")

    return errors, warnings


def _check_atc_004_evidence(atc: Dict) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    ev = atc.get("evidence", {})

    if not _is_object(atc.get("evidence")):
        errors.append("ATC-004: evidence must be an object")
        return errors, warnings

    if not _has_fields(ev, ["audit_pipeline", "audit_completed_at", "static_checks", "dynamic_checks", "runtime_checks", "findings"]):
        errors.append("ATC-004: evidence must include audit_pipeline, audit_completed_at, static_checks, dynamic_checks, runtime_checks, findings")

    ac = ev.get("audit_completed_at")
    if ac is not None:
        try:
            datetime.fromisoformat(str(ac).replace("Z", "+00:00"))
        except ValueError:
            errors.append("ATC-004: evidence.audit_completed_at is not a valid ISO 8601 timestamp")

    findings = ev.get("findings", [])
    if isinstance(findings, list):
        for i, f in enumerate(findings):
            if not _is_object(f):
                errors.append(f"ATC-004: evidence.findings[{i}] must be an object")
                continue
            if not _has_fields(f, ["layer", "rule_id", "severity", "description"]):
                errors.append(f"ATC-004: evidence.findings[{i}] must include layer, rule_id, severity, description")
            sev = f.get("severity")
            if sev and sev not in ["info", "low", "medium", "high", "critical"]:
                errors.append(f"ATC-004: evidence.findings[{i}].severity must be info/low/medium/high/critical (got {sev})")

    return errors, warnings


def _check_atc_005_risk(atc: Dict) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    r = atc.get("risk", {})

    if not _is_object(atc.get("risk")):
        errors.append("ATC-005: risk must be an object")
        return errors, warnings

    if not _has_fields(r, ["trust_score", "risk_level", "decision_authority", "score_explanation", "scored_at"]):
        errors.append("ATC-005: risk must include trust_score, risk_level, decision_authority, score_explanation, scored_at")

    ts = r.get("trust_score")
    if not isinstance(ts, int) or ts < 0 or ts > 10:
        errors.append("ATC-005: risk.trust_score must be an integer 0-10")
    else:
        expected = "low" if ts >= 8 else "medium" if ts >= 5 else "high" if ts >= 2 else "critical"
        rl = r.get("risk_level")
        if rl and rl != expected:
            warnings.append(f"ATC-005: risk.risk_level='{rl}' but trust_score={ts} implies '{expected}'")

    rl = r.get("risk_level")
    if rl and rl not in ["low", "medium", "high", "critical"]:
        errors.append(f"ATC-005: risk.risk_level must be low/medium/high/critical (got {rl})")

    da = r.get("decision_authority")
    if da and da != "consumer":
        errors.append(f"ATC-005: risk.decision_authority must be 'consumer' in ATC/1.0 (got {da})")

    return errors, warnings


def _check_atc_006_signature(atc: Dict, ca_public_key: Optional[str] = None) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []

    try:
        canonical = canonicalize_atc(atc)
    except Exception as e:
        errors.append(f"ATC-006: canonicalization failed: {e}")
        return errors, warnings

    computed_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    stored_hash = atc.get("attestation", {}).get("signed_payload_hash", "")
    if computed_hash != stored_hash:
        errors.append(f"ATC-006: signed_payload_hash mismatch — expected {computed_hash[:16]}..., got {stored_hash[:16]}...")

    ca_key = ca_public_key or atc.get("issuer", {}).get("ca_public_key")
    if not ca_key:
        errors.append("ATC-006: no CA public key provided")
        return errors, warnings

    sig = atc.get("attestation", {}).get("signature", "")
    if not verify_signature(canonical, sig, ca_key):
        errors.append("ATC-006: Ed25519 signature verification failed")

    return errors, warnings


def _check_atc_007_revocation(atc: Dict) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    rev = atc.get("revocation", {})

    if not _is_object(atc.get("revocation")):
        errors.append("ATC-007: revocation must be an object")
        return errors, warnings

    if not _has_fields(rev, ["revocation_check_url", "revocation_check_method", "revocation_check_required"]):
        errors.append("ATC-007: revocation must include revocation_check_url, revocation_check_method, revocation_check_required")

    method = rev.get("revocation_check_method")
    if method and method not in ["ocsp", "crl", "simple_json"]:
        errors.append(f"ATC-007: revocation_check_method must be ocsp/crl/simple_json (got {method})")

    if rev.get("revocation_check_required") is True:
        warnings.append("ATC-007: revocation_check_required=true — caller must fetch the list separately (use verify_atc with fetch_revocation=True)")

    return errors, warnings


def _check_atc_008_expiration(atc: Dict) -> Tuple[List[str], List[str]]:
    errors: List[str] = []
    warnings: List[str] = []
    v = atc.get("validity", {})

    if not _is_object(atc.get("validity")):
        errors.append("ATC-008: validity must be an object")
        return errors, warnings

    if not _has_fields(v, ["issued_at", "expires_at", "max_ttl_days"]):
        errors.append("ATC-008: validity must include issued_at, expires_at, max_ttl_days")

    now = datetime.now(timezone.utc)
    issued_str = v.get("issued_at")
    expires_str = v.get("expires_at")

    try:
        issued = datetime.fromisoformat(str(issued_str).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        issued = None
        errors.append("ATC-008: validity.issued_at is not a valid ISO 8601 timestamp")

    try:
        expires = datetime.fromisoformat(str(expires_str).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        expires = None
        errors.append("ATC-008: validity.expires_at is not a valid ISO 8601 timestamp")

    max_ttl = v.get("max_ttl_days")
    if not isinstance(max_ttl, int) or not (1 <= max_ttl <= 365):
        errors.append("ATC-008: validity.max_ttl_days must be 1-365")

    if issued and expires:
        ttl_days = (expires - issued).total_seconds() / 86400
        if ttl_days > max_ttl:
            errors.append(f"ATC-008: actual TTL ({ttl_days:.1f} days) exceeds max_ttl_days ({max_ttl})")

        skew = timedelta(minutes=5)
        if now < issued - skew:
            errors.append("ATC-008: ATC issued in the future (clock skew > 5min)")
        if now > expires + skew:
            errors.append("ATC-008: ATC expired (clock skew > 5min)")

        if expires - now < timedelta(days=7) and now < expires:
            days_left = (expires - now).days
            warnings.append(f"ATC-008: ATC expires in less than 7 days ({days_left} days)")

    return errors, warnings


def _fetch_revocation_list(url: str, timeout_ms: int = 5000) -> Dict:
    """Fetch and parse a revocation list JSON."""
    import requests
    res = requests.get(url, headers={"Accept": "application/json"}, timeout=timeout_ms / 1000)
    res.raise_for_status()
    return res.json()


def _is_card_revoked(revocation_list: Dict, card_id: str) -> Dict:
    """Check whether a card_id appears in the revocation list.

    Supports two formats:
    - The MarketNow live CRL format: `cards` array with `status` per card
      (cards with status:"revoked" are revoked; others are active).
    - The ATC-007 spec format: `revoked_cards` array (presence = revoked).
    """
    if not revocation_list:
        return {"revoked": False}
    cards = revocation_list.get("cards") or revocation_list.get("revoked_cards")
    if not isinstance(cards, list):
        return {"revoked": False}
    for c in cards:
        if c.get("card_id") == card_id:
            # In `cards` format, status:"revoked" indicates revocation.
            # In `revoked_cards` format, presence itself indicates revocation.
            is_revoked = c.get("status") == "revoked" or "status" not in c
            if is_revoked:
                return {"revoked": True, "reason": c.get("reason"), "revoked_at": c.get("revoked_at")}
            return {"revoked": False}
    return {"revoked": False}


def verify_atc_sync(atc: Dict, ca_public_key: Optional[str] = None) -> Dict:
    """Synchronously verify an ATC/1.0 card (no revocation list fetch).

    Returns a dict with: valid, spec_version, controls_passed, controls_failed,
    errors, warnings, card_id, issuer_ca_id, trust_score, risk_level, expires_at,
    agent_id, agent_name.
    """
    errors: List[str] = []
    warnings: List[str] = []
    controls_passed: List[str] = []
    controls_failed: List[str] = []

    if not _is_object(atc):
        return {
            "valid": False, "spec_version": None, "controls_passed": [],
            "controls_failed": REQUIRED_CONTROLS, "errors": ["ATC must be an object"],
            "warnings": [], "card_id": None, "issuer_ca_id": None,
            "trust_score": None, "risk_level": None, "expires_at": None,
        }

    if atc.get("spec_version") != ATC_SPEC_VERSION:
        errors.append(f"Invalid spec_version: expected '{ATC_SPEC_VERSION}', got '{atc.get('spec_version')}'")
        return {
            "valid": False, "spec_version": atc.get("spec_version"),
            "controls_passed": [], "controls_failed": REQUIRED_CONTROLS,
            "errors": errors, "warnings": warnings, "card_id": atc.get("card_id"),
            "issuer_ca_id": atc.get("issuer", {}).get("ca_id"),
            "trust_score": atc.get("risk", {}).get("trust_score"),
            "risk_level": atc.get("risk", {}).get("risk_level"),
            "expires_at": atc.get("validity", {}).get("expires_at"),
        }

    if not isinstance(atc.get("card_id"), str) or not CARD_ID_PATTERN.match(atc.get("card_id", "")):
        errors.append(f"card_id must match {CARD_ID_PATTERN.pattern} (e.g. ATC-2026-7777670)")

    checks = [
        ("ATC-001", _check_atc_001_identity(atc)),
        ("ATC-002", _check_atc_002_attestation(atc)),
        ("ATC-003", _check_atc_003_capabilities(atc)),
        ("ATC-004", _check_atc_004_evidence(atc)),
        ("ATC-005", _check_atc_005_risk(atc)),
        ("ATC-007", _check_atc_007_revocation(atc)),
        ("ATC-008", _check_atc_008_expiration(atc)),
    ]

    for cid, (errs, warns) in checks:
        if not errs:
            controls_passed.append(cid)
        else:
            controls_failed.append(cid)
            errors.extend(errs)
        warnings.extend(warns)

    if "ATC-002" in controls_passed:
        sig_errs, sig_warns = _check_atc_006_signature(atc, ca_public_key)
        if not sig_errs:
            controls_passed.append("ATC-006")
        else:
            controls_failed.append("ATC-006")
            errors.extend(sig_errs)
        warnings.extend(sig_warns)
    else:
        controls_failed.append("ATC-006")
        errors.append("ATC-006: skipped because ATC-002 (attestation structure) failed")

    if atc.get("delegation"):
        warnings.append("ATC-009 (delegation) is present but not validated by this verifier")
    if atc.get("runtime_trust"):
        warnings.append("ATC-010 (runtime_trust) is present but not validated by this verifier")

    controls_passed.sort()
    controls_failed.sort()

    return {
        "valid": not errors,
        "spec_version": atc.get("spec_version"),
        "controls_passed": controls_passed,
        "controls_failed": controls_failed,
        "errors": errors,
        "warnings": warnings,
        "card_id": atc.get("card_id"),
        "issuer_ca_id": atc.get("issuer", {}).get("ca_id"),
        "issuer_ca_url": atc.get("issuer", {}).get("ca_url"),
        "trust_score": atc.get("risk", {}).get("trust_score"),
        "risk_level": atc.get("risk", {}).get("risk_level"),
        "expires_at": atc.get("validity", {}).get("expires_at"),
        "agent_id": atc.get("identity", {}).get("agent_id"),
        "agent_name": atc.get("identity", {}).get("agent_name"),
        "revoked": False,
        "revocation_reason": None,
        "revoked_at": None,
    }


def verify_atc(atc: Dict, ca_public_key: Optional[str] = None, fetch_revocation: bool = False, revocation_timeout_ms: int = 5000) -> Dict:
    """Verify an ATC/1.0 card.

    Args:
        atc: The ATC JSON document to verify.
        ca_public_key: Optional override for the CA public key (base64 SPKI).
        fetch_revocation: If True, fetch the revocation list via HTTP and check
                          if the card_id is revoked.
        revocation_timeout_ms: Timeout for the HTTP fetch (default 5000ms).

    Returns: Same shape as verify_atc_sync, plus `revoked`, `revocation_reason`,
             `revoked_at` fields.
    """
    # Start with the sync result
    result = verify_atc_sync(atc, ca_public_key)

    # If fetch_revocation is True and ATC-007 passed structurally, fetch the list
    if fetch_revocation and "ATC-007" in result["controls_passed"]:
        rev_url = atc.get("revocation", {}).get("revocation_check_url")
        if not rev_url:
            result["warnings"].append("ATC-007: fetch_revocation=True but revocation_check_url is missing")
        else:
            try:
                rev_list = _fetch_revocation_list(rev_url, revocation_timeout_ms)
                r = _is_card_revoked(rev_list, atc.get("card_id", ""))
                result["revoked"] = r["revoked"]
                result["revocation_reason"] = r.get("reason")
                result["revoked_at"] = r.get("revoked_at")

                if r["revoked"]:
                    result["errors"].append(
                        f"ATC-007: card_id {atc.get('card_id')} is revoked "
                        f"(reason: {r.get('reason', 'unknown')}, revoked_at: {r.get('revoked_at', '?')})"
                    )
                    result["controls_passed"].remove("ATC-007")
                    result["controls_failed"].append("ATC-007")
                    result["valid"] = False
                else:
                    cards_list = rev_list.get("cards") or rev_list.get("revoked_cards") or []
                    total = len(cards_list)
                    revoked_count = sum(1 for c in cards_list if c.get("status") == "revoked") if rev_list.get("cards") else total
                    result["warnings"].append(
                        f"ATC-007: revocation list fetched successfully ({total} total cards, {revoked_count} revoked — this card_id is not in the revoked set)"
                    )
            except Exception as e:
                result["warnings"].append(f"ATC-007: revocation list fetch failed: {e}")
                if atc.get("revocation", {}).get("revocation_check_required") is True:
                    result["errors"].append(f"ATC-007: revocation list is required but unreachable ({e})")
                    if "ATC-007" in result["controls_passed"]:
                        result["controls_passed"].remove("ATC-007")
                        result["controls_failed"].append("ATC-007")
                    result["valid"] = False

    result["controls_passed"].sort()
    result["controls_failed"].sort()
    return result
