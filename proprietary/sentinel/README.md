# Sentinel — 8-Layer Audit Pipeline

**Proprietary — AliceLabs Source-Available License v1.0 (AL-1.0)**

This directory contains the Sentinel audit pipeline, AliceLabs' proprietary 8-layer security audit system for AI agent trust.

**Status:** Architecture defined, implementation in progress. Each layer is being built separately.

---

## The 8 Layers

| Layer | Name | Purpose | Status |
|---|---|---|---|
| L1 | Metadata Scan | Inspect README, package.json, tool descriptions for red flags | ✅ Implemented |
| L2 | Runtime Sandbox | Execute skill in isolated Docker (`--network none --read-only`) and observe behavior | ✅ Implemented |
| L3 | Static Analysis | Semgrep-equivalent JS/TS rules for command injection, SSRF, secrets | ✅ Implemented |
| L4 | Supply Chain (OSV) | Real-time OSV API check on all dependencies | ✅ Implemented |
| L5 | Prompt Injection | 8-pattern detector for prompt injection in tool descriptions | ✅ Implemented |
| L6 | Differential Execution | Run same skill in 4 sandboxes (base, faketime, honeypot, simulated network); compare syscall trees | 🚧 Implementation Q4 2026 |
| L7 | TEE Attestation | Intel SGX / AMD SEV-SNP / AWS Nitro hardware-anchored identity | 🚧 Implementation Q1 2027 |
| L8 | Human Review | AliceLabs team manual review for high-trust skills | ✅ Process defined |

---

## Layer outputs

Each layer produces a `TrustEvidence` object in UTS format:

```typescript
{
  type: 'sentinel-audit',
  source: 'Sentinel L1.5',
  result: 'pass' | 'fail' | 'warn' | 'info',
  details: 'specific findings...',
  timestamp: '2026-08-20T00:00:00Z',
  evidence_hash: 'sha256:abc...'
}
```

These evidence objects feed into the `trust_claims.owasp_top_10` mapping of the ATC credential.

---

## How Sentinel feeds ATC v3

```
┌─────────────────────────────────────────────────────────────────┐
│  Sentinel Pipeline (proprietary, AL-1.0)                        │
│                                                                  │
│  L1 → L2 → L3 → L4 → L5 → L6 → L7 → L8                         │
│                                            │                     │
│                                            ▼                     │
│                              ┌──────────────────────────┐      │
│                              │  trust_claims.owasp_top_10│      │
│                              │  + trust_claims.anthropic_zta │  │
│                              └──────────────────────────┘      │
│                                            │                     │
│                                            ▼                     │
│  TrustEngine issues ATC v3 credential with trust_claims         │
│  populated from Sentinel evidence                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Subdirectory structure (when implemented)

```
proprietary/sentinel/
├── L1-metadata-scan/
│   ├── README.md
│   ├── scanner.ts                ← Inspect README, package.json, tool descriptions
│   └── patterns.json              ← Red flag patterns to detect
├── L2-runtime-sandbox/
│   ├── README.md
│   ├── sandbox.ts                 ← Docker runner (--network none --read-only)
│   ├── Dockerfile.l2              ← Sandbox image definition
│   └── observation.ts             ← Capture docker logs, diff, top, inspect
├── L3-static-analysis/
│   ├── README.md
│   ├── semgrep-rules.yml          ← 18 patterns (command injection, SSRF, secrets)
│   └── runner.ts
├── L4-supply-chain-osv/
│   ├── README.md
│   ├── osv-checker.ts             ← Calls api.osv.dev
│   └── cache.ts                   ← 24h cache to avoid rate limits
├── L5-prompt-injection/
│   ├── README.md
│   ├── patterns.ts                ← 8 prompt injection patterns
│   └── scanner.ts
├── L6-differential-execution/
│   ├── README.md
│   ├── base-env/                  ← Normal sandbox
│   ├── faketime-env/              ← Libfaketime injected
│   ├── honeypot-env/              ← Fake credentials in env
│   ├── network-env/               ← Simulated DNS resolver
│   └── syscall-matcher.ts         ← Tree diff algorithm
├── L7-tee-attestation/
│   ├── README.md
│   ├── sgx-runner.ts              ← Intel SGX quote generator
│   ├── sev-snp-runner.ts          ← AMD SEV-SNP
│   └── nitro-runner.ts            ← AWS Nitro Enclaves
└── L8-human-review/
    ├── README.md
    ├── checklist.md                ← Reviewer checklist
    └── process.md                  ← How AliceLabs team handles review requests
```

---

## Licensing

All Sentinel code is **proprietary** under AliceLabs Source-Available License v1.0 (AL-1.0).

- ✅ Read source for review
- ✅ Security audit permitted
- ✅ Build for personal non-commercial use
- ❌ Commercial use requires a commercial license
- ❌ Redistribution prohibited

For commercial licensing (including L1-L8 in a product): `legal@alicelabs.site`

See `proprietary/COMMERCIAL-LICENSE.md` for pricing.

---

## Contact

- Security disclosures: `legal@alicelabs.site`
- Commercial licensing: `legal@alicelabs.site`
- L6/L7 technical questions: `engineering@alicelabs.site`

— AliceLabs LLC, 2026-08-20
