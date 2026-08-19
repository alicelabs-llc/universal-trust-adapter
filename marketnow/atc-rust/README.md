# agent-trust-card (Rust)

> **Issue and verify Agent Trust Cards in Rust.** A small, framework-agnostic SDK for the [ATC/1.0 specification](https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/SPEC.md).

[![Crates.io](https://img.shields.io/crates/v/agent-trust-card.svg)](https://crates.io/crates/agent-trust-card)
[![License: AliceLabs Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)
[![Spec: ATC/1.0](https://img.shields.io/badge/Spec-ATC%2F1.0-brightgreen)](https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/SPEC.md)

## Install

Add to `Cargo.toml`:

```toml
[dependencies]
agent-trust-card = "1.0"
```

Or via `cargo` CLI:

```bash
cargo add agent-trust-card
```

## Quick start

```rust
use agent_trust_card::{generate_keypair, issue_atc, verify_atc_sync};
use serde_json::json;

fn main() {
    let ca = generate_keypair().unwrap();
    let agent = generate_keypair().unwrap();

    let payload = json!({
        "card_id": "ATC-2026-0000001",
        "identity": {
            "agent_id": "my-bot",
            "agent_name": "My Bot",
            "agent_owner": "My Org"
        },
        "capabilities": {
            "filesystem": {"read": "own_dir", "write": "own_dir"},
            "network": {"egress": "allowlist", "ingress": "none"},
            "shell": {"exec": "sandboxed", "spawn": "none"},
            "credentials": {"read_env": "none", "read_files": "none"},
            "process": {"subprocess": "none", "signals": "own"}
        },
        "evidence": {/* ... see spec ... */},
        "risk": {
            "trust_score": 9,
            "risk_level": "low",
            "score_explanation": "clean",
            "scored_at": "2026-08-10T12:01:00Z"
        }
    });

    let atc = issue_atc(&ca, &agent, payload).unwrap();
    let result = verify_atc_sync(&atc, None).unwrap();

    println!("valid: {}", result.valid);
    println!("controls passed: {}/8", result.controls_passed.len());
}
```

## Publish

```bash
cargo login <your-crates-io-token>
cargo publish
```

## Cross-language compatibility

ATCs issued by the Rust SDK verify in the Node.js and Python SDKs and vice versa. All three use:
- Ed25519 (RFC 8032) for signatures
- RFC 8785 JCS for canonical JSON
- SHA-256 for payload hashes
- Full SPKI/PKCS8 DER encoding for keys (base64-encoded)

## License

MNNC-1.0 (AliceLabs LLC Proprietary). For licensing: legal@alicelabs.site

Built by AliceLabs LLC (Wyoming, USA) — founder Edison Flores.
