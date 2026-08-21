# Security Policy

## Reporting a Vulnerability

**DO NOT open a public GitHub issue for security vulnerabilities.**

Email: security@alicelabs.site

Include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge within 48 hours and provide a timeline for a fix within 7 days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅        |

## Security Measures

### Cryptography
- **Signing**: Ed25519 (RFC 8032) — no RSA/ECDSA for internal signing
- **Canonicalization**: RFC 8785 JCS — deterministic across all implementations
- **Domain separation**: 7 distinct domains prevent cross-context signature reuse
- **Post-quantum ready**: ML-DSA-65 (FIPS 204) abstraction layer with hybrid mode

### Authentication
- **Agent**: Ed25519 PoP (Proof-of-Possession) with single-use nonce
- **Admin**: API key (X-API-Key header)
- **Multi-tenant**: Per-organization API keys + CA key pairs

### Authorization
- **Trust Gateway**: Per-tool-call policy enforcement (min_trust_score, block_secret_reads, block_shell_exec)
- **Issuer allowlist**: Only credentials from trusted issuers are accepted
- **Rate limiting**: Token bucket (600 req/min default, Redis-backed for distributed deployments)

### Audit Trail
- **Action receipts**: Every ALLOW/DENY decision produces a signed receipt
- **Merkle audit log**: Receipts are chained in a tamper-evident Merkle tree
- **Root signing**: Merkle roots are signed with Ed25519 and can be externally verified

### Supply Chain
- **SBOM**: SPDX 2.3 generated per package
- **SLSA**: Build Level 3 provenance via slsa-github-generator
- **Sigstore**: Keyless signing (Fulcio + Rekor) via cosign
- **npm provenance**: `npm publish --provenance` attestation

### Key Management
- **Rotation**: Automated 90-day rotation with 30-day overlap period
- **Revocation**: CRL + OCSP + Bitstring Status List
- **Compromise**: Manual revocation of legacy keys + webhook notification

## Threat Model

See [THREAT_MODEL.md](threat-model/THREAT_MODEL.md) for the full STRIDE + MITRE ATLAS analysis.

## Disclosure Policy

- Coordinated disclosure with 90-day embargo
- Credit given to reporter (unless they prefer to remain anonymous)
- CVE requested for confirmed vulnerabilities
