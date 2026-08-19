//! ATC/1.0 Rust SDK — Issue and verify Agent Trust Cards
//!
//! A small, framework-agnostic SDK for the ATC/1.0 specification.
//! Uses Ed25519 (RFC 8032) signatures and RFC 8785 JCS canonical JSON.
//!
//! # Quick start
//!
//! ```no_run
//! use agent_trust_card::{generate_keypair, issue_atc, verify_atc_sync};
//!
//! let ca = generate_keypair().unwrap();
//! let agent = generate_keypair().unwrap();
//!
//! let payload = serde_json::json!({
//!     "card_id": "ATC-2026-0000001",
//!     "identity": {
//!         "agent_id": "my-bot",
//!         "agent_name": "My Bot",
//!         "agent_owner": "My Org"
//!     },
//!     "capabilities": {
//!         "filesystem": {"read": "own_dir", "write": "own_dir"},
//!         "network": {"egress": "allowlist", "ingress": "none"},
//!         "shell": {"exec": "sandboxed", "spawn": "none"},
//!         "credentials": {"read_env": "none", "read_files": "none"},
//!         "process": {"subprocess": "none", "signals": "own"}
//!     },
//!     "evidence": {/* ... see spec ... */},
//!     "risk": {
//!         "trust_score": 9,
//!         "risk_level": "low",
//!         "score_explanation": "clean",
//!         "scored_at": "2026-08-10T12:01:00Z"
//!     }
//! });
//!
//! let atc = issue_atc(&ca, &agent, payload).unwrap();
//! let result = verify_atc_sync(&atc, None).unwrap();
//! assert!(result.valid);
//! ```

pub mod keys;
pub mod issue;
pub mod verify;

pub use keys::{generate_keypair, load_keypair_from_private, KeyPair};
pub use issue::{issue_atc, resign_atc, canonicalize_atc, compute_payload_hash, ATC_SPEC_VERSION, ATC_MAX_TTL_DAYS_DEFAULT};
pub use verify::{verify_atc_sync, verify_atc, VerifyResult, VerifyOptions};

pub const ATC_ALGORITHM: &str = "Ed25519";
pub const VERSION: &str = "1.0.0";
