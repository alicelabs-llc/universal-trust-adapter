# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| ATC v3.0 (draft) | ✅ Active development |
| ATC v2.0         | ✅ Backward compatible |
| ATC/1.0          | ✅ Stable (SDK: `agent-trust-card@1.x`) |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you believe you have found a security issue in the Universal Trust Adapter (UTA), Agent Trust Card (ATC), or any AliceLabs package, please report it responsibly.

### How to report

**DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, please use **one** of these channels:

1. **GitHub Security Advisories** (preferred)
   - Go to https://github.com/alicelabs-llc/universal-trust-adapter/security/advisories/new
   - Mark as "Private" until we coordinate disclosure
   - Includes private fork workflow for fix collaboration

2. **Email**
   - Send to: `security@alicelabs.site`
   - PGP encrypted: append `-----BEGIN PGP PUBLIC KEY BLOCK-----` request and we'll send the key
   - Subject: `[SECURITY] <short description>`

3. **HackerOne / Bug Bounty** (planned)
   - Not yet active. Track this section for updates.

### What to include

- Description of the vulnerability
- Affected package(s) and version(s)
- Reproduction steps (code snippet, command, or PoC)
- Impact assessment (RCE / data leak / DoS / auth bypass / etc.)
- Suggested mitigation if you have one
- Whether you want public credit (default: anonymous)

### Response timeline

| Step | Target SLA |
|------|-----------|
| Acknowledge receipt | 24 hours |
| Initial assessment + severity rating | 72 hours |
| Mitigation plan communicated | 7 days |
| Fix released | 30 days (Critical/High) / 90 days (Medium/Low) |
| Public disclosure (after fix shipped) | Coordinated with reporter |

## Scope

**In scope:**
- All npm packages published under `@marketnow/*` and `marketnow-*`
- The `uta-monorepo` packages (uts, core, adapters, gateway, mcp-middleware, etc.)
- The `/api/trust` endpoint at marketnow.site
- ATC verification / signing / revocation logic
- The status page at status.marketnow.site

**Out of scope:**
- The marketnow.site landing page (separate codebase)
- Third-party dependencies (report upstream)
- Self-hosted deployments misconfigured by users (we'll help, but not a vuln in UTA itself)
- Findings from automated scanners without manual verification
- Social engineering or phishing attempts

## Threat model

UTA's threat model is documented in `uta-monorepo/threat-model/THREAT_MODEL.md` (STRIDE + MITRE ATLAS). Key concerns:

1. **Credential exfiltration via ATC-signed payloads** — addressed by canonicalization + domain separation
2. **Cross-format signature confusion** — addressed by 7 distinct domain separators (`UTA-ATC-CARD`, `UTA-ZTA-CARD`, etc.)
3. **Supply chain attacks via npm dependencies** — addressed by SBOM (SPDX 2.3) per package, SLSA Build Level 3, Sigstore keyless signing
4. **Prompt injection in agent trust decisions** — addressed by fail-closed pipeline (`UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY`)
5. **Key compromise** — addressed by CRL + OCSP + Bitstring Status List revocation

## Security measures already in place

- **Cryptographic signing**: Ed25519 (RFC 8032) for all ATC cards
- **Canonicalization**: RFC 8785 JCS (deterministic JSON serialization)
- **Domain separation**: 7 distinct signing domains prevent cross-context replay
- **Proof-of-Possession**: 32-byte nonce, single-use (anti-replay)
- **Multi-sig**: N-of-M quorum with `required_key_ids` policy
- **Post-quantum ready**: ML-DSA-65 (FIPS 204) abstraction + hybrid mode
- **Revocation**: CRL + OCSP responder + W3C Bitstring Status List
- **Audit**: Signed action receipts + Merkle audit log (tamper-evident)
- **Supply chain**: SBOM SPDX 2.3 per package, SLSA Build Level 3, Sigstore keyless signing via cosign, npm publish with `--provenance` attestation

## Disclosure policy

- We follow **coordinated disclosure** — we will not publish details of a vulnerability until a fix is available and the reporter agrees (or after 90 days from initial report, whichever comes first).
- We will **credit reporters** in the security advisory and release notes, unless they prefer to remain anonymous.
- We will **not take legal action** against reporters who act in good faith and follow this policy.

## Contact

- **Security email:** security@alicelabs.site
- **GitHub Security Advisories:** https://github.com/alicelabs-llc/universal-trust-adapter/security/advisories/new
- **PGP key:** available on request
- **General inquiries:** info@alicelabs.site

---

Last updated: 2026-08-27
