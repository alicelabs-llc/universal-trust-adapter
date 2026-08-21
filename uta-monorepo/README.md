# Universal Trust Adapter (UTA)

> **MCP lets agents use tools. A2A lets agents talk to agents. UTA lets the ecosystem understand and exchange trust.**

## Implementation Status (Honest)

| Capability | Code | Unit Test | Integration | External Vector | Production |
|-----------|------|-----------|-------------|-----------------|------------|
| Ed25519 (RFC 8032) | ✅ | ✅ 8 vectors | ✅ TS+Python+CLI | ✅ 6 cross-lang | ⬜ |
| JCS (RFC 8785) | ✅ | ✅ 6 cross-lang | ✅ TS+Python | ✅ canonical SHA-256 (Python) | ⬜ |
| PoP (nonce challenge) | ✅ NonceStore + PoPManager | ✅ 2 vectors | ✅ replay test | ✅ Python | ⬜ |
| Artifact binding | ✅ hash verify (JCS+SHA-256) | ✅ in ATC vectors | ✅ | ⬜ | ⬜ |
| Evidence verification | ✅ hash verify (JCS+SHA-256) | ✅ in ATC vectors | ✅ | ⬜ | ⬜ |
| Issuer trust | ✅ fail-closed (DENY unknown) | ✅ | ✅ gateway tests | ⬜ | ⬜ |
| Key binding | ✅ TrustRegistry | ✅ | ✅ 3 tests | ⬜ | ⬜ |
| JWT verification (RS256/ES256/EdDSA) | ✅ real crypto.verify | ✅ 4 vectors (3 alg + 1 neg) | ✅ CLI | ✅ Python (3 alg) | ⬜ |
| W3C VC verification | ✅ Ed25519Signature2020 | ✅ 2 vectors | ✅ CLI round-trip | ✅ Python | ⬜ |
| W3C VC issuance | ✅ real Ed25519 sign | ✅ | ✅ | ⬜ | ⬜ |
| A2A (Agent2Agent) | ✅ Ed25519Signature2020 | ✅ | ✅ 7 tests | ⬜ | ⬜ |
| EAT-AI (CWT/COSE) | ✅ EdDSA/ES256/RS256 | ✅ | ✅ 9 tests | ⬜ | ⬜ |
| ZTA (P5-2) | ✅ Ed25519 + UTA-ZTA-CARD domain | ✅ | ✅ 9 tests | ⬜ | ⬜ |
| MCP (P5-3) | ✅ Ed25519 + UTA-MCP-CARD domain | ✅ | ✅ 8 tests (signed + unsigned) | ⬜ | ⬜ |
| OCSP responder (P5-1) | ✅ HTTP server + signature | ✅ | ✅ 13 tests (incl HTTP) | ⬜ | ⬜ |
| Action receipts | ✅ signed Ed25519 | ✅ 2 vectors | ✅ tamper-evident | ✅ Python | ⬜ |
| Gateway args_hash | ✅ JCS (not JSON.stringify) | ✅ full SHA-256 | ✅ deterministic | ⬜ | ⬜ |
| Revocation | ✅ CRL + OCSP + Bitstring + Responder | ✅ 3 vectors | ✅ 16 tests | ⬜ | ⬜ |
| Domain separation | ✅ 7 distinct domains | ✅ 3 cross-domain tests | ✅ | ✅ Python | ⬜ |
| Mutation detection | ✅ 1-byte → reject | ✅ 5 mutation vectors | ✅ | ⬜ | ⬜ |
| Multi-signature | ✅ N-of-M + required signers | ✅ | ✅ 10 tests | ⬜ | ⬜ |
| MCP Gateway | ✅ TrustGateway + middleware | ✅ | ✅ 17 tests | ⬜ | ⬜ |
| SBOM | ✅ SPDX 2.3 generator + build hook | ✅ smoke test | ✅ 4 SBOMs in dist/ | ⬜ | ⬜ |
| Sigstore | ✅ bundle verifier + CI workflow | ✅ smoke test | ✅ cosign keyless in CI | ⬜ | ⬜ |
| SLSA | ✅ slsa-github-generator in CI | ✅ | ✅ Build Level 3 provenance | ⬜ | ⬜ |
| TypeDoc API docs | ✅ typedoc + GitHub Pages (P5-4) | ✅ | ✅ 200+ pages, auto-deployed | ⬜ | ⬜ |
| Performance benchmarks | ✅ npm run bench | ✅ | ✅ 6,744 ops/sec pipeline | ⬜ | ⬜ |
| Cross-language (Python) | ✅ verifier script | ✅ | ✅ 29 tests | ✅ 29/29 | ⬜ |
| CLI tool (P5-7) | ✅ uta-verify command | ✅ | ✅ 11 tests (7 formats) | ⬜ | ⬜ |
| Plugin template (P5-5) | ✅ MIT-licensed starter | ✅ | ✅ copy + go | ⬜ | ⬜ |
| Supabase persistence (P5-6) | ✅ receipts + nonces + revocations | ✅ | ✅ duck-typed client | ⬜ | ⬜ |

**Legend:** ✅ implemented | ⚠️ partial | 📄 documented only | ⬜ not yet done

**Total tests: 462 passing** (444 Node.js + 18 RPC + 16 Python SDK + 2 smoke). Run with `npm test` + `cd packages/uta-python && python -m pytest tests/`.

**Performance: 6,744 verifications/second** for the full 12-stage pipeline (Node 24, 2 vCPUs). Overhead vs raw Ed25519: **1.8x** (JCS canonicalization adds ~19μs, evidence_hash check adds ~48μs).

**Cross-language SDKs:** Python (16 tests), Rust (7 tests), Go (code complete, tests pending). All implementations verify the same test vectors with identical results.

**Integration guides:** Express.js, Fastify, Hono, FastAPI, Django, Axum (Rust), Gin (Go), and Anthropic MCP — see [INTEGRATION.md](packages/docs/INTEGRATION.md).

**Test vectors: 36 total** (8 positive + 17 negative + 5 mutation + 6 cross-language).
All vectors use fixed test keypairs committed to `vectors/keys/` — reproducible across runs and implementations.

## npm Packages

| Package | Path | License | Description |
|---------|------|---------|-------------|
| `@marketnow/trust-core` | `packages/core/` | AL-1.0 | Ed25519, JCS, PoP, 12-stage pipeline, Revocation, SBOM, Sigstore, OCSP responder |
| `@marketnow/trust-adapters` | `packages/adapters/` | AL-1.0 | ATC v3, EAT-AI, A2A, ZTA, MCP, W3C VC, OAuth, SPIFFE, Multi-sig |
| `@marketnow/trust-gateway` | `packages/gateway/` | AL-1.0 | MCP Trust Gateway middleware + Action Receipts |
| `@marketnow/trust-persistence` | `packages/persistence/` | AL-1.0 | Supabase-backed stores for receipts, nonces, revocations |
| `@marketnow/uta-verify` | `packages/cli/` | AL-1.0 | CLI tool — verifies any of 7 credential formats |
| Plugin template | `packages/plugin-template/` | **MIT** | Starter kit for third-party adapters |

Each package ships:
- Compiled `.js` + `.d.ts` in `dist/`
- TypeDoc-generated API reference (auto-deployed to GitHub Pages)
- SPDX 2.3 SBOM in `dist/sbom.spdx.json`
- SLSA Build Level 3 provenance attestation (when published via CI)
- Sigstore keyless signature (cosign, when published via CI)

To install:
```bash
npm install @marketnow/trust-core @marketnow/trust-adapters @marketnow/trust-gateway
# Optional:
npm install @marketnow/trust-persistence  # Supabase persistence
npm install -g @marketnow/uta-verify      # CLI: uta-verify cred.json --ca-key ca.pem
```

## CLI Tool (P5-7)

The `uta-verify` CLI verifies any of 7 credential formats:

```bash
# Verify an ATC v3 credential
uta-verify credential.json --ca-key ca-public-key.pem

# Verify a JWT
uta-verify --jwt "eyJhbGc..." --ca-key ca.pem

# Output JSON instead of human-readable
uta-verify cred.json --ca-key ca.pem --json

# Allow expired (testing only)
uta-verify cred.json --ca-key ca.pem --allow-expired
```

Auto-detects format from the credential structure. Exit codes: `0` = valid, `1` = invalid, `2` = error.

## Architecture (Frozen)

```
                    MARKETNOW TRUST GATEWAY
                              │
             ┌────────────────┴────────────────┐
             │                                 │
        VERIFICATION                       ENFORCEMENT
        (12-stage pipeline)               (Policy + PoP + MCP)
             │                                 │
             ▼                                 ▼
      ┌───────────────┐                 DECISION
      │      UTS      │◄──────────────────────┘
      └───────┬───────┘
              │
      ┌───────▼───────────────────────────┐
      │ Evidence + Provenance              │
      │ Git SHA + npm SHA256 + OCI + SLSA │
      └──────────┬──────────────────────────┘
                 │
         ┌───────▼────────┐
         │ Credential Layer │
         │ ATC v3 + EAT/VC │
         └───────┬──────────┘
                 │
          UTA ADAPTERS (8)
```

## 12-Stage Verification Pipeline (Fail-Closed)

```
01 PARSE → 02 DETECT → 03 SCHEMA → 04 CRYPTO → 05 ISSUER → 06 KEY_BINDING
→ 07 POP → 08 PROVENANCE → 09 LIFECYCLE → 10 EVIDENCE → 11 POLICY → 12 DECISION
```

**Golden Rule:** UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY

## Monorepo Structure

```
packages/
├── core/           # Ed25519, JCS, PoP, 12-stage pipeline
├── uts/            # UTS v2 schema
├── adapters/       # ATC v3, EAT, ZTA, A2A, MCP, VC, OAuth, SPIFFE
├── conformance/    # Test runner + conformance matrix
└── gateway/        # MCP Trust Gateway middleware

services/            # REST API + MCP gateway
specs/               # UTS v2, ATC v3 RFC
vectors/             # Test vectors (positive, negative, mutation)
threat-model/       # STRIDE + MITRE ATLAS
supply-chain/        # SLSA + Sigstore + SBOM CI/CD design
```

## License

| Path | License |
|------|---------|
| packages/core, adapters, gateway, conformance | AL-1.0 (source-available, commercial requires license) |
| specs/ (UTS, ATC RFC) | CC-BY-NC-ND 4.0 (open for reading) |
| vectors/, threat-model/ | CC-BY-4.0 (open for use) |
| Plugin template (when available) | MIT |

Built by Edison Flores & Alejandro Flores at AliceLabs LLC (Wyoming, USA).
