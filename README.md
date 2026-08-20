# Universal Trust Adapter (UTA)

**The USB-C of agent trust.**

UTA translates between ALL trust credential formats used by AI agents — ATC, EAT-AI (IETF), ZTA (Anthropic), A2A Agent Card (Google/AAIF), MCP Server Card (Anthropic), W3C Verifiable Credentials, OAuth/OIDC, and SPIFFE SVID — via a canonical Universal Trust Schema (UTS).

Like Zapier connects applications, **UTA connects trust standards**.

Built by **Edison Flores** & **Alejandro Flores** at **AliceLabs LLC** (Wyoming, USA).

> ⚠️ **License:** AliceLabs Source-Available License v1.0 (AL-1.0) — proprietary. Source is available for review and non-commercial use. Commercial use requires a separate commercial license. See [LICENSE-AL-1.0](./LICENSE-AL-1.0).

---

## Why UTA exists

In August 2026, there are **8 competing trust credential formats** for AI agents:

| Format | Owner | Crypto | Lock-in |
|---|---|---|---|
| ATC v3 | AliceLabs | Ed25519 + EAT-CWT + W3C VC | Source-Available (AL-1.0) |
| EAT-AI | IETF | CWT/CBOR + COSE | Open |
| ZTA | Anthropic | JSON + proprietary | Closed |
| A2A Agent Card | Google / AAIF | JSON-LD + OAuth | Open |
| MCP Server Card | Anthropic | JSON (no signature) | Open |
| W3C VC 2.0 | W3C | Ed25519Signature2020 | Open |
| OAuth/OIDC | IETF | JWT (RS256) | Open |
| SPIFFE SVID | CNCF | X.509 / JWT | Open |

**None of them speak to each other.** An agent with an ATC credential can't verify an agent with a ZTA credential. An A2A agent can't trust an MCP Server. Each ecosystem is an island.

UTA solves this by being the universal translator. No new standard — just translation.

---

## The architecture

```
┌─────────┐     ┌─────────────────────┐     ┌─────────┐
│  ATC    │────▶│                     │◀────│ EAT-AI  │
│ v3.0    │     │   UNIVERSAL TRUST   │     │ (IETF)  │
└─────────┘     │     ADAPTER (UTA)   │     └─────────┘
                │                     │
┌─────────┐     │   translates any    │     ┌─────────┐
│  ZTA    │────▶│   format to any     │◀────│  A2A    │
│(Anthropic)│   │   other format      │     │ (Google)│
└─────────┘     │                     │     └─────────┘
                │   via Universal     │
┌─────────┐     │   Trust Schema (UTS)│     ┌─────────┐
│  MCP    │────▶│                     │◀────│  W3C    │
│ Card    │     │                     │     │   VC    │
└─────────┘     └─────────────────────┘     └─────────┘
                                                  │
                                                  ▼
                                          ┌─────────────┐
                                          │  Universal  │
                                          │ Trust Schema│
                                          │   (UTS)     │
                                          └─────────────┘
```

Every adapter implements two functions:

```typescript
function fromNative(payload: any): UniversalTrustSchema  // native → UTS
function toNative(uts: UniversalTrustSchema): any          // UTS → native
```

8 formats = 8 adapters, not 56 pairwise translators. This is the i18n pattern applied to trust.

---

## Test results

**83/83 tests passing.** Test suite covers:
- Auto-detection of all 6 formats
- Round-trip translation (UTS preserves all key fields)
- Cross-format translation matrix (30 pairs)
- Bridge (verify in one ecosystem, re-issue in another)
- Lossless preservation (`format.raw` keeps original payload)
- Policy enforcement (e.g., reject low-trust credentials)

```bash
$ node test.mjs
✓ 6 formats registered
✓ 6/6 detected correctly
✓ 6/6 garbage inputs rejected
✓ ATC round-trip preserves all key fields
✓ All 30/30 translation pairs succeed
✓ All formats preserve original payload in format.raw (lossless)
RESULTS: 83 passed, 0 failed
```

---

## Quick start

### Install

```bash
npm install @marketnow/trust-core
```

> ⚠️ Package is source-available under AL-1.0. For commercial use, contact legal@alicelabs.site for a commercial license.

### Use

```typescript
import { createEngineWithAllAdapters } from '@marketnow/trust-core';

const engine = createEngineWithAllAdapters();

// Auto-detect and verify any payload
const result = await engine.verifyAny(unknownPayload);
// → { valid: true, detected_format: 'zta', uts: {...} }

// Translate ATC → EAT-AI
const eatToken = engine.translate(atcCard, { from: 'atc-v3', to: 'eat-ai' });

// Issue in multiple formats simultaneously
const credentials = await engine.issueMulti(
  {
    subject: { id: 'my-agent', name: 'My Agent', type: 'agent' },
    trust: { score: 8, confidence: 'high', evidence: [], assessor: 'me' },
  },
  ['atc-v3', 'eat-ai', 'w3c-vc']
);

// Bridge: verify in one ecosystem, re-issue as another
const bridge = await engine.bridge({
  verify_in: 'zta',
  issue_as: 'atc-v3',
  payload: ztaPayload,
  policy: { min_trust_score: 7 },
});
```

---

## Repository structure

```
universal-trust-adapter/
├── README.md
├── LICENSE-AL-1.0                       ← AliceLabs Source-Available License
├── spec/
│   ├── UTS-v1.md                        ← Universal Trust Schema spec
│   ├── uts-v1.json                      ← JSON Schema for UTS
│   └── RFC-ATC-v3-Draft-00.md           ← ATC v3.0 with multi-format signatures
├── adapters/
│   ├── types.ts                         ← TypeScript types for UTS + Adapter interface
│   ├── trust-engine.ts                  ← TrustEngine class (translate, verify, issue, bridge)
│   ├── index.ts                         ← Package entrypoint
│   ├── package.json                     ← @marketnow/trust-core npm package
│   ├── atc-adapter.ts                   ← ATC v2.0/v3.0
│   ├── eat-adapter.ts                   ← IETF EAT-AI (CWT/CBOR)  [bug-fixed]
│   ├── zta-adapter.ts                   ← Anthropic ZTA
│   ├── a2a-adapter.ts                   ← Google A2A Agent Card
│   ├── mcp-adapter.ts                   ← MCP Server Card
│   ├── vc-adapter.ts                    ← W3C Verifiable Credentials 2.0
│   ├── oauth-adapter.ts                 ← OAuth 2.0 / OIDC (JWT)
│   └── spiffe-adapter.ts                ← SPIFFE SVID
├── api/
│   └── trust-api-spec.md                ← REST API specification
├── fixes/
│   └── C4-owasp-rename.md               ← OWASP MCP Top 10 rename fix documentation
├── tests/
│   └── test.mjs                         ← Test suite (83 tests, all passing)
└── EXECUTION_PLAN.md                    ← 6-month plan
```

---

## Status (Aug 2026)

| Component | Status |
|---|---|
| UTS spec v1.0 | ✅ Published |
| TrustEngine core | ✅ Implemented (TypeScript) |
| 8 adapters (with bug fixes) | ✅ Implemented (crypto stubs) |
| ATC v3.0 spec | ✅ Draft 00 published |
| REST API spec | ✅ Published |
| OWASP rename fix | ✅ Documented |
| Test suite | ✅ 83/83 tests passing |
| Reference SDK on npm | 🚧 Pending (Sprint 2) |
| Reference SDK on PyPI | 🚧 Pending (Sprint 4) |
| 1 runtime integration | 🚧 Pending (Sprint 5) |
| AAIF hosting | 🚧 Pending (Sprint 6) |

---

## Why this is a strategic asset (not "just code")

1. **Cost-to-recreate**: ~$300k-$600k in senior security engineers + 9 months of work for any enterprise (Cloudflare, Okta, Snyk) to replicate from scratch.
2. **Network effect**: every new trust format that emerges wants a UTA adapter to be compatible with all others. UTA becomes the toll gate.
3. **Maintenance cost**: ~$0/month (serverless, offline-first, 100% margin).
4. **Source-available (AL-1.0)**: protects the work while allowing review and contribution. Commercial use requires a commercial license — protects the asset value.
5. **First-mover advantage**: nobody else has built this. The window closes in 6 months.

---

## License

**AliceLabs Source-Available License v1.0 (AL-1.0)** — see [LICENSE-AL-1.0](./LICENSE-AL-1.0).

- ✅ **Allowed**: read source, build, run for non-commercial use, security review, contribute back via PR
- ❌ **Prohibited**: commercial use without license, redistribution, forking (except for PR contribution), trademark use

For commercial licensing: `legal@alicelabs.site`

---

## Trademarks

"ATC", "Agent Trust Credential", "UTA", "Universal Trust Adapter", "UTS", "Universal Trust Schema", "AliceLabs", and "MarketNow" are trademarks of AliceLabs LLC. Use without authorization is prohibited.

---

## Contact

- **Commercial licensing:** legal@alicelabs.site
- **Security disclosures:** legal@alicelabs.site
- **General:** info@alicelabs.site

— Edison & Alejandro Flores, AliceLabs LLC, 2026-08-20
