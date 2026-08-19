# ATC SDK

> **Issue and verify Agent Trust Cards in 5 minutes.** A tiny (~5KB), framework-agnostic SDK for the [ATC/1.0 specification](https://marketnow.site/atc). Works in any JavaScript runtime that supports `node:crypto` (Node.js >=18, Bun, Deno).

[![npm version](https://img.shields.io/npm/v/agent-trust-card.svg)](https://www.npmjs.com/package/agent-trust-card)
[![License: AliceLabs Proprietary](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)
[![Spec: ATC/1.0](https://img.shields.io/badge/Spec-ATC%2F1.0-brightgreen)](https://marketnow.site/atc)

---

## What is ATC?

ATC (Agent Trust Card) is **SSL certificates for AI agents** — a cryptographic credential that lets an agent prove its identity, declare its capabilities, and carry its security audit evidence. Any peer agent can verify it offline without calling home.

- **Spec**: [ATC/1.0](https://marketnow.site/atc) — 10 controls (8 required, 2 optional)
- **Crypto**: Ed25519 (RFC 8032) signatures + RFC 8785 JCS canonical JSON + SHA-256
- **License**: MNNC-1.0 (AliceLabs LLC Proprietary). The spec is open; the SDK is proprietary.

---

## Install

```bash
npm install agent-trust-card
# or use without install:
npx agent-trust-card verify card.json
```

---

## Quick start (5 minutes)

### 1. Generate keys

```bash
npx atc init > keys.json
```

```json
{
  "ca": {
    "publicKey": "MCowBQYDK2VwAyEA...",
    "privateKey": "MC4CAQAwBQYDK2VwBCIEI..."
  },
  "agent": {
    "publicKey": "MCowBQYDK2VwAyEA...",
    "privateKey": "MC4CAQAwBQYDK2VwBCIEI..."
  }
}
```

### 2. Issue a card

```javascript
import { generateKeyPair, issueATC } from 'agent-trust-card';

const ca = generateKeyPair();
const agent = generateKeyPair();

const atc = issueATC(ca, agent, {
  card_id: 'ATC-2026-0000001',
  identity: {
    agent_id: 'my-bot',
    agent_name: 'My Bot',
    agent_owner: 'My Org',
  },
  capabilities: {
    filesystem: { read: 'own_dir', write: 'own_dir' },
    network: { egress: 'allowlist', ingress: 'none' },
    shell: { exec: 'sandboxed', spawn: 'none' },
    credentials: { read_env: 'none', read_files: 'none' },
    process: { subprocess: 'none', signals: 'own' },
  },
  evidence: { /* ... see spec ... */ },
  risk: {
    trust_score: 9,
    risk_level: 'low',
    score_explanation: 'Clean audit',
    scored_at: new Date().toISOString(),
  },
});

console.log(JSON.stringify(atc, null, 2));
```

### 3. Verify a card

```javascript
import { verifyATC } from 'agent-trust-card';

const result = verifyATC(atc);

if (!result.valid) {
  throw new Error(`Untrusted agent: ${result.errors.join(', ')}`);
}

console.log(`✓ ${atc.card_id} — ${result.controls_passed.length}/8 controls passed`);
```

### 4. CLI

```bash
# Generate keys
npx atc init > keys.json

# Issue
npx atc issue --ca ca.json --agent agent.json --payload payload.json --out card.json

# Verify
npx atc verify card.json

# Inspect
npx atc inspect card.json
```

---

## API reference

### `generateKeyPair()`

Returns `{ publicKey, privateKey, rawPublicKey, rawPrivateKey }`. Uses `node:crypto` Ed25519 (RFC 8032).

### `loadKeyPairFromPrivate(base64PrivateKey)`

Reconstructs a keypair from a saved private key. Useful for CAs that persist their key across sessions.

### `issueATC(caKeyPair, agentKeyPair, partialPayload)`

Signs an ATC. Returns the complete, signed ATC document. See [ATC-006 in the spec](https://marketnow.site/atc) for the signature process.

### `verifyATC(atc, options?)`

Verifies an ATC against ATC/1.0. Returns:

```typescript
{
  valid: boolean,
  spec_version: string,
  controls_passed: string[],   // e.g. ['ATC-001', 'ATC-002', ..., 'ATC-008']
  controls_failed: string[],
  errors: string[],
  warnings: string[],
  card_id: string,
  issuer_ca_id: string,
  trust_score: number | null,
  risk_level: string | null,
  expires_at: string | null,
  agent_id: string | null,
  agent_name: string | null,
}
```

`options.ca_public_key` — Override the CA public key (base64 SPKI). Use this when you have an out-of-band trusted CA key and want to detect CA substitution attacks.

`options.fetch_revocation` — Not yet implemented. The verifier checks structural fields only. If `revocation_check_required=true`, the caller must fetch the revocation list at `atc.revocation.revocation_check_url` separately.

### `canonicalizeATC(atc)`

Returns the RFC 8785 JCS canonical form of the ATC (with signature + hash blanked).

### `computePayloadHash(atc)`

Returns the hex SHA-256 of the canonical payload.

---

## The 8 required controls

| # | ID | What it checks |
|---|----|----------------|
| 1 | ATC-001 | Identity — `agent_id`, `agent_name`, `agent_owner` are present and well-formed |
| 2 | ATC-002 | Attestation — `subject_public_key`, `subject_algorithm=Ed25519`, `signature`, `signed_payload_hash` are present and well-formed |
| 3 | ATC-003 | Capabilities — 5 categories (filesystem, network, shell, credentials, process) × 2-3 sub-fields each, every value validated against an enum |
| 4 | ATC-004 | Evidence — audit pipeline output, findings array with severity |
| 5 | ATC-005 | Risk — `trust_score` 0-10, `risk_level` low/medium/high/critical, `decision_authority=consumer` |
| 6 | ATC-006 | Signature — Ed25519 over RFC 8785 JCS canonical form, SHA-256 hash match |
| 7 | ATC-007 | Revocation — `revocation_check_url`, `revocation_check_method` (ocsp/crl/simple_json), `revocation_check_required` |
| 8 | ATC-008 | Expiration — `issued_at`, `expires_at`, `max_ttl_days` (1-365), ±5min clock skew tolerance |

---

## CLI reference

```bash
atc init                                    Generate a CA + agent keypair (JSON to stdout)
atc issue --ca <key.json> \
          --agent <key.json> \
          --payload <payload.json> \
          [--out <card.json>]              Issue (sign) an ATC
atc verify <card.json>                      Verify an ATC — exits 0 if valid, 1 if invalid
atc inspect <card.json>                     Pretty-print an ATC summary
atc canonical <card.json>                   Print the RFC 8785 JCS canonical form
atc hash <card.json>                        Print the SHA-256 of the canonical payload
atc help                                    Show this message
```

---

## Conformance

A conformant ATC/1.0 implementation MUST pass all 8 required controls. The conformance test suite is in [`test/conformance.mjs`](./test/conformance.mjs). Run it with:

```bash
git clone https://marketnow.site/atc.git
cd marketnow/atc-sdk
npm install
npm test
```

See [`CONFORMANCE.md`](./CONFORMANCE.md) for the full conformance matrix.

---

## Badge

If your project implements ATC/1.0, you can add this badge to your README:

```markdown
[![ATC Compatible](https://marketnow.site/badges/atc-compatible.svg)](https://marketnow.site/atc)
```

![ATC Compatible](./badges/atc-compatible.svg)

---

## Why ATC/1.0?

The market is converging on agent trust infrastructure from multiple directions — Microsoft AutoGen, OpenAI Cookbook, A2A Agent Cards, OpenA2A AIP, OATI, and others. ATC/1.0 is the first formal, versioned, testable specification for Agent Trust Cards.

See:
- [PRIOR-ART-TIMELINE.md](https://marketnow.site/atc) — honest chronology of ATC and adjacent work
- [SPEC.md](https://marketnow.site/atc) — the full specification
- [dev.to article](https://dev.to/edison_flores_6d2cd381b13/atc10-shipping-a-formal-spec-for-agent-trust-cards-instead-of-arguing-about-who-invented-them-h0l) — the strategic framing

---

## License

- **SDK source code** (`src/`, `bin/`): MNNC-1.0 (AliceLabs LLC Proprietary)
- **Test vectors** (`test/`): CC0 (public domain)
- **Specification** (in `docs/atc-spec/`): W3C CG-FSA (open for community contribution)

For licensing: legal@alicelabs.site

Built by AliceLabs LLC (Wyoming, USA) — founder Edison Flores.
