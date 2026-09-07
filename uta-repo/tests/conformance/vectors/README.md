# UTA Conformance Vectors — Canonical Bytes

This directory contains the canonical bytes for each UTA conformance test vector.

## Why this exists

@anp2network asked (three times) for the canonical bytes to be published alongside the SHA-256, so an external verifier can reproduce signature verification without guessing the preimage.

> "One ask on format: record the canonical JCS bytes per vector as hex or base64, alongside the SHA-256. The nested-object bug was two implementations disagreeing about the bytes. Shipping the bytes is the only thing that settles that."

v1.2.0 adds the vector that separates a pinned trust anchor from trust-on-first-use, and machine-readable per-stage expectations:

> "The two perfect scores are the thing. A runner that pins ca-test-1 and a runner that trusts whatever key the card declares both score 10/10 on this suite. [...] The shortcut you killed at signature verification came back one level up, at key selection." — @anp2network, 2026-09-08

## What's in here

For each vector `<id>`:

| File | Contents |
|------|----------|
| `<id>.json` | The original test vector (full credential with signature) |
| `<id>.canonical.txt` | The JCS-canonicalized payload as UTF-8 text |
| `<id>.bytes.hex` | The canonical bytes as hex |
| `<id>.bytes.base64` | The canonical bytes as base64 |
| `<id>.sha256` | The SHA-256 of the canonical bytes |

Plus `_index.json` — a manifest listing all vectors, their expected outcomes, expected stages, SHA-256s, and signatures.

Public keys published beside the vectors:

| File | Key |
|------|-----|
| `ca-test-1.pub.spki.b64` | The pinned trust anchor. `verify=true` REQUIRES `payload.identity.public_key` to equal this key, and the signature to be produced by it. |
| `ca-test-1.pub.raw32.hex` / `.b64` | The same key as raw 32 bytes. |
| `ca-wrong-1.pub.spki.b64` | Second throwaway CA. It SIGNS the `wrong-ca` vector while the card CLAIMS ca-test-1 → fails at **signature verification**. |
| `ca-self-1.pub.spki.b64` | Attacker throwaway key. It is DECLARED in `self-signed-atc.payload.identity.public_key` AND signs the card → fails at **key selection** only. |

## Canonicalization method

All vectors are canonicalized using **RFC 8785 JCS** (JSON Canonicalization Scheme):
- Recursive key sort by UTF-16 code unit
- JCS number handling (shortest round-trip)
- JCS string escaping

The signature is computed over the **whole document minus its top-level `signature` key** (`signed_subtree: "whole-document-minus-signature"`). `identity.public_key` lives INSIDE the signed subtree and must equal `ca-test-1` for `verify=true` (`key_selection_rule` in `_index.json`).

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

## Vector inventory (v1.2.0 — 11 vectors)

Signed ATC family (Ed25519 by throwaway CAs, `expected_stages` in `_index.json`):

| Vector | signature_verification | trust_anchor_key_selection | expiry | status | expected_verify |
|---|---|---|---|---|---|
| `valid-atc` | pass | pass | pass | pass | **true** |
| `invalid-signature` | **fail** | pass | pass | pass | false |
| `expired-atc` | pass | pass | **fail** | pass | false |
| `revoked-atc` | pass | pass | pass | **fail** | false |
| `wrong-ca` | **fail** (signed by ca-wrong-1) | pass (claims ca-test-1) | pass | pass | false |
| `self-signed-atc` | **pass** (signed by ca-self-1, its own declared key) | **fail** (declares ca-self-1 ≠ ca-test-1) | pass | pass | false |

Translation/validation family (no signature semantics, canonicalization-only): `valid-zta`, `valid-a2a`, `valid-mcp`, `atc-to-uts`, `uts-to-zta`.

`expected_verify` alone folds signature validity with policy validity — `expected_stages` (machine-readable, in `_index.json`) says which stage fires.

## Runner separation matrix (why self-signed-atc exists)

Scoring runner variants against this suite (methodology from @anp2network's independent run):

| Runner | v1.1.0 (10 vectors) | v1.2.0 (11 vectors) |
|---|---|---|
| always-true | 6/10 | 6/11 |
| policy-only (Ed25519 deleted) | 8/10 | 8/11 |
| crypto-only (no expiry/status) | 8/10 | 8/11 |
| embedded-key + policy (trust-on-first-use) | **10/10** | **10/11** ← fails `self-signed-atc` |
| pinned-CA-key + policy | **10/10** | **11/11** |

On v1.1.0 the top two rows tie, so the suite could not tell an implementer whether `identity.public_key` is a key to trust or a claim to check. On v1.2.0 they separate: `self-signed-atc` declares an attacker key and signs with it, so a runner that verifies against the card's declared key (TOFU) passes a card it has no business passing. Its twin `wrong-ca` (claims the right key, signed by someone else) fails at signature verification instead — the pair pins down both failure modes.

The floor: any runner that skips either real signature verification or the key-selection comparison now drops below 10/11.

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- RFC 8785 JCS: https://datatracker.ietf.org/doc/html/rfc8785
- Original test vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/spec/test-vectors
- Changelog: `updates` array in `_index.json` (v1.1.0 → v1.2.0)
