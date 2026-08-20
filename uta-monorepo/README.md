# Universal Trust Adapter (UTA)

> **MCP lets agents use tools. A2A lets agents talk to agents. UTA lets the ecosystem understand and exchange trust.**

## Implementation Status (Honest)

| Capability | Code | Unit Test | Integration | External Vector | Production |
|-----------|------|-----------|-------------|-----------------|------------|
| Ed25519 (RFC 8032) | ✅ | ✅ 8 vectors | ⬜ | ✅ 6 cross-lang | ⬜ |
| JCS (RFC 8785) | ✅ | ✅ 6 cross-lang | ⬜ | ✅ canonical SHA-256 | ⬜ |
| PoP (nonce challenge) | ✅ NonceStore + PoPManager | ✅ 2 vectors | ⬜ | ⬜ | ⬜ |
| Artifact binding | ✅ hash verify (JCS+SHA-256) | ✅ in ATC vectors | ⬜ | ⬜ | ⬜ |
| Evidence verification | ✅ hash verify (JCS+SHA-256) | ✅ in ATC vectors | ⬜ | ⬜ | ⬜ |
| Issuer trust | ✅ fail-closed (DENY unknown) | ✅ | ⬜ | ⬜ | ⬜ |
| Key binding | ✅ TrustRegistry | ✅ | ⬜ | ⬜ | ⬜ |
| JWT verification (RS256/ES256/EdDSA) | ✅ real crypto.verify | ✅ 4 vectors (3 alg + 1 neg) | ⬜ | ⬜ | ⬜ |
| W3C VC verification | ✅ Ed25519Signature2020 | ✅ 2 vectors | ⬜ | ⬜ | ⬜ |
| W3C VC issuance | ✅ real Ed25519 sign | ✅ | ⬜ | ⬜ | ⬜ |
| Action receipts | ✅ signed Ed25519 | ✅ 2 vectors | ⬜ | ⬜ | ⬜ |
| Gateway args_hash | ✅ JCS (not JSON.stringify) | ✅ full SHA-256 | ⬜ | ⬜ | ⬜ |
| Revocation | ✅ CRL + OCSP + Bitstring Status List | ✅ 3 vectors | ⬜ | ⬜ | ⬜ |
| Domain separation | ✅ 5 distinct domains | ✅ 3 cross-domain tests | ⬜ | ⬜ | ⬜ |
| Mutation detection | ✅ 1-byte → reject | ✅ 5 mutation vectors | ⬜ | ⬜ | ⬜ |
| SLSA | 📄 documented | ⬜ | ⬜ | ⬜ | ⬜ |
| Sigstore | ✅ bundle verifier | ✅ smoke test | ⬜ | ⬜ | ⬜ |
| MCP Gateway | ⚠️ partial | ⬜ | ⬜ | ⬜ | ⬜ |
| SBOM | ✅ SPDX 2.3 generator | ✅ smoke test | ⬜ | ⬜ | ⬜ |

**Legend:** ✅ implemented | ⚠️ partial | 📄 documented only | ⬜ not yet done

**Total tests: 152 passing** (76 structural + 76 vector). Run with `npm test`.

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
