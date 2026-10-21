// uta_authority.rs — wiring template for solana-foundation/pay#514 hosts.
//
// This file is a REFERENCE, kept in lockstep with the tested Node
// implementation (`src/spend514.mjs`). The Node module is the source of
// truth for the semantics; this template shows how a Pay MCP host binds
// the UTA-backed policy into `PayContext::spending_authority` once PR
// #514's `pay_mcp::authority` surfaces are available.
//
// Semantics (mirrored by spend514.mjs, 9 tests):
//   Deny / provider failure / deadline expiry never fall back to allow.
//   A genuine policy denial maps to Ok(AuthorityDecision::Deny).
//   A transport failure inside the trust path maps to Err(AuthorityUnavailable)
//   — opaque to the agent, no raw transport errors.
//
// rust,ignore — compiles only inside a host crate that depends on
// pay_mcp (post-#514), tokio, and has the UTA bridge reachable over
// local IPC / authenticated HTTP. The policy endpoint is trusted
// configuration, never a tool argument.
#![allow(dead_code)]
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use pay_mcp::authority::{AuthorityBinding, AuthorityDecision, SpendRequest, SpendingAuthority};
use serde::Deserialize;

/// Decision shape returned by the UTA bridge policy endpoint
/// (POST /v1/authority/authorize with the SpendRequest JSON mirror).
#[derive(Deserialize)]
struct BridgeDecision {
    decision: String,          // "allow" | "deny"
    #[serde(default)]
    unavailable: bool,         // provider failure (opaque), never a fallback-to-allow
    #[serde(default)]
    reason: Option<String>,
    // receipts/facts (verdict_id, band, offer_sha256, ...) are consumed by
    // the host's audit sink; the agent-visible result stays opaque.
}

struct UtaAuthority {
    endpoint: String,          // trusted configuration: e.g. http://127.0.0.1:8642
    client: reqwest::Client,
    deadline: Duration,        // default 5s, host-configurable <= 60s
}

impl SpendingAuthority for UtaAuthority {
    fn authorize(
        &self,
        request: SpendRequest,
    ) -> Pin<Box<dyn Future<Output = Result<AuthorityDecision, AuthorityUnavailable>> + Send + '_>>
    {
        let endpoint = self.endpoint.clone();
        let client = self.client.clone();
        let deadline = self.deadline;
        Box::pin(async move {
            let body = serde_json::to_value(&request).map_err(|_| AuthorityUnavailable)?;
            let fut = async {
                client
                    .post(format!("{endpoint}/v1/authority/authorize"))
                    .json(&body)
                    .send()
                    .await
                    .ok()?
                    .json::<BridgeDecision>()
                    .await
                    .ok()
            };
            match tokio::time::timeout(deadline, fut).await {
                // provider failure / timeout -> opaque unavailable, fail closed
                Err(_) | Ok(None) => Err(AuthorityUnavailable),
                Ok(Some(BridgeDecision { decision, unavailable: true, .. })) => {
                    let _ = decision; // never surface raw reasons to the agent
                    Err(AuthorityUnavailable)
                }
                Ok(Some(BridgeDecision { decision, .. })) => match decision.as_str() {
                    "allow" => Ok(AuthorityDecision::Allow),
                    _ => Ok(AuthorityDecision::Deny),
                },
            }
        })
    }
}

// Host binding (docs/external-spending-authority.md pattern):
//
//   impl PayContext for ConnectionContext {
//       fn spending_authority(&self, _: &RequestContext<RoleServer>)
//           -> Result<Option<AuthorityBinding>, rmcp::ErrorData>
//       {
//           Ok(Some(AuthorityBinding::new(
//               self.caller_id.clone(),
//               Arc::new(UtaAuthority {
//                   endpoint: "http://127.0.0.1:8642".into(), // trusted config
//                   client: reqwest::Client::new(),
//                   deadline: Duration::from_secs(5),
//               }),
//           )))
//       }
//   }
//
// None remains "deliberately disabled": if the UTA bridge is required but
// unreachable at startup, the host must NOT silently return None — it
// should fail configuration instead. Unavailable-at-runtime is handled by
// AuthorityUnavailable, fail closed.
