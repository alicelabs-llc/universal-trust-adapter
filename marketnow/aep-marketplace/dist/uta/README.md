# Universal Trust Adapter (UTA)

**The USB-C of agent trust.**

[![npm downloads](https://img.shields.io/npm/dm/marketnow-mcp.svg)](https://www.npmjs.com/package/marketnow-mcp)
[![npm version](https://img.shields.io/npm/v/agent-trust-card.svg)](https://www.npmjs.com/package/agent-trust-card)
[![GitHub release](https://img.shields.io/github/v/release/alicelabs-llc/universal-trust-adapter)](https://github.com/alicelabs-llc/universal-trust-adapter/releases)
[![license](https://img.shields.io/badge/license-open--core%20MIT%20%C2%B7%20AL--1.0%20core-blue.svg)](https://marketnow.site/licensing)
[![conformance tests](https://img.shields.io/badge/conformance-v1.3.5-brightgreen.svg)](https://www.marketnow.site/uta/conformance/)
[![test vectors](https://img.shields.io/badge/test%20vectors-41%20total-blue.svg)](https://www.marketnow.site/uta/conformance/vectors/)

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
npm install -g marketnow-mcp       # MCP server (15 trust tools; remote endpoint exposes 9)
```

## 📊 Project stats (auto-synced from npm registry + /api/stats.json — scripts/sync_npm_versions.py)

| Metric | Value |
|---|---|
| NPM packages | 14 |
| NPM monthly downloads | 9,585 |
| Test vectors (ATC/1.0) | 5 frozen + manifest |
| Test vectors (ATC v3.0) | 36 (8 positive + 17 negative + 5 mutation + 6 cross-language) |
| Conformance tests | v1.3.5 — 14 public vectors · 24 checks + 10 mutants (runner-under-test) |
| Format adapters | 9 (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE, X.509) |
| Dev.to articles | 96 |
| Download channels | 5 (NPM, jsDelivr, unpkg, marketnow.site, GitHub) |

## 📦 Packages

| Package | Version | Description | Monthly downloads |
|---|---|---|---|
| [`marketnow-mcp`](https://www.npmjs.com/package/marketnow-mcp) | 1.14.1 | MCP server with 15 trust tools (remote endpoint exposes 9) | 1,839 |
| [`agent-trust-card`](https://www.npmjs.com/package/agent-trust-card) | 1.4.1 | ATC/1.0 SDK (issue, verify, inspect) | 878 |
| [`marketnow-install-stack`](https://www.npmjs.com/package/marketnow-install-stack) | 1.2.1 | Multi-source installer | 577 |
| [`@marketnow/uts`](https://www.npmjs.com/package/@marketnow/uts) | 2.0.3 | Universal Trust Schema | 576 |
| [`@marketnow/trust-core`](https://www.npmjs.com/package/@marketnow/trust-core) | 2.0.3 | Trust Engine core | 1,044 |
| [`@marketnow/trust-adapters`](https://www.npmjs.com/package/@marketnow/trust-adapters) | 1.0.4 | 9 format adapters | 704 |
| [`@marketnow/trust-gateway`](https://www.npmjs.com/package/@marketnow/trust-gateway) | 1.0.5 | Gateway + post-exec filter | 875 |
| [`@marketnow/uta-conformance`](https://www.npmjs.com/package/@marketnow/uta-conformance) | 1.3.5 | 14 signed vectors + reference scorer | 406 |
| [`@marketnow/cline-trust-plugin`](https://www.npmjs.com/package/@marketnow/cline-trust-plugin) | 1.1.2 | Interceptor: revocation gate + tool pinning | 452 |
| [`marketnow-audit`](https://www.npmjs.com/package/marketnow-audit) | 1.0.1 | Security audit CLI (domain scam-check, ATC verify, OCSP, catalog) | 316 |
| [`@marketnow/uta-verify`](https://www.npmjs.com/package/%40marketnow/uta-verify) | 1.0.2 | CLI credential verifier (CI exit codes) | 400 |
| [`@marketnow/sentinel-rules`](https://www.npmjs.com/package/%40marketnow/sentinel-rules) | 1.1.2 | 29 MCP security rules + zero-dep lite scanner | 566 |
| [`@marketnow/trust-mcp-middleware`](https://www.npmjs.com/package/%40marketnow/trust-mcp-middleware) | 1.0.2 | MCP tools/call wrapper: credential enforcement | 402 |
| [`@marketnow/trust-observability`](https://www.npmjs.com/package/%40marketnow/trust-observability) | 1.0.3 | Zero-dep observability: logging, tracing, metrics | 550 |

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
| **3. The Engine + Sentinel + Interceptor** | TrustEngine core, Sentinel 12-stage / 10-layer audit, eBPF enforcement | **AL-1.0** |

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
