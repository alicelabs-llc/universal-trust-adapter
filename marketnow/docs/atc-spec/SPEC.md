# ATC/1.0 — Agent Trust Card Protocol Specification

**Status**: Draft v1.0.0 — public for review
**Issued**: 2026-08-10
**Author**: Edison Flores, AliceLabs LLC
**Repository**: https://github.com/alicelabs-llc/marketnow/tree/master/docs/atc-spec
**License**: MNNC-1.0 (AliceLabs LLC Proprietary) for the reference implementation; the specification itself is published under the [W3C Community Group Final Specification Agreement](https://www.w3.org/community/about/agreements/final/) terms for community contributions.
**Prior art**: See [PRIOR-ART-TIMELINE.md](./PRIOR-ART-TIMELINE.md)

---

## 1. Introduction

### 1.1 Motivation

AI agents are now autonomous actors: they call APIs, write to filesystems, spawn processes, and pay for resources. Unlike human users, agents cannot rely on interactive authentication (typing a password, scanning a QR code, approving a 2FA push). They need a **machine-verifiable credential** that:

1. Cryptographically identifies the agent
2. Bounds what the agent is allowed to do (capabilities)
3. Carries security evidence (audit score, sandbox results, malware scan)
4. Can be verified offline by any peer agent
5. Can be revoked if the agent is later found malicious
6. Expires

This is the same problem SSL/TLS certificates solve for human-facing websites. ATC/1.0 applies the same pattern to AI agents.

### 1.2 Scope

ATC/1.0 specifies:

- The structure of an Agent Trust Card (ATC)
- The Certificate Authority (CA) that issues ATCs
- The signature algorithm (Ed25519, RFC 8032)
- The canonical JSON encoding (RFC 8785 JCS)
- The verification protocol
- The revocation protocol
- The capability manifest
- The trust score semantics

ATC/1.0 does **not** specify:

- How agents discover each other (use A2A, MCP, or any registry)
- How agents negotiate sessions (use any transport)
- How agents pay each other (use x402, Lightning, or any payment protocol)
- How agents enforce the capabilities (use any runtime interceptor)

### 1.3 Design principles

1. **Cryptographic verifiability** — every claim in an ATC is signed by a CA whose public key is independently retrievable. Verification never requires a network call to the CA.
2. **Offline-friendly** — an ATC is a self-contained JSON document. A peer agent can verify it without calling home.
3. **Revocation-aware** — agents SHOULD check revocation status before trusting; ATCs include the revocation endpoint URL.
4. **Capability-bounded** — an ATC declares what the agent is allowed to do. Runtimes SHOULD enforce these bounds.
5. **Evidence-carrying** — an ATC carries its audit evidence (Sentinel score, sandbox results, malware scan) so a verifier does not need to re-audit.
6. **Time-bounded** — every ATC has `issued_at` and `expires_at`. Verifiers reject expired cards.
7. **Algorithm-agile** — ATC/1.0 mandates Ed25519; ATC/1.1 will add ML-DSA (post-quantum). The `algorithm` field makes the signature algorithm explicit.

---

## 2. The 10 Controls

ATC/1.0 is structured around 10 controls. Every conformant implementation MUST support all 10.

| # | Control ID | Name | Required |
|---|-----------|------|----------|
| 1 | ATC-001 | Identity | ✅ |
| 2 | ATC-002 | Attestation | ✅ |
| 3 | ATC-003 | Capabilities | ✅ |
| 4 | ATC-004 | Evidence | ✅ |
| 5 | ATC-005 | Risk | ✅ |
| 6 | ATC-006 | Signature | ✅ |
| 7 | ATC-007 | Revocation | ✅ |
| 8 | ATC-008 | Expiration | ✅ |
| 9 | ATC-009 | Delegation | Optional |
| 10 | ATC-010 | Runtime Trust | Optional |

The 10 controls are designed to be independently implementable, but a conformant ATC MUST include controls 001–008. Controls 009 and 010 are optional but recommended for production deployments.

---

## ATC-001 — Identity

**Purpose**: Uniquely and cryptographically identify the agent.

**Fields**:

```json
{
  "agent_id": "string — UUID v4 or org-defined unique identifier",
  "agent_name": "string — human-readable name",
  "agent_owner": "string — organization or individual",
  "owner_contact": "string — email or URL"
}
```

**Rules**:

- `agent_id` MUST be globally unique. RECOMMENDED: UUID v4. Alternatively: `<org>-<random>` (e.g. `alicelabs-7f3a9c2d`).
- `agent_id` MUST NOT exceed 128 characters.
- `agent_name` MUST NOT exceed 100 characters.
- `owner_contact` SHOULD be a `mailto:` URL or `https:` URL.

**Test vector**: `atc-001-identity.json`

---

## ATC-002 — Attestation

**Purpose**: Bind the identity to a public key, signed by the CA. This is the cryptographic core of the ATC.

**Fields**:

```json
{
  "issuer": {
    "ca_id": "string — CA identifier (e.g. 'alicelabs-sentinel-ca')",
    "ca_public_key": "string — base64 Ed25519 public key (32 bytes)",
    "ca_algorithm": "Ed25519",
    "ca_url": "string — URL where the CA publishes its key + revocation list"
  },
  "attestation": {
    "subject_public_key": "string — base64 Ed25519 public key of the agent (32 bytes)",
    "subject_algorithm": "Ed25519",
    "signature": "string — base64 Ed25519 signature over RFC 8785 JCS canonical form of the ATC payload",
    "signed_payload_hash": "string — hex SHA-256 of the canonical payload"
  }
}
```

**Rules**:

- `ca_algorithm` MUST be `Ed25519` in ATC/1.0.
- The `signature` is computed over the **RFC 8785 JCS canonical form** of the ATC payload (everything in the ATC EXCEPT the `attestation.signature` field itself).
- The verifier MUST:
  1. Compute RFC 8785 JCS of the payload (with `signature` set to empty string)
  2. Compute SHA-256 of that canonical form
  3. Verify that hash matches `signed_payload_hash`
  4. Verify the Ed25519 signature using `ca_public_key`

**Test vector**: `atc-002-attestation.json`

---

## ATC-003 — Capabilities

**Purpose**: Declare what the agent is allowed to do. Runtimes SHOULD enforce these bounds.

**Fields**:

```json
{
  "capabilities": {
    "filesystem": {
      "read": ["enum — none | own_dir | temp_dir | home_dir | system | all"],
      "write": ["enum — none | own_dir | temp_dir | home_dir | system | all"]
    },
    "network": {
      "egress": ["enum — none | allowlist | all"],
      "ingress": ["enum — none | bound_ports | all"]
    },
    "shell": {
      "exec": ["enum — none | sandboxed | unrestricted"],
      "spawn": ["enum — none | sandboxed | unrestricted"]
    },
    "credentials": {
      "read_env": ["enum — none | allowlist | all"],
      "read_files": ["enum — none | allowlist | all"]
    },
    "process": {
      "subprocess": ["enum — none | sandboxed | unrestricted"],
      "signals": ["enum — none | own | all"]
    }
  }
}
```

**Rules**:

- Every capability category MUST be present. If a category is not applicable, set all its sub-fields to `none`.
- The runtime that hosts the agent SHOULD enforce these capabilities.
- A verifier (peer agent) MAY use these capabilities to decide whether to delegate a task to the agent.
- The `allowlist` value means the agent has an out-of-band list (e.g. environment variable `ATC_NETWORK_ALLOWLIST`) that the runtime enforces. The verifier does not see the contents of the allowlist.

**Test vector**: `atc-003-capabilities.json`

---

## ATC-004 — Evidence

**Purpose**: Carry the security audit evidence so a verifier does not need to re-audit.

**Fields**:

```json
{
  "evidence": {
    "audit_pipeline": "string — e.g. 'Sentinel L1.5 → L1.9 → L2.5 → L3'",
    "audit_completed_at": "string — ISO 8601 timestamp",
    "static_checks": {
      "metadata": "boolean",
      "semgrep_rules_count": "integer",
      "secret_patterns_count": "integer",
      "dependency_scan": "boolean",
      "malware_patterns_count": "integer",
      "malware_family_signatures_count": "integer",
      "prompt_injection_rules_count": "integer"
    },
    "dynamic_checks": {
      "sandbox_run": "boolean",
      "sandbox_runtime_ms": "integer",
      "sandbox_exit_code": "integer",
      "sandbox_network_blocked": "boolean",
      "sandbox_fs_read_only": "boolean",
      "sandbox_cap_drop_all": "boolean"
    },
    "runtime_checks": {
      "interceptor_rules_count": "integer",
      "interceptor_blocks": "integer",
      "interceptor_warns": "integer"
    },
    "findings": [
      {
        "layer": "string — e.g. 'L1.6'",
        "rule_id": "string",
        "severity": "enum — info | low | medium | high | critical",
        "description": "string"
      }
    ]
  }
}
```

**Rules**:

- `audit_completed_at` MUST be an ISO 8601 timestamp.
- `findings` MAY be empty (clean audit).
- A verifier SHOULD downgrade trust if any finding has `severity: high` or `severity: critical`.

**Test vector**: `atc-004-evidence.json`

---

## ATC-005 — Risk

**Purpose**: Provide a machine-readable trust score derived from the evidence.

**Fields**:

```json
{
  "risk": {
    "trust_score": "integer — 0 to 10",
    "risk_level": "enum — low | medium | high | critical",
    "decision_authority": "enum — issuer | consumer",
    "score_explanation": "string — human-readable explanation of the score",
    "scored_at": "string — ISO 8601 timestamp"
  }
}
```

**Rules**:

- `trust_score` is an integer from 0 (untrusted) to 10 (highly trusted).
- `risk_level` is derived from `trust_score`:
  - 8–10 → `low`
  - 5–7 → `medium`
  - 2–4 → `high`
  - 0–1 → `critical`
- `decision_authority` MUST be `consumer` in ATC/1.0. This means: the ATC carries a recommendation, but the runtime that hosts the consuming agent makes the final trust decision. This is a deliberate design choice — the CA does not override the runtime's security policy.

**Test vector**: `atc-005-risk.json`

---

## ATC-006 — Signature

**Purpose**: Bind the entire ATC to the CA's private key.

**Algorithm**: Ed25519 (RFC 8032)

**Canonical form**: RFC 8785 JCS (JSON Canonicalization Scheme)

**Process**:

1. Take the full ATC JSON document
2. Set the `attestation.signature` field to `""` (empty string)
3. Set the `attestation.signed_payload_hash` field to `""` (empty string) — both fields are part of the attestation envelope and MUST NOT be part of the signed payload (chicken-and-egg: the hash is computed FROM the payload, so it cannot be part of what it hashes)
4. Apply RFC 8785 JCS to produce canonical bytes
5. Compute SHA-256 of the canonical bytes
6. Store the hex hash in `attestation.signed_payload_hash`
7. Sign the canonical bytes with the CA's Ed25519 private key
8. Store the base64 signature in `attestation.signature`

**Verification**:

1. Read `attestation.signature` and `attestation.signed_payload_hash`
2. Set both `attestation.signature = ""` and `attestation.signed_payload_hash = ""`
3. Apply RFC 8785 JCS
4. Compute SHA-256
5. Verify hash matches the originally-stored `attestation.signed_payload_hash`
6. Verify Ed25519 signature using `issuer.ca_public_key`

**Test vector**: `atc-006-signature.json` (includes the canonical bytes, the SHA-256 hash, and the signature)

---

## ATC-007 — Revocation

**Purpose**: Allow the CA to revoke an ATC before its expiration.

**Fields** (in the ATC itself):

```json
{
  "revocation": {
    "revocation_check_url": "string — URL where the CA publishes the revocation list",
    "revocation_check_method": "enum — ocsp | crl | simple_json",
    "revocation_check_required": "boolean — if true, the verifier MUST check; if false, the verifier MAY skip"
  }
}
```

**Revocation list format** (served at `revocation_check_url`):

```json
{
  "ca_id": "string",
  "issued_at": "string — ISO 8601",
  "expires_at": "string — ISO 8601",
  "revoked_cards": [
    {
      "card_id": "string",
      "revoked_at": "string — ISO 8601",
      "reason": "enum — compromised | malicious | superseded | unknown"
    }
  ]
}
```

**Rules**:

- The CA SHOULD update the revocation list within 5 minutes of revoking a card.
- The list MUST be signed by the CA (same Ed25519 + JCS process as ATC-006).
- A verifier SHOULD cache the list for up to 5 minutes.
- If `revocation_check_required` is `true` and the verifier cannot reach `revocation_check_url`, the verifier MUST reject the ATC.

**Test vector**: `atc-007-revocation.json` (revoked + non-revoked samples)

---

## ATC-008 — Expiration

**Purpose**: Bound the validity of an ATC in time.

**Fields**:

```json
{
  "validity": {
    "issued_at": "string — ISO 8601 timestamp",
    "expires_at": "string — ISO 8601 timestamp",
    "max_ttl_days": "integer — maximum allowed TTL for this ATC type"
  }
}
```

**Rules**:

- `expires_at - issued_at` MUST NOT exceed `max_ttl_days` (in days).
- Default `max_ttl_days` for ATC/1.0 is 90 (3 months).
- A verifier MUST reject any ATC where `now > expires_at`.
- A verifier SHOULD warn if `expires_at - now < 7 days` (renewal window).

**Test vector**: `atc-008-expiration.json` (valid + expired samples)

---

## ATC-009 — Delegation (OPTIONAL)

**Purpose**: Allow an agent to delegate a subset of its capabilities to another agent, without the CA re-issuing.

**Fields**:

```json
{
  "delegation": {
    "parent_card_id": "string — the parent ATC's card_id",
    "delegated_capabilities": "object — same shape as ATC-003, but only the capabilities being delegated",
    "delegation_signature": "string — base64 Ed25519 signature by the parent agent's private key over the delegated payload"
  }
}
```

**Rules**:

- Delegation MUST NOT expand capabilities — only narrow them.
- The verifier MUST verify the delegation chain back to a root ATC issued by a CA.
- Maximum delegation depth: 3 (CA → A → B → C). Deeper chains MUST be rejected.

**Status**: Optional in ATC/1.0. Conformant verifiers MAY ignore this control.

---

## ATC-010 — Runtime Trust (OPTIONAL)

**Purpose**: Allow runtime trust signals to be reported alongside the ATC.

**Fields**:

```json
{
  "runtime_trust": {
    "observed_behavior": {
      "calls_blocked": "integer",
      "calls_warned": "integer",
      "calls_allowed": "integer",
      "observation_window_hours": "integer"
    },
    "behavioral_score": "integer — 0 to 10",
    "drift_detected": "boolean",
    "last_observed_at": "string — ISO 8601"
  }
}
```

**Rules**:

- Runtime trust is a soft signal — it does not override ATC-005 (the static risk score).
- A verifier MAY combine static + runtime scores using any weighted formula.
- A verifier MUST NOT treat a missing `runtime_trust` block as a negative signal — the agent may simply not have been observed yet.

**Status**: Optional in ATC/1.0. Conformant verifiers MAY ignore this control.

---

## 3. The full ATC/1.0 envelope

A complete ATC/1.0 document looks like this (with all 8 required controls + 2 optional):

```json
{
  "spec_version": "ATC/1.0",
  "card_id": "ATC-2026-7777670",
  "issuer": {
    "ca_id": "alicelabs-sentinel-ca",
    "ca_public_key": "base64...32bytes",
    "ca_algorithm": "Ed25519",
    "ca_url": "https://marketnow.site/api/atc"
  },

  "identity": { "...ATC-001..." },
  "attestation": {
    "...ATC-002 (without signature)..."
  },
  "capabilities": { "...ATC-003..." },
  "evidence": { "...ATC-004..." },
  "risk": { "...ATC-005..." },
  "revocation": { "...ATC-007..." },
  "validity": { "...ATC-008..." },

  "delegation": { "...ATC-009 (optional)..." },
  "runtime_trust": { "...ATC-010 (optional)..." },

  "attestation": {
    "signature": "base64 Ed25519 signature",
    "signed_payload_hash": "hex SHA-256 of canonical payload"
  }
}
```

(Note: the `attestation` field appears twice above for clarity — in practice it's one block with `signature` and `signed_payload_hash` included alongside `subject_public_key` etc.)

---

## 4. Conformance

An implementation is **ATC/1.0-conformant** if:

1. ✅ It can issue an ATC that passes the ATC-006 signature verification test vector
2. ✅ It can verify an ATC that passes the ATC-006 signature verification test vector
3. ✅ It rejects an ATC with a modified payload (signature mismatch)
4. ✅ It rejects an ATC with an expired `validity.expires_at`
5. ✅ It rejects an ATC that appears in the revocation list
6. ✅ It correctly parses all capability categories from ATC-003
7. ✅ It correctly serializes an ATC using RFC 8785 JCS

Conformance test suite: [`./conformance/`](./conformance/)

---

## 5. Security considerations

### 5.1 CA key compromise

If the CA's private key is compromised:

1. All ATCs signed by that CA are untrustworthy
2. The CA MUST rotate its keypair
3. The CA MUST publish a new `ca_public_key` at `ca_url`
4. The CA MUST revoke all ATCs signed by the old key
5. Existing ATCs MUST be re-issued under the new key

ATC/1.0 does not specify the rotation protocol — that is ATC/1.1.

### 5.2 Canonicalization

ATC/1.0 mandates RFC 8785 JCS. Do not use Node.js `JSON.stringify` for canonicalization — it is not deterministic across V8 versions. Use a JCS library (e.g. `ieee754-jcs`, `canonicalize`).

### 5.3 Clock skew

Verifiers MUST allow ±5 minutes of clock skew between their clock and the `issued_at` / `expires_at` timestamps. Beyond ±5 minutes, reject.

### 5.4 Capability enforcement

The ATC declares capabilities. **The runtime is responsible for enforcing them.** A malicious runtime can ignore the declared capabilities. ATC/1.0 does not solve runtime integrity — it only provides the credential. Use a sandboxed runtime (gVisor, Firecracker) for true enforcement.

---

## 6. Versioning

| Spec version | Status | Backwards compatible? | Notes |
|--------------|--------|----------------------|-------|
| ATC/1.0 | Current draft | n/a | Ed25519 + JCS, 10 controls (8 required, 2 optional) |
| ATC/1.1 | Planned Q4 2026 | Yes | Adds ML-DSA (post-quantum), CA key rotation protocol, delegation chains |
| ATC/2.0 | Planned 2027 | No | Adds transparency log (Merkle), DID integration, capability revocation (vs. card revocation) |

---

## 7. References

- [RFC 8032 — Ed25519](https://datatracker.ietf.org/doc/html/rfc8032)
- [RFC 8785 — JSON Canonicalization Scheme (JCS)](https://datatracker.ietf.org/doc/html/rfc8785)
- [RFC 5280 — X.509 Public Key Infrastructure](https://datatracker.ietf.org/doc/html/rfc5280) (for comparison with SSL certificates)
- [RFC 6960 — OCSP](https://datatracker.ietf.org/doc/html/rfc6960) (for revocation check method `ocsp`)
- [RFC 5280 — CRL](https://datatracker.ietf.org/doc/html/rfc5280#section-5) (for revocation check method `crl`)
- [OWASP MCP Cheat Sheet](https://owasp.org/www-project-mcp-security/) (for the 12 controls ATC-003 capabilities align with)

---

## 8. Contributing

PRs welcome at https://github.com/alicelabs-llc/marketnow.

### Contribution license

By contributing to ATC/1.0, you agree to release your contributions under the [W3C Community Group Final Specification Agreement](https://www.w3.org/community/about/agreements/final/) terms. This ensures the spec remains open and royalty-free.

### Areas needing contribution

- Reference implementation in Rust
- Reference implementation in Python
- Conformance test suite (currently Node.js only)
- Formal proof of the signature verification algorithm
- Integration with existing DID methods (did:key, did:web)

---

## 9. Citation

```
AliceLabs LLC. "ATC/1.0 — Agent Trust Card Protocol Specification."
Version 1.0.0-draft. 2026-08-10.
https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/SPEC.md
```

---

## 10. Why this matters

ATC/1.0 is published as a formal specification because **the market is converging on agent trust infrastructure from multiple directions** (see [PRIOR-ART-TIMELINE.md](./PRIOR-ART-TIMELINE.md)).

The question is no longer "who thought of agent trust first" — multiple parties did.

The question is **"who shipped a formal, versioned, testable specification first"** — and the answer is this document, dated 2026-08-10.

If you are building an agent runtime, an MCP server, an A2A client, or an agent marketplace, **implement ATC/1.0**. Conformance tests are in [`./conformance/`](./conformance/). Reference implementation is in [`./reference-impl/`](./reference-impl/). Both are open-source.

If you have a competing proposal (OpenA2A AIP, OATI, your own) — let's talk. Interop is the goal. Standards win by adoption, not by priority.
