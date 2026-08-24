# Universal Trust Adapter — Architecture & Licensing Model

**The Open-Core Platform for Agent Trust Interoperability**

This document explains the 3-layer architecture of the Universal Trust Adapter (UTA) and how each layer is licensed. This model is the same one that made Zapier, Stripe, Docker, and MuleSoft into multi-billion dollar platforms.

---

## The 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    OPEN-CORE ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [CAPA 1: PLUGIN TEMPLATE]              ──► OPEN (MIT)                       │
│  open/plugins/template/                                                     │
│  • trust-adapter-template.ts (interface + boilerplate)                      │
│  • Lets third parties write connectors that plug into UTA                   │
│  • Anyone can implement — no permission required                           │
│                                                                             │
│  [CAPA 2: UTS SPECIFICATION]            ──► OPEN FOR READING (CC-BY-NC-ND) │
│  open/uts-spec/                                                             │
│  • UTS-v1.md (the specification)                                            │
│  • uts-v1.json (the JSON Schema)                                            │
│  • Anyone can read, study, and implement against the spec                   │
│  • Cannot redistribute modified versions — changes go via PR to us         │
│                                                                             │
│  [CAPA 3: THE ENGINE + SENTINEL + INTERCEPTOR]  ──► PROPRIETARY (AL-1.0)   │
│  proprietary/trust-engine/    ← The Universal Trust Engine (closed)         │
│  proprietary/sentinel/        ← 8-layer audit pipeline (closed)            │
│  proprietary/interceptor/      ← eBPF kernel-level enforcement (closed)    │
│  • Source-available for review (security audit)                             │
│  • Commercial use requires separate commercial license                       │
│  • Contact: legal@alicelabs.site                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why this model works (the Zapier / Stripe / Docker playbook)

### Like Zapier

- Zapier publishes an open SDK so Shopify, Salesforce, Gmail can build connectors
- But Zapier's central automation engine is **100% proprietary**
- Every event that flows through Zapier's engine pays a toll
- Connectors are open; the engine is closed; the toll is monetized

### Like Stripe

- Stripe publishes `stripe-js` libraries under MIT for any developer to integrate
- But Stripe's fraud detection (Radar), payment processing, and ledger are **proprietary**
- Open client libraries + closed proprietary backend = billion-dollar moat

### Like Docker

- Docker publishes `runc` and the container runtime as open source
- But Docker Desktop, Docker Hub enterprise features, and the orchestration layer are **proprietary**
- Free for individual use; enterprise features are paid

**UTA follows the same model:**

| Layer | What it is | License | Why |
|---|---|---|---|
| 1. Plugin Template | The interface + boilerplate so third parties can write adapters | MIT | Network effect — every new format plugin increases UTA's value, and AliceLabs owns the engine |
| 2. UTS Specification | The spec that defines the universal schema | CC-BY-NC-ND 4.0 | Open for reading + implementing, but no one can fork and rebrand the spec |
| 3. The Engine + Sentinel + Interceptor | TrustEngine core, audit pipeline, kernel enforcement | AL-1.0 (proprietary) | The moat — the actual value that competitors can't copy |

---

## Directory Structure

```
universal-trust-adapter/
├── README.md                                 ← Overview + links to architecture
├── docs/
│   └── ARCHITECTURE.md                       ← This document
│
├── open/                                     ← LAYER 1 + 2 (OPEN)
│   ├── plugins/
│   │   └── template/                         ← MIT-licensed
│   │       ├── LICENSE-MIT                   ← MIT license (scope: this directory only)
│   │       ├── README.md                      ← How to write a plugin
│   │       ├── package.json                   ← @marketnow/trust-adapter-template
│   │       └── trust-adapter-template.ts     ← Interface + boilerplate
│   │
│   └── uts-spec/                             ← CC-BY-NC-ND 4.0
│       ├── LICENSE-CC-BY-NC-ND                ← Spec license
│       ├── UTS-v1.md                         ← The specification
│       ├── uts-v1.json                       ← JSON Schema
│       └── examples/                         ← Example ATC v3 + UTS instances
│
├── proprietary/                              ← LAYER 3 (CLOSED)
│   ├── LICENSE-AL-1.0                        ← AliceLabs Source-Available License
│   ├── COMMERCIAL-LICENSE.md                 ← Commercial terms + pricing
│   │
│   ├── trust-engine/                         ← The Universal Trust Engine (closed)
│   │   ├── trust-engine.ts                   ← Engine core (translate, verify, issue, bridge)
│   │   ├── types.ts                          ← UTS types
│   │   └── index.ts                          ← Package entrypoint
│   │
│   ├── adapters/                             ← Built-in adapters (closed)
│   │   ├── atc-adapter.ts
│   │   ├── eat-adapter.ts
│   │   ├── zta-adapter.ts
│   │   ├── a2a-adapter.ts
│   │   ├── mcp-adapter.ts
│   │   ├── vc-adapter.ts
│   │   ├── oauth-adapter.ts
│   │   └── spiffe-adapter.ts
│   │
│   ├── sentinel/                             ← 8-layer audit pipeline (closed)
│   │   ├── L1-metadata-scan/
│   │   ├── L2-runtime-sandbox/
│   │   ├── L3-static-analysis/
│   │   ├── L4-supply-chain-osv/
│   │   ├── L5-prompt-injection/
│   │   ├── L6-differential-execution/
│   │   ├── L7-tee-attestation/
│   │   └── L8-human-review/
│   │
│   └── interceptor/                          ← eBPF kernel enforcement (closed)
│       ├── ebpf-probe.c
│       ├── policy-engine.ts
│       └── enforcement-rules.json
│
├── api/                                       ← REST API (proprietary, AL-1.0)
│   └── trust-api-spec.md
│
├── fixes/                                     ← Bug fix documentation
│   └── C4-owasp-rename.md
│
└── tests/                                     ← Test suite (proprietary, AL-1.0)
    └── test.mjs
```

---

## What Each License Allows

### Layer 1 — Plugin Template (MIT)

| Action | Allowed |
|---|---|
| Read source | ✅ |
| Build and run commercially | ✅ |
| Modify | ✅ |
| Redistribute | ✅ |
| Fork | ✅ |
| Use in commercial product | ✅ |
| Sell plugins based on template | ✅ |

**Anyone can write a plugin that plugs into UTA. No permission, no fee, no questions.**

### Layer 2 — UTS Specification (CC-BY-NC-ND 4.0)

| Action | Allowed |
|---|---|
| Read spec | ✅ |
| Study spec | ✅ |
| Implement software conforming to spec | ✅ (commercial or non-commercial) |
| Quote spec in documentation | ✅ (with attribution) |
| Redistribute spec verbatim | ✅ (non-commercial, with attribution) |
| Sell spec text | ❌ |
| Modify spec and redistribute | ❌ (changes go via PR to AliceLabs) |
| Rebrand spec as own | ❌ |

**Anyone can read and implement against UTS. No one can fork and rebrand the spec.**

### Layer 3 — The Engine + Sentinel + Interceptor (AL-1.0)

| Action | Allowed |
|---|---|
| Read source for review | ✅ |
| Build for personal non-commercial use | ✅ |
| Security audit | ✅ |
| Contribute via PR | ✅ (assigns IP to AliceLabs) |
| Use commercially | ❌ (requires commercial license) |
| Redistribute | ❌ |
| Fork | ❌ (private forks for PR only) |
| Use trademarks | ❌ |

**The engine is the moat. Commercial use requires a license.**

---

## Commercial Licensing

For commercial use of Layer 3 (TrustEngine, Sentinel, Interceptor), contact:

**`legal@alicelabs.site`**

Commercial licenses are structured as:
- **Per-developer** (small teams)
- **Per-organization** (mid-market)
- **Enterprise unlimited** (large corps with SSO, audit, SLAs)
- **Source code license** (full code + modifications allowed)

See `proprietary/COMMERCIAL-LICENSE.md` for details.

---

## Why This is the Right Model for UTA

### 1. Network effect without giving away the moat

Every third-party plugin written against the template (Layer 1) increases the value of UTA's engine (Layer 3). But no third party can fork the engine and compete — Layer 3 is closed.

### 2. Standards body friendly

When AAIF / W3C / NIST review UTA, they see:
- A clearly-documented spec (Layer 2) — open, citable
- A reference implementation (Layer 3) — available for review
- A plugin system (Layer 1) — open to anyone

This is exactly the pattern of successful standards: RFC + reference implementation + open extension points.

### 3. Investor / acquirer friendly

If AliceLabs is acquired or raises capital:
- The **engine** (Layer 3) is the asset being bought
- The **plugins** (Layer 1) are community contributions, not part of the acquisition
- The **spec** (Layer 2) is open and remains so (no fragmentation risk)

This is the same structure that made Stripe, Docker, and Zapier acquirable.

### 4. Defensible against Microsoft / AWS / Google

If Microsoft, AWS, or Google wants to use UTA, they have three options:
1. **Pay for a commercial license** — recurring revenue for AliceLabs
2. **Build their own adapters** (Layer 1, MIT-licensed) — increases UTA's network effect
3. **Fork the engine** — prohibited by AL-1.0; legal action possible

Compare with MIT-everything: under MIT, they could just take the engine, rebrand it, and sell it. Under Open-Core, they have to pay or build around it.

---

## Trademarks

"ATC", "Agent Trust Credential", "UTA", "Universal Trust Adapter", "UTS", "Universal Trust Schema", "Sentinel", "AliceLabs", "MarketNow" are trademarks of AliceLabs LLC. Use without authorization is prohibited.

For trademark licensing (e.g., to certify a plugin as "ATC-compatible"): `legal@alicelabs.site`

---

## Contact

- **Commercial licensing:** `legal@alicelabs.site`
- **Security disclosures:** `legal@alicelabs.site`
- **Plugin ecosystem:** `plugins@alicelabs.site`
- **Standards body inquiries:** `standards@alicelabs.site`
- **General:** `info@alicelabs.site`

— Edison & Alejandro Flores, AliceLabs LLC, 2026-08-20
