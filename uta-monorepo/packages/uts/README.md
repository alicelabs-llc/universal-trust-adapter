# @marketnow/uts

**Universal Trust Schema (UTS) v2** — the canonical trust data model for AI agents. One JSON document describing *who an agent is, what evidence backs it, what it can do, what it is allowed to do, where it came from, when it is valid, and how its trust score was computed*.

Zero dependencies. Ships a machine-checkable JSON Schema (draft 2020-12) plus full TypeScript types.

Part of the [MarketNow](https://marketnow.site) / Universal Trust Adapter (UTA) stack — works standalone, no other packages required.

## Why UTS v2

Trust claims are usually a single opaque number. UTS v2 replaces that with **separated, independently verifiable concerns**:

| Concern | Question it answers |
|---|---|
| Identity | Who is this agent? (public keys) |
| Attestations | What signed evidence exists? |
| Capabilities | What can it do / does it need? |
| Policies | What is it allowed to do? |
| Provenance | Where did it come from? |
| Lifecycle | When is it valid? |
| Assessment | How was the score computed? |

The assessment score is **NOT "trust"** — it is a reproducible computation linked to hashes of signed evidence, so any verifier can recompute it.

## Install

```bash
npm install @marketnow/uts
```

## Quick start

```js
const { UTS_VERSION, UTS_V2_JSON_SCHEMA } = require('@marketnow/uts');

// Validate a UTS document with any JSON Schema validator
const Ajv = require('ajv');            // or ajv, tv4, your own validator
const ajv = new Ajv();
const validate = ajv.compile(UTS_V2_JSON_SCHEMA);

const ok = validate({
  uts_version: '2.0.0',
  subject: { id: 'did:example:agent-1', name: 'example-agent', type: 'mcp-server' },
  identity: { public_keys: [{ kid: 'k1', kty: 'Ed25519', use: 'sig' }] },
  attestations: [],
  capabilities: { provides: [], requires: [], protocols: ['mcp'] },
  policies: [],
  provenance: { source: 'https://example.com/agent.json' },
  lifecycle: { valid_from: '2026-01-01T00:00:00Z' },
  assessment: {},
  format: 'uts/2.0'
});
```

## API

| Export | Description |
|---|---|
| `UTS_VERSION` | Schema version constant (`'2.0.0'`) |
| `UTS_V2_JSON_SCHEMA` | Full JSON Schema (draft 2020-12) for UTS v2 documents |
| `UTSv2` (types) | TypeScript interfaces: `UTSSubject`, `UTSIdentity`, `UTSAttestation`, `UTSEvidence`, `UTSCapabilities`, `UTSPolicy`, `UTSProvenance`, `UTSLifecycle`, `UTSAssessment`, `UTSFormat` |

### Attestation types

Attestations carry typed evidence: `sentinel-audit`, `static-analysis`, `sandbox-test`, `human-review`, `on-chain-verification`, `tee-attestation`, `owasp-mcp-scan`, `runtime-observation`, `slsa-provenance`, `sigstore-signature`, `sbom-analysis`.

## Ecosystem

- `@marketnow/trust-core` — full 12-stage verification pipeline built on UTS
- `@marketnow/trust-gateway` — MCP middleware enforcing UTS policies on tool calls
- `marketnow-mcp` — MCP server exposing the MarketNow catalog (68,387+ verified servers)

## License

Dual-licensed under **MIT OR Apache-2.0, at your option** — free for any use, including
commercial use. This repo and all MarketNow npm packages (marketnow-mcp v1.14.0+,
agent-trust-card v1.4.0+, @marketnow/*) ship dual-licensed: see
[LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
Trademarks ("MarketNow", "UTA", "ATC") are reserved by AliceLabs LLC — see [NOTICE](NOTICE).
