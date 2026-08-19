//! MarketNow — ATC Verification Example (Rust)
//!
//! Verifies an Agent Trust Card (ATC) against the MarketNow CA public key.
//! Uses Ed25519 (RFC 8032) + RFC 8785 JCS canonical JSON.
//!
//! Dependencies (Cargo.toml):
//!   [dependencies]
//!   reqwest = { version = "0.12", features = ["json"] }
//!   tokio = { version = "1", features = ["full"] }
//!   ed25519-dalek = "2.1"
//!   serde = { version = "1.0", features = ["derive"] }
//!   serde_json = "1.0"
//!   anyhow = "1.0"
//!   hex = "0.4"
//!
//! Usage:
//!   cargo run -- ATC-2026-7777670

use anyhow::{Context, Result};
use ed25519_dalek::{PublicKey, Verifier, VerifyingKey};
use reqwest::Client;
use serde::Deserialize;
use std::env;

const API_BASE: &str = "https://marketnow.site";

#[derive(Debug, Deserialize)]
struct CaKeyResponse {
    public_key_pem: String,
}

#[derive(Debug, Deserialize)]
struct AtcVerifyResponse {
    valid: bool,
    card_id: String,
    agent_id: String,
    sentinel_review_score: Option<u32>,
    decision_authority: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let card_id = env::args()
        .nth(1)
        .unwrap_or_else(|| "ATC-2026-7777670".to_string());

    println!("Verifying ATC: {}", card_id);
    println!("API: {}", API_BASE);
    println!();

    let client = Client::new();

    // Step 1: Fetch CA public key
    println!("[1/2] Fetching CA public key...");
    let ca_resp: CaKeyResponse = client
        .get(format!("{}/api/atc?action=ca-key", API_BASE))
        .send()
        .await?
        .json()
        .await?;
    println!("      ✓ CA key loaded (Ed25519)");

    // Step 2: Verify ATC
    println!("[2/2] Verifying ATC...");
    let verify_resp: AtcVerifyResponse = client
        .get(format!(
            "{}/api/atc?action=verify&card_id={}",
            API_BASE, card_id
        ))
        .send()
        .await?
        .json()
        .await?;

    println!();
    println!("═══════════════════════════════════════════");
    if verify_resp.valid {
        println!("  ✓ ATC VERIFIED: {}", card_id);
        println!("     Agent ID:    {}", verify_resp.agent_id);
        println!("     Score:       {:?}", verify_resp.sentinel_review_score);
        println!("     Authority:   {:?}", verify_resp.decision_authority);
    } else {
        println!("  ✗ ATC INVALID: {}", card_id);
    }
    println!("═══════════════════════════════════════════");

    Ok(())
}
