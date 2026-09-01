// UTA — Rust example: verify a credential via public HTTP API.
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize)] struct VerifyRequest<'a> { card: &'a str }
#[derive(Deserialize, Debug)] struct VerifyResponse {
    decision: String,
    detected_format: Option<String>,
    issuer: Option<String>,
    failed_stage: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let card = env::args().nth(1).expect("Usage: verify <card>");
    let client = Client::new();
    let resp: VerifyResponse = client
        .post("https://www.marketnow.site/api/trust?action=verify")
        .json(&VerifyRequest { card: &card })
        .send().await?.json().await?;
    println!("Decision:  {}", resp.decision);
    println!("Format:    {:?}", resp.detected_format);
    println!("Issuer:    {:?}", resp.issuer);
    Ok(())
}
