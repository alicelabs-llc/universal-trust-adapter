# Contributing to ATC/1.0

Thanks for your interest in contributing! This document covers the basics.

## Code of conduct

Be technical, be honest, be respectful. Disagreements are productive when they're about the work.

## Ways to contribute

### 1. Run the conformance suite

```bash
git clone https://github.com/alicelabs-llc/universal-trust-adapter
cd universal-trust-adapter/marketnow/atc-sdk
npm install
node test/conformance.mjs
```

If you see any failures, open an issue.

### 2. Run an independent verifier

The test vectors at `marketnow/docs/atc-spec/test-vectors/` are designed to be verifiable in any language that supports Ed25519 + RFC 8785 JCS.

1. Read `_index.json` for canonical bytes, SHA-256, and expected verification outcomes
2. Read `_test-ca-keys.json` for the test CA public + private keys (intentionally published for cross-language reproducibility)
3. Implement (or use an existing) RFC 8785 JCS implementation in your language
4. Apply JCS to each vector's ATC payload (with `attestation.signature=""` and `attestation.signed_payload_hash=""`)
5. Compute SHA-256 of canonical bytes — should match `sha256` in `_index.json`
6. Verify Ed25519 signature with CA public key — should match expected outcome

If your verifier produces different bytes for any vector, **that's the most valuable contribution you can make**. Open an issue with:
- Which vector
- Your language and JCS implementation
- The bytes you computed
- The bytes in `_index.json`

### 3. Add test vectors

The current 5 vectors cover the obvious failure classes. We need more:
- Nested objects deeper than 2 levels
- Unicode payloads (CJK, RTL, combining characters)
- Large card sizes (10KB+)
- Multi-sig scenarios (when implemented)

Add a new vector to `marketnow/docs/atc-spec/test-vectors/`, regenerate `_index.json` by running `node scripts/gen_canonical_vectors_v3.mjs`, and submit a PR.

### 4. Implement ATC in another language

Currently supported: Node.js (reference impl in `marketnow/atc-sdk/`).

Needed:
- Python SDK
- Rust crate
- Go package

The test CA keypair is published, so you can verify your implementation against the same vectors.

### 5. Report security issues

**Do NOT open a public issue for security vulnerabilities.**

Email security@alicelabs.site with:
- Description of the vulnerability
- Affected component (spec, SDK, conformance runner, etc.)
- Reproduction steps
- Suggested fix (if any)

We'll acknowledge within 24 hours and triage within 72 hours.

## Pull requests

1. Fork the repo
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Run tests: `node test/conformance.mjs` (must pass)
5. If adding a new test vector, regenerate `_index.json`
6. Commit with a clear message
7. Open a PR

### Commit message format

```
feat: add multi-sig support for ATC-006

Implements N-of-M CA signatures as specified in ATC/1.0 §6.3.
Updates conformance suite with 4 new test vectors.
```

### License

By contributing, you agree that your contributions will be licensed under the AL-1.0 (AliceLabs Source-Available License v1.0) for the engine/sentinel/interceptor layers, MIT for the plugin template, and CC-BY-NC-ND 4.0 for the UTS specification.

— Edison Flores, AliceLabs LLC
