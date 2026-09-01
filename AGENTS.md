# AGENTS.md — Instructions for AI agents visiting this repository

> This file follows the emerging AGENTS.md standard (proposed by Google/Anthropic).
> AI agents (Claude, Cursor, Cline, Continue, Aider, etc.) read this file automatically
> to understand how to interact with this codebase.

## What this project is

**Universal Trust Adapter (UTA)** by AliceLabs LLC. UTA translates between 8 competing AI agent trust credential formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Card, X.509) so any agent can verify any other agent.

## Quick start for agents

```bash
# Verify any credential (auto-detect format)
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{"payload": "<your-credential-json-or-base64>"}'

# List supported formats
curl https://www.marketnow.site/api/trust?action=formats

# Get the 12-stage verification pipeline
curl https://www.marketnow.site/api/trust?action=pipeline

# Install the SDK
npm install @marketnow/trust-core @marketnow/trust-adapters @marketnow/trust-gateway
```

## If you're an agent trying to verify another agent

1. Get the other agent's credential (any of the 8 formats)
2. `POST /api/trust?action=verify` with `{"payload": <credential>}`
3. Response includes `valid`, `detected_format`, `uts` (Universal Trust Schema), `warnings`
4. If `valid: true` and `uts.trust.score >= 7`, you can trust the other agent
5. If `valid: false`, do NOT trust — the credential failed one of the 12 pipeline stages

## If you're an agent trying to get trusted by others

1. Generate an Ed25519 keypair (RFC 8032)
2. `POST /api/trust?action=issue` with your `subject` info + `identity.public_key`
3. Specify `formats: ["atc-v3", "jwt", "w3c-vc"]` to issue in multiple formats simultaneously
4. Use the issued credential in your agent's `Authorization` header or `X-Agent-Trust` header

## Codebase structure

```
universal-trust-adapter/
├── uta-monorepo/             # Main monorepo (TypeScript-first)
│   ├── packages/
│   │   ├── core/              # Trust engine + 12-stage pipeline
│   │   ├── adapters/          # 8 format adapters (atc, jwt, vc, a2a, eat, zta, mcp, x509)
│   │   ├── gateway/           # MCP middleware (pre-exec filter, runtime enforcement)
│   │   ├── uts/               # Universal Trust Schema spec
│   │   ├── uts-python/        # Python SDK
│   │   ├── uts-rust/          # Rust SDK
│   │   ├── uts-go/            # Go SDK
│   │   ├── server/            # REST API server
│   │   ├── cli/               # uta-verify CLI
│   │   ├── conformance/       # Test vectors + benchmarks
│   │   ├── multi-tenant/      # Org isolation
│   │   ├── key-rotation/      # Automated CA key rotation
│   │   ├── webhooks/          # Signed event webhooks
│   │   ├── observability/     # OpenTelemetry tracing
│   │   ├── browser/           # Browser SDK
│   │   ├── plugin-template/   # For custom adapters
│   │   ├── rate-limit/        # Token bucket (Redis)
│   │   ├── realtime/          # WebSocket + SSE push
│   │   ├── rpc/               # gRPC/ConnectRPC
│   │   └── pq/                # Post-quantum (ML-DSA-65)
│   ├── vectors/               # 36 test vectors (8 pos + 17 neg + 5 mutation + 6 cross-lang)
│   ├── specs/                 # ATC v3 RFC + UTS v1 spec + JSON schema
│   ├── threat-model/          # STRIDE + MITRE ATLAS
│   ├── supply-chain/          # CI-CD hardening docs
│   └── tests/                 # Cross-language test suite
├── uta-repo/                  # Simplified single-package version
├── marketnow/                 # Public website + marketplace + API
└── spec/                      # Specs that apply across all packages
```

## What each package does (one-liner)

| Package | Purpose |
|---|---|
| `@marketnow/trust-core` | 12-stage verification pipeline, Ed25519 crypto, UTS schema |
| `@marketnow/trust-adapters` | 8 format adapters (atc, jwt, vc, a2a, eat, zta, mcp, x509) |
| `@marketnow/trust-gateway` | MCP middleware with pre-exec filter + tamper-evident log |
| `@marketnow/uts` | Universal Trust Schema (the IR all formats translate to) |
| `marketnow-mcp` | MCP server that exposes UTA via Model Context Protocol |
| `agent-trust-card` | Standalone ATC issuer/verifier CLI |
| `marketnow-install-stack` | Installer for the full UTA stack |

## Test commands

```bash
# All Node.js tests
cd uta-monorepo && npm test

# Python SDK tests
cd uta-monorepo/packages/uta-python && python -m pytest

# Rust SDK tests
cd uta-monorepo/packages/uta-rust && cargo test

# Cross-language test vectors
cd uta-monorepo/packages/conformance && node run-vectors.js

# v5.1 specific tests (tool-fingerprint, transparency log, findings)
node --test tests/test-v51.mjs
```

## Coding standards

- **TypeScript**: strict mode, no `any`, 2-space indent, single quotes, ESLint
- **Python**: PEP 8 + Black + ruff + type hints
- **Rust**: rustfmt + clippy clean
- **Go**: gofmt + golangci-lint

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full standards.

## Commit message convention

Conventional Commits:
```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, perf, test, chore, ci, security
Scopes: atc, uts, adapters, gateway, mcp, python, rust, go, cli, docs, core
```

## Important: do NOT

- ❌ Do NOT commit `.env`, `.vercel-token`, `.npm-token`, `*.pem`, `*.key`
- ❌ Do NOT use `Math.random()` for security-relevant randomness — use `crypto.randomBytes()`
- ❌ Do NOT use `JSON.stringify(payload, Object.keys(payload).sort())` for canonicalization — that's a replacer allowlist, not a key sort. Use RFC 8785 JCS.
- ❌ Do NOT use `eval()` or `new Function()` with dynamic strings
- ❌ Do NOT use `require(variable)` where variable is not a literal

## Security reporting

DO NOT open a public GitHub issue for security vulnerabilities. Use:
- GitHub Security Advisories: https://github.com/alicelabs-llc/universal-trust-adapter/security/advisories/new
- Email: security@alicelabs.site

See [SECURITY.md](./SECURITY.md) for full policy.

## Live status

- Status page: https://status.marketnow.site
- API uptime: 100% since launch (2026-08-26)
- 6 services monitored, all operational

## How to cite this work

```
AliceLabs LLC. (2026). Universal Trust Adapter (UTA) v1.1.0.
https://github.com/alicelabs-llc/universal-trust-adapter
```

## License

AL-1.0 (AliceLabs Source-Available License v1.0). Code is readable and modifiable. Commercial deployment requires a separate commercial license. Contact: legal@alicelabs.site

## Contact

- General: info@alicelabs.site
- Security: security@alicelabs.site
- Dev.to: @edison_flores_6d2cd381b13
- Status: https://status.marketnow.site

---

Built by Edison Flores & Alejandro Flores at AliceLabs LLC (Wyoming, USA).
