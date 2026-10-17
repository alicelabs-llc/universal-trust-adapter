# uta-pay-mcp-bridge

Fail-closed spend-authority bridge for the [Solana Pay MCP](https://github.com/solana-foundation/pay) — the UTA side of the composition proposed in [pay#505](https://github.com/solana-foundation/pay/issues/505).

```
Pay MCP (Solana)              uta-pay-mcp-bridge                    UTA Trust API
─────────────────             ──────────────────────────────        ─────────────────────────
launch with YAML    ────────▶ load policy → seed runtime state
                            per spend request:
                              1. grant for agent+resource?        ──▶ POST /v1/trust/verify
                              2. cumulative budgets (runtime)          (fresh challenge per attempt)
                              3. verify AGENT (ATC/1.0)          ◀─── verdict_id + band
                              4. band >= grant threshold
                              5. revocation re-check, fail-closed ◀──▶ /v1/revocation
                              6. ALLOW → Ed25519-signed receipt
                                 DENY  → reason recorded
```

## The property

**No spend is ever honored because verification was unavailable.** Verify unreachable, HTTP error, non-JSON, missing band while the grant class requires one, or an unresolvable revocation check — every one of those is a *deny* with the reason recorded. A static YAML snapshot cannot express this; it is exactly the runtime half (per-agent cumulative budgets, mid-session grants, immediate revocation) that [Niri7981's point](https://github.com/solana-foundation/pay/issues/505#issuecomment-6217345332) and [lgalabru's YAML question](https://github.com/solana-foundation/pay/issues/505#issuecomment-6216961540) converge on.

## What maps where

| Pay MCP YAML (launch) | Bridge | Runtime |
|---|---|---|
| `budget` (total, per-spend cap) | seeded policy | enforced against cumulative state per spend |
| `authorizations` (agent, resources, daily cap, **`trust_band_min`**) | seeded policy | grants looked up per spend |
| `revocation.check_url` + `fail_closed` | seeded policy | re-checked **on every spend** |
| — | receipts | Ed25519-signed, bound to `verdict_id`, `band`, `policy_sha256` |

## Usage

```js
import { createUtaHook, loadPolicy } from "./src/bridge.mjs";

const hook = await createUtaHook({ policyPath: "./examples/pay-mcp.yaml" });

const decision = await hook.authorize({
  agent: "did:web:checkout-bot.alicelabs.site",
  resource: "solana:transfer",
  amountUsd: 3.5,
  atc: { /* the agent's Agent Trust Card (ATC/1.0) */ },
});
// => { allow: true, verdict_id: "vrg_…", band: "B2", receipt: {…, receipt_sig} }
// or => { allow: false, reason: "fail-closed: verify unreachable (…)" }

hook.verifyReceipt(decision.receipt); // true — against the hook's Ed25519 key
```

Inject `fetchImpl` for deterministic tests; inject `keyPair` to sign receipts with the operator's key instead of an ephemeral one.

## Status

- **Draft 0.1** — schema-tolerant normalizer (accepts `snake_case`/`camelCase`, `authorizations`/`grants`/`agents`). **The bridge will mirror the official Pay MCP YAML 1:1 the moment lgalabru publishes the schema** — the intent stated in [our reply](https://github.com/solana-foundation/pay/issues/505#issuecomment-6227808384).
- `trust_band_min` is the seam between this bridge and UTA's ATC/1.0 verdicts (Ed25519 over RFC 8785 JCS, revocation fail-closed). See [universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter).
- Receipt canonicalization: sorted-keys recursive JSON (RFC 8785-compatible for the ASCII subset receipts use).

## Run tests

```
npm install   # only `yaml` (a minimal fallback parser ships in case it is absent)
npm test
```

17 tests: allow path + receipt verification, band threshold, unreachable/500 verify, per-spend cap, daily cap via runtime state, total budget, revoked agent, revocation-down under both `fail_closed` settings, band-unavailable, no-grant, tamper detection, external operator key — plus the zero-dep fallback regression pair (inline comments / `null` keyword / flow lists, and fallback ≡ `yaml`-path normalization, fixed 2026-10-17 after a post-push audit caught the fallback corrupting commented values).
