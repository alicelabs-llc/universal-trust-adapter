# UTA Compliance Mapping

## SOC 2 (Trust Services Criteria)

| SOC 2 Criterion | UTA Control | Implementation |
|----------------|-------------|----------------|
| CC6.1 — Logical and Physical Access Controls | API key authentication + PoP | Every API call requires valid API key. Credential verification requires PoP (private key possession). |
| CC6.2 — Authentication Mechanisms | Ed25519 signatures + nonce challenges | Agent authentication via Ed25519 signature over nonce. Nonce is single-use (anti-replay). |
| CC6.3 — Authorization Controls | TrustGateway policy enforcement | Per-tool-call policy check: min_trust_score, block_secret_reads, block_shell_exec, allowed_issuers. |
| CC7.1 — System Monitoring | OpenTelemetry + structured logging | All operations logged as JSON. Tracing spans for every verification. Prometheus metrics exported. |
| CC7.2 — Anomaly Detection | Rate limiting + audit log | Token bucket rate limiter (600 req/min default). Merkle audit log detects tampering. |
| CC7.3 — Incident Response | Webhook notifications | Real-time webhook on revocation events. Signed with HMAC + Ed25519. |
| CC8.1 — Change Management | Key rotation automation | Automated CA key rotation every 90 days with 30-day overlap. |
| CC9.1 — Risk Mitigation | Threat model (STRIDE + ATLAS) | 35 mitigations documented. Fuzzing (400 iterations). Property-based tests (23 properties). |
| A1.2 — Availability | Docker + Kubernetes deployment | Multi-stage Docker build. Helm chart with HPA (2-10 replicas). Health checks. |

## ISO 27001 (Annex A Controls)

| ISO 27001 Control | UTA Implementation |
|-------------------|-------------------|
| A.8.1.1 — Asset Inventory | SBOM (SPDX 2.3) generated per package |
| A.9.1.1 — Access Control Policy | API key per organization (multi-tenant) |
| A.10.1.1 — Cryptographic Controls | Ed25519 (RFC 8032) + JCS (RFC 8785) + domain separation |
| A.10.1.2 — Key Management | Key rotation automation (90-day interval, 30-day overlap) |
| A.12.1.1 — Operational Procedures | Docker + docker-compose + Helm chart |
| A.12.2.1 — Malware Protection | Artifact binding (git SHA + npm SHA-256 + SBOM hash) |
| A.12.3.1 — Information Backup | Receipts persisted to Supabase + Merkle audit log |
| A.12.4.1 — Event Logging | Structured logging (JSON) + tracing + metrics |
| A.12.4.3 — Administrator Logs | Admin API key required for issue/revoke operations |
| A.14.1.1 — Secure Development | CI pipeline: tsc + 444 tests + SBOM + SLSA + Sigstore |
| A.14.2.1 — Secure Coding Practices | TypeScript strict mode, no `any` (except external APIs), domain separation |
| A.16.1.1 — Incident Management | Webhook notifications for revocation, real-time SSE/WS for decisions |
| A.18.1.1 — Legal Requirements | AL-1.0 license (source-available, commercial requires license) |

## NIST Cybersecurity Framework

| NIST Function | UTA Controls |
|---------------|-------------|
| Identify (ID) | SBOM, threat model, asset inventory |
| Protect (PR) | PoP, API keys, rate limiting, TLS |
| Detect (DE) | Audit log (Merkle tree), structured logging, tracing |
| Respond (RS) | Revocation (CRL + OCSP + Bitstring), webhooks, key rotation |
| Recover (RC) | Key rotation (overlap period), Docker restart policy, Kubernetes HPA |

## Supply Chain (SLSA + Sigstore)

| Control | Status |
|---------|--------|
| SLSA Build Level 3 | ✅ CI workflow with slsa-github-generator |
| Sigstore keyless signing | ✅ cosign sign-blob (Fulcio + Rekor) |
| SBOM (SPDX 2.3) | ✅ Generated per package in dist/ |
| Artifact binding | ✅ git SHA + npm SHA-256 + SBOM hash |
| npm provenance attestation | ✅ npm publish --provenance |
