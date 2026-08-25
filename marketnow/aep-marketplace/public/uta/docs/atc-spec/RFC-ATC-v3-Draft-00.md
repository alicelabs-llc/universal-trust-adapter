# RFC: ATC v3.0 — Multi-Format Cryptographic Profile

**Status:** Draft 00 — Pre-public review
**Version:** 3.0.0-rfc-00
**Issued:** 2026-08-20
**Editors:** Edison Flores, Alejandro Flores — AliceLabs LLC
**License:** MIT (code) + CC-BY-4.0 (text)
**Supersedes:** ATC v2.0 Draft 01 (remains valid as legacy profile)
**Repository:** `github.com/eddyflores100-lang/atc-spec`

---

## 0. TL;DR

ATC v3.0 introduces **multi-format cryptographic support**. A single ATC credential can be signed simultaneously in Ed25519/JCS, EAT-CWT/CBOR, and W3C VC JSON-LD. Verifiers use whichever format their ecosystem supports — no migration required.

This eliminates the cryptographic lock-in that limited ATC v2.0 adoption. It also enables TEE-based attestation (Intel SGX, AMD SEV-SNP, AWS Nitro) via the EAT profile.

ATC v3.0 is the credential format used inside the Universal Trust Adapter (UTA). When a credential is issued through UTA, it produces an ATC v3.0 with all available signature formats populated.

---

## 1. Motivation

ATC v2.0 was published August 2026 using Ed25519Signature2020 + JCS (RFC 8785) exclusively. Two weeks later, three events forced a v3.0:

1. **IETF published `draft-messous-eat-ai-00`** (Feb 2026) defining Entity Attestation Token for AI agents using CWT/CBOR + COSE. EAT is the cryptographic profile that aligns with TEE attestation (SGX, SEV, Nitro). ATC v2.0 cannot interoperate.

2. **Agentic AI Foundation (AAIF) under Linux Foundation** hosts A2A (Aug 2026) and signals convergence around multi-format credentials. A single-format credential will be locked out of the stack.

3. **Enterprise/military demand for TEE attestation** is real (May 2026 survey: 60%+ of CISOs want hardware-anchored identity for high-trust agents). ATC v2.0 has no path to TEE.

ATC v3.0 solves all three by supporting multiple signature formats in a single credential.

---

## 2. Design principles

1. **Backward compatible.** A v2.0 ATC remains valid. v3.0 verifiers accept v2.0 credentials and treat them as having a single signature (Ed25519).
2. **One credential, many signatures.** A v3.0 ATC contains a `signatures[]` array. Each entry signs the same canonical payload using a different format.
3. **Verifiers choose.** A verifier in the Anthropic ZTA ecosystem checks the `w3c-vc` signature. A verifier in the IETF EAT ecosystem checks the `eat-cwt` signature. No verifier is forced to support all formats.
4. **Issuers choose what to populate.** An issuer can populate only `atc-ed25519` (minimum), or all 5 formats (maximum). The set populated is declared in `signatures_provided[]`.
5. **No mandatory format.** The minimum required is one valid signature. The maximum recommended is all formats the issuer's key infrastructure supports.

---

## 3. Schema

```json
{
  "$schema": "https://w3id.org/security/atc/v3.json",
  "atc_version": "3.0.0-rfc-00",
  "id": "urn:uuid:0d7e3a4c-1234-5f67-89ab-cdef01234567",
  "type": ["VerifiableCredential", "AgentTrustCredential"],

  "subject_type": "skill",

  "issuer": {
    "did": "did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z",
    "name": "AliceLabs Trust CA",
    "trust_engine_version": "UTA-1.0",
    "trust_registry_entry": "https://atc.alicelabs.site/api/trust-registry#al-ca"
  },

  "issuance_date": "2026-08-20T00:00:00Z",
  "expiration_date": "2026-11-20T00:00:00Z",

  "credential_subject": {
    "skill_id": "mn-skill-extractor-de-datos",
    "upstream_repo": "https://github.com/user/repo",
    "upstream_license": "MIT"
  },

  "artifact": {
    "repository_url": "https://github.com/user/repo",
    "commit_sha": "d3b07384d113edec49eaa6238ad5ff00c8b7c0a5",
    "artifact_digest": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "package_manager": "npm",
    "package_name": "@user/skill",
    "package_version": "1.2.3"
  },

  "attestation": {
    "score": 9.4,
    "trust_level": "A",
    "risk": "LOW",
    "engine_layers": ["L1", "L2"]
  },

  "trust_claims": {
    "filesystem_write": false,
    "network_access": "restricted",
    "prompt_injection_scan": "passed",
    "runtime_observed": true,
    "differential_execution_passed": false,
    "human_review": false,
    "provenance_verified": true,

    "owasp_top_10": {
      "mcp01_token_mismanagement": "passed",
      "mcp02_privilege_escalation": "passed",
      "mcp03_tool_poisoning": "passed",
      "mcp04_supply_chain": "partial",
      "mcp05_command_injection": "passed",
      "mcp06_intent_flow_subversion": "passed",
      "mcp07_insufficient_authz": "passed",
      "mcp08_audit_telemetry": "passed",
      "mcp09_shadow_servers": "not_applicable",
      "mcp10_context_injection": "passed"
    },

    "anthropic_zta": {
      "identity_verification": "passed",
      "least_privilege": "passed",
      "continuous_verification": "passed",
      "explicit_deny_default": "passed",
      "assume_breach": "partial",
      "microsegmentation": "not_applicable"
    },

    "community_reviews": 0,
    "incident_count_30d": 0
  },

  "credential_status": {
    "method": "OCSP",
    "endpoint": "https://atc.alicelabs.site/api/v2/ocsp",
    "crl": "https://atc.alicelabs.site/crl.pem",
    "stapling_supported": true,
    "stapling_cached_until": "2026-08-21T00:00:00Z",
    "last_checked": 1755460000
  },

  "signatures_provided": ["atc-ed25519", "eat-cwt", "w3c-vc"],

  "signatures": [
    {
      "format": "atc-ed25519",
      "algorithm": "Ed25519 (RFC 8032)",
      "canonicalization": "RFC_8785_JCS",
      "verification_method": "did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z#z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z",
      "proof_purpose": "assertionMethod",
      "proof_bytes": "z5A8kZ2...",
      "created": "2026-08-20T00:00:00Z"
    },
    {
      "format": "eat-cwt",
      "algorithm": "ES256 (ECDSA P-256)",
      "encoding": "CBOR",
      "verification_method": "did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z#z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z",
      "proof_purpose": "assertionMethod",
      "proof_bytes": "base64:h'q49...',
      "cwt_claims": {
        "iss": "did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z",
        "sub": "urn:uuid:0d7e3a4c-1234-5f67-89ab-cdef01234567",
        "iat": 1755648000,
        "exp": 1763222400,
        "cnf": {
          "jwk": {
            "kty": "OKP",
            "crv": "Ed25519",
            "x": "11qYAYKxCrfVS_7TyWQHOg7hcv2pa7t9gyI3cKK2X0I"
          }
        }
      },
      "tee_attestation": null,
      "created": "2026-08-20T00:00:00Z"
    },
    {
      "format": "w3c-vc",
      "algorithm": "Ed25519Signature2020",
      "verification_method": "did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z#z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z",
      "proof_purpose": "assertionMethod",
      "proof_value": "z5A8kZ2tBcDeFgHiJkLmNoPqRsTuVwXyZ123456789abcdefghijklmnopqrstuvwxyzABCDEF",
      "created": "2026-08-20T00:00:00Z",
      "jcs_canonicalized": true
    }
  ]
}
```

---

## 4. Signature formats defined

### 4.1 `atc-ed25519` (required minimum)

- Algorithm: Ed25519 (RFC 8032)
- Canonicalization: JCS (RFC 8785)
- Encoding: base58btc
- This is the ATC v2.0 native format. Every v3.0 credential MUST include at least this signature.

### 4.2 `eat-cwt` (recommended for IETF/TEE ecosystems)

- Algorithm: ES256 (ECDSA P-256) or EdDSA (Ed25519)
- Encoding: CBOR Web Token (CWT, RFC 8392)
- Wraps the canonical payload as CWT claims
- Supports `ueid` claim for TEE attestation (Universal Entity ID, used by Intel SGX and ARM TrustZone)
- This format is what IETF EAT-AI draft specifies. Adopting it makes ATC v3.0 a profile of EAT-AI.

### 4.3 `w3c-vc` (recommended for ZTA/VC ecosystems)

- Algorithm: Ed25519Signature2020 (W3C Data Integrity)
- Canonicalization: JCS (for the embedded proof)
- This format is what W3C VC 2.0 expects. Adopting it makes ATC v3.0 a valid W3C VC.

### 4.4 Optional future formats

The `signatures[]` array can be extended with:

- `a2a-agent-card`: signed AgentCard for Google A2A protocol
- `oauth-jwt`: signed JWT for OAuth 2.0 ecosystems
- `spiffe-svid`: SPIFFE SVID for k8s workload identity

Each is a separate signature entry with its own format, algorithm, and verification method.

---

## 5. Verification algorithm

A verifier:

1. Checks the credential schema (v3.0 required fields)
2. Iterates `signatures[]` and picks the format it supports
3. Verifies the chosen signature against the canonical payload
4. Optionally checks revocation via OCSP with stapling

```python
def verify_atc_v3(atc: dict, supported_formats: list[str]) -> dict:
    """Verify an ATC v3.0 credential.

    A verifier specifies which signature formats it supports.
    The first matching signature is verified.
    """
    # 1. Validate schema
    validate_atc_v3_schema(atc)

    # 2. Pick a signature format the verifier supports
    chosen = None
    for sig in atc["signatures"]:
        if sig["format"] in supported_formats:
            chosen = sig
            break

    if chosen is None:
        return {
            "valid": False,
            "reason": f"none of the provided signatures ({atc['signatures_provided']}) match the verifier's supported formats ({supported_formats})"
        }

    # 3. Verify the chosen signature
    canonical_payload = build_canonical_payload(atc, format=chosen["format"])
    if chosen["format"] == "atc-ed25519":
        result = verify_ed25519_jcs(canonical_payload, chosen)
    elif chosen["format"] == "eat-cwt":
        result = verify_eat_cwt(canonical_payload, chosen)
    elif chosen["format"] == "w3c-vc":
        result = verify_w3c_vc(canonical_payload, chosen)
    else:
        return {"valid": False, "reason": f"unsupported format: {chosen['format']}"}

    if not result["valid"]:
        return result

    # 4. Check expiration
    if datetime.utcnow() > parse_iso(atc["expiration_date"]):
        return {"valid": False, "reason": "expired"}

    # 5. Optional OCSP
    # ...

    return {"valid": True, "trust_claims": atc["trust_claims"], "verified_via": chosen["format"]}
```

### 5.1 Performance

Each signature format adds ~1KB to the credential size and ~10-30ms to the issuance time. Verification of one format remains at v2.0 speed (~25ms offline).

---

## 6. Migration from v2.0 to v3.0

### 6.1 Automatic

Any v2.0 ATC is automatically a valid v3.0 ATC with a single `atc-ed25519` signature. Verifiers supporting v3.0 automatically accept v2.0.

### 6.2 Re-issuance (optional)

Issuers who want to add EAT-CWT or W3C-VC signatures to existing credentials can re-issue. The new credential has the same `id` (URN UUID), new `atc_version: "3.0.0-rfc-00"`, and additional signatures.

### 6.3 OCSP compatibility

OCSP endpoints accept both v2.0 and v3.0 ATC IDs. No migration needed for revocation.

---

## 7. Backward compatibility

| Verifier | Sees v2.0 ATC | Sees v3.0 ATC | Behavior |
|---|---|---|---|
| v2.0 verifier | ✓ works | ✓ works (uses `signatures[0]` if format is `atc-ed25519`) | v2.0 verifiers continue to work with v3.0 |
| v3.0 verifier (Ed25519 only) | ✓ works (treats as v2.0) | ✓ works (picks `atc-ed25519` signature) | Same |
| v3.0 verifier (EAT only) | ✗ rejects | ✓ works if `eat-cwt` present | New capability |
| v3.0 verifier (multi-format) | ✓ works | ✓ works (picks best format) | New capability |

---

## 8. Trust Registry implications

The Trust Registry gains a `supported_formats` field per issuer:

```json
{
  "did": "did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z",
  "name": "AliceLabs Trust CA",
  "supported_formats": ["atc-ed25519", "eat-cwt", "w3c-vc"],
  "..."
}
```

Verifiers can filter issuers by format support.

---

## 9. Reference implementation

The reference implementation of ATC v3.0 lives in the Universal Trust Adapter (UTA). The UTA's `@marketnow/trust-adapter-atc` package produces v3.0 credentials with all available signatures populated.

```typescript
import { TrustEngine } from '@marketnow/trust-core';
import { ATCAdapter } from '@marketnow/trust-adapter-atc';

const engine = new TrustEngine({
  adapters: [new ATCAdapter()],
  issuer_keys: {
    ed25519: loadEd25519Key(),
    es256: loadES256Key(),  // optional, for EAT-CWT
  }
});

const credential = await engine.issue({
  subject: { id: 'my-agent', type: 'agent' },
  trust: { score: 8, evidence: [...] },
  formats: ['atc-v3'],  // produces ATC v3.0
});

// credential.signatures_provided = ['atc-ed25519', 'eat-cwt', 'w3c-vc']
```

---

## 10. Open questions

1. **Should `atc-ed25519` be mandatory?** Yes, per §4.1. This ensures all v3.0 credentials are verifiable by v2.0 verifiers.

2. **Should `eat-cwt` require a hardware-backed key (TEE)?** No, but issuers SHOULD use TEE-backed keys when available. The `tee_attestation` field in the `eat-cwt` signature entry documents whether TEE was used.

3. **Should we add `a2a-agent-card` as a signature format?** Deferred to v3.1. A2A AgentCard is a separate schema, not a signature format. A future spec may define a translation.

4. **How to handle issuer key rotation across formats?** Each signature entry has its own `verification_method`. Key rotation rotates all formats atomically.

---

## 11. Changelog

- **v3.0 Draft 00 (2026-08-20):** Initial publication. Introduces `signatures[]` array with multi-format support. Defines `atc-ed25519`, `eat-cwt`, `w3c-vc` formats. Maintains backward compatibility with v2.0.

---

## 12. How to comment

- Open issue at `github.com/eddyflores100-lang/atc-spec/issues`
- Tag: `v3.0-comment`
- Direct: `legal@alicelabs.site`

— Edison Flores & Alejandro Flores, AliceLabs LLC, 2026-08-20
