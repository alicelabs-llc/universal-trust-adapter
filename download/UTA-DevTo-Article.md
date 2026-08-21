# UTA — Universal Trust Adapter: The USB-C of Agent Trust

**TL;DR:** We built a universal trust layer for AI agents. 12-stage fail-closed pipeline, 8 credential formats, 480+ tests, 6,744 verifications/sec. Deployed at marketnow.site. Open source (AL-1.0).

---

## The Problem

AI agents are everywhere. MCP lets agents use tools. A2A lets agents talk to each other. But nobody is verifying **who is trustworthy**.

If an agent steals another agent's credentials, there's no cryptographic way to detect it. If someone issues fake trust certificates, there's no CA verification. If a supply chain attacker injects malicious code, there's no binding between source code and trust claims.

**We needed a universal trust layer. So we built one.**

## What is UTA?

UTA (Universal Trust Adapter) is a **format-agnostic trust verification pipeline** that works with any agent credential format. Think of it as the USB-C of agent trust — one universal interface, 8 supported formats, zero vendor lock-in.

### The 12-Stage Pipeline

Every credential goes through 12 stages. Any failure = immediate DENY. No exceptions.

```
01 PARSE → 02 DETECT → 03 SCHEMA → 04 CRYPTO → 05 ISSUER → 06 KEY_BINDING
→ 07 POP → 08 PROVENANCE → 09 LIFECYCLE → 10 EVIDENCE → 11 POLICY → 12 DECISION
```

**Golden Rule:** `UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY`

### 8 Supported Formats

| Format | Algorithm | Status |
|--------|-----------|--------|
| ATC v3 | Ed25519 (RFC 8032) | ✅ Stable |
| JWT | RS256 / ES256 / EdDSA | ✅ Stable |
| W3C VC | Ed25519Signature2020 | ✅ Stable |
| A2A | Ed25519Signature2020 | ✅ Stable |
| EAT-AI | EdDSA / ES256 / RS256 | ✅ Beta |
| ZTA | Ed25519 + domain separation | ✅ Beta |
| MCP | Ed25519 + registry signature | ✅ Stable |
| X.509 | RSA / ECDSA / Ed25519 | ✅ Stable |

### Cryptographic Features

- **Ed25519** (RFC 8032) — 64-byte signatures, verification in ~100μs
- **JCS** (RFC 8785) — deterministic JSON canonicalization, same bytes in any language
- **7 domain separation** — a signature from one context CANNOT verify in another
- **PoP** (Proof-of-Possession) — 32-byte nonce challenge, single-use anti-replay
- **Multi-signature** — N-of-M quorum with required signers policy
- **Post-quantum ready** — ML-DSA-65 (FIPS 204) abstraction with hybrid mode

### Revocation Triple

- **CRL** — signed list of revoked credentials, Ed25519 verified, TTL cached
- **OCSP** — real-time HTTP responder, nonce anti-replay, fail-closed on timeout
- **Bitstring Status List** — W3C 2021, 1 bit per credential, scales to millions in ~30KB

## By the Numbers

| Metric | Value |
|--------|-------|
| Tests passing | 480+ (Node.js) + 16 (Python) |
| Performance | 6,744 verifications/sec |
| Overhead vs raw Ed25519 | 1.8x |
| npm packages | 20+ |
| Language SDKs | TypeScript, Python, Rust, Go |
| Test vectors | 36 (8 positive + 17 negative + 5 mutation + 6 cross-language) |
| Fuzz iterations | 400 (0 crashes) |
| Property tests | 23 mathematical properties verified |

## Supply Chain Hardening

Every package ships with:
- **SBOM** (SPDX 2.3) — generated per package in the build
- **SLSA Build Level 3** — provenance attestation via slsa-github-generator
- **Sigstore keyless** — Fulcio + Rekor via cosign
- **npm provenance** — `npm publish --provenance` attestation

## Deployment

- **Docker** — multi-stage build, Node 20 slim, non-root user
- **Kubernetes** — Helm chart with HPA (2-10 replicas), health checks, security context
- **CI/CD** — GitHub Actions: build → test → SBOM → SLSA → Sigstore → publish
- **CLI** — `uta-verify credential.json --ca-key ca.pem` (7 formats, auto-detect)
- **Dashboard** — web UI for metrics, receipts, and verification

## Try It Now

```bash
# Verify any credential
curl https://marketnow.site/api/trust?action=formats

# See the 12-stage pipeline
curl https://marketnow.site/api/trust?action=pipeline
```

## Installation (when npm packages are published)

```bash
npm install @marketnow/trust-core @marketnow/trust-adapters @marketnow/trust-gateway
```

## License

AL-1.0 (AliceLabs Source-Available License) — source-available, commercial use requires a separate license. Plugin template is MIT.

---

Built by Edison Flores & Alejandro Flores at AliceLabs LLC (Wyoming, USA).
GitHub: github.com/eddyflores100-lang/universal-trust-adapter
