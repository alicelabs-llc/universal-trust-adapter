# Universal Trust Adapter (UTA)

**The USB-C of agent trust.**

[![npm downloads](https://img.shields.io/npm/dm/marketnow-mcp.svg)](https://www.npmjs.com/package/marketnow-mcp)
[![npm version](https://img.shields.io/npm/v/agent-trust-card.svg)](https://www.npmjs.com/package/agent-trust-card)
[![GitHub release](https://img.shields.io/github/v/release/alicelabs-llc/universal-trust-adapter)](https://github.com/alicelabs-llc/universal-trust-adapter/releases)
[![license](https://img.shields.io/badge/license-AL--1.0-blue.svg)](./LICENSE-AL-1.0)
[![conformance tests](https://img.shields.io/badge/conformance-23%2F23-brightgreen.svg)](./tests/test.mjs)
[![test vectors](https://img.shields.io/badge/test%20vectors-5%20frozen-blue.svg)](./marketnow/docs/atc-spec/test-vectors/)

UTA translates between ALL trust credential formats used by AI agents — ATC, EAT-AI (IETF), ZTA (Anthropic), A2A Agent Card (Google/AAIF), MCP Server Card (Anthropic), W3C Verifiable Credentials, OAuth/OIDC, and SPIFFE SVID — via a canonical Universal Trust Schema (UTS).

Like Zapier connects applications, **UTA connects trust standards**.

Built by **Edison Flores** & **Alejandro Flores** at **AliceLabs LLC** (Wyoming, USA).

---

## 🚀 Quick install

```bash
# Multi-source installer (tries 5 channels in order)
curl -fsSL https://marketnow.site/install.sh | bash

# Or install individual packages
npm install agent-trust-card        # ATC SDK
npm install -g marketnow-mcp       # MCP server (13 trust tools)
```

## 📊 Project stats (Aug 25, 2026)

| Metric | Value |
|---|---|
| NPM packages | 7 |
| NPM monthly downloads | 2,276 |
| NPM total (12mo) | 3,865 |
| Test vectors | 5 frozen + manifest |
| Conformance tests | 23/23 pass |
| Dev.to articles | 96 |
| Dev.to comments | 44 (responded via 5 batched articles) |
| Download channels | 5 (NPM, jsDelivr, unpkg, marketnow.site, GitHub) |

## 📦 Packages

| Package | Version | Description | Monthly downloads |
|---|---|---|---|
| [`marketnow-mcp`](https://www.npmjs.com/package/marketnow-mcp) | 1.10.0 | MCP server with 13 trust tools | 958 |
| [`agent-trust-card`](https://www.npmjs.com/package/agent-trust-card) | 1.1.1 | ATC SDK (issue, verify, inspect) | 518 |
| [`marketnow-install-stack`](https://www.npmjs.com/package/marketnow-install-stack) | 1.1.0 | Multi-source installer | 345 |
| [`@marketnow/uts`](https://www.npmjs.com/package/@marketnow/uts) | 2.0.0 | Universal Trust Schema | 125 |
| [`@marketnow/trust-core`](https://www.npmjs.com/package/@marketnow/trust-core) | 1.0.0 | Trust Engine core | 122 |
| [`@marketnow/trust-adapters`](https://www.npmjs.com/package/@marketnow/trust-adapters) | 1.0.0 | Format adapters (8 formats) | 106 |
| [`@marketnow/trust-gateway`](https://www.npmjs.com/package/@marketnow/trust-gateway) | 1.0.0 | Gateway + post-exec filter | 102 |

All packages are automatically mirrored by:
- **jsDelivr CDN:** `https://cdn.jsdelivr.net/npm/{pkg}@{ver}/`
- **unpkg CDN:** `https://unpkg.com/{pkg}@{ver}/`

## 🛡️ 5 Anti-ban download channels

1. **NPM Registry** — primary, independent of GitHub
2. **jsDelivr CDN** — free global CDN, mirrors NPM automatically
3. **unpkg CDN** — alternative CDN, also mirrors NPM
4. **marketnow.site** — AliceLabs-owned origin server
5. **GitHub org** — `alicelabs-llc/universal-trust-adapter` (this repo)

If any one channel is blocked, the other 4 continue working. All tarballs are byte-identical (SHA-256 verified).

**Resilience manifest:** https://marketnow.site/resilience.json

## 📐 Open-Core Architecture (3 layers)

UTA follows the **Open-Core platform model** used by Zapier, Stripe, Docker, and MuleSoft. Three layers with different licenses:

| Layer | What | License | Why |
|---|---|---|---|
| **1. Plugin Template** | Interface + boilerplate for third-party adapters | **MIT** | Open ecosystem — anyone can write plugins |
| **2. UTS Specification** | The universal trust schema (spec + JSON Schema) | **CC-BY-NC-ND 4.0** | Open for reading + implementing, closed for forking |
| **3. The Engine + Sentinel + Interceptor** | TrustEngine core, 8-layer audit, eBPF enforcement | **AL-1.0 (proprietary)** | The moat — commercial use requires license |

📖 **Read the full architecture:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

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
│  ZTA    │────▶│   format to any    │◀────│  A2A    │
│(Anthropic)│   │   other format     │     │ (Google)│
└─────────┘     │                     │     └─────────┘
                │   via Universal     │
┌─────────┐     │   Trust Schema (UTS)│     ┌─────────┐
│  MCP    │────▶│                     │◀────│  W3C    │
│ Card    │     │                     │     │   VC    │
└─────────┘     └─────────────────────┘     └─────────┘
```

## 🧪 Try it

```bash
# Verify any ATC card
npx -y agent-trust-card verify card.json

# Run the MCP server (works with Claude Desktop, Cursor, Cline, Continue, Aider)
npx -y marketnow-mcp

# Run the conformance suite
git clone https://github.com/alicelabs-llc/universal-trust-adapter
cd universal-trust-adapter/marketnow/atc-sdk
npm install && node test/conformance.mjs
```

## 🧬 Test vectors (independent verification)

5 frozen test vectors with:
- Canonical JCS bytes per vector (hex + base64 + utf8)
- SHA-256 of canonical bytes
- Ed25519 signature
- Expected verification outcome
- Test CA private key intentionally published for cross-language reproducibility

**Location:** [`marketnow/docs/atc-spec/test-vectors/`](./marketnow/docs/atc-spec/test-vectors)

The test CA keypair is in `_test-ca-keys.json` — anyone can re-derive the signatures in Python, Go, Rust, or any language that supports Ed25519 + RFC 8785 JCS.

## 📋 Spec & docs

- **ATC/1.0 Spec:** [`marketnow/docs/atc-spec/SPEC.md`](./marketnow/docs/atc-spec/SPEC.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **Threat model:** [`uta-repo/THREAT_MODEL.md`](./uta-repo/THREAT_MODEL.md)
- **Roadmap:** [`uta-monorepo/CHANGELOG.md`](./uta-monorepo/CHANGELOG.md)
- **Contributing:** [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Security policy:** [`SECURITY.md`](./SECURITY.md)

## 🌐 Community

- **GitHub Discussions:** [![discussions](https://img.shields.io/badge/discuss-on%20GitHub-blue.svg)](https://github.com/alicelabs-llc/universal-trust-adapter/discussions)
- **Dev.to:** [@edison_flores_6d2cd381b13](https://dev.to/edison_flores_6d2cd381b13) — 96 articles published
- **Issues:** [Report a bug](https://github.com/alicelabs-llc/universal-trust-adapter/issues/new?labels=bug&template=bug-report.md)
- **Email:** info@alicelabs.site

## 📄 License

| Component | License |
|---|---|
| Plugin template | MIT |
| UTS specification | CC-BY-NC-ND 4.0 |
| Engine + Sentinel + Interceptor | **AL-1.0** (AliceLabs Source-Available License v1.0) |

Commercial use of the engine requires a separate license. Contact legal@alicelabs.site.

## 🙏 Acknowledgments

The most valuable technical feedback came from:

- [@anp2network](https://dev.to/anp2network) — found the JCS replacer bug, pushed for public test vectors
- [@mads_hansen_27b33ebfee4c9](https://dev.to/mads_hansen_27b33ebfee4c9) — capability classification, runtime split, key registry design
- [@wrencalloway](https://dev.to/wrencalloway) — import-time vs runtime gap, tool-description-poisoning attack
- [@topstar_ai](https://dev.to/topstar_ai) — dynamic trust in production, collaboration
- [@neelagiri65](https://dev.to/neelagiri65) — pushed for honest per-layer catch counts
- [@bogumi_jankiewicz_fcfce0](https://dev.to/bogumi_jankiewicz_fcfce0) — gate.cat exec-boundary deny-gate

Read the [batched response articles](https://dev.to/edison_flores_6d2cd381b13) for the full technical exchange.

---

**Author:** Edison Flores · **Email:** info@alicelabs.site · **Website:** https://marketnow.site  
**Company:** AliceLabs LLC (Wyoming, USA) · **License:** AL-1.0
