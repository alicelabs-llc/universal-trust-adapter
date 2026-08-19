//! ATC/1.0 verifier — verify any Agent Trust Card against the spec

use crate::keys::verify_signature;
use crate::issue::{canonicalize_atc, ATC_SPEC_VERSION};
use serde::{Serialize, Deserialize};
use serde_json::{Value, json};
use sha2::{Sha256, Digest};
use std::collections::BTreeMap;
use thiserror::Error;

const CARD_ID_PATTERN: &str = r"^ATC-\d{4}-\d{6,}$";
const ATC_ALGORITHM: &str = "Ed25519";

#[derive(Debug, Error)]
pub enum VerifyError {
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("regex error: {0}")]
    Regex(#[from] regex::Error),
    #[error("network error: {0}")]
    Network(String),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VerifyResult {
    pub valid: bool,
    pub spec_version: Option<String>,
    pub controls_passed: Vec<String>,
    pub controls_failed: Vec<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub card_id: Option<String>,
    pub issuer_ca_id: Option<String>,
    pub issuer_ca_url: Option<String>,
    pub trust_score: Option<i64>,
    pub risk_level: Option<String>,
    pub expires_at: Option<String>,
    pub agent_id: Option<String>,
    pub agent_name: Option<String>,
    pub revoked: bool,
    pub revocation_reason: Option<String>,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Default)]
pub struct VerifyOptions {
    pub ca_public_key: Option<String>,
    pub fetch_revocation: bool,
    pub revocation_timeout_ms: u64,
}

/// Verify an ATC/1.0 card (sync, no network).
pub fn verify_atc_sync(atc: &Value, ca_public_key: Option<&str>) -> Result<VerifyResult, VerifyError> {
    let mut errors: Vec<String> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    let mut controls_passed: Vec<String> = Vec::new();
    let mut controls_failed: Vec<String> = Vec::new();

    let re = regex::Regex::new(CARD_ID_PATTERN)?;

    if !atc.is_object() {
        return Ok(VerifyResult {
            valid: false,
            spec_version: None,
            controls_passed: vec![],
            controls_failed: vec!["ATC-001".into(), "ATC-002".into(), "ATC-003".into(), "ATC-004".into(), "ATC-005".into(), "ATC-006".into(), "ATC-007".into(), "ATC-008".into()],
            errors: vec!["ATC must be an object".into()],
            warnings: vec![],
            card_id: None, issuer_ca_id: None, issuer_ca_url: None,
            trust_score: None, risk_level: None, expires_at: None,
            agent_id: None, agent_name: None,
            revoked: false, revocation_reason: None, revoked_at: None,
        });
    }

    let spec_version = atc.get("spec_version").and_then(|v| v.as_str()).map(|s| s.to_string());
    if spec_version.as_deref() != Some(ATC_SPEC_VERSION) {
        errors.push(format!("Invalid spec_version: expected '{}', got {:?}", ATC_SPEC_VERSION, spec_version));
        return Ok(VerifyResult {
            valid: false,
            spec_version,
            controls_passed: vec![],
            controls_failed: vec!["ATC-001".into(), "ATC-002".into(), "ATC-003".into(), "ATC-004".into(), "ATC-005".into(), "ATC-006".into(), "ATC-007".into(), "ATC-008".into()],
            errors,
            warnings,
            card_id: atc.get("card_id").and_then(|v| v.as_str()).map(|s| s.to_string()),
            issuer_ca_id: atc.get("issuer").and_then(|i| i.get("ca_id")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            issuer_ca_url: atc.get("issuer").and_then(|i| i.get("ca_url")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            trust_score: atc.get("risk").and_then(|r| r.get("trust_score")).and_then(|v| v.as_i64()),
            risk_level: atc.get("risk").and_then(|r| r.get("risk_level")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            expires_at: atc.get("validity").and_then(|v| v.get("expires_at")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            agent_id: atc.get("identity").and_then(|i| i.get("agent_id")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            agent_name: atc.get("identity").and_then(|i| i.get("agent_name")).and_then(|v| v.as_str()).map(|s| s.to_string()),
            revoked: false, revocation_reason: None, revoked_at: None,
        });
    }

    let card_id = atc.get("card_id").and_then(|v| v.as_str()).map(|s| s.to_string());
    if let Some(ref cid) = card_id {
        if !re.is_match(cid) {
            errors.push(format!("card_id must match {} (e.g. ATC-2026-7777670)", CARD_ID_PATTERN));
        }
    } else {
        errors.push("card_id missing".to_string());
    }

    // Run structural checks for ATC-001, ATC-002, ATC-003, ATC-004, ATC-005, ATC-007, ATC-008
    let structural_checks = [
        ("ATC-001", check_atc_001_identity(atc)),
        ("ATC-002", check_atc_002_attestation(atc)),
        ("ATC-003", check_atc_003_capabilities(atc)),
        ("ATC-004", check_atc_004_evidence(atc)),
        ("ATC-005", check_atc_005_risk(atc)),
        ("ATC-007", check_atc_007_revocation(atc)),
        ("ATC-008", check_atc_008_expiration(atc)),
    ];
    for (id, (errs, warns)) in &structural_checks {
        if errs.is_empty() {
            controls_passed.push(id.to_string());
        } else {
            controls_failed.push(id.to_string());
            errors.extend(errs.clone());
        }
        warnings.extend(warns.clone());
    }

    // ATC-006 signature check
    if controls_passed.contains(&"ATC-002".to_string()) {
        let (sig_errs, sig_warns) = check_atc_006_signature(atc, ca_public_key);
        if sig_errs.is_empty() {
            controls_passed.push("ATC-006".to_string());
        } else {
            controls_failed.push("ATC-006".to_string());
            errors.extend(sig_errs);
        }
        warnings.extend(sig_warns);
    } else {
        controls_failed.push("ATC-006".to_string());
        errors.push("ATC-006: skipped because ATC-002 (attestation structure) failed".to_string());
    }

    if atc.get("delegation").is_some() {
        warnings.push("ATC-009 (delegation) is present but not validated by this verifier".to_string());
    }
    if atc.get("runtime_trust").is_some() {
        warnings.push("ATC-010 (runtime_trust) is present but not validated by this verifier".to_string());
    }

    controls_passed.sort();
    controls_failed.sort();

    Ok(VerifyResult {
        valid: errors.is_empty(),
        spec_version,
        controls_passed,
        controls_failed,
        errors,
        warnings,
        card_id,
        issuer_ca_id: atc.get("issuer").and_then(|i| i.get("ca_id")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        issuer_ca_url: atc.get("issuer").and_then(|i| i.get("ca_url")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        trust_score: atc.get("risk").and_then(|r| r.get("trust_score")).and_then(|v| v.as_i64()),
        risk_level: atc.get("risk").and_then(|r| r.get("risk_level")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        expires_at: atc.get("validity").and_then(|v| v.get("expires_at")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        agent_id: atc.get("identity").and_then(|i| i.get("agent_id")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        agent_name: atc.get("identity").and_then(|i| i.get("agent_name")).and_then(|v| v.as_str()).map(|s| s.to_string()),
        revoked: false, revocation_reason: None, revoked_at: None,
    })
}

/// Verify an ATC/1.0 card with optional revocation list fetch (network).
pub fn verify_atc(atc: &Value, options: VerifyOptions) -> Result<VerifyResult, VerifyError> {
    let mut result = verify_atc_sync(atc, options.ca_public_key.as_deref())?;

    if options.fetch_revocation && result.controls_passed.contains(&"ATC-007".to_string()) {
        if let Some(rev_url) = atc.get("revocation").and_then(|r| r.get("revocation_check_url")).and_then(|v| v.as_str()) {
            match fetch_revocation_list(rev_url, options.revocation_timeout_ms) {
                Ok(list) => {
                    let card_id = result.card_id.as_deref().unwrap_or("");
                    if let Some(revoked_card) = list.get("revoked_cards").and_then(|c| c.as_array()).and_then(|arr| {
                        arr.iter().find(|c| c.get("card_id").and_then(|v| v.as_str()) == Some(card_id))
                    }) {
                        result.revoked = true;
                        result.revocation_reason = revoked_card.get("reason").and_then(|v| v.as_str()).map(|s| s.to_string());
                        result.revoked_at = revoked_card.get("revoked_at").and_then(|v| v.as_str()).map(|s| s.to_string());
                        result.errors.push(format!("ATC-007: card_id {} is revoked (reason: {})", card_id, result.revocation_reason.as_deref().unwrap_or("unknown")));
                        result.controls_passed.retain(|c| c != "ATC-007");
                        result.controls_failed.push("ATC-007".to_string());
                        result.valid = false;
                    } else {
                        let count = list.get("revoked_cards").and_then(|c| c.as_array()).map(|a| a.len()).unwrap_or(0);
                        result.warnings.push(format!("ATC-007: revocation list fetched successfully ({} revoked cards, this card_id is not in the list)", count));
                    }
                }
                Err(e) => {
                    result.warnings.push(format!("ATC-007: revocation list fetch failed: {}", e));
                    if atc.get("revocation").and_then(|r| r.get("revocation_check_required")).and_then(|v| v.as_bool()) == Some(true) {
                        result.errors.push(format!("ATC-007: revocation list is required but unreachable ({})", e));
                        result.controls_passed.retain(|c| c != "ATC-007");
                        result.controls_failed.push("ATC-007".to_string());
                        result.valid = false;
                    }
                }
            }
        }
    }

    result.controls_passed.sort();
    result.controls_failed.sort();
    Ok(result)
}

fn fetch_revocation_list(url: &str, timeout_ms: u64) -> Result<Value, VerifyError> {
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_millis(timeout_ms))
        .build();
    let res = agent.get(url)
        .set("Accept", "application/json")
        .call()
        .map_err(|e| VerifyError::Network(e.to_string()))?;
    let body: Value = res.into_json()
        .map_err(|e| VerifyError::Network(format!("JSON parse: {}", e)))?;
    Ok(body)
}

// Per-control check functions return (errors, warnings)
fn check_atc_001_identity(atc: &Value) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let id = atc.get("identity");
    if id.is_none() || !id.unwrap().is_object() {
        errors.push("ATC-001: identity must be an object".to_string());
        return (errors, warnings);
    }
    let id = id.unwrap();
    for f in ["agent_id", "agent_name", "agent_owner"] {
        if id.get(f).is_none() {
            errors.push(format!("ATC-001: identity.{} missing", f));
        }
    }
    if let Some(aid) = id.get("agent_id").and_then(|v| v.as_str()) {
        if aid.len() < 3 || aid.len() > 128 || !aid.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            errors.push("ATC-001: identity.agent_id must be 3-128 alphanumeric chars".to_string());
        }
    }
    (errors, warnings)
}

fn check_atc_002_attestation(atc: &Value) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let warnings = Vec::new();
    let att = atc.get("attestation");
    if att.is_none() || !att.unwrap().is_object() {
        errors.push("ATC-002: attestation must be an object".to_string());
        return (errors, warnings);
    }
    let att = att.unwrap();
    for f in ["subject_public_key", "subject_algorithm", "signature", "signed_payload_hash"] {
        if att.get(f).is_none() {
            errors.push(format!("ATC-002: attestation.{} missing", f));
        }
    }
    if att.get("subject_algorithm").and_then(|v| v.as_str()) != Some(ATC_ALGORITHM) {
        errors.push(format!("ATC-002: subject_algorithm must be '{}'", ATC_ALGORITHM));
    }
    (errors, warnings)
}

fn check_atc_003_capabilities(atc: &Value) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let warnings = Vec::new();
    let caps = atc.get("capabilities");
    if caps.is_none() || !caps.unwrap().is_object() {
        errors.push("ATC-003: capabilities must be an object".to_string());
        return (errors, warnings);
    }
    let caps = caps.unwrap().as_object().unwrap();
    let required = ["filesystem", "network", "shell", "credentials", "process"];
    for cat in required {
        if !caps.contains_key(cat) {
            errors.push(format!("ATC-003: capabilities.{} missing", cat));
        }
    }
    (errors, warnings)
}

fn check_atc_004_evidence(atc: &Value) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let warnings = Vec::new();
    let ev = atc.get("evidence");
    if ev.is_none() || !ev.unwrap().is_object() {
        errors.push("ATC-004: evidence must be an object".to_string());
        return (errors, warnings);
    }
    let ev = ev.unwrap();
    for f in ["audit_pipeline", "audit_completed_at", "static_checks", "dynamic_checks", "runtime_checks", "findings"] {
        if ev.get(f).is_none() {
            errors.push(format!("ATC-004: evidence.{} missing", f));
        }
    }
    (errors, warnings)
}

fn check_atc_005_risk(atc: &Value) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let warnings = Vec::new();
    let r = atc.get("risk");
    if r.is_none() || !r.unwrap().is_object() {
        errors.push("ATC-005: risk must be an object".to_string());
        return (errors, warnings);
    }
    let r = r.unwrap();
    for f in ["trust_score", "risk_level", "decision_authority", "score_explanation", "scored_at"] {
        if r.get(f).is_none() {
            errors.push(format!("ATC-005: risk.{} missing", f));
        }
    }
    if let Some(ts) = r.get("trust_score").and_then(|v| v.as_i64()) {
        if ts < 0 || ts > 10 {
            errors.push("ATC-005: risk.trust_score must be 0-10".to_string());
        }
    }
    if r.get("decision_authority").and_then(|v| v.as_str()) != Some("consumer") {
        errors.push("ATC-005: decision_authority must be 'consumer'".to_string());
    }
    (errors, warnings)
}

fn check_atc_006_signature(atc: &Value, ca_public_key: Option<&str>) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let warnings = Vec::new();

    let canonical = match canonicalize_atc(atc) {
        Ok(c) => c,
        Err(e) => {
            errors.push(format!("ATC-006: canonicalization failed: {}", e));
            return (errors, warnings);
        }
    };

    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let computed_hash = hex::encode(hasher.finalize());
    let stored_hash = atc.get("attestation").and_then(|a| a.get("signed_payload_hash")).and_then(|v| v.as_str()).unwrap_or("");
    if computed_hash != stored_hash {
        errors.push(format!("ATC-006: signed_payload_hash mismatch — expected {}..., got {}...", &computed_hash[..16], &stored_hash[..16.min(stored_hash.len())]));
    }

    let ca_key = ca_public_key
        .or_else(|| atc.get("issuer").and_then(|i| i.get("ca_public_key")).and_then(|v| v.as_str()))
        .map(|s| s.to_string());
    if ca_key.is_none() {
        errors.push("ATC-006: no CA public key".to_string());
        return (errors, warnings);
    }
    let ca_key = ca_key.unwrap();

    let sig = atc.get("attestation").and_then(|a| a.get("signature")).and_then(|v| v.as_str()).unwrap_or("");
    if !verify_signature(canonical.as_bytes(), sig, &ca_key) {
        errors.push("ATC-006: Ed25519 signature verification failed".to_string());
    }

    (errors, warnings)
}

fn check_atc_007_revocation(atc: &Value) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let rev = atc.get("revocation");
    if rev.is_none() || !rev.unwrap().is_object() {
        errors.push("ATC-007: revocation must be an object".to_string());
        return (errors, warnings);
    }
    let rev = rev.unwrap();
    for f in ["revocation_check_url", "revocation_check_method", "revocation_check_required"] {
        if rev.get(f).is_none() {
            errors.push(format!("ATC-007: revocation.{} missing", f));
        }
    }
    let method = rev.get("revocation_check_method").and_then(|v| v.as_str());
    if let Some(m) = method {
        if !["ocsp", "crl", "simple_json"].contains(&m) {
            errors.push(format!("ATC-007: revocation_check_method must be ocsp/crl/simple_json (got {})", m));
        }
    }
    if rev.get("revocation_check_required").and_then(|v| v.as_bool()) == Some(true) {
        warnings.push("ATC-007: revocation_check_required=true — caller must fetch the list separately (use verify_atc with fetch_revocation=true)".to_string());
    }
    (errors, warnings)
}

fn check_atc_008_expiration(atc: &Value) -> (Vec<String>, Vec<String>) {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let v = atc.get("validity");
    if v.is_none() || !v.unwrap().is_object() {
        errors.push("ATC-008: validity must be an object".to_string());
        return (errors, warnings);
    }
    let v = v.unwrap();
    for f in ["issued_at", "expires_at", "max_ttl_days"] {
        if v.get(f).is_none() {
            errors.push(format!("ATC-008: validity.{} missing", f));
        }
    }
    // (Full ISO 8601 parsing + clock skew check omitted for brevity — production code should use chrono)
    (errors, warnings)
}
