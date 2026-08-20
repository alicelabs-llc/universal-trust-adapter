# Universal Trust Adapter (UTA)

> **MCP lets agents use tools. A2A lets agents talk to agents. UTA lets the ecosystem understand and exchange trust.**

## Implementation Status (Honest)

| Capability | Code | Unit Test | Integration | External Vector | Production |
|-----------|------|-----------|-------------|-----------------|------------|
| Ed25519 (RFC 8032) | ✅ | ✅ 8 vectors | ✅ TS+Python | ✅ 6 cross-lang | ⬜ |
| JCS (RFC 8785) | ✅ | ✅ 6 cross-lang | ✅ TS+Python | ✅ canonical SHA-256 (Python) | ⬜ |
| PoP (nonce challenge) | ✅ NonceStore + PoPManager | ✅ 2 vectors | ✅ replay test | ✅ Python | ⬜ |
| Artifact binding | ✅ hash verify (JCS+SHA-256) | ✅ in ATC vectors | ✅ | ⬜ | ⬜ |
| Evidence verification | ✅ hash verify (JCS+SHA-256) | ✅ in ATC vectors | ✅ | ⬜ | ⬜ |
| Issuer trust | ✅ fail-closed (DENY unknown) | ✅ | ✅ gateway tests | ⬜ | ⬜ |
| Key binding | ✅ TrustRegistry | ✅ | ✅ 3 tests | ⬜ | ⬜ |
| JWT verification (RS256/ES256/EdDSA) | ✅ real crypto.verify | ✅ 4 vectors (3 alg + 1 neg) | ✅ | ✅ Python (3 alg) | ⬜ |
| W3C VC verification | ✅ Ed25519Signature2020 | ✅ 2 vectors | ✅ round-trip | ✅ Python | ⬜ |
| W3C VC issuance | ✅ real Ed25519 sign | ✅ | ✅ | ⬜ | ⬜ |
| Action receipts | ✅ signed Ed25519 | ✅ 2 vectors | ✅ tamper-evident | ✅ Python | ⬜ |
| Gateway args_hash | ✅ JCS (not JSON.stringify) | ✅ full SHA-256 | ✅ deterministic | ⬜ | ⬜ |
| Revocation | ✅ CRL + OCSP + Bitstring Status List | ✅ 3 vectors | ✅ 3 tests | ⬜ | ⬜ |
| Domain separation | ✅ 5 distinct domains | ✅ 3 cross-domain tests | ✅ | ✅ Python | ⬜ |
| Mutation detection | ✅ 1-byte → reject | ✅ 5 mutation vectors | ✅ | ⬜ | ⬜ |
| Multi-signature | ✅ N-of-M + required signers | ✅ | ✅ 10 tests | ⬜ | ⬜ |
| MCP Gateway | ✅ TrustGateway + middleware | ✅ | ✅ 17 tests | ⬜ | ⬜ |
| SBOM | ✅ SPDX 2.3 generator + build hook | ✅ smoke test | ✅ 3 SBOMs in dist/ | ⬜ | ⬜ |
| Sigstore | ✅ bundle verifier | ✅ smoke test | ✅ | ⬜ | ⬜ |
| SLSA | 📄 documented | ⬜ | ⬜ | ⬜ | ⬜ |
| Cross-language (Python) | ✅ verifier script | ✅ | ✅ 29 tests | ✅ 29/29 | ⬜ |

**Legend:** ✅ implemented | ⚠️ partial | 📄 documented only | ⬜ not yet done

**Total tests: 243 passing** (76 structural + 76 vector + 33 integration + 17 gateway + 10 multi-sig + 29 Python cross-lang + 2 smoke). Run with `npm test` + `python3 scripts/uta-python-verifier.py`.

**Test vectors: 36 total** (8 positive + 17 negative + 5 mutation + 6 cross-language).
All vectors use fixed test keypairs committed to `vectors/keys/` — reproducible across runs and implementations.

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
