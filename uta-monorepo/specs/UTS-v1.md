# Universal Trust Schema (UTS) v1.0

**Status:** Draft 00
**Issued:** 2026-08-20
**License:** MIT
**Editors:** Edison Flores, Alejandro Flores — AliceLabs LLC

---

## What is UTS?

Universal Trust Schema (UTS) is the **canonical internal representation** that all trust formats (ATC, EAT-AI, ZTA, A2A, MCP, W3C VC, OAuth) translate to and from. Like Unicode is the internal format of all OSes, UTS is the internal format of trust data.

- UTS is **not** an output format. Nobody emits raw UTS.
- UTS is **not** a competing standard. It's a translation layer.
- UTS is **the** schema that the Universal Trust Adapter (UTA) uses internally.

## Why UTS exists

Each trust format has different field names, structures, and semantics:

| Concept | ATC v2.0 | EAT-AI | ZTA | A2A AgentCard | MCP Server Card |
|---|---|---|---|---|---|
| Subject identifier | `credential_subject.skill_id` | `sub` (CWT claim) | `agent_id` | `name` | `name` |
| Public key | `credential_subject.public_key` | `cnf.jwk` | `identity.public_key` | `public_key` | `keys` |
| Trust score | `attestation.score` | `trust_score` | `trust.score` | (none) | (none) |
| Issuance date | `issuance_date` | `iat` | `metadata.issued_at` | `issued_at` | `created_at` |
| Capabilities | (none) | (none) | `capabilities.provides` | `capabilities` | `tools` |

Without UTS, every pair of formats needs a custom translator (5 formats = 20 translators). With UTS, every format needs one adapter (5 formats = 5 adapters). This is the same pattern as i18n: each language has one translator to a canonical format, not to every other language.

## The schema

See `uts-v1.json` for the JSON Schema. Highlights:

- **subject**: who is this entity (id, name, type, description)
- **identity**: how do we verify identity (public_key, key_algorithm, attestation, oauth_subject, did)
- **trust**: how much do we trust (score, confidence, evidence[], assessor, assessed_at)
- **capabilities**: what can it do (provides, requires, protocols, rate_limits)
- **policy**: what is allowed (max_spend_usd, allowed_actions, denied_actions, allowed_networks, filesystem_access, shell_access)
- **provenance**: where did it come from (source, source_url, artifact_hash, commit_sha, registry_id)
- **lifecycle**: when is it valid (issued_at, expires_at, revoked, revocation_url, version)
- **format**: metadata about the source format (type, version, raw)

## Translation rules

Each adapter implements 2 functions:

```typescript
function fromNative(payload: any): UniversalTrustSchema
function toNative(uts: UniversalTrustSchema): any
```

### Translation matrix

| From \ To | ATC v3 | EAT-AI | ZTA | A2A | MCP | W3C VC | OAuth |
|---|---|---|---|---|---|---|---|
| **ATC v3** | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **EAT-AI** | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| **ZTA** | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| **A2A** | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| **MCP** | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| **W3C VC** | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| **OAuth** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |

7 formats = 42 translation pairs. Each is computed as `toNative(fromNative(payload))` — no pair-specific code.

## Lossy fields

Some fields don't translate cleanly. Each adapter documents what's lost:

- **ATC → MCP Server Card**: ATC's `trust_claims.owasp_top_10` has no equivalent in MCP. Lost in translation.
- **ZTA → ATC**: ZTA's 8-phase implementation workflow has no ATC equivalent. Lost.
- **EAT-AI → A2A**: EAT's `ueid` (TEE attestation) has no A2A equivalent. Lost.

In each case, the data is preserved in the `format.raw` field for round-trip translation.

## Use cases

### 1. Bridge two ecosystems

```typescript
// An Anthropic ZTA credential is verified and re-issued as ATC v3
const ztaPayload = loadFromAnthropicAPI();
const uts = engine.fromNative('zta', ztaPayload);
const atcV3 = engine.toNative('atc-v3', uts);
// atcV3 is now a valid ATC v3.0 credential
```

### 2. Auto-detect and verify any format

```typescript
const payload = /* any: JSON, CBOR, base64 */;
const result = engine.verifyAny(payload);
// → { format: 'eat-ai', valid: true, uts: {...} }
```

### 3. Issue in multiple formats simultaneously

```typescript
const credentials = engine.issue({
  subject: { id: 'my-agent', type: 'agent' },
  trust: { score: 8, evidence: [...] },
  formats: ['atc-v3', 'eat-ai', 'zta', 'a2a-card'],
});
// → { atc: {...}, eat: Uint8Array, zta: {...}, a2a: {...} }
```

## Versioning

UTS uses semver. v1.0 is the initial publication. Future versions:

- **v1.1**: add new optional fields (no breaking changes)
- **v2.0**: breaking changes (require new adapters)

Adapters declare which UTS version they support.

## License

MIT. Anyone can implement UTS without permission.

— Edison & Alejandro Flores, AliceLabs LLC, 2026-08-20
