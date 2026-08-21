# Changelog

All notable changes to the Universal Trust Adapter (UTA) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-21

### Added — P0: Core Foundation
- 12-stage fail-closed verification pipeline
- RFC 8785 JCS canonicalization (pure TypeScript)
- Ed25519 signing/verification (RFC 8032)
- Domain separation (7 distinct domains)
- Proof-of-Possession (PoP) with nonce challenge
- ATC v3 credential format with multi-signature support

### Added — P1: Real Crypto + Persistence
- MemoryNonceStore + RedisNonceStore (PoP challenge persistence)
- Real JWT verification (RS256/ES256/EdDSA — no stubs)
- Real W3C VC verification + issuance (Ed25519Signature2020)
- TrustRegistry for key binding verification
- Signed action receipts (Ed25519)
- JCS-based args_hash (not JSON.stringify)

### Added — P2: Test Vectors + Revocation + Supply Chain
- 36 test vectors (8 positive + 17 negative + 5 mutation + 6 cross-language)
- Real vector conformance runner (executes actual verification, not regex)
- CRL + OCSP + Bitstring Status List revocation
- SBOM generation (SPDX 2.3)
- Sigstore bundle verification

### Added — P3: Integration + Multi-sig + Python
- TypeScript integration tests (33 tests — real compiled modules)
- MCP Trust Gateway (17 integration tests)
- Multi-signature ATC v3 (N-of-M + quorum)
- Python cross-language verifier (29 tests)
- Bug fix: double-canonicalization in evidence_hash (critical for cross-lang)

### Added — P4: CI + npm + A2A + EAT
- GitHub Actions: Sigstore keyless + SLSA Level 3 provenance
- TypeDoc API documentation (GitHub Pages deployment)
- npm package configuration (@marketnow/trust-core, trust-adapters, trust-gateway)
- A2A adapter: real Ed25519Signature2020 verification
- EAT-AI adapter: real COSE-style signature verification (EdDSA/ES256/RS256)
- Performance benchmarks (6,744 ops/sec pipeline)

### Added — P5: OCSP + ZTA + MCP + CLI + Supabase
- OCSP responder (HTTP server with signed responses)
- ZTA adapter: real Ed25519 verification (UTA-ZTA-CARD domain)
- MCP adapter: real registry signature verification (UTA-MCP-CARD domain)
- uta-verify CLI (7 credential formats, auto-detect)
- Supabase persistence (receipts + nonces + revocations)
- Plugin template (MIT license)

### Added — P6: Server + Middleware + PQ + Webhooks
- REST API server (15+ endpoints, rate limiting, CORS)
- MCP middleware (withUTATrust wrapper)
- Python SDK (pip-installable, 16 tests)
- Post-quantum abstraction (ML-DSA-65 + hybrid signer)
- Webhooks (HMAC + Ed25519 signed, retry with backoff)

### Added — P7: Dashboard + Rust/Go + X.509 + Benchmarks
- Web dashboard (metrics, receipts, verify, revocation lookup)
- Rust SDK (canonicalize + verify, 7 tests)
- Go SDK (canonicalize + verify)
- X.509 certificate adapter (traditional PKI bridge)
- Redis rate limiter (token bucket, Lua scripting)
- Comparative benchmarks (1.8x overhead vs raw Ed25519)
- Framework integration guides (8 frameworks)

### Added — P8: Fuzzing + Audit + Docker + Observability
- Fuzzing harness (400 iterations, 0 crashes)
- Merkle audit log (tamper-evident, signed roots)
- Docker image + docker-compose (3 services)
- Helm chart for Kubernetes
- OpenTelemetry tracing + structured logging
- Property-based testing (23 properties)
- Threat model update (STRIDE + MITRE ATLAS, 35 mitigations)

### Added — P9: RPC + Realtime + Multi-tenant + Key Rotation
- gRPC/ConnectRPC service (proto definition + HTTP transport)
- WebSocket + SSE real-time push (trust decisions live)
- Multi-tenant support (organization isolation, per-org API keys)
- Key rotation automation (90-day interval, 30-day overlap)
- Compliance documentation (SOC2 + ISO 27001 + NIST CSF)
- LRU verification cache

### Statistics
- **460+ tests** (444 Node.js + 16 Python)
- **20+ npm packages**
- **4 language SDKs** (TypeScript, Python, Rust, Go)
- **36 test vectors** (reproducible across all SDKs)
- **6,744 ops/sec** (1.8x overhead vs raw Ed25519)
