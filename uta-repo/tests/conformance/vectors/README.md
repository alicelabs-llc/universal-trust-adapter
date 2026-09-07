# UTA Conformance Vectors — Canonical Bytes

This directory contains the canonical bytes for each UTA conformance test vector.

## Why this exists

@anp2network asked (three times) for the canonical bytes to be published alongside the SHA-256, so an external verifier can reproduce signature verification without guessing the preimage.

> "One ask on format: record the canonical JCS bytes per vector as hex or base64, alongside the SHA-256. The nested-object bug was two implementations disagreeing about the bytes. Shipping the bytes is the only thing that settles that."

## What's in here

For each vector `<id>`:

| File | Contents |
|------|----------|
| `<id>.json` | The original test vector (full credential with signature) |
| `<id>.canonical.txt` | The JCS-canonicalized payload as UTF-8 text |
| `<id>.bytes.hex` | The canonical bytes as hex |
| `<id>.bytes.base64` | The canonical bytes as base64 |
| `<id>.sha256` | The SHA-256 of the canonical bytes |

Plus `_index.json` — a manifest listing all vectors, their expected outcomes, SHA-256s, and signatures.

## Canonicalization method

All vectors are canonicalized using **RFC 8785 JCS** (JSON Canonicalization Scheme):
- Recursive key sort by UTF-16 code unit
- JCS number handling (shortest round-trip)
- JCS string escaping

The signature fields (`attestation`, `signature`, or `proof`) are **stripped** before canonicalization — the signature is computed over the payload without the signature field.

## How to verify

```bash
# 1. Read the canonical bytes
cat valid-atc.canonical.txt

# 2. Compute SHA-256
shasum -a 256 valid-atc.canonical.txt
# Should match valid-atc.sha256

# 3. Verify the signature (Ed25519)
# Using the CA public key from the spec:
# - Take the canonical bytes
# - SHA-256 them
# - Verify the Ed25519 signature from the vector's attestation.signature
```

## Vector inventory

- `valid-atc` (valid, atc-v2): 649 bytes, SHA-256 `c48ec58dec856ca5...`, expected_verify=True
- `invalid-signature` (invalid, atc-v2): 653 bytes, SHA-256 `984e10cac94a0b0d...`, expected_verify=False
- `expired-atc` (invalid, atc-v2): 645 bytes, SHA-256 `b97f943539cab9fa...`, expected_verify=False
- `revoked-atc` (invalid, atc-v2): 684 bytes, SHA-256 `8a8126408754b4cc...`, expected_verify=False
- `valid-zta` (valid, zta): 499 bytes, SHA-256 `5bc2f576c8f0182b...`, expected_verify=True
- `valid-a2a` (valid, a2a-card): 319 bytes, SHA-256 `270b572585b581ee...`, expected_verify=True
- `valid-mcp` (valid, mcp-card): 227 bytes, SHA-256 `bb3eb6d4a861017c...`, expected_verify=True
- `atc-to-uts` (translation, ?): 957 bytes, SHA-256 `8415c5ae43198866...`, expected_verify=True
- `uts-to-zta` (translation, ?): 437 bytes, SHA-256 `f8e041e4b4a17f85...`, expected_verify=True


## Total: 9 vectors

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- RFC 8785 JCS: https://datatracker.ietf.org/doc/html/rfc8785
- Original test vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/spec/test-vectors

## Attribution

Published in response to @anp2network's feedback (asked 3 times across 3 comments).

---

## v1.1.0 — Real signatures (2026-09-08)

Responds to @anp2network (dev.to comment 3e1j6, 2026-09-02): *"Sign the vectors with a throwaway CA keypair, publish the 32 bytes of public key beside them, and add one wrong-key vector so a runner that skips verification fails instead of passing."*

### What changed

- **All 4 ATC vectors are now signed with a real throwaway Ed25519 CA** (`ca-test-1`). Placeholder signatures (`0xab` bytes) and the truncated 12-byte SPKI header are gone.
- **The test CA public key is published in this directory**:
  - `ca-test-1.pub.spki.b64` — full SPKI (44 bytes, base64) — this is what `identity.public_key` / `ca_key_id` in each card equals
  - `ca-test-1.pub.raw32.hex` — the raw 32-byte public key
  - `ca-test-1.pub.raw32.b64` — the raw 32-byte public key, base64
- **New anti-shortcut vector `wrong-ca`**: a card whose metadata is fully valid (active, unexpired) but is signed by a **second** throwaway CA (`ca-wrong-1`, published for reference only) while claiming `ca-test-1`. A conformance runner that deletes Ed25519 verification cannot fail this card. Every expected verdict now requires either doing the cryptographic work or reading `expected_verify` from the manifest.
- **The signed subtree is now stated, not discovered**: the signature covers the JCS-canonicalized document **with its top-level `signature` key removed** (whole card minus signature). `identity.public_key` is *inside* the signed subtree and must equal `ca-test-1` for `verify=true`. This rule is recorded per-vector in `_index.json` (`signed_subtree`) and globally in `signed_subtree_rule`.

### Signature-layer expectations

| Vector | Ed25519 signature | Final verdict | Why |
|--------|------------------|---------------|-----|
| `valid-atc` | valid | `true` | signature verifies against `ca-test-1` |
| `expired-atc` | valid | `false` | fails the expiry stage (expires 2020-01-01) |
| `revoked-atc` | valid | `false` | fails the revocation stage (status: revoked) |
| `invalid-signature` | **invalid** (one flipped byte) | `false` | real signature with byte 10 xor 0x5a |
| `wrong-ca` | **invalid vs claimed CA** | `false` | real signature by `ca-wrong-1`, claims `ca-test-1` |

A runner that skips verification passes `valid-atc` trivially but must also pass `expired-atc`/`revoked-atc`/`invalid-signature`/`wrong-ca` — and without crypto it has no way to fail the last two.

### Verify in Node.js (no dependencies)

```js
import crypto from 'node:crypto';
import fs from 'node:fs';

const ca = fs.readFileSync('ca-test-1.pub.spki.b64', 'utf8').trim(); // claimed CA
const card = JSON.parse(fs.readFileSync('valid-atc.json', 'utf8'));
const { signature, ...signed } = card;                              // whole card minus signature
const canonical = JSON.stringify(signed, replacer);                 // JCS: recursive key sort
const keyObj = crypto.createPublicKey({ key: Buffer.from(ca, 'base64'), format: 'der', type: 'spki' });
const ok = crypto.verify(null, Buffer.from(canonical, 'utf8'), keyObj, Buffer.from(signature.value, 'hex'));
console.log(ok); // true
```

(JCS replacer: recursively sort object keys; these documents contain no exotic numbers, so `JSON.stringify` with sorted keys is RFC 8785-conformant here.)

### Verify the SHA-256 chain

```bash
sha256sum valid-atc.canonical.txt   # matches valid-atc.sha256 and _index.json
```

### Scope of `ca-test-1`

`ca-test-1` is a **throwaway, vectors-only keypair**. It has never signed a production credential, is not in any key registry, and is published so third parties can independently verify these fixtures. Production CA keys are separate and governed by the rotation policy discussed in the key-registry thread.
