# Universal Trust Adapter (UTA)

**The USB-C of agent trust.**

[![npm downloads](https://img.shields.io/npm/dm/marketnow-mcp.svg)](https://www.npmjs.com/package/marketnow-mcp)
[![npm version](https://img.shields.io/npm/v/agent-trust-card.svg)](https://www.npmjs.com/package/agent-trust-card)
[![GitHub release](https://img.shields.io/github/v/release/alicelabs-llc/universal-trust-adapter)](https://github.com/alicelabs-llc/universal-trust-adapter/releases)
[![license](https://img.shields.io/badge/license-open--core%20MIT%20%C2%B7%20AL--1.0%20core-blue.svg)](https://marketnow.site/licensing)
[![conformance](https://img.shields.io/badge/conformance-v1.3.5-brightgreen.svg)](https://www.marketnow.site/uta/conformance/)
[![Rekor anchored](https://img.shields.io/badge/Sigstore%20Rekor-anchored-blue.svg)](https://www.marketnow.site/uta/conformance/anchors/)

UTA translates between ALL trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS).

Like Zapier connects applications, **UTA connects trust standards**.

Built by **Edison Flores** & **Alejandro Flores** at **AliceLabs LLC** (Wyoming, USA).

---

## ⚡ Verify our claims — the stranger test (30 seconds)

Every trust claim in this repo is re-derivable by a stranger, from live public URLs, with no account and no trust in our endpoints:

```bash
# 9 checks against Sigstore Rekor's LIVE transparency-log data:
# entry exists · content hash · countersignature · signed tree head ·
# Merkle inclusion proof · C2SP checkpoint — all verified locally.
curl -sL https://www.marketnow.site/uta/conformance/anchors/verify-rekor.mjs -o verify-rekor.mjs
node verify-rekor.mjs

# Full conformance suite (14 vectors, stage scoring, curl + node only):
# https://www.marketnow.site/uta/conformance/
```

**Exercised in production, receipts public:** we rotated our CA key `mn-ca-002` → `mn-ca-003` on 2026-09-08 after private-key material was found committed to a public repository (exposure confirmed; no third-party misuse observed). Revocation published same-day, postmortem public: **https://marketnow.site/security/incidents/2026-09-08**. Three Rekor log entries (logIndex `2762061972`, `2764017355`, `2764479676`) anchor the digests, and the published npm tarball's tar layer rebuilds byte-exact from source (sha256 `519d406a…`).

---

## 🌐 The Stranger Manifesto — 13 languages

> **Trust that requires membership is not trust. It's a guest list.**

Ten build rules for stranger-verifiable agent trust — read it in your language
(every version anchored to the same live receipts):

[English](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-en.md) · [Español](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-es.md) · [Português](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-pt.md) · [Français](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-fr.md) · [Deutsch](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-de.md) · [Italiano](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-it.md) · [Русский](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-ru.md) · [日本語](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-ja.md) · [中文](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-zh.md) · [한국어](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-ko.md) · [हिन्दी](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-hi.md) · [العربية](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-ar.md) · [Türkçe](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/manifesto/manifesto-tr.md)

Markdown sources: [`manifesto/`](./manifesto/) — one file per language, same content, same receipts.
Rendered right here on GitHub; the marketnow.site/manifesto/ pages ship with the next site deploy.

## 🌍 Visa & Mastercard article — 14 languages

*"Visa has a Trusted Agent Protocol. Mastercard has Verifiable Intent. Here's the layer neither one gives you."*

- **[English — canonical, full version](https://dev.to/edison_flores_6d2cd381b13/visa-has-a-trusted-agent-protocol-mastercard-has-verifiable-intent-heres-the-layer-neither-one-5g41)**
- [العربية](https://dev.to/edison_flores_6d2cd381b13/fyz-ldyh-brwtwkwl-llwkl-lmwthwqyn-wmstrkrd-ldyh-verifiable-intent-whdhh-hy-ltbq-lty-l-51kl)
- [Deutsch](https://dev.to/edison_flores_6d2cd381b13/visa-hat-ein-trusted-agent-protokoll-mastercard-hat-verifiable-intent-hier-ist-die-schicht-die-1072)
- [Español](https://dev.to/edison_flores_6d2cd381b13/visa-tiene-un-protocolo-de-agentes-de-confianza-mastercard-tiene-verifiable-intent-esta-es-la-2blc)
- [Français](https://dev.to/edison_flores_6d2cd381b13/visa-a-un-protocole-dagents-de-confiance-mastercard-a-la-verifiable-intent-voici-la-couche-4g19)
- [हिन्दी](https://dev.to/edison_flores_6d2cd381b13/visa-ke-paas-trusted-agent-protocol-hai-aur-mastercard-ke-paas-verifiable-intent-vh-leyr-jo-donon-men-4ofd)
- [Bahasa Indonesia](https://dev.to/edison_flores_6d2cd381b13/visa-punya-trusted-agent-protocol-mastercard-punya-verifiable-intent-inilah-lapisan-yang-tidak-7bd)
- [Italiano](https://dev.to/edison_flores_6d2cd381b13/visa-ha-un-protocollo-per-agenti-affidabili-mastercard-ha-la-verifiable-intent-ecco-il-layer-che-21f5)
- [日本語](https://dev.to/edison_flores_6d2cd381b13/visahatrusted-agent-protocolwo-mastercardhaverifiable-intentwochi-tuteiru-dotiramokurenaireiyagakokoniaruri-ben-yu-ban--3bnc)
- [한국어](https://dev.to/edison_flores_6d2cd381b13/visaneun-trusted-agent-protocoli-issgo-mastercardneun-verifiable-intentga-issda-dul-da-juji-anhneun-reieoga-yeogi-issda-hangugeo-om5)
- [Português](https://dev.to/edison_flores_6d2cd381b13/a-visa-tem-um-protocolo-de-agentes-confiaveis-a-mastercard-tem-verifiable-intent-aqui-esta-a-3g8d)
- [Русский](https://dev.to/edison_flores_6d2cd381b13/u-visa-iest-protokol-dovieriennykh-aghientov-u-mastercard-verifiable-intent-vot-sloi-kotorogho-nie-hed)
- [Türkçe](https://dev.to/edison_flores_6d2cd381b13/visanin-bir-trusted-agent-protocolu-mastercardin-verifiable-intenti-var-ikisinin-de-size-2o27)
- [Tiếng Việt](https://dev.to/edison_flores_6d2cd381b13/visa-co-trusted-agent-protocol-mastercard-co-verifiable-intent-day-la-lop-ma-khong-ben-nao-cung-16kg)
- [中文](https://dev.to/edison_flores_6d2cd381b13/visa-you-liao-ke-xin-dai-li-xie-yi-mastercard-you-liao-ke-yan-zheng-yi-tu-dan-ta-men-du-mei-gei-ni-de-na-ceng-zhong-wen-ban--n4g)

## 🌍 Global Trust Series (multi-language, 2026-09-08)

The 2026 gray-market quota trust crisis, documented — plus the receipts-based fix:

- [English](https://telegra.ph/You-Paid-an-AI-Reseller--Then-the-Rules-Changed-Mid-Cycle-09-08) — You Paid an AI Reseller — Then the Rules Changed Mid-Cycle
- [中文](https://telegra.ph/你买的-AI-合租中转被改规则或跑路开发者自保清单附密码学验证思路-09-08) — 你买的 AI 合租/中转被改规则或跑路？开发者自保清单
- [Русский](https://telegra.ph/Oplatili-AI-podpisku-cherez-posrednika--a-pravila-izmenilis-posredi-cikla-09-08) — Оплатили AI-подписку через посредника — а правила изменились посреди цикла?
- [Español](https://telegra.ph/Pagaste-por-Claude-o-Cursor-a-un-revendedor-y-las-reglas-cambiaron-a-mitad-del-ciclo-09-08) — Pagaste por Claude o Cursor a un revendedor ¿y las reglas cambiaron a mitad del ciclo?
- [Sourced timeline (EN)](https://rentry.co/y26cps92) — The 2026 AI Quota Gray-Market Trust Crisis — A Sourced Timeline
- [Series index](https://telegra.ph/MarketNow-Global-Trust-Series-2026-09-08) · Verify a trust card: https://marketnow.site/verify

## 🆕 What's new — v5.1 (revocation that answers + tool fingerprinting)

**Release v5.1 — roadmap items 1 & 5 (commit 7fb7db6a, Rekor anchor #4):**

- **ATC Revocation + Transparency Log (MNR-CRL-1.0)** — a signed, append-only revocation registry for Agent Trust Cards and CA keys. The `/api/trust?action=revocation` page used to *promise* an OCSP responder that returned 404; now `GET /api/ocsp?card_id=…` / `?kid=…` answers for real: VALID / EXPIRED / REVOKED / SUPERSEDED / UNKNOWN, with PERMIT/DENY recommendation, fail-closed semantics, and the CRL signature embedded so any client can verify the signed layer independently (`GET /api/crl`). Seeded with real events — 3 superseded ATCs + the `mn-ca-002` key compromise (2026-09-08).
- **Cryptographic Tool Fingerprinting (TFP-1.0)** — the OWASP MCP Cheat Sheet control "verify tool descriptions haven't changed", as an MCP tool: SHA-256 over the RFC 8785 JCS canonical form of each tool + a manifest fingerprint for the whole `tools/list` surface + drift reports (added / removed / changed) against pinned manifests. The core defense against tool poisoning and rug-pull redefinitions.
- **MCP endpoint v1.14.1** (9 public remote tools — discovery/trust surface) and **npm `marketnow-mcp@1.14.1`** (15 local trust/security tools) — remote surface and package surface are different by design: the endpoint exposes public discovery over the live catalog, the package runs client-side against local credentials. The npm package also fixed the broken `repository.directory` link and upgraded the MCP SDK (DNS-rebinding advisory resolved; `npm audit` clean).
- **Interceptor v1.1.0** (`@marketnow/cline-trust-plugin`, [npm](https://www.npmjs.com/package/@marketnow/cline-trust-plugin)) — revocation gate (fail-closed, 5-min TTL) + per-server tool-surface pinning/verification.
- **Sentinel semgrep rules v2** — 29 rules: +tool-poisoning (MCP-TP), +exfiltration chains (MCP-EX), +multi-step attack chains (MCP-AC, roadmap v5.4 preview), +stale-trust caching (MCP-RR).
- **Rekor anchor #4** (logIndex 2771735480) — the revocation registry itself is anchored in Sigstore's public log; the revocation history is third-party-checkable end-to-end.

### v1.3.3 — the receipts release (previous)

**Stranger-verifiable trust evidence:**

- **Rekor transparency anchors (entries #1–#3)** — result digests committed to Sigstore's public append-only log; 9 local checks against live third-party data (run the stranger test above)

**Stranger-verifiable trust evidence:**

- **Rekor transparency anchors** — result digests committed to Sigstore's public append-only log; 9 local checks against live third-party data (run the stranger test above)
- **Exercised CA key rotation** — `mn-ca-002` → `mn-ca-003` (key material found in a public repo; exposure confirmed, no third-party misuse), revocation published same-day — [postmortem](https://marketnow.site/security/incidents/2026-09-08), verifiers fail-safe inside the window
- **Reproducible build** — `agent-trust-card@1.1.2`'s tar layer rebuilds byte-exact from source (the `.tgz` is anchored by digest; the tar layer by rebuild)
- **New failure vectors** — `premature-atc` (credential accepted before verification completes), `expired-atc` (key no longer valid at verify time), stage scoring, published generator CA
- **Conformance v1.3.3** — 14 public vectors · 24 checks + 10 mutants (runner-under-test) · versioned digests

### v1.2.0 — Domain Reputation Endpoint (previous)

**Domain Reputation Endpoint** (`/api/reputation`) — UTA now answers a second class of trust
question. The Universal Trust API verifies *credentials*; this endpoint answers
*"can I trust this domain before I show it to a human or act on it?"*

- **Spec:** [`api/reputation-spec.md`](./api/reputation-spec.md) · v1.2 engine, stable
- **Reference implementation:** [`api/reputation.ts`](./api/reputation.ts) — one file, zero
  dependencies, hosting-neutral (Node 18+, Deno, Bun, Cloudflare Workers, any edge runtime)
- **Verdicts:** `trusted` (95) · `unknown` (55) · `caution` (35) · `risky` (8) — deterministic,
  transparent reasons, free & keyless, CDN-cacheable 24h
- **Client parity:** identical engine runs in the browser ([ProdIntel](https://github.com/alicelabs-llc/Scraper)
  `services/sourceTrust.ts`) — badges render instantly offline, get server-confirmed when reachable
- **First consumer in production:** ProdIntel source safety gate
- **v1.2 engine fix:** shortener matching is now exact-host/subdomain — v1.1 substring
  matching wrongly scored `risky` marketplaces containing `t.co` inside `<name>.com`
  (walmart.com, target.com, homedepot.com, flipkart.com). Cache consumers should key on v1.2.

Code lives in this repo (GitHub is the single source of truth). Deployment is bring-your-own-host.

---

## ATC Versions in this repo

UTA supports **TWO versions of ATC** (Agent Trust Card):

| Version | Status | Multi-sig | Spec file | Description |
|---|---|---|---|---|
| **ATC/1.0** | Public, stable | Single-sig (Ed25519) | [`SPEC.md`](./marketnow/docs/atc-spec/SPEC.md) | Simple, single-CA credential. SDK at `agent-trust-card@1.1.2` on NPM. |
| **ATC v3.0** | Draft 00, pre-public review | Multi-format (Ed25519 + EAT-CWT + W3C VC) | [`RFC-ATC-v3-Draft-00.md`](./marketnow/docs/atc-spec/RFC-ATC-v3-Draft-00.md) | Multi-sig (N-of-M), multi-format. Backward-compatible with v2.0. Used internally by UTA. |

ATC v3.0 supersedes ATC v2.0 (which itself was the basis for the simpler ATC/1.0 SDK). A v2.0 ATC remains valid; v3.0 verifiers accept v2.0 credentials and treat them as having a single signature.

---

## 🚀 Quick install

```bash
# Multi-source installer (tries 5 channels in order)
curl -fsSL https://marketnow.site/install.sh | bash

# Or install individual packages
npm install agent-trust-card        # ATC/1.0 SDK
npm install -g marketnow-mcp       # MCP server (15 trust tools)
npx @marketnow/uta-conformance    # run the 14-vector conformance suite
npx @marketnow/sentinel-rules --path .  # 29 MCP security rules, zero-dep scan
npx marketnow-audit bit.ly        # domain scam-check + ATC + OCSP, CI exit codes
```

## 📊 Project stats

| Metric | Value |
|---|---|
| NPM packages | 12 (combined last-week downloads: 4,901+) |
| Conformance (live) | 14 public vectors · 24 checks + 10 mutants · v1.3.5 (npm-synced) |
| Transparency anchors | 3 Rekor log entries (verify-rekor.mjs, 9 checks) |
| CA key rotation | exercised 2026-09-08 (`mn-ca-002` → `mn-ca-003`) — [postmortem](https://marketnow.site/security/incidents/2026-09-08) — [postmortem](https://marketnow.site/security/incidents/2026-09-08) |
| Test vectors (ATC/1.0) | 5 frozen + manifest |
| Test vectors (ATC v3.0) | 36 (8 positive + 17 negative + 5 mutation + 6 cross-language) |
| Format adapters | 9 (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE, X.509) |
| Dev.to articles | 100 (EN + 15 languages) |
| Download channels | 5 (NPM, jsDelivr, unpkg, marketnow.site, GitHub) |

## 📦 Packages

| Package | Version | Description | Downloads (last week) |
|---|---|---|---|
| [`marketnow-mcp`](https://www.npmjs.com/package/marketnow-mcp) | 1.14.1 | MCP server with 15 trust tools (+revocation, +fingerprinting; SDK hardened, `npm audit` clean) | 1,003/wk |
| [`agent-trust-card`](https://www.npmjs.com/package/agent-trust-card) | 1.4.1 | ATC/1.0 SDK (issue, verify, inspect) | 616/wk |
| [`marketnow-install-stack`](https://www.npmjs.com/package/marketnow-install-stack) | 1.2.1 | Multi-source installer (5 stacks over the live catalog) | 178/wk |
| [`@marketnow/uts`](https://www.npmjs.com/package/@marketnow/uts) | 2.0.3 | Universal Trust Schema | 298/wk |
| [`@marketnow/trust-core`](https://www.npmjs.com/package/@marketnow/trust-core) | 2.0.3 | Trust Engine core: verification pipeline + behavior/drift + policy + trajectory + cross-agent (92 exports, zero deps) | 313/wk |
| [`@marketnow/trust-adapters`](https://www.npmjs.com/package/@marketnow/trust-adapters) | 1.0.4 | 9 format adapters (X509 exported; self-contained, zero deps) | 282/wk |
| [`@marketnow/trust-gateway`](https://www.npmjs.com/package/@marketnow/trust-gateway) | 1.0.5 | MCP middleware gateway + ReceiptStore/ReceiptGenerator exported (self-contained, zero deps) | 307/wk |
| [`@marketnow/cline-trust-plugin`](https://www.npmjs.com/package/@marketnow/cline-trust-plugin) | 1.1.2 | Cline interceptor: revocation gate + TFP tool-surface pinning | 346/wk |
| [`@marketnow/uta-conformance`](https://www.npmjs.com/package/@marketnow/uta-conformance) | 1.3.5 | 14 signed vectors + reference scorer + card generator — `npx @marketnow/uta-conformance` | 307/wk |
| [`@marketnow/sentinel-rules`](https://www.npmjs.com/package/@marketnow/sentinel-rules) | 1.1.2 | 29 MCP security rules: semgrep config + zero-dep lite scanner — `npx @marketnow/sentinel-rules --path .` | 471/wk |
| [`@marketnow/trust-mcp-middleware`](https://www.npmjs.com/package/@marketnow/trust-mcp-middleware) | 1.0.2 | MCP `tools/call` wrapper: credential enforcement + signed audit receipts | 319/wk |
| [`@marketnow/trust-observability`](https://www.npmjs.com/package/@marketnow/trust-observability) | 1.0.3 | Zero-dep observability: structured logging, tracing, Prometheus metrics | 461/wk |
| [`@marketnow/uta-verify`](https://www.npmjs.com/package/@marketnow/uta-verify) | 1.0.0 | CLI credential verifier: ATC v3, JWT, VC, A2A, EAT, ZTA, MCP — CI exit codes | new |
| [`marketnow-audit`](https://www.npmjs.com/package/marketnow-audit) | 1.0.0 | Security audit CLI: domain scam-check, ATC verify, OCSP status, catalog — exit codes for CI (`0` PERMIT / `1` DENY / `2` CAUTION) | new |

## 🛡️ 5 Anti-ban download channels

1. **NPM Registry** — primary, independent of GitHub
2. **jsDelivr CDN** — free global CDN, mirrors NPM automatically
3. **unpkg CDN** — alternative CDN, also mirrors NPM
4. **marketnow.site** — AliceLabs-owned origin server
5. **GitHub org** — `alicelabs-llc/universal-trust-adapter` (this repo)

## 🔢 Taxonomy — which count belongs to which system

Three different counts coexist in this ecosystem. They are **not** three ways of
counting the same thing:

| System | Count | What it counts | Where to verify |
|---|---|---|---|
| **Sentinel** (audit pipeline) | **12 stages / 10 layers** | Index certification (L1), static analysis (L1.5–L1.9), deep tarball scan (L2, 29 rules), sandbox (L2.5), runtime monitoring (L3), dependency/secrets/SBOM/policy (L4–L9) | [/security/sentinel-v3.0](https://marketnow.site/security/sentinel-v3.0) |
| **ATC/1.0** (credential verification) | **10 controls — 8 required + 2 optional** | Signature, key selection, expiry, status, revocation… per ATC card | [SPEC.md §2](./marketnow/docs/atc-spec/SPEC.md) |
| **UTA** (interop layer) | **9 format adapters** | Credential formats translated through UTS: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE, X.509 | [/uta](https://marketnow.site/uta) |

If a surface says "8-layer audit" anywhere, it is stale — the Sentinel pipeline is
12 stages grouped into 10 audit layers (L1–L9). ATC's "8" is the count of *required*
verification controls (10 total). UTA's number is *formats*, not layers.

## 🔢 Taxonomy — which count belongs to which system

Three different counts coexist in this ecosystem. They are **not** three ways of
counting the same thing:

| System | Count | What it counts | Where to verify |
|---|---|---|---|
| **Sentinel** (audit pipeline) | **12 stages / 10 layers** | Index certification (L1), static analysis (L1.5–L1.9), deep tarball scan (L2, 29 rules), sandbox (L2.5), runtime monitoring (L3), dependency/secrets/SBOM/policy (L4–L9) | [/security/sentinel-v3.0](https://marketnow.site/security/sentinel-v3.0) |
| **ATC/1.0** (credential verification) | **10 controls — 8 required + 2 optional** | Signature, key selection, expiry, status, revocation… per ATC card | [SPEC.md §2](./marketnow/docs/atc-spec/SPEC.md) |
| **UTA** (interop layer) | **9 format adapters** | Credential formats translated through UTS: ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE, X.509 | [/uta](https://marketnow.site/uta) |

If a surface says "8-layer audit" anywhere, it is stale — the Sentinel pipeline is
12 stages grouped into 10 audit layers (L1–L9). ATC's "8" is the count of *required*
verification controls (10 total). UTA's number is *formats*, not layers.

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

> ⚠️ **TEST ONLY — this private key is intentionally public. It MUST NEVER be trusted in production.**
> `ca-test-2` exists so any stranger can regenerate and re-sign the conformance vectors in any language.
> Signatures under `ca-test-2` prove conformance-suite behavior — nothing else. Production CAs
> (`mn-ca-003`) are separate keys, never published, and their lifecycle is auditable in the
> [revocation registry](https://marketnow.site/api/crl) and the
> [2026-09-08 incident postmortem](https://marketnow.site/security/incidents/2026-09-08).

> ⚠️ **TEST ONLY — this private key is intentionally public. It MUST NEVER be trusted in production.**
> `ca-test-2` exists so any stranger can regenerate and re-sign the conformance vectors in any language.
> Signatures under `ca-test-2` prove conformance-suite behavior — nothing else. Production CAs
> (`mn-ca-003`) are separate keys, never published, and their lifecycle is auditable in the
> [revocation registry](https://marketnow.site/api/crl) and the
> [2026-09-08 incident postmortem](https://marketnow.site/security/incidents/2026-09-08).

## 📋 Specs & docs

- **License matrix (all components):** https://marketnow.site/licensing
- **CA incident postmortem 2026-09-08:** https://marketnow.site/security/incidents/2026-09-08
- **License matrix (all components):** https://marketnow.site/licensing
- **CA incident postmortem 2026-09-08:** https://marketnow.site/security/incidents/2026-09-08
- **ATC/1.0 Spec:** [`marketnow/docs/atc-spec/SPEC.md`](./marketnow/docs/atc-spec/SPEC.md)
- **ATC v3.0 RFC Draft:** [`marketnow/docs/atc-spec/RFC-ATC-v3-Draft-00.md`](./marketnow/docs/atc-spec/RFC-ATC-v3-Draft-00.md)
- **Domain Reputation API spec:** [`api/reputation-spec.md`](./api/reputation-spec.md)
- **Universal Trust API spec:** [`api/trust-api-spec.md`](./api/trust-api-spec.md)
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

## License

Dual-licensed under **MIT OR Apache-2.0, at your option** — free for any use, including
commercial use. This repo and all MarketNow npm packages (marketnow-mcp v1.14.0+,
agent-trust-card v1.4.0+, @marketnow/*) ship dual-licensed: see
[LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
Trademarks ("MarketNow", "UTA", "ATC") are reserved by AliceLabs LLC — see [NOTICE](NOTICE).
