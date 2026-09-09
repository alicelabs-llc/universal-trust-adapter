# @marketnow/trust-core

**UTA Verification Core v2** — the full agent-trust stack in one zero-dependency package: behavior analysis (baselines + drift), policy engine (capability graph + org policies + approval workflow), trajectory analysis (attack chains + data flow), and cross-agent trust, on top of the 12-stage verification pipeline. Every module ships typed end-to-end and is exercised by a registry-installed smoke suite (21/21) before release.

```bash
npm install @marketnow/trust-core
```

## Behavior — baselines + drift

```js
import { computeBaseline, detectDrift } from '@marketnow/trust-core';

const baseline = computeBaseline(observations, { server_id, server_version, tool_fingerprint_hash, window_start, window_end });
const drift = detectDrift(baseline, baselineObs, currentObs, currentWindow);
// drift.signals — 7 signal classes; drift.severity 'critical' on new egress hosts,
// credential env reads, process spawns, latency/data-volume anomalies
```

## Capability graph + org policies

```js
import { matchCapabilities, MINIMAL_SAFE, evaluatePolicy, DEFAULT_STRICT_POLICY } from '@marketnow/trust-core';

const match = matchCapabilities(manifest, MINIMAL_SAFE);     // matches: boolean + satisfied/unsatisfied
const decision = evaluatePolicy(trustScore, manifest, DEFAULT_STRICT_POLICY);
// → { action: 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK', reason, rules_triggered }
```

Three preset policies (STRICT / ENTERPRISE / PERMISSIVE) + full approval workflow (`createApprovalRequest`, `approveRequest`, `denyRequest`, TTL, pending caps).

## Trajectory — attack chains + data flow

```js
import { detectAttackChains, scoreTrajectory, buildDataFlowGraph } from '@marketnow/trust-core';

const chains = detectAttackChains(calls);   // AC-001 search→read→download→execute, AC-002 read .env→exfiltrate, …
const traj = scoreTrajectory(calls);        // risk 0–10 + should_block_call index
const flow = buildDataFlowGraph(calls);     // nodes/edges + exfiltration_paths
```

Each step individually allowed — the **chain** is what gets blocked (each action alone = ALLOW, chain = BLOCK).

## Cross-agent trust + memory poisoning

```js
import { evaluateDelegation, scanMemoryForPoisoning } from '@marketnow/trust-core';

const delegation = evaluateDelegation(request, { from_trust_score, to_trust_score, to_capabilities, to_revoked, to_suspicious_flags, delegation_chain_depth });
const scan = scanMemoryForPoisoning(memoryEntries); // instruction injection, taint, sensitivity anomalies
```

## Core (v1 line)

| Export | What it does |
|---|---|
| `verifyCredential(credential, context)` | **12-stage verification pipeline**, structured `VerificationResult` |
| `TrustEngine` | Composable trust-decision engine over the pipeline |
| `sign` / `verify` | Ed25519 (RFC 8032) over JCS-canonicalized payloads |
| `canonicalize` / `canonicalHash` | RFC 8785 JCS + SHA-256 |
| `generatePoPChallenge` / `verifyPoP` | **Proof of Possession** |
| `RevocationTransparencyLog` | RFC 6962-style Merkle log, signed tree heads, inclusion/consistency proofs |
| `computeToolFingerprint` / `diffFingerprints` | TFP-1.0 tool fingerprinting + drift reports |
| `computeConfidence` / `summarizeFindings` | Evidence-first findings: risk score + confidence score + coverage |

## Design principles

- **Fail-closed**: unknown revocation state or unreachable evidence never counts as "valid".
- **Deterministic**: RFC 8785 JCS before every hash/signature.
- **Zero dependencies**: only `node:crypto`.
- **Typed end-to-end**: full `.d.ts` for every module.

## Related packages

- `@marketnow/trust-adapters` — 9 credential formats (ATC, EAT, A2A, W3C-VC, OAuth, SPIFFE, X.509, MCP, ZTA)
- `@marketnow/trust-gateway` — runtime gateway (`TrustGateway`, `withTrustGateway`)
- `marketnow-mcp` — MCP server exposing the live trust tools (15 tools)
- `agent-trust-card` — ATC/1.0 SDK and CLI

## License

AL-1.0 (Apache-style, attribution required). See `LICENSE-AL-1.0` and `NOTICE`. © 2025–2026 AliceLabs LLC (Wyoming, USA).

