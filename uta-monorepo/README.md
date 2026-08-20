# Universal Trust Adapter (UTA) — Monorepo

> **MCP lets agents use tools. A2A lets agents talk to agents. UTA lets the ecosystem understand and exchange trust.**

## Architecture (Frozen — No More Redesigns)

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
├── core/           # BLOQUE B+D: Ed25519, JCS, PoP, 12-stage pipeline
├── uts/            # BLOQUE C: UTS v2 schema (separated concerns)
├── adapters/       # BLOQUE E+I: ATC v3, EAT, ZTA, A2A, MCP, VC, OAuth, SPIFFE
├── conformance/    # BLOQUE J: Golden Corpus + mutation tests
└── gateway/        # BLOQUE K: MCP Trust Gateway middleware

services/
├── trust-api/      # REST API (v2 endpoints)
└── mcp-gateway/    # Runtime enforcement

specs/              # UTS v2, ATC v3 RFC, API spec
vectors/            # Test vectors (positive, negative, mutation, cross-lang)
threat-model/       # STRIDE + MITRE ATLAS
supply-chain/       # SLSA + Sigstore + SBOM + CI/CD
```

## 7 Non-Negotiable Principles

1. **Single Source of Truth** — One TypeScript implementation
2. **Real Cryptography** — Zero stubs. Ed25519 (RFC 8032) + JCS (RFC 8785)
3. **12-Stage Pipeline** — Fail-closed verification
4. **Reproducible Assessment** — Score linked to evidence hashes
5. **Artifact Binding** — Git SHA + npm tarball + OCI digest + SLSA
6. **Proof-of-Possession** — Nonce challenge anti-replay
7. **Control Plane** — Trust Gateway as the central product

## License

- Plugin template: MIT
- UTS specification: CC-BY-NC-ND 4.0
- Engine + Adapters + Gateway: AL-1.0 (AliceLabs Source-Available)

Built by Edison Flores & Alejandro Flores at AliceLabs LLC (Wyoming, USA).
