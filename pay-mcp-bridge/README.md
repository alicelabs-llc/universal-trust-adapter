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

Inject `fetchImpl` for deterministic tests; inject `keyPair` to sign receipts with the operator's key instead of an ephemeral one; inject `verifierPublicKey` (single pin) or `verifierKeys` (§5.2 rev 3 pin set: `[{kid, public_key, not_before, not_after}]`) for §5.2 scope-binding checks (strict by default — a verifier response without a signed verdict bound to `{challenge, resource, amount_usd}` denies).

## Status

- **Draft 0.1** — schema-tolerant normalizer (accepts `snake_case`/`camelCase`, `authorizations`/`grants`/`agents`). **The bridge will mirror the official Pay MCP YAML 1:1 the moment lgalabru publishes the schema** — the intent stated in [our reply](https://github.com/solana-foundation/pay/issues/505#issuecomment-6227808384).
- `trust_band_min` is the seam between this bridge and UTA's ATC/1.0 verdicts (Ed25519 over RFC 8785 JCS, revocation fail-closed). See [universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter).
- **Verdict scope binding (RFC-ATC v3 §5.2, rev 3):** the verifier's response must carry an Ed25519-signed verdict bound to `{challenge, resource, amount_usd}`; the bridge checks it fail-closed (`scope_binding: strict` by default — `off` is the documented migration opt-out while the verifier rollout completes). Rev 3 hardening (from minia2auk's follow-up review): `amount_usd` must be a **fixed-scale decimal string** (a JSON number or non-canonical string in the signed scope denies — JCS makes serialization normative and non-JS implementations diverge); challenges are **seller-minted from a cryptographic RNG** (the reference bridge uses `randomBytes(16)`); verdicts must carry **`kid`**, verified against a pinned key set with `not_before`/`not_after` windows checked at `issued_at` (a missing `kid` is only accepted for a single-key pin); missing `issued_at`/`expires_in` denies; verifier-unreachable ⇒ deny is normative. Pin via `verifierPublicKey`/`uta.verifier_public_key` (single) or `verifierKeys`/`uta.verifier_keys` (pin set). Without scope binding a `verdict_id` is a bearer token across routes and amounts.
- Receipt canonicalization: sorted-keys recursive JSON (RFC 8785-compatible for the ASCII subset receipts use).

## Run tests

```
npm install   # only `yaml` (a minimal fallback parser ships in case it is absent)
npm test
```

17 tests: allow path + receipt verification, band threshold, unreachable/500 verify, per-spend cap, daily cap via runtime state, total budget, revoked agent, revocation-down under both `fail_closed` settings, band-unavailable, no-grant, tamper detection, external operator key — plus the zero-dep fallback regression pair (inline comments / `null` keyword / flow lists, and fallback ≡ `yaml`-path normalization, fixed 2026-10-17 after a post-push audit caught the fallback corrupting commented values).
