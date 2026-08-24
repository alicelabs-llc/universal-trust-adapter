# Universal Trust Adapter (UTA)

**The USB-C of agent trust.**

UTA translates between ALL trust credential formats used by AI agents — ATC, EAT-AI (IETF), ZTA (Anthropic), A2A Agent Card (Google/AAIF), MCP Server Card (Anthropic), W3C Verifiable Credentials, OAuth/OIDC, and SPIFFE SVID — via a canonical Universal Trust Schema (UTS).

Like Zapier connects applications, **UTA connects trust standards**.

Built by **Edison Flores** & **Alejandro Flores** at **AliceLabs LLC** (Wyoming, USA).

---

## 📐 Open-Core Architecture (3 layers)

UTA follows the **Open-Core platform model** used by Zapier, Stripe, Docker, and MuleSoft. Three layers with different licenses:

| Layer | What | License | Why |
|---|---|---|---|
| **1. Plugin Template** | Interface + boilerplate for third-party adapters | **MIT** | Open ecosystem — anyone can write plugins |
| **2. UTS Specification** | The universal trust schema (spec + JSON Schema) | **CC-BY-NC-ND 4.0** | Open for reading + implementing, closed for forking |
| **3. The Engine + Sentinel + Interceptor** | TrustEngine core, 8-layer audit, eBPF enforcement | **AL-1.0 (proprietary)** | The moat — commercial use requires license |

📖 **Read the full architecture:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

---

## 🚀 What UTA does

### The problem (Aug 2026)

8 competing trust credential formats for AI agents. None speak to each other. Each ecosystem is an island. 88% of organizations had AI agent security incidents in 2026 (Gravitee). 92% of CISOs lack visibility. 30+ CVEs against MCP servers in 60 days. The market is fragmented and hurting.

### The solution

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

Every adapter implements `fromNative(payload) → UTS` and `toNative(UTS) → payload`. 8 formats = 8 adapters, not 56 pairwise translators.

---

## 🧪 Test results

**83/83 tests passing.** Suite covers:
- Auto-detection of all 6 formats
- Round-trip translation (UTS preserves all key fields)
- Cross-format translation matrix (30 pairs)
- Bridge (verify in one ecosystem, re-issue in another)
- Lossless preservation (`format.raw` keeps original payload)
- Policy enforcement (e.g., reject low-trust credentials)

```bash
$ node tests/test.mjs
✓ 6 formats registered
✓ All 30/30 translation pairs succeed
✓ All formats preserve original payload in format.raw (lossless)
RESULTS: 83 passed, 0 failed
```

---

## 📦 Repository structure

```
universal-trust-adapter/
├── README.md                              ← This file
├── docs/
│   └── ARCHITECTURE.md                    ← Open-Core model explained
│
├── open/                                  ← OPEN LAYERS
│   ├── plugins/
│   │   └── template/                      ← Layer 1: MIT-licensed plugin template
│   │       ├── LICENSE-MIT
│   │       ├── README.md
│   │       ├── package.json
│   │       └── trust-adapter-template.ts
│   │
│   └── uts-spec/                          ← Layer 2: CC-BY-NC-ND spec
│       ├── LICENSE-CC-BY-NC-ND
│       ├── UTS-v1.md                      ← The specification
│       ├── uts-v1.json                    ← JSON Schema
│       ├── RFC-ATC-v3-Draft-00.md         ← ATC v3 spec (multi-format)
│       └── examples/                      ← Example ATC v3 credentials
│
├── proprietary/                           ← LAYER 3: CLOSED
│   ├── LICENSE-AL-1.0                      ← AliceLabs Source-Available License
│   ├── COMMERCIAL-LICENSE.md               ← Commercial terms + pricing tiers
│   │
│   ├── trust-engine/                       ← The Universal Trust Engine
│   │   ├── trust-engine.ts
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── adapters/                          ← 8 built-in adapters (proprietary)
│   │   ├── atc-adapter.ts
│   │   ├── eat-adapter.ts
│   │   ├── zta-adapter.ts
│   │   ├── a2a-adapter.ts
│   │   ├── mcp-adapter.ts
│   │   ├── vc-adapter.ts
│   │   ├── oauth-adapter.ts
│   │   └── spiffe-adapter.ts
│   │
│   ├── sentinel/                          ← 8-layer audit pipeline (proprietary)
│   │   ├── README.md
│   │   ├── L1-metadata-scan/
│   │   ├── L2-runtime-sandbox/
│   │   ├── L3-static-analysis/
│   │   ├── L4-supply-chain-osv/
│   │   ├── L5-prompt-injection/
│   │   ├── L6-differential-execution/
│   │   ├── L7-tee-attestation/
│   │   └── L8-human-review/
│   │
│   └── interceptor/                       ← eBPF kernel enforcement (proprietary)
│       └── README.md
│
├── api/                                    ← REST API spec (proprietary)
│   └── trust-api-spec.md
│
├── tests/                                  ← Test suite (proprietary)
│   └── test.mjs
│
└── fixes/                                  ← Bug fix documentation
    └── C4-owasp-rename.md
```

---

## 💼 Commercial licensing

Layer 3 (Engine, Sentinel, Interceptor) is **proprietary** under AL-1.0. Commercial use requires a commercial license.

### Pricing tiers

| Tier | For | Pricing |
|---|---|---|
| Tier 1 — Per-Developer | Small teams, indie | **$99 / dev / month** |
| Tier 2 — Per-Organization | Mid-market (10-100 engineers) | **$2,500 / month** |
| Tier 3 — Enterprise | Fortune 500, regulated industries | **$15,000 / month** |
| Tier 4 — Source Code License | Strategic partners | **$500,000 one-time** |
| Tier 5 — Acqui-Hire | Acquisition | **$2.5M — $5M** |

Volume pricing for SaaS providers (per-verification): from **$0.0015 / verify** at 10M+ monthly volume.

📖 **Full pricing:** [`proprietary/COMMERCIAL-LICENSE.md`](./proprietary/COMMERCIAL-LICENSE.md)

📧 Contact: `legal@alicelabs.site`

---

## 🛡️ Why this model

### Anti-fragile against standards wars

If Google (A2A), Anthropic (ZTA), or IETF (EAT-AI) wins, UTA wins — because UTA translates to/from all of them. The more fragmented the market, the more valuable UTA becomes.

### Defensible against Microsoft / AWS / Google

Under MIT-everything, hyperscalers could fork UTA and rebrand it. Under Open-Core:
- The plugin template (Layer 1) is MIT — they can write adapters freely
- The UTS spec (Layer 2) is CC-BY-NC-ND — they can read and implement
- The engine (Layer 3) is AL-1.0 — they must license it commercially

### The Zapier / Stripe / Docker playbook

- **Zapier:** open SDK for connectors, closed automation engine
- **Stripe:** MIT libraries for client integration, closed payment engine
- **Docker:** open `runc` runtime, closed Docker Desktop enterprise
- **UTA:** MIT plugin template, CC-BY-NC-ND spec, AL-1.0 engine + Sentinel + Interceptor

---

## 🧩 Writing a plugin (Layer 1, MIT)

Anyone can write a custom adapter:

1. Copy `open/plugins/template/trust-adapter-template.ts`
2. Implement the 5 required methods: `detect`, `fromNative`, `toNative`, `verify`, `issue`
3. Test against the UTS spec (`open/uts-spec/`)
4. Publish as `@your-org/trust-adapter-myformat` on npm

📖 Full guide: [`open/plugins/template/README.md`](./open/plugins/template/README.md)

---

## 📜 License summary

| Layer | License | What you can do |
|---|---|---|
| Plugin Template | MIT | Anything — copy, modify, sell, embed |
| UTS Spec | CC-BY-NC-ND 4.0 | Read, study, implement against. Cannot redistribute modified versions. |
| Engine + Sentinel + Interceptor | AL-1.0 | Read for review, build for personal use. Commercial use requires license. |

📖 Full details: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

---

## 🏷️ Trademarks

"ATC", "Agent Trust Credential", "UTA", "Universal Trust Adapter", "UTS", "Universal Trust Schema", "Sentinel", "Interceptor", "AliceLabs", "MarketNow" are trademarks of AliceLabs LLC. Use without authorization is prohibited.

For trademark licensing (e.g., "ATC-Compatible" certification): `legal@alicelabs.site`

---

## 📞 Contact

| Topic | Email |
|---|---|
| Commercial licensing | `legal@alicelabs.site` |
| Security disclosures | `legal@alicelabs.site` |
| Plugin ecosystem | `plugins@alicelabs.site` |
| Standards body inquiries | `standards@alicelabs.site` |
| General | `info@alicelabs.site` |

— Edison & Alejandro Flores, AliceLabs LLC, 2026-08-20
