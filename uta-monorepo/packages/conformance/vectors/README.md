# UTA Conformance Vectors — Canonical Bytes

This directory contains the canonical bytes for each UTA conformance test vector.

## Why this exists

@anp2network asked (three times) for the canonical bytes to be published alongside the SHA-256, so an external verifier can reproduce signature verification without guessing the preimage.

> "One ask on format: record the canonical JCS bytes per vector as hex or base64, alongside the SHA-256. The nested-object bug was two implementations disagreeing about the bytes. Shipping the bytes is the only thing that settles that."

v1.2.0 added the vector that separates a pinned trust anchor from trust-on-first-use, and machine-readable per-stage expectations.

v1.3.0 closes the three gaps in [the 2026-09-08 review](https://dev.to/edison_flores_6d2cd381b13/re-community-answers-to-12-unanswered-comments-across-9-articles-3ca9):

> "The reject side is defended now. The accept side is one card. [...] a runner that returns true for anything without an atc-v2 signature, hardcodes sha256 25b46086... as true, and returns false for the other five signed cards scores 11/11 while verifying nothing. [...] Any fixed set stays memorizable, so a generator is the stronger version of the same idea. [...] nothing in the suite punishes rejecting too much. [...] Compare the stage vector itself and count a stage mismatch as a failure." — @anp2network, 2026-09-08

All three are closed, and the 11 v1.2.0 vectors are **unchanged byte-for-byte** — every previously published verification result still holds.

## What's in here

For each vector `<id>`:

| File | Contents |
|------|----------|
| `<id>.json` | The original test vector (full credential with signature) |
| `<id>.canonical.txt` | The JCS-canonicalized payload as UTF-8 text |
| `<id>.bytes.hex` | The canonical bytes as hex |
| `<id>.bytes.base64` | The canonical bytes as base64 |
| `<id>.sha256` | The SHA-256 of the canonical bytes |

Plus `_index.json` — a manifest listing all vectors, their expected outcomes, expected stages, SHA-256s, signatures, the pinned trust anchor set, and every scoring rule.

**`_test-ca-keys.json` — the ca-test-2 private key is PUBLISHED.** That is the point of v1.3.0: anyone can re-derive signatures and generate unlimited fresh signed cards, so the accept side of the suite cannot be memorized.

Public keys published beside the vectors:

| File | Key |
|------|-----|
| `ca-test-1.pub.spki.b64` | Frozen v1.2.0 anchor. Its throwaway private key was discarded at generation time — the six v1.2.0 signed vectors are its complete output, forever. |
| `ca-test-2.pub.spki.b64` (+ `.raw32.hex` / `.raw32.b64`) | The **generator CA**. Private key in `_test-ca-keys.json`. Signs `valid-atc-2`, `valid-unknown-field`, and every card from `generate-accept-vectors.mjs`. |
| `ca-wrong-1.pub.spki.b64` | Second throwaway CA. It SIGNS the `wrong-ca` vector while the card CLAIMS ca-test-1 → fails at **signature verification**. |
| `ca-self-1.pub.spki.b64` | Attacker throwaway key. It is DECLARED in `self-signed-atc.payload.identity.public_key` AND signs the card → fails at **key selection** only. |

The **pinned trust anchor set** is `{ca-test-1, ca-test-2}` (`pinned_trust_anchors` in `_index.json`). `verify=true` REQUIRES `payload.identity.public_key` to be a member of the set and the signature to be produced by that member key. The set grew by exactly one key because ca-test-1 cannot ever sign a second accept card (its private key no longer exists) — which is precisely why the generator needed a new anchor.

## Canonicalization method

All vectors are canonicalized using **RFC 8785 JCS** (JSON Canonicalization Scheme):
- Recursive key sort by UTF-16 code unit
- JCS number handling (shortest round-trip)
- JCS string escaping

The signature is computed over the **whole document minus its top-level `signature` key** (`signed_subtree: "whole-document-minus-signature"`). `identity.public_key` lives INSIDE the signed subtree and must be a pinned anchor for `verify=true` (`key_selection_rule` in `_index.json`).

## How to verify

```bash
# 1. Byte-exact check
cat valid-atc.canonical.txt
shasum -a 256 valid-atc.canonical.txt   # matches valid-atc.sha256 AND _index.json

# 2. Signature check (Node ≥ 18, no dependencies)
node -e '
const crypto = require("node:crypto");
const card = require("./valid-atc.json");
const { signature, ...subtree } = card;
const jcs = (v) => JSON.stringify(v, (k, x) =>
  (x !== null && typeof x === "object" && !Array.isArray(x))
    ? Object.fromEntries(Object.entries(x).sort(([a],[b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : x);
const ca = crypto.createPublicKey({ key: Buffer.from(require("fs").readFileSync("ca-test-1.pub.spki.b64","utf8").trim(), "base64"), format: "der", type: "spki" });
const ok = crypto.verify(null, Buffer.from(jcs(subtree), "utf8"), ca, Buffer.from(signature.value, "hex"));
const keyOk = card.payload.identity.public_key === require("fs").readFileSync("ca-test-1.pub.spki.b64","utf8").trim();
console.log("signature:", ok, "| pinned-key match:", keyOk, "| verify:", ok && keyOk);'
```

## The generator (v1.3.0 — "any fixed set stays memorizable")

```bash
# 20 fresh accept cards, signed by ca-test-2, random content + random x_gen_* fields
node generate-accept-vectors.mjs --count 20 --seed 42 --out ./challenge

# unlimited reject challenges too
node generate-accept-vectors.mjs --mode self-signed --count 10 --out ./challenge-tofu
node generate-accept-vectors.mjs --mode wrong-ca     --count 10 --out ./challenge-anchor

# then score any runner against them
node ../score-runner.mjs --generated ./challenge
```

Every generated card self-verifies before it is emitted (fail-closed). `--seed` makes a run reproducible; without it, crypto-random. The scorer treats generated accept cards as must-accept and self-signed/wrong-ca cards as must-reject.

## The scorer (v1.3.0 — stage mismatches count as failures)

```bash
node ../score-runner.mjs                        # reference runner vs the 13 fixed vectors
node ../score-runner.mjs --matrix               # reproduce the separation table below
node ../score-runner.mjs --generated ./challenge
```

`stage_scoring_rule` (in `_index.json`): for every vector carrying `expected_stages`, the runner's per-stage outcomes are compared stage by stage. **Any stage mismatch marks the vector FAILED even when the boolean matches.** This kills the stage-liar runner — one that fires everything at `signature_verification` and still returns the right booleans.

## Vector inventory (v1.3.0 — 13 vectors)

Signed ATC family (Ed25519 by throwaway CAs, `expected_stages` in `_index.json`):

| Vector | signature_verification | trust_anchor_key_selection | expiry | status | expected_verify |
|---|---|---|---|---|---|
| `valid-atc` | pass | pass | pass | pass | **true** |
| `valid-atc-2` | pass | pass | pass | pass | **true** |
| `valid-unknown-field` | pass | pass | pass | pass | **true** |
| `invalid-signature` | **fail** | pass | pass | pass | false |
| `expired-atc` | pass | pass | **fail** | pass | false |
| `revoked-atc` | pass | pass | pass | **fail** | false |
| `wrong-ca` | **fail** (signed by ca-wrong-1) | pass (claims ca-test-1) | pass | pass | false |
| `self-signed-atc` | **pass** (signed by ca-self-1, its own declared key) | **fail** (declares ca-self-1 ∉ anchor set) | pass | pass | false |

- `valid-atc-2` — second accept card: different agent_id, capabilities, protocol_language, scores, issued_at, expires_at. Both canonical bytes and digest move, so acceptance must come from the rule, not recognition of `25b46086…`.
- `valid-unknown-field` — accept card carrying a permitted `x_uta_extension` field inside the signed subtree. Punishes over-rejection (`unknown_field_rule` in `_index.json`): false rejections no longer read as healthy.

Translation/validation family (no signature semantics, canonicalization-only): `valid-zta`, `valid-a2a`, `valid-mcp`, `atc-to-uts`, `uts-to-zta`.

## Runner separation matrix (reproducible: `node ../score-runner.mjs --matrix`)

| Runner | v1.2.0 (11) | v1.3.0 (13 fixed) | + generated cards |
|---|---|---|---|
| always-true | 6/11 | 8/13 | 5/5 ← caught on rejects only |
| policy-only (Ed25519 deleted) | 8/11 | 10/13 | 5/5 |
| crypto-only (no expiry/status) | 8/11 | 11/13 | 5/5 |
| embedded-key + policy (TOFU) | 10/11 | 12/13 | 5/5 |
| **memorizer (hardcodes valid-atc digest)** | **11/11** | 11/13 | **0/N** |
| **over-rejector (chokes on x_* fields)** | *invisible* (11/11) | 12/13 | **0/N** |
| **stage-liar (all fire at sig-verification)** | *invisible* (11/11 boolean) | 7/13 under stage scoring | 0/N |
| pinned-CA-set + policy + tolerance | **11/11** | **13/13** | **N/N** |

v1.2.0 made the reject side honest: deleting Ed25519, skipping key selection, or skipping policy each dropped the score. v1.3.0 makes the accept side honest: the memorizer that scored 11/11 by hardcoding the single accept digest now fails `valid-atc-2` and `valid-unknown-field`, and scores **0 against generated cards** — no fixed set survives a generator. Over-rejection is now a measured failure, and the stage vector itself is compared, so a runner cannot fire the wrong stage and keep its score.

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- RFC 8785 JCS: https://datatracker.ietf.org/doc/html/rfc8785
- Original test vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/spec/test-vectors
- Changelog: `updates` array in `_index.json` (v1.1.0 → v1.2.0 → v1.3.0)


## Third-party interop evidence (v1.6.0)

`third-party/` — two evidence vectors (`agentbouncer-transport-allowed`,
`agentbouncer-transport-denied`) + `_interop-index.json` + the source traces
(`traces_20261002_final.json`). These document a live interop test with AgentBouncer
(beta) over RFC 9421 signed transport with `x-uta-trust` as a covered component.
They are **not** scored cards and are not loaded by `score-runner.mjs`; the scored set
is the 14 vectors above, unchanged byte-for-byte.

- `agentbouncer-transport-allowed` — card ATC-2026-003701, `network.egress=allowlist`;
  AgentBouncer: verified/allowed; UTA: PASS (8/8 controls + caps match).
- `agentbouncer-transport-denied` — card ATC-2026-003702, `network.egress=none`;
  AgentBouncer: verified/allowed (transport fine); UTA: POLICY_FAIL — denial attributable
  to trust-policy, not transport. Both cards differ only in the caps entry (and
  card_id/timestamps/signature), making the differential variable explicit.
- `unsigned_control` inside each evidence doc: a request without a signature is rejected
  by AgentBouncer (`no_signature`), so the envelope verification is real.

## Adversarial window sampling (v1.7.0)

The 3ehcp critique was correct: after v1.3.3, `premature-atc` carried the
lower bound alone — one card, `issued_at` frozen at `2030-01-01`. A runner
could special-case that exact timestamp and still mishandle every other
issuance time in the future half-plane, and 0/60 future-dated cards was a
measurement of the generator, not of the runner's window.

`generate-accept-vectors.mjs --mode adversarial` now emits **correctly
signed, anchored, active** cards whose **only** defect is a violated
validity window, sampled as a distribution relative to the scoring clock:

| Bucket | Share | Range |
|---|---|---|
| future-issued (lower bound) | 55% | +2..7d (boundary band), +8..90d, +91..730d, +731..1460d |
| already-expired (upper bound) | 35% | expires today (`expires_at > NOW` at equality), 1..30d, 31..730d |
| empty window | 10% | `issued_at == expires_at` in the future |

Accept mode additionally issues **20% of cards TODAY** — the boundary-in
band. A runner using `<` instead of `<=`, or a clock-retarded runner,
silently rejects them, and the sidecar cross-check (which pins the
generation-time clock) turns that into a hard FATAL. Adversarial future
offsets floor at **+2 days** so a generated set stays re-scoreable across
midnight — the resulting `clock+1d` mutant survivor is a named, deliberate
trade-off, not an accident.

Fail-closed semantics are mirrored: in valid-card modes a window violation
is a FATAL; in adversarial mode a card that lands **IN** window is a FATAL
(the generator failed to produce the defect it exists to produce).

## Mutation testing (v1.7.0)

The hand-listed mutant catalogue was a closed set — our own memorizer
argument pointed at the test suite ("memorizing wins whenever the set it
has to cover is closed and small"). `mutate-runner.mjs` replaces it with
generation: a declared operator set applied mechanically at every
applicable site on the scored path of `score-runner.mjs`, every mutant
actually executed against the full suite.

```bash
node vectors/generate-accept-vectors.mjs --mode adversarial --count 40 --seed 7 --out .gen-adv
node mutate-runner.mjs --generated .gen-adv --out mutation-survivors.json
```

Classification is mechanical — no judgment calls:

- **caught** — the suite fails under the mutant (exit != 0);
- **equivalent-on-suite** — exit 0 with byte-identical `--json` output
  (suite-equivalence, not true equivalence, is the honest claim);
- **observable-escape** — exit 0 with changed output. Each one names a
  check the suite does not enforce.

Current published state (**46 mutants: 40 caught, 6 equivalent, 0
observable** — see `../mutation-survivors.json`):

- `clock+1d` survives — the deliberate midnight-portability trade-off
  (adversarial offsets floor at +2d; catching a +1d clock shift would cost
  re-scoreability of generated sets).
- The meta-integrity check that guards the other checks can itself be
  disabled — **self-verification bottoms out somewhere**, which is exactly
  why external cross-anchoring (Rekor side, queued) is the exit, not more
  internal checks.
- The rest are dead-path-under-`--json`, error-message-only, or provably
  order-neutral JCS comparator mutants on this suite.

Derived-truth tightening shipped in the same release, each one closing a
hole the mutation run itself found: `--generated` on the command line that
is not parsed or yields 0 cards is now a FATAL (a silently-ignored input
used to be a green run); every sidecar cross-check is bound to the card
bytes via sha256 (on a uniform set, cross-checking the WRONG row still
agreed on `expected_verify`); and the runner counts its own checks —
byte-exactness, sidecar and stage cross-checks must each run exactly once
per entry, a skipped check is a FATAL, not a green run.
