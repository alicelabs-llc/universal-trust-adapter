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
- **Verdict scope binding (RFC-ATC v3 §5.2, rev 4):** the verifier's response must carry an Ed25519-signed verdict bound to `{challenge, resource, amount_usd}`; the bridge checks it fail-closed (`scope_binding: strict` by default — `off` is the documented migration opt-out while the verifier rollout completes). Hardening folded from minia2auk's reviews: `amount_usd` must be a **fixed-scale decimal string with six fractional digits** (micro-USD granularity, 1:1 with USDC's 6 decimals on Base — sub-cent routes like $0.005 stay inside scope binding; pricing finer than 1 micro-USD is normatively excluded); challenges are **seller-minted from a cryptographic RNG** (`randomBytes(16)`); verdicts must carry **`kid`**, verified against a pinned key set with `not_before`/`not_after` windows checked at `issued_at` (a missing `kid` is only accepted for a single-key pin); the window is **bounded on both sides** — `issued_at` beyond `max_skew_s` (default 60s) in the future denies, `expires_in` over `max_expires_in_s` (default 300s) denies; **`not_after` is rotation, not revocation** — a `revoked_at` cutoff in the pin entry denies verdicts issued after it; missing `issued_at`/`expires_in` denies; verifier-unreachable ⇒ deny is normative. Pin via `verifierPublicKey`/`uta.verifier_public_key` (single) or `verifierKeys`/`uta.verifier_keys` (pin set). Without scope binding a `verdict_id` is a bearer token across routes and amounts.
- Receipt canonicalization: sorted-keys recursive JSON (RFC 8785-compatible for the ASCII subset receipts use).

## Run tests

```
npm install   # only `yaml` (a minimal fallback parser ships in case it is absent)
npm test
```

17 tests: allow path + receipt verification, band threshold, unreachable/500 verify, per-spend cap, daily cap via runtime state, total budget, revoked agent, revocation-down under both `fail_closed` settings, band-unavailable, no-grant, tamper detection, external operator key — plus the zero-dep fallback regression pair (inline comments / `null` keyword / flow lists, and fallback ≡ `yaml`-path normalization, fixed 2026-10-17 after a post-push audit caught the fallback corrupting commented values).

---

## The #514 contract: `SpendRequest` → UTA (`src/spend514.mjs`)

[solana-foundation/pay#514](https://github.com/solana-foundation/pay/pull/514) adds an optional `SpendingAuthority` hook: after the SDK selects a real offer and before signing, a trusted host consults runtime spending policy. This bridge now ships the **tested reference implementation** of that surface backed by UTA.

| `SpendRequest` field (#514) | What the bridge does with it |
|---|---|
| `operation_id` (1–128 `[A-Za-z0-9-_.:]`) | durable replay guard: `(caller, operation)` is atomically bound to the attempt + offer hash; a new attempt on a claimed operation **fails closed** |
| `attempt_id` | bound into the receipt; distinguishes attempts across process lifetimes |
| `caller_id` (trusted host assertion) | ATC verification subject (`agent`) — never taken from `clientInfo` or tool args |
| `request.{method,url,headers,body}` | hostile-header gate (`Authorization`/`Cookie`/x402-payment/sign-in) + case-insensitive duplicate rejection; `request_sha256` bound into the receipt |
| `amount_atomic` (integer string) | scaled by `assetDecimals` (default 6 = USDC on Solana) into the budget/band pipeline |
| `asset` / `network` / `recipient` | optional `spend_rules` allowlists — present-but-unmatched denies |
| `execution_network` | must equal `network` (offer/execution mismatch denies) |
| `accepted` (canonical offer) | scheme gate (x402 V2 exact only) + `offer_sha256` bound into the receipt |

Decision mapping, matching `docs/external-spending-authority.md` in #514:

- genuine policy denial → `Ok(AuthorityDecision::Deny)` (`{decision:"deny", unavailable:false}`)
- trust-path transport failure → `Err(AuthorityUnavailable)` (`{decision:"deny", unavailable:true}`) — opaque to the agent, never falls back to allow
- deadline (default 5s, ≤60s) → `AuthorityUnavailable`
- receipts are Ed25519-signed and now bind `operation_id`, `attempt_id`, `offer_sha256`, `request_sha256` on top of `verdict_id` + `band` + `policy_sha256`

Nothing from `request` or `accepted` is logged — only ids, hashes and decisions.

```js
import { createUtaHook } from "./src/bridge.mjs";
import { createSpendAuthority } from "./src/spend514.mjs";

const hook = await createUtaHook({ policyPath: "./examples/pay-mcp.yaml" });
const authority = createSpendAuthority(hook, { timeoutMs: 5000, assetDecimals: 6 });

const r = await authority.authorize(spendRequest); // SpendRequest JSON mirror
// r.decision: "allow" | "deny";  r.unavailable: provider failure (fail-closed)
// r.receipt: signed, bound to the full #514 fact set
```

A Rust wiring template for the host side lives in [`authority/uta_authority.rs`](authority/uta_authority.rs).

**Tests:** 9 new (`test/authority514.test.mjs`) mirroring the #514 contract — allow path, replay/attempt binding, hostile headers, duplicate headers, scheme gate (V1/non-exact), fail-closed unreachable, deadline, allowlists/network match, deny-keeps-claim. Full suite: 47 passing.
