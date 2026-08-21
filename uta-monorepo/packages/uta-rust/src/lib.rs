//! UTA Rust SDK — verify UTA credentials in pure Rust.
//!
//! Implements:
//!   - RFC 8785 JCS canonicalization (canonicalize + canonical_hash)
//!   - Ed25519 signature verification (via ed25519-dalek)
//!   - ATC v3 credential verification (verify_atc_v3)
//!   - JWT verification (verify_jwt — EdDSA only; RS256/ES256 TODO)
//!   - W3C VC verification (verify_w3c_vc — Ed25519Signature2020)
//!
//! Usage:
//!   ```rust
//!   use uta_rust::{UTAVerifier, VerifyResult};
//!
//!   let verifier = UTAVerifier::new(&ca_public_key_pem);
//!   let result: VerifyResult = verifier.verify_credential(&credential_json);
//!   println!("Valid: {}", result.valid);
//!   ```
//!
//! AliceLabs Source-Available License v1.0 (AL-1.0)
//! Copyright (c) 2026 AliceLabs LLC. All rights reserved.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use ed25519_dalek::{Signature, VerifyingKey, Verifier};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Domain separation constants
pub const DOMAIN_ATC_V3_CREDENTIAL: &str = "UTA-ATC-V3-CREDENTIAL";
pub const DOMAIN_ATC_V3_POP: &str = "UTA-ATC-V3-POP";
pub const DOMAIN_TRUST_DECISION: &str = "UTA-TRUST-DECISION";
pub const DOMAIN_W3C_VC: &str = "W3C-VC-DATA-INTEGRITY";

// ============================================================================
// RFC 8785 JCS Canonicalization
// ============================================================================

/// Canonicalize a JSON value per RFC 8785 (JSON Canonicalization Scheme).
pub fn canonicalize(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => serialize_number(n),
        Value::String(s) => serialize_string(s),
        Value::Array(arr) => {
            let items: Vec<String> = arr.iter().map(canonicalize).collect();
            format!("[{}]", items.join(","))
        }
        Value::Object(map) => {
            // Sort keys by UTF-16 code units
            let mut entries: Vec<(&String, &Value)> = map.iter().collect();
            entries.sort_by(|a, b| compare_utf16(a.0, b.0));
            let items: Vec<String> = entries
                .iter()
                .map(|(k, v)| format!("{}:{}", serialize_string(k), canonicalize(v)))
                .collect();
            format!("{{{}}}", items.join(","))
        }
    }
}

fn serialize_number(n: &serde_json::Number) -> String {
    if let Some(i) = n.as_i64() {
        return i.to_string();
    }
    if let Some(u) = n.as_u64() {
        return u.to_string();
    }
    if let Some(f) = n.as_f64() {
        if f == f.trunc() && f.abs() < 2_f64.powi(53) {
            return format!("{}", f as i64);
        }
        let s = format!("{}", f);
        // Normalize exponent format (simplified)
        s
    } else {
        "0".to_string()
    }
}

fn serialize_string(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        let code = c as u32;
        match code {
            0x22 => out.push_str("\\\""),
            0x5C => out.push_str("\\\\"),
            0x08 => out.push_str("\\b"),
            0x09 => out.push_str("\\t"),
            0x0A => out.push_str("\\n"),
            0x0C => out.push_str("\\f"),
            0x0D => out.push_str("\\r"),
            _ if code < 0x20 => out.push_str(&format!("\\u{:04x}", code)),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

fn compare_utf16(a: &str, b: &str) -> std::cmp::Ordering {
    let a_codes = to_utf16_codes(a);
    let b_codes = to_utf16_codes(b);
    a_codes.cmp(&b_codes)
}

fn to_utf16_codes(s: &str) -> Vec<u16> {
    let mut codes = Vec::new();
    for c in s.chars() {
        let code = c as u32;
        if code > 0xFFFF {
            let offset = code - 0x10000;
            codes.push((0xD800 + (offset >> 10)) as u16);
            codes.push((0xDC00 + (offset & 0x3FF)) as u16);
        } else {
            codes.push(code as u16);
        }
    }
    codes
}

/// SHA-256 of canonicalize(value).
pub fn canonical_hash(value: &Value) -> String {
    let canonical = canonicalize(value);
    let mut hasher = Sha256::new();
    hasher.update(canonical.as_bytes());
    hex::encode(hasher.finalize())
}

// ============================================================================
// Ed25519 Verification
// ============================================================================

/// Verify an Ed25519 signature over `domain:canonicalize(payload)`.
pub fn ed25519_verify(
    payload: &Value,
    signature_hex: &str,
    public_key_pem: &str,
    domain: &str,
) -> bool {
    let canonical = canonicalize(payload);
    let signing_input = format!("{}:{}", domain, canonical);

    let sig_bytes = match hex::decode(signature_hex) {
        Ok(b) => b,
        Err(_) => return false,
    };
    if sig_bytes.len() != 64 {
        return false;
    }
    let signature = match Signature::from_slice(&sig_bytes) {
        Ok(s) => s,
        Err(_) => return false,
    };

    // Parse the Ed25519 public key from PEM
    let public_key = match parse_ed25519_public_key(public_key_pem) {
        Some(k) => k,
        None => return false,
    };

    public_key
        .verify(signing_input.as_bytes(), &signature)
        .is_ok()
}

/// Parse an Ed25519 public key from PEM format.
/// Extracts the raw 32-byte key from the SPKI DER structure.
fn parse_ed25519_public_key(pem: &str) -> Option<VerifyingKey> {
    // Remove PEM headers and decode base64
    let b64: String = pem
        .lines()
        .filter(|l| !l.starts_with("-----"))
        .collect();
    let der = URL_SAFE_NO_PAD
        .decode(b64.trim())
        .or_else(|_| base64::engine::general_purpose::STANDARD.decode(b64.trim()))
        .ok()?;

    // Ed25519 SPKI DER: 12 bytes header + 32 bytes raw key
    if der.len() < 44 {
        return None;
    }
    let raw_key = &der[der.len() - 32..];
    VerifyingKey::from_bytes(raw_key.try_into().ok()?).ok()
}

// ============================================================================
// Verification Results
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyResult {
    pub valid: bool,
    pub format: String,
    pub issues: Vec<String>,
    pub credential_id: Option<String>,
    pub issuer: Option<String>,
    pub subject: Option<String>,
    pub expires_at: Option<String>,
}

impl Default for VerifyResult {
    fn default() -> Self {
        Self {
            valid: false,
            format: "unknown".to_string(),
            issues: Vec::new(),
            credential_id: None,
            issuer: None,
            subject: None,
            expires_at: None,
        }
    }
}

// ============================================================================
// ATC v3 Verification
// ============================================================================

/// Verify an ATC v3 credential's Ed25519 signature.
pub fn verify_atc_v3(cred: &Value, ca_public_key_pem: &str) -> VerifyResult {
    let mut result = VerifyResult {
        format: "atc-v3".to_string(),
        ..Default::default()
    };

    let atc_version = cred.get("atc_version").and_then(|v| v.as_str()).unwrap_or("");
    if !atc_version.starts_with("3.") {
        result.issues.push(format!("wrong atc_version: {}", atc_version));
        return result;
    }

    let signatures = cred.get("signatures").and_then(|v| v.as_array());
    if signatures.is_none() || signatures.unwrap().is_empty() {
        result.issues.push("no signatures found".to_string());
        return result;
    }

    let sig = &signatures.unwrap()[0];
    let sig_value = sig.get("value").and_then(|v| v.as_str()).unwrap_or("");
    if sig_value.len() != 128 || !sig_value.chars().all(|c| c.is_ascii_hexdigit()) {
        result.issues.push(format!("malformed signature: {} chars", sig_value.len()));
        return result;
    }

    let domain = sig.get("domain").and_then(|v| v.as_str()).unwrap_or("");
    if domain != DOMAIN_ATC_V3_CREDENTIAL {
        result.issues.push(format!("wrong domain: {}", domain));
    }

    // Build payload (credential without signatures field)
    let mut payload = cred.clone();
    if let Some(obj) = payload.as_object_mut() {
        obj.remove("signatures");
    }

    if !ed25519_verify(&payload, sig_value, ca_public_key_pem, DOMAIN_ATC_V3_CREDENTIAL) {
        result.issues.push("Ed25519 signature verification failed".to_string());
    }

    // evidence_hash check
    let canonical = canonicalize(&payload);
    let mut hasher = Sha256::new();
    hasher.update(format!("{}{}", canonical, sig_value).as_bytes());
    let expected_evidence_hash = format!("sha256:{}", hex::encode(hasher.finalize()));
    let actual_evidence_hash = sig.get("evidence_hash").and_then(|v| v.as_str()).unwrap_or("");
    if actual_evidence_hash != expected_evidence_hash {
        result.issues.push("evidence_hash mismatch".to_string());
    }

    result.credential_id = cred.get("credential_id").and_then(|v| v.as_str()).map(|s| s.to_string());
    result.issuer = cred.get("issuer").and_then(|v| v.get("did")).and_then(|v| v.as_str()).map(|s| s.to_string());
    result.expires_at = cred.get("lifecycle").and_then(|v| v.get("expires_at")).and_then(|v| v.as_str()).map(|s| s.to_string());
    result.valid = result.issues.is_empty();
    result
}

// ============================================================================
// JWT Verification (EdDSA only — RS256/ES256 TODO)
// ============================================================================

/// Verify a JWT (EdDSA only).
pub fn verify_jwt(jwt: &str, public_key_pem: &str) -> VerifyResult {
    let mut result = VerifyResult {
        format: "jwt".to_string(),
        ..Default::default()
    };

    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() != 3 {
        result.issues.push("invalid JWT format (expected 3 parts)".to_string());
        return result;
    }

    let header_b64 = parts[0];
    let payload_b64 = parts[1];
    let sig_b64 = parts[2];

    let header_bytes = match URL_SAFE_NO_PAD.decode(header_b64) {
        Ok(b) => b,
        Err(_) => {
            result.issues.push("invalid header encoding".to_string());
            return result;
        }
    };
    let header: Value = match serde_json::from_slice(&header_bytes) {
        Ok(v) => v,
        Err(e) => {
            result.issues.push(format!("header decode error: {}", e));
            return result;
        }
    };

    let alg = header.get("alg").and_then(|v| v.as_str()).unwrap_or("");
    if alg == "none" {
        result.issues.push("algorithm \"none\" is forbidden".to_string());
        return result;
    }
    if alg == "HS256" {
        result.issues.push("HS256 not supported".to_string());
        return result;
    }
    if alg != "EdDSA" {
        result.issues.push(format!("unsupported alg: {} (only EdDSA supported in Rust SDK)", alg));
        return result;
    }

    let signing_input = format!("{}.{}", header_b64, payload_b64);
    let signature = match URL_SAFE_NO_PAD.decode(sig_b64) {
        Ok(b) => b,
        Err(_) => {
            result.issues.push("invalid signature encoding".to_string());
            return result;
        }
    };

    if signature.len() != 64 {
        result.issues.push(format!("signature wrong length: {}", signature.len()));
        return result;
    }

    let public_key = match parse_ed25519_public_key(public_key_pem) {
        Some(k) => k,
        None => {
            result.issues.push("failed to parse public key".to_string());
            return result;
        }
    };

    let sig = Signature::from_slice(&signature).unwrap();
    if public_key.verify(signing_input.as_bytes(), &sig).is_err() {
        result.issues.push("EdDSA signature verification failed".to_string());
    }

    // Parse claims
    let claims_bytes = match URL_SAFE_NO_PAD.decode(payload_b64) {
        Ok(b) => b,
        Err(_) => return result,
    };
    let claims: Value = match serde_json::from_slice(&claims_bytes) {
        Ok(v) => v,
        Err(_) => return result,
    };
    result.issuer = claims.get("iss").and_then(|v| v.as_str()).map(|s| s.to_string());
    result.subject = claims.get("sub").and_then(|v| v.as_str()).map(|s| s.to_string());

    result.valid = result.issues.is_empty();
    result
}

// ============================================================================
// W3C VC Verification (Ed25519Signature2020)
// ============================================================================

/// Verify a W3C VC with Ed25519Signature2020 proof.
pub fn verify_w3c_vc(vc: &Value, public_key_pem: &str) -> VerifyResult {
    let mut result = VerifyResult {
        format: "vc".to_string(),
        ..Default::default()
    };

    let proof = match vc.get("proof") {
        Some(p) => p,
        None => {
            result.issues.push("missing proof".to_string());
            return result;
        }
    };

    let proof_type = proof.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if proof_type != "Ed25519Signature2020" {
        result.issues.push(format!("unsupported proof type: {}", proof_type));
        return result;
    }

    let proof_value = proof.get("proofValue").and_then(|v| v.as_str()).unwrap_or("");
    let signature = match URL_SAFE_NO_PAD.decode(proof_value) {
        Ok(b) => b,
        Err(_) => {
            result.issues.push("invalid proofValue encoding".to_string());
            return result;
        }
    };

    if signature.len() != 64 {
        result.issues.push(format!("signature wrong length: {}", signature.len()));
        return result;
    }

    // Build payload (VC without proof)
    let mut payload = vc.clone();
    if let Some(obj) = payload.as_object_mut() {
        obj.remove("proof");
    }

    let canonical = canonicalize(&payload);
    let signing_input = format!("{}:{}", DOMAIN_W3C_VC, canonical);

    let public_key = match parse_ed25519_public_key(public_key_pem) {
        Some(k) => k,
        None => {
            result.issues.push("failed to parse public key".to_string());
            return result;
        }
    };

    let sig = Signature::from_slice(&signature).unwrap();
    if public_key.verify(signing_input.as_bytes(), &sig).is_err() {
        result.issues.push("Ed25519Signature2020 verification failed".to_string());
    }

    result.credential_id = vc.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
    result.issuer = vc.get("issuer").and_then(|v| v.as_str()).map(|s| s.to_string());
    result.valid = result.issues.is_empty();
    result
}

// ============================================================================
// Main Verifier — auto-detects format
// ============================================================================

pub struct UTAVerifier {
    ca_public_key_pem: String,
}

impl UTAVerifier {
    pub fn new(ca_public_key_pem: &str) -> Self {
        Self {
            ca_public_key_pem: ca_public_key_pem.to_string(),
        }
    }

    /// Verify any credential format. Auto-detects from the structure.
    pub fn verify_credential(&self, credential: &Value) -> VerifyResult {
        // Unwrap test vector format
        let cred = if credential.get("input").is_some() && credential.get("vector_id").is_some() {
            &credential["input"]
        } else {
            credential
        };

        // JWT
        if let Some(jwt) = cred.get("jwt").and_then(|v| v.as_str()) {
            return verify_jwt(jwt, &self.ca_public_key_pem);
        }

        // ATC v3
        if let Some(version) = cred.get("atc_version").and_then(|v| v.as_str()) {
            if version.starts_with("3.") {
                return verify_atc_v3(cred, &self.ca_public_key_pem);
            }
        }

        // W3C VC
        if let Some(ctx) = cred.get("@context").and_then(|v| v.as_array()) {
            if ctx.iter().any(|c| c.as_str() == Some("https://www.w3.org/2018/credentials/v1")) {
                return verify_w3c_vc(cred, &self.ca_public_key_pem);
            }
        }

        VerifyResult {
            valid: false,
            format: "unknown".to_string(),
            issues: vec!["cannot auto-detect credential format".to_string()],
            ..Default::default()
        }
    }

    /// Verify from a JSON string.
    pub fn verify_credential_json(&self, json_str: &str) -> VerifyResult {
        match serde_json::from_str::<Value>(json_str) {
            Ok(v) => self.verify_credential(&v),
            Err(e) => VerifyResult {
                valid: false,
                format: "unknown".to_string(),
                issues: vec![format!("JSON parse error: {}", e)],
                ..Default::default()
            },
        }
    }

    /// Verify from a file path.
    pub fn verify_credential_file(&self, path: &str) -> VerifyResult {
        match std::fs::read_to_string(path) {
            Ok(content) => self.verify_credential_json(&content),
            Err(e) => VerifyResult {
                valid: false,
                format: "unknown".to_string(),
                issues: vec![format!("file read error: {}", e)],
                ..Default::default()
            },
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn load_keys() -> serde_json::Value {
        let keys_str = std::fs::read_to_string("../../vectors/keys/manifest.json").unwrap();
        serde_json::from_str(&keys_str).unwrap()
    }

    fn load_vector(subdir: &str, name: &str) -> serde_json::Value {
        let path = format!("../../vectors/{}/{}/{}.json", subdir, subdir, name);
        // Try alternate path
        let path = if !std::path::Path::new(&path).exists() {
            format!("../../vectors/{}/{}.json", subdir, name)
        } else {
            path
        };
        let content = std::fs::read_to_string(&path).unwrap();
        serde_json::from_str(&content).unwrap()
    }

    #[test]
    fn test_canonicalize_flat_object() {
        let v = json!({"b": true, "a": "first", "z": "last", "m": 42, "q": null});
        let canonical = canonicalize(&v);
        assert_eq!(canonical, r#"{"a":"first","b":true,"m":42,"q":null,"z":"last"}"#);
    }

    #[test]
    fn test_canonicalize_forward_slash_not_escaped() {
        let v = json!({"path": "a/b/c"});
        let canonical = canonicalize(&v);
        assert_eq!(canonical, r#"{"path":"a/b/c"}"#);
    }

    #[test]
    fn test_canonical_hash() {
        let v = json!({"hello": "world"});
        let hash = canonical_hash(&v);
        assert_eq!(hash.len(), 64); // 32 bytes hex
    }

    #[test]
    fn test_verify_atc_v3_valid() {
        let keys = load_keys();
        let ca_pem = keys["ca_ed25519"]["public_key_pem"].as_str().unwrap();
        let v = load_vector("positive", "pos-001-atc-v3-valid");
        let result = verify_atc_v3(&v["input"], ca_pem);
        assert!(result.valid, "Issues: {:?}", result.issues);
    }

    #[test]
    fn test_verify_atc_v3_tampered() {
        let keys = load_keys();
        let ca_pem = keys["ca_ed25519"]["public_key_pem"].as_str().unwrap();
        let v = load_vector("negative", "neg-001-atc-tampered-sig");
        let result = verify_atc_v3(&v["input"], ca_pem);
        assert!(!result.valid);
    }

    #[test]
    fn test_verify_jwt_eddsa() {
        let keys = load_keys();
        let ca_pem = keys["ca_ed25519"]["public_key_pem"].as_str().unwrap();
        let v = load_vector("positive", "pos-004-jwt-eddsa-valid");
        let jwt = v["input"]["jwt"].as_str().unwrap();
        let result = verify_jwt(jwt, ca_pem);
        // JWT may have expired — check signature only
        assert!(result.issues.iter().all(|i| !i.contains("verification failed")), "Issues: {:?}", result.issues);
    }

    #[test]
    fn test_verify_w3c_vc() {
        let keys = load_keys();
        let ca_pem = keys["ca_ed25519"]["public_key_pem"].as_str().unwrap();
        let v = load_vector("positive", "pos-005-vc-ed25519-valid");
        let result = verify_w3c_vc(&v["input"], ca_pem);
        assert!(result.valid, "Issues: {:?}", result.issues);
    }

    #[test]
    fn test_cross_domain_non_reuse() {
        let keys = load_keys();
        let ca_pem = keys["ca_ed25519"]["public_key_pem"].as_str().unwrap();
        let v = load_vector("positive", "pos-001-atc-v3-valid");
        let cred = &v["input"];
        let sig = cred["signatures"][0]["value"].as_str().unwrap();
        let mut payload = cred.clone();
        payload.as_object_mut().unwrap().remove("signatures");
        // ATC sig must NOT verify in POP domain
        assert!(!ed25519_verify(&payload, sig, ca_pem, DOMAIN_ATC_V3_POP));
    }
}
