# MarketNow — Threat Model (STRIDE + MITRE ATLAS)

> Required by audit point #68, item 10. This document defines the formal threat model for MarketNow / UTA / ATC / Sentinel.

## 1. Scope

| Component | In scope |
|-----------|----------|
| MarketNow API (marketnow.site) | ✅ |
| UTA (universal-trust-adapter.vercel.app) | ✅ |
| ATC credential issuance/verification | ✅ |
| Sentinel audit pipeline | ✅ |
| MCP Trust Gateway (planned) | ✅ |
| Supabase database | ✅ |
| Upstash Redis | ✅ |
| Vercel Lambda runtime | ✅ |

## 2. STRIDE Analysis

### S — Spoofing

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Attacker impersonates a trusted agent | Stolen ATC card JSON | **PoP (Proof-of-Possession)**: agent must sign a nonce challenge with its private key. Card alone is not enough. |
| Attacker impersonates MarketNow CA | Forged signature | Ed25519 verification against published CA public key. Private key in Vercel env var, never exposed. |
| Attacker impersonates a third-party issuer (Anthropic, Google) | Forged ZTA/A2A credential | UTA verifies the issuer's signature against their published public keys. Unknown issuers are rejected. |
| Attacker reuses a revoked credential | Replay of old ATC | **Revocation check**: every verification checks the CRL (live Supabase query). Revoked cards are rejected. |

### T — Tampering

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Attacker modifies a credential's trust score | Change `sentinel_review_score: 8` → `10` | **Ed25519 signature** covers the canonical payload. Any byte change breaks the signature. |
| Attacker modifies the evidence array | Add fake evidence entries | Evidence entries are hashed (`evidence_hash`). The signature covers the evidence array. |
| Attacker modifies the policy | Increase `max_spend_usd` from $50 to $5000 | Policy is part of the signed payload. Hard caps ($500/mandate, $50/purchase) are enforced server-side and cannot be overridden by the credential. |
| Attacker modifies the format.raw field | Inject malicious data into the preserved payload | `format.raw` is informational only. It's never used for trust decisions — only for audit. The UTS fields drive decisions, not the raw payload. |

### R — Repudiation

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Agent denies performing an action | "I didn't call that tool" | **Action receipts**: every `tools/call` through the Trust Gateway produces a signed receipt with the agent's ATC card_id + the action + the timestamp + the policy decision. Receipts are stored in Supabase `trust_decisions` table. |
| MarketNow denies issuing a credential | "We didn't issue that ATC" | Every ATC has `signature.signed_by` + `signature.signed_at` + `signature.ca_key_id`. The CA key is published. Anyone can verify the issuance chain. |
| Agent denies receiving a BLOCK decision | "I never got told to stop" | The Trust Gateway returns the `evidence_record` with `decision_id`, `evidence_hash`, and `evidence_url`. The caller can retrieve the stored decision from `/api/trust/evidence/{decision_id}`. |

### I — Information Disclosure

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Attacker reads .env from the server | `curl marketnow.site/.env` | **Honeypot**: vercel.json routes `/.env` → `/api/security?honeypot=1`. The request is logged and the IP is rate-limited. |
| Attacker reads the CA private key | Compromise Vercel env var | The private key is `MARKETNOW_ATC_CA_PRIVATE_KEY` in Vercel. It's `encrypted` type. Even Vercel dashboard shows it masked. |
| Attacker reads credentials from Supabase | Direct DB access | RLS (Row Level Security) is enabled. `anon` role can only READ non-sensitive tables. Writes require `service_role` key. `mandates` table requires wallet_address match. |
| Attacker reads agent communication | MITM on API calls | All API calls are over HTTPS (Vercel enforces TLS 1.3). HSTS header is set (`max-age=63072000; includeSubDomains; preload`). |

### D — Denial of Service

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Attacker floods /api/atc?action=issue | Mass card issuance | **Rate limiting**: 5 issues per IP per hour (Upstash Redis distributed). |
| Attacker floods /api/trust?action=bridge | Expensive bridge operations | Rate limiting: 100 req/min per IP (Upstash Redis). |
| Attacker floods /api/skills-lite.json | Download the 4.2MB catalog repeatedly | CDN cache: `s-maxage=600`. Rate limiting on search: 60/min. |
| Attacker floods honeypot endpoints | Hit /.env, /.git, /admin repeatedly | Honeypot rate limit: 3 hits/min → IP blocked. |

### E — Elevation of Privilege

| Threat | Vector | Mitigation |
|--------|--------|------------|
| Attacker escalates from `anon` to `service_role` | Steal the service_role key from env | The key never appears in client-side code. It's only used in server-side Lambda functions. |
| Attacker bypasses policy enforcement | Craft a credential with `max_spend_usd: 999999` | Hard caps are enforced server-side: `$500/mandate`, `$50/purchase`. These are code constants, not credential fields. |
| Attacker bypasses the Interceptor | Call MCP tools directly without going through /api/trust | The MCP Trust Gateway (planned) will be a middleware that intercepts ALL `tools/call` requests. Bypassing it requires access to the underlying MCP server, which is behind the Gateway. |
| Attacker downgrades ATC v2 to v1 | Send a v1 card (without ca_key_id) to bypass v2 checks | UTA detects v1 cards and emits warnings. The `v2_compliant` flag is `false`. Policy can require `v2_compliant: true`. |

## 3. MITRE ATLAS (Adversarial Threat Landscape for AI Systems)

### Reconnaissance

| Threat | Mitigation |
|--------|------------|
| Attacker discovers the API surface | All endpoints are documented at `/api/trust` (GET). No hidden admin endpoints. |
| Attacker discovers the CA public key | The CA key is PUBLIC by design (`/api/atc?action=ca-key`). This is not a vulnerability. |

### Resource Development

| Threat | Mitigation |
|--------|------------|
| Attacker creates a fake CA key | Verifiers compare against the published CA key. A fake key produces signatures that don't verify. |
| Attacker creates a fake agent identity | The agent must prove PoP (Proof-of-Possession) by signing a nonce with its private key. |

| Initial Access

| Threat | Mitigation |
|--------|------------|
| Attacker compromises an agent's private key | **Key rotation**: ATC v3 supports `ca_key_id` for rotation. Compromised keys can be rotated. Old cards are revoked via CRL. |
| Attacker compromises the CA private key | **CA rotation**: the CA key can be rotated. New key is published at `/api/atc?action=ca-key`. Old key is added to the deprecated list. Cards signed with the old key are migrated. |

### Persistence

| Threat | Mitigation |
|--------|------------|
| Attacker installs a backdoor MCP server | Sentinel scans detect backdoor patterns (L1.7 malware detection, L1.8 malware family signatures). Quarantined servers are removed from the catalog. |

### Defense Evasion

| Threat | Mitigation |
|--------|------------|
| Attacker obfuscates malicious code in an MCP server | Sentinel v3.0 gVisor sandbox runs the server in isolation. Network is disabled. Filesystem is read-only. Obfuscated code is detected by L1.6 Semgrep + L1.7 malware patterns. |
| Attacker uses prompt injection to bypass Sentinel | Sentinel L1.9 has 32 prompt injection detection rules. The interceptor blocks reads of .env, .ssh, .aws, etc. |

### Discovery

| Threat | Mitigation |
|--------|------------|
| Attacker maps the Supabase schema | RLS prevents anon users from seeing table structure. Only public read tables are accessible via REST. |
| Attacker discovers the Vercel env var names | Env var names are not secret. The VALUES are secret and encrypted in Vercel. |

### Collection

| Threat | Mitigation |
|--------|------------|
| Attacker scrapes the skills catalog | Rate limiting: 60 searches/min. CDN cache: 10 min. |
| Attacker scrapes ATC cards | Public cards are designed to be public (they're trust credentials, not secrets). But mass scraping is rate-limited. |

### Impact

| Threat | Mitigation |
|--------|------------|
| Attacker quarantines a legitimate skill (false positive) | The `quarantine_decisions` table records every decision with `record_sha256`. Appeals can reverse false positives. The `appeal_decision: false_positive` field tracks corrections. |
| Attacker issues a flood of fake ATC cards | Rate limited (5/hour). Cards signed with the real CA key require the CA private key. Without it, signatures don't verify. |

## 4. Attack Surface Map

```
External
  │
  ├── marketnow.site (Vercel CDN)
  │     ├── /api/trust (UTA — auto-detect + verify + translate + bridge)
  │     ├── /api/atc (ATC — issue + verify + revoke + CRL)
  │     ├── /api/agent-purchase (commerce — Stripe + USDC)
  │     ├── /api/skills-lite.json (catalog — 9,248 skills)
  │     └── /api/security (honeypot + interceptor)
  │
  ├── universal-trust-adapter.vercel.app (UTA standalone)
  │     └── /api/trust (same as above, standalone)
  │
  ├── Supabase (pjhsgiblydnpsnjfbxzw.supabase.co)
  │     ├── REST API (RLS-protected)
  │     └── Postgres (pooler, IPv6 only, password-protected)
  │
  ├── Upstash Redis (calm-elf-146402.upstash.io)
  │     └── REST API (token-protected)
  │
  └── Alchemy RPC (base-mainnet.g.alchemy.com)
        └── JSON-RPC (API key required)

Internal (Vercel env vars)
  ├── MARKETNOW_ATC_CA_PRIVATE_KEY (Ed25519 — never exposed)
  ├── SUPABASE_SERVICE_ROLE_KEY (full DB access — never exposed)
  ├── UPSTASH_REDIS_REST_TOKEN (Redis access — never exposed)
  ├── ALCHEMY_API_KEY (RPC access — never exposed)
  ├── STRIPE_SECRET_KEY (payment — never exposed)
  └── STRIPE_WEBHOOK_SECRET (webhook verification — never exposed)
```

## 5. Security Controls Summary

| Control | Implemented | Status |
|---------|-------------|--------|
| Ed25519 real verification | ✅ | Live (ATC adapter) |
| RFC 8785 JCS canonicalization | ✅ | Live (canonical-json.mjs) |
| Revocation (CRL) | ✅ | Live (Supabase query) |
| Rate limiting (distributed) | ✅ | Live (Upstash Redis) |
| Honeypot endpoints | ✅ | Live (vercel.json rewrites) |
| RLS (Row Level Security) | ✅ | Live (Supabase) |
| TLS 1.3 + HSTS | ✅ | Live (Vercel) |
| Lossless translation | ✅ | Live (format.raw) |
| Attestation chaining | ✅ | Live (bridge API) |
| Proof-of-Possession (PoP) | ✅ | Live — NonceStore + PoPManager, anti-replay |
| Artifact binding (SHA256) | ✅ | Live — JCS canonical hash, git+npm+docker |
| Mutation tests | ✅ | 5 mutation vectors + 400 fuzz iterations |
| SLSA / Sigstore | ✅ | Live — CI workflow with cosign keyless + SLSA Level 3 |
| MCP Trust Gateway | ✅ | Live — TrustGateway + withUTATrust middleware |
| External penetration test | ❌ | PENDING — audit item #10 |

---

## 8. P8 Threat Model Update (2026-08-21)

### 8.1 New mitigations implemented (P0-P7)

| Mitigation | Status | Phase |
|-----------|--------|-------|
| 12-stage fail-closed pipeline | ✅ | P0 |
| RFC 8785 JCS canonicalization | ✅ | P0 |
| Ed25519 domain separation (7 domains) | ✅ | P0 |
| PoP with NonceStore (Redis-backed) | ✅ | P1 |
| Real JWT verification (RS256/ES256/EdDSA) | ✅ | P1 |
| Real W3C VC verification (Ed25519Signature2020) | ✅ | P1 |
| TrustRegistry key binding | ✅ | P1 |
| Signed action receipts | ✅ | P1 |
| JCS args_hash (not JSON.stringify) | ✅ | P1 |
| 36 test vectors (positive + negative + mutation + cross-lang) | ✅ | P2 |
| CRL + OCSP + Bitstring Status List revocation | ✅ | P2 |
| SBOM generation (SPDX 2.3) | ✅ | P2 |
| Sigstore bundle verification | ✅ | P2 |
| Multi-signature (N-of-M + quorum) | ✅ | P3 |
| MCP Trust Gateway (real crypto enforcement) | ✅ | P3 |
| Python cross-language verifier | ✅ | P3 |
| A2A adapter real Ed25519Signature2020 | ✅ | P4 |
| EAT-AI adapter real COSE-style signatures | ✅ | P4 |
| ZTA adapter real Ed25519 verification | ✅ | P5 |
| MCP adapter registry signature verification | ✅ | P5 |
| OCSP responder (HTTP server + Lua scripts) | ✅ | P5 |
| CLI tool (uta-verify, 7 formats) | ✅ | P5 |
| Supabase persistence (receipts + nonces + revocations) | ✅ | P5 |
| Plugin template (MIT) | ✅ | P5 |
| REST API server (15+ endpoints) | ✅ | P6 |
| MCP middleware (withUTATrust) | ✅ | P6 |
| Post-quantum abstraction (ML-DSA-65 + hybrid) | ✅ | P6 |
| Webhooks (HMAC + Ed25519 signed) | ✅ | P6 |
| Web dashboard (metrics + receipts + verify) | ✅ | P7 |
| Rust SDK | ✅ | P7 |
| Go SDK | ✅ | P7 |
| X.509 adapter (traditional PKI bridge) | ✅ | P7 |
| Redis rate limiter (token bucket, Lua) | ✅ | P7 |
| Fuzzing harness (400 iterations, 0 crashes) | ✅ | P8 |
| Merkle audit log (tamper-evident) | ✅ | P8 |
| Docker + docker-compose deployment | ✅ | P8 |
| Helm chart (Kubernetes) | ✅ | P8 |
| OpenTelemetry tracing + structured logging | ✅ | P8 |

### 8.2 MITRE ATLAS update

| ATLAS technique | UTA mitigation |
|----------------|-----------------|
| T1: Prompt injection | Evidence chain: sentinel-audit L1.9 layer detects prompt injection patterns |
| T2: Data poisoning | Artifact binding: credential cryptographically bound to git SHA + npm SHA-256 |
| T3: Model DoS | Rate limiting: token bucket per IP (600 req/min default, Redis-backed) |
| T4: Credential theft | PoP: stolen credential JSON alone is useless without the private key |
| T5: Lateral movement | Trust Gateway: every tool call is independently verified (no session trust) |
| T6: Supply chain attack | SBOM + SLSA + Sigstore: full provenance chain from git to deployed package |
| T7: Evasion | Merkle audit log: receipts are append-only + tamper-evident; root is signed |
| T8: Privilege escalation | Multi-sig + quorum: critical operations require N-of-M signatures |
| T9: Post-quantum attack | ML-DSA-65 abstraction: hybrid mode (Ed25519 + PQ) ready for migration |
| T10: Cross-format replay | Domain separation: 7 distinct domains prevent signature reuse across formats |

### 8.3 Residual risks

| Risk | Severity | Mitigation plan |
|------|----------|-----------------|
| External penetration test not yet done | High | Schedule with third-party firm |
| PQ backend (liboqs-js) not yet installed | Medium | Install when NIST finalizes ML-DSA standardization |
| Go/Rust SDKs not yet compiled | Medium | Set up CI with Go/Rust toolchains |
| Dashboard not authenticated | Medium | Add OAuth2 / OIDC before production deployment |
| Webhook delivery not guaranteed (best-effort retry) | Low | Add dead-letter queue for failed deliveries |
| No formal verification of the JCS implementation | Low | Property-based tests (P8-7) provide empirical verification |
