# Universal Trust Adapter (UTA)

> **MCP lets agents use tools. A2A lets agents talk to agents. UTA lets the ecosystem understand and exchange trust.**

## Implementation Status (Honest)

| Capability | Code | Unit Test | Integration | External Vector | Production |
|-----------|------|-----------|-------------|-----------------|------------|
| Ed25519 (RFC 8032) | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| JCS (RFC 8785) | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| PoP (nonce challenge) | ✅ NonceStore + PoPManager | ⬜ | ⬜ | ⬜ | ⬜ |
| Artifact binding | ✅ hash verify (JCS+SHA-256) | ⬜ | ⬜ | ⬜ | ⬜ |
| Evidence verification | ✅ hash verify (JCS+SHA-256) | ⬜ | ⬜ | ⬜ | ⬜ |
| Issuer trust | ✅ fail-closed (DENY unknown) | ⬜ | ⬜ | ⬜ | ⬜ |
| Key binding | ✅ TrustRegistry | ⬜ | ⬜ | ⬜ | ⬜ |
| JWT verification (RS256/ES256/EdDSA) | ✅ real crypto.verify | ⬜ | ⬜ | ⬜ | ⬜ |
| W3C VC verification | ✅ Ed25519Signature2020 | ⬜ | ⬜ | ⬜ | ⬜ |
| W3C VC issuance | ✅ real Ed25519 sign | ⬜ | ⬜ | ⬜ | ⬜ |
| Action receipts | ✅ signed Ed25519 | ⬜ | ⬜ | ⬜ | ⬜ |
| Gateway args_hash | ✅ JCS (not JSON.stringify) | ⬜ | ⬜ | ⬜ | ⬜ |
| Revocation | ⚠️ CRL query only | ⬜ | ⬜ | ⬜ | ⬜ |
| SLSA | 📄 documented | ⬜ | ⬜ | ⬜ | ⬜ |
| Sigstore | 📄 documented | ⬜ | ⬜ | ⬜ | ⬜ |
| MCP Gateway | ⚠️ partial | ⬜ | ⬜ | ⬜ | ⬜ |
| SBOM | 📄 documented | ⬜ | ⬜ | ⬜ | ⬜ |

**Legend:** ✅ implemented | ⚠️ partial | 📄 documented only | ⬜ not yet done

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
