//! ATC/1.0 card issuance — sign an ATC envelope with a CA's private key

use crate::keys::{KeyPair, sign_message, ATC_ALGORITHM};
use serde_json::{Value, json};
use sha2::{Sha256, Digest};
use thiserror::Error;

pub const ATC_SPEC_VERSION: &str = "ATC/1.0";
pub const ATC_MAX_TTL_DAYS_DEFAULT: i64 = 90;

#[derive(Debug, Error)]
pub enum IssueError {
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("missing required field: {0}")]
    MissingField(String),
}

/// RFC 8785 JCS canonicalization (simplified).
///
/// Uses `serde_json` with sorted keys + compact separators. This matches
/// RFC 8785 for the ATC use case (strings, integers, booleans, null, lists,
/// objects). Note: this is NOT a full RFC 8785 implementation — it doesn't
/// handle float edge cases. For ATC payloads (which use integers for
/// timestamps/counts and strings for everything else) it is correct.
pub fn canonicalize_json(value: &Value) -> Result<String, IssueError> {
    // Serialize with sorted keys + compact separators
    let s = serde_json::to_string(value)?;
    // serde_json doesn't have a built-in sort_keys for arbitrary Value,
    // so we use a custom recursive sorter.
    let mut sorted = value.clone();
    sort_json_recursive(&mut sorted);
    Ok(serde_json::to_string(&sorted)?)
}

fn sort_json_recursive(value: &mut Value) {
    match value {
        Value::Object(map) => {
            // serde_json::Map preserves insertion order unless feature "preserve_order" is off
            // For deterministic output, we serialize keys sorted
            let mut keys: Vec<String> = map.keys().cloned().collect();
            keys.sort();
            let mut new_map = serde_json::Map::new();
            for k in keys {
                if let Some(mut v) = map.remove(&k) {
                    sort_json_recursive(&mut v);
                    new_map.insert(k, v);
                }
            }
            *map = new_map;
        }
        Value::Array(arr) => {
            for v in arr.iter_mut() {
                sort_json_recursive(v);
            }
        }
        _ => {}
    }
}

/// Canonicalize an ATC for signing (blank out signature + signed_payload_hash).
pub fn canonicalize_atc(atc: &Value) -> Result<String, IssueError> {
    let mut payload = atc.clone();
    if let Some(att) = payload.get_mut("attestation") {
        if let Some(att_obj) = att.as_object_mut() {
            att_obj.insert("signature".to_string(), Value::String(String::new()));
            att_obj.insert("signed_payload_hash".to_string(), Value::String(String::new()));
        }
    } else {
        payload["attestation"] = json!({"signature": "", "signed_payload_hash": ""});
    }
    canonicalize_json(&payload)
}

/// Compute the SHA-256 hash of the canonical payload, return hex string.
pub fn compute_payload_hash(atc: &Value) -> Result<String, IssueError> {
    let canonical = canonicalize_atc(atc)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let result = hasher.finalize();
    Ok(hex::encode(result))
}

/// Issue (sign) an Agent Trust Card.
pub fn issue_atc(ca_kp: &KeyPair, agent_kp: &KeyPair, partial_payload: Value) -> Result<Value, IssueError> {
    let now = chrono::Utc::now().to_rfc3339();
    let partial_obj = partial_payload.as_object().ok_or(IssueError::MissingField("payload must be an object".to_string()))?;

    let issued_at = partial_obj.get("validity")
        .and_then(|v| v.get("issued_at"))
        .and_then(|v| v.as_str())
        .unwrap_or(&now)
        .to_string();

    let max_ttl_days = partial_obj.get("validity")
        .and_then(|v| v.get("max_ttl_days"))
        .and_then(|v| v.as_i64())
        .unwrap_or(ATC_MAX_TTL_DAYS_DEFAULT);

    // Compute expires_at if not provided
    let expires_at = partial_obj.get("validity")
        .and_then(|v| v.get("expires_at"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            // Parse issued_at and add max_ttl_days
            // For simplicity, use the current time + max_ttl_days
            let expires = chrono::Utc::now() + chrono::Duration::days(max_ttl_days);
            expires.to_rfc3339()
        });

    let ca_id = partial_obj.get("issuer")
        .and_then(|v| v.get("ca_id"))
        .and_then(|v| v.as_str())
        .unwrap_or("alicelabs-sentinel-ca")
        .to_string();

    let ca_url = partial_obj.get("issuer")
        .and_then(|v| v.get("ca_url"))
        .and_then(|v| v.as_str())
        .unwrap_or("https://marketnow.site/api/atc")
        .to_string();

    let identity = partial_obj.get("identity").cloned().ok_or(IssueError::MissingField("identity".to_string()))?;
    let capabilities = partial_obj.get("capabilities").cloned().ok_or(IssueError::MissingField("capabilities".to_string()))?;
    let evidence = partial_obj.get("evidence").cloned().ok_or(IssueError::MissingField("evidence".to_string()))?;
    let mut risk = partial_obj.get("risk").cloned().ok_or(IssueError::MissingField("risk".to_string()))?;
    if let Some(risk_obj) = risk.as_object_mut() {
        risk_obj.insert("decision_authority".to_string(), Value::String("consumer".to_string()));
    }

    let revocation = partial_obj.get("revocation").cloned().unwrap_or_else(|| json!({
        "revocation_check_url": "https://marketnow.site/api/atc?action=revocation-list",
        "revocation_check_method": "simple_json",
        "revocation_check_required": true
    }));

    let mut atc = json!({
        "spec_version": ATC_SPEC_VERSION,
        "card_id": partial_obj.get("card_id").cloned().ok_or(IssueError::MissingField("card_id".to_string()))?,
        "issuer": {
            "ca_id": ca_id,
            "ca_public_key": ca_kp.public_key,
            "ca_algorithm": ATC_ALGORITHM,
            "ca_url": ca_url,
        },
        "identity": identity,
        "attestation": {
            "subject_public_key": agent_kp.public_key,
            "subject_algorithm": ATC_ALGORITHM,
            "signature": "",
            "signed_payload_hash": "",
        },
        "capabilities": capabilities,
        "evidence": evidence,
        "risk": risk,
        "revocation": revocation,
        "validity": {
            "issued_at": issued_at,
            "expires_at": expires_at,
            "max_ttl_days": max_ttl_days,
        },
    });

    // Compute canonical + hash
    let canonical = canonicalize_atc(&atc)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let hash = hex::encode(hasher.finalize());

    if let Some(att) = atc.get_mut("attestation").and_then(|a| a.as_object_mut()) {
        att.insert("signed_payload_hash".to_string(), Value::String(hash));
        let sig = sign_message(canonical.as_bytes(), &ca_kp.raw_signing_key);
        att.insert("signature".to_string(), Value::String(sig));
    }

    Ok(atc)
}

/// Re-sign an existing ATC after editing.
pub fn resign_atc(atc: &mut Value, ca_kp: &KeyPair) -> Result<(), IssueError> {
    let canonical = canonicalize_atc(atc)?;
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    let hash = hex::encode(hasher.finalize());

    if let Some(att) = atc.get_mut("attestation").and_then(|a| a.as_object_mut()) {
        att.insert("signed_payload_hash".to_string(), Value::String(hash));
        let sig = sign_message(canonical.as_bytes(), &ca_kp.raw_signing_key);
        att.insert("signature".to_string(), Value::String(sig));
    }
    Ok(())
}

// Use chrono for date math
extern crate chrono;
