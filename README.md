# Universal Trust Adapter (UTA)

**The USB-C of agent trust.**

[![npm downloads](https://img.shields.io/npm/dm/marketnow-mcp.svg)](https://www.npmjs.com/package/marketnow-mcp)
[![npm version](https://img.shields.io/npm/v/agent-trust-card.svg)](https://www.npmjs.com/package/agent-trust-card)
[![GitHub release](https://img.shields.io/github/v/release/alicelabs-llc/universal-trust-adapter)](https://github.com/alicelabs-llc/universal-trust-adapter/releases)
[![license](https://img.shields.io/badge/license-AL--1.0-blue.svg)](./LICENSE-AL-1.0)
[![conformance tests](https://img.shields.io/badge/conformance-23%2F23-brightgreen.svg)](./tests/test.mjs)
[![test vectors](https://img.shields.io/badge/test%20vectors-41%20total-blue.svg)](./marketnow/docs/atc-spec/test-vectors/)

UTA translates between ALL trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS).

Like Zapier connects applications, **UTA connects trust standards**.

Built by **Edison Flores** & **Alejandro Flores** at **AliceLabs LLC** (Wyoming, USA).

---

## ATC Versions in this repo

UTA supports **TWO versions of ATC** (Agent Trust Card):

| Version | Status | Multi-sig | Spec file | Description |
|---|---|---|---|---|
| **ATC/1.0** | Public, stable | Single-sig (Ed25519) | [`SPEC.md`](./marketnow/docs/atc-spec/SPEC.md) | Simple, single-CA credential. SDK at `agent-trust-card@1.1.1` on NPM. |
| **ATC v3.0** | Draft 00, pre-public review | Multi-format (Ed25519 + EAT-CWT + W3C VC) | [`RFC-ATC-v3-Draft-00.md`](./marketnow/docs/atc-spec/RFC-ATC-v3-Draft-00.md) | Multi-sig (N-of-M), multi-format. Backward-compatible with v2.0. Used internally by UTA. |

ATC v3.0 supersedes ATC v2.0 (which itself was the basis for the simpler ATC/1.0 SDK). A v2.0 ATC remains valid; v3.0 verifiers accept v2.0 credentials and treat them as having a single signature.

---

## 🚀 Quick install

```bash
# Multi-source installer (tries 5 channels in order)
curl -fsSL https://marketnow.site/install.sh | bash

# Or install individual packages
npm install agent-trust-card        # ATC/1.0 SDK
npm install -g marketnow-mcp       # MCP server (13 trust tools)
```

## 📊 Project stats (Aug 25, 2026)

| Metric | Value |
|---|---|
| NPM packages | 7 |
| NPM monthly downloads | 2,276 |
| Test vectors (ATC/1.0) | 5 frozen + manifest |
| Test vectors (ATC v3.0) | 36 (8 positive + 17 negative + 5 mutation + 6 cross-language) |
| Conformance tests | 23/23 pass |
| Format adapters | 8 (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE) |
| Dev.to articles | 96 |
| Download channels | 5 (NPM, jsDelivr, unpkg, marketnow.site, GitHub) |

## 📦 Packages

| Package | Version | Description | Monthly downloads |
|---|---|---|---|
| [`marketnow-mcp`](https://www.npmjs.com/package/marketnow-mcp) | 1.10.0 | MCP server with 13 trust tools | 958 |
| [`agent-trust-card`](https://www.npmjs.com/package/agent-trust-card) | 1.1.1 | ATC/1.0 SDK (issue, verify, inspect) | 518 |
| [`marketnow-install-stack`](https://www.npmjs.com/package/marketnow-install-stack) | 1.1.0 | Multi-source installer | 345 |
| [`@marketnow/uts`](https://www.npmjs.com/package/@marketnow/uts) | 2.0.0 | Universal Trust Schema | 125 |
| [`@marketnow/trust-core`](https://www.npmjs.com/package/@marketnow/trust-core) | 1.0.0 | Trust Engine core | 122 |
| [`@marketnow/trust-adapters`](https://www.npmjs.com/package/@marketnow/trust-adapters) | 1.0.0 | 8 format adapters | 106 |
| [`@marketnow/trust-gateway`](https://www.npmjs.com/package/@marketnow/trust-gateway) | 1.0.0 | Gateway + post-exec filter | 102 |

## 🛡️ 5 Anti-ban download channels

1. **NPM Registry** — primary, independent of GitHub
2. **jsDelivr CDN** — free global CDN, mirrors NPM automatically
3. **unpkg CDN** — alternative CDN, also mirrors NPM
4. **marketnow.site** — AliceLabs-owned origin server
5. **GitHub org** — `alicelabs-llc/universal-trust-adapter` (this repo)

## 📐 Open-Core Architecture

| Layer | What | License |
|---|---|---|
| **1. Plugin Template** | Interface + boilerplate for third-party adapters | **MIT** |
| **2. UTS Specification** | Universal Trust Schema (spec + JSON Schema) | **CC-BY-NC-ND 4.0** |
| **3. The Engine + Sentinel + Interceptor** | TrustEngine core, 8-layer audit, eBPF enforcement | **AL-1.0** |

## 🧪 Try it

```bash
# Verify any ATC card (ATC/1.0 or ATC v3.0)
npx -y agent-trust-card verify card.json

# Run the MCP server (works with Claude Desktop, Cursor, Cline, Continue, Aider)
npx -y marketnow-mcp

# Run the conformance suite
git clone https://github.com/alicelabs-llc/universal-trust-adapter
cd universal-trust-adapter/marketnow/atc-sdk
npm install && node test/conformance.mjs
```

## 🧬 Test vectors

**ATC/1.0 (5 frozen):** [`marketnow/docs/atc-spec/test-vectors/`](./marketnow/docs/atc-spec/test-vectors) — 5 fixtures with canonical JCS bytes per vector + SHA-256 + Ed25519 signature.

**ATC v3.0 (36 vectors):** [`marketnow/docs/atc-spec/test-vectors-v3/`](./marketnow/docs/atc-spec/test-vectors-v3) — 8 positive + 17 negative + 5 mutation + 6 cross-language.

The test CA keypair is intentionally published (including private key) for cross-language reproducibility.

## 📋 Specs & docs

- **ATC/1.0 Spec:** [`marketnow/docs/atc-spec/SPEC.md`](./marketnow/docs/atc-spec/SPEC.md)
- **ATC v3.0 RFC Draft:** [`marketnow/docs/atc-spec/RFC-ATC-v3-Draft-00.md`](./marketnow/docs/atc-spec/RFC-ATC-v3-Draft-00.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- **Threat model:** [`uta-repo/THREAT_MODEL.md`](./uta-repo/THREAT_MODEL.md)
- **Contributing:** [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Security policy:** [`SECURITY.md`](./SECURITY.md)

## 🌐 Community

- **GitHub Discussions:** [discussions](https://github.com/alicelabs-llc/universal-trust-adapter/discussions)
- **Dev.to:** [@edison_flores_6d2cd381b13](https://dev.to/edison_flores_6d2cd381b13) — 96 articles
- **Issues:** [Report a bug](https://github.com/alicelabs-llc/universal-trust-adapter/issues/new?labels=bug&template=bug-report.md)
- **Email:** info@alicelabs.site

## 📄 License

| Component | License |
|---|---|
| Plugin template | MIT |
| UTS specification | CC-BY-NC-ND 4.0 |
| Engine + Sentinel + Interceptor | **AL-1.0** |

---

**Author:** Edison Flores · **Email:** info@alicelabs.site · **Website:** https://marketnow.site  
**Company:** AliceLabs LLC (Wyoming, USA)
