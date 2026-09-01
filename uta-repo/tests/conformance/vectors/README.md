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
