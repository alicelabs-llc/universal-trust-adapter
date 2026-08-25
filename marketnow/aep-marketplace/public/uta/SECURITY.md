# Security Policy

## Supported versions

ATC/1.0 is currently in active development. The latest version on NPM is always the supported version.

| Version | Supported |
|---------|-----------|
| 1.1.x   | ✅        |
| 1.0.x   | ⚠️ (security fixes only) |
| < 1.0   | ❌        |

## Reporting a vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Email: **security@alicelabs.site**

Please include:
- Description of the vulnerability
- Affected component (spec, SDK, conformance runner, test vectors, etc.)
- Reproduction steps (PoC if possible)
- Impact assessment
- Suggested fix (if any)

### Response timeline

- **Acknowledgement:** within 24 hours
- **Triage:** within 72 hours
- **Fix or workaround:** within 7 days for high-severity, 30 days for medium, 90 days for low
- **Public disclosure:** after fix is released, coordinated with reporter

## Scope

### In scope

- ATC/1.0 specification ambiguities that could lead to implementation vulnerabilities
- Reference implementation bugs (`marketnow/atc-sdk/`)
- Test vector inaccuracies
- Conformance runner bugs
- Ed25519 signature verification issues
- RFC 8785 JCS canonicalization bugs
- Revocation list bypass

### Out of scope

- Bugs in third-party libraries (report to upstream)
- Vulnerabilities in dependencies (we use only `node:crypto`, no external crypto deps)
- Theoretical attacks without PoC
- Social engineering

## Threat model

See https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-repo/THREAT_MODEL.md for the documented threat model.

## Disclosure policy

- We believe in coordinated disclosure
- We will credit reporters in release notes (unless they prefer to remain anonymous)
- We will not take legal action against good-faith security research

— AliceLabs LLC Security
