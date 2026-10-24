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

### 5.2 Verdict scope binding (required for paid-route presentation)

A verdict produced by a verifier for presentation to a seller (the `verdict_id` object returned by a verify call) MUST be a signed object, and the signature MUST cover the transaction scope it is valid for:

```
verdict = { v, verdict_id, kid, card_digest, challenge, resource, amount_usd,
            band, stages, issued_at, expires_in }
```

The signature is Ed25519 over the RFC 8785 JCS canonicalization of the verdict minus its `verdict_sig` field, from a key the seller pins for the verifier (selected by `kid`, below).

**Field types are normative, because the signed bytes are the JCS canonical form.**

- `amount_usd` MUST be a fixed-scale decimal string with exactly six fractional digits (micro-USD granularity — the same precision as USDC's six decimals on Base), e.g. `"0.010000"`, `"0.005000"`, `"50.000000"` — never a JSON number. JCS serializes numbers through ECMAScript number-to-string, which non-JavaScript implementations may not reproduce bit-for-bit (values beyond 2^53, sub-cent scales, and numeric parsing of `"0.10"` are where implementations diverge). A string has exactly one canonical form in every implementation, so the seller can byte-compare the signed scope against the payable amount it normalized from the request. Six digits keep sub-cent routes inside scope binding — a $0.005 route signs `"0.005000"`, and sub-cent pricing is exactly where micro-payment rails operate; pricing finer than 1 micro-USD cannot be canonicalized and MUST NOT use scope binding. The exclusion is stated here so it is visible rather than discovered by the first seller that hits it.
- `challenge` MUST be a string carrying at least 128 bits of entropy from a cryptographic random source.

The presenting seller MUST check, fail-closed (any absence or mismatch ⇒ deny):

1. `verdict_sig` verifies against the pinned verifier key selected below;
2. `challenge` equals the challenge the seller minted for THIS attempt (one-time freshness — a replayed verdict fails here with no seller-side state, since the seller mints a fresh challenge per attempt);
3. `resource` equals the route being served;
4. `amount_usd` equals the payable amount of this request, compared as fixed-scale strings (the seller normalizes the request amount to the same six-fractional-digit form and compares bytes; a verdict carrying a JSON number or a non-canonical string ⇒ deny);
5. the window is bounded on both sides: `issued_at` + `expires_in` not elapsed, `issued_at` NOT more than the seller's allowed clock skew in the future, and `expires_in` NOT longer than the seller's maximum window (a verifier with a wrong clock — or a compromised one — cannot widen the replay window by itself); `issued_at` and `expires_in` MUST be present in a signed verdict.

**Challenges are seller-minted.** The challenge MUST be minted by the presenting seller (or its gateway) for this attempt, from a cryptographic random source, and MUST NOT be accepted from the caller. A seller that accepts caller-supplied challenges voids the freshness guarantee entirely: the attacker picks the challenge, obtains one verdict signed over it, and replays it within the window against every route that accepts it.

**Verifier key identification and rotation.** The verdict MUST carry `kid`, identifying the verifier signing key. The seller pins a verifier key set of `{kid → public_key, not_before, not_after}` entries. The seller MUST verify the signature against a pinned entry whose `kid` matches the verdict and whose validity window covers the verdict's `issued_at`; an unknown `kid`, or a known `kid` with no pinned key valid at `issued_at`, ⇒ deny. A single-key pin set MAY accept a verdict without `kid` (the mapping is unambiguous); a multi-key pin set MUST fail closed on a missing `kid`.

**Validity windows are rotation, not revocation.** A `not_after` in the past does not revoke verdicts signed before it — those still verify until they expire. Revocation requires removing the `kid` from the pin set (an unknown `kid` ⇒ deny) or publishing a `revoked_at` cutoff that the seller checks against the verdict's `issued_at`.

**Verifier availability.** Verifier unreachable, non-200, malformed, or negative ⇒ deny. Fail-closed is the specified behavior, not a degradation path; availability pressure is exactly where implementations drift.

A verdict whose signature covers none of `challenge`, `resource`, and `amount_usd` is a bearer token: it can be obtained for a cheap route and presented at an expensive one until it expires. Scope binding closes exactly that. Migration: sellers MAY run `scope_binding: off` against verifiers that do not yet sign scope until the verifier rollout completes; the requirement above is normative for paid-route verification under ATC/1.0 from v3.0 onward. (Motivated by external seller-side review of the pay-mcp-bridge reference flow — see parthod0x/satroot#2, comment by minia2auk; §5.2 rev 3 and rev 4 hardening folded from minia2auk's follow-up reviews of 2026-10-20.)
---

### 5.3 Settlement receipt ledger (paid routes)

A seller operating paid routes (x402 or equivalent accountless payment) MUST record one ledger line per payment attempt it serves, at the moment the outcome is known. Authorizations are accountless: the ledger is what "did we already serve this authorization" is answered from, so its fields are normative:

- `outcome` — `settled`, `settlement-unknown`, or `denied`. A `denied` line records that the route refused before serving work; the other two record what happened after work was served or the authorization captured.
- `resource`, `amount_usd` (same fixed-scale form as §5.2), `timestamp`.
- `chain_id`, `asset`, `payer`, `nonce` — `payer` and `nonce` from the payer's EIP-3009 `authorization` (`from`, `nonce`); `chain_id` and `asset` from the payment requirements the seller itself advertises, never from payer-controlled fields the seller does not check. The payer's address is a per-key identity: it bounds a key, not a buyer, and MUST NOT be read as a customer count or a returning-user signal.
- On `settlement-unknown` lines: `valid_after` and `valid_before`, kept as the strings the signer sent. The horizon bounds the re-check schedule: the row needs re-checking only while `block.timestamp < valid_before` and the nonce is still unconsumed; past `valid_before` with the nonce unconsumed, the row closes as not-charged.

**Idempotency key.** The canonical key for "did we already serve this authorization" is the tuple `(chain_id, asset, payer, nonce)`. EIP-3009 scopes `authorizationState[from][nonce]` per token contract per authorizer, so the same `(from, nonce)` under two deployments of the same asset — or under two different EIP-3009 tokens — is two independent authorizations. A ledger keyed on the pair alone does two wrong things: it rejects a legitimate second authorization that happens to share a nonce across deployments, and it lets a reconciler join an authorization on one deployment to a settlement on another with the join succeeding silently. UTA's own discovery document serves USDC on both `eip155:8453` and `eip155:84532` — same asset symbol, two `(chain_id, asset)` pairs, one payer address space — so this is a live case for the reference deployment, not a hypothetical.

**The transaction hash is settlement evidence, not an idempotency key.** It answers "did this transfer land" for one settlement; re-signing the same intent with a shifted `valid_before` produces a new hash for the same authorization. Conversely, `authorizationState[from][nonce]` returns true for any transfer that consumed the nonce regardless of value or recipient: a mismatched transfer (same tuple, different `value` or `to`) makes the unknown row terminal, not pending — the nonce cannot be spent again, so re-checking can never resolve it, and the row leaves the bounded schedule on the first mismatch.

(Motivated by the seller-side reviews in parthod0x/satroot#2 — minia2auk, 2026-10-20 and 2026-10-21; parthod0x's correction of 2026-10-24. The on-chain `authorizationState` lookup remains a suggestion for reconcilers, not a deployed feature.)

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
- **v3.0 Draft 00 rev 2 (2026-10-19):** §5.2 added — verdict scope binding required for paid-route presentation (signed verdict MUST cover challenge, resource, amount_usd; seller-side checks fail-closed). Motivated by external seller-side review (minia2auk, parthod0x/satroot#2).
- **v3.0 Draft 00 rev 3 (2026-10-20):** §5.2 hardened from minia2auk's follow-up review (parthod0x/satroot#2): `amount_usd` pinned to a fixed-scale decimal string (JCS makes number serialization normative and non-JS implementations diverge), challenges normatively seller-minted with ≥128 bits of cryptographic entropy (caller-supplied challenges void freshness), `kid` + pinned-key validity windows (`not_before`/`not_after` checked against `issued_at`), and verifier-unreachable ⇒ deny made normative.
- **v3.0 Draft 00 rev 4 (2026-10-20):** §5.2 hardened from minia2auk's second follow-up (parthod0x/satroot#2): `amount_usd` moved to six fractional digits — micro-USD granularity matching USDC's six decimals on Base, because two digits silently excluded the sub-cent routes where x402 micro-payments operate (pricing finer than 1 micro-USD excluded normatively and visibly); verdict window bounded on both sides (`issued_at` rejected beyond the seller's clock skew, `expires_in` capped by seller policy — a wrong or compromised verifier clock cannot widen the replay window alone); rotation separated from revocation (`not_after` does not revoke verdicts signed before it — revocation requires removing the `kid` from the pin set or a `revoked_at` cutoff checked against `issued_at`).
- **v3.0 Draft 00 rev 5 (2026-10-24):** §5.3 added — settlement receipt ledger for paid routes: one line per served payment attempt carrying `outcome` (`settled` / `settlement-unknown` / `denied`) plus `chain_id`, `asset`, `payer`, `nonce` taken from the payer's EIP-3009 authorization and the seller's own payment requirements; the idempotency key is the 4-tuple `(chain_id, asset, payer, nonce)` (the 2-tuple breaks the moment two deployments of the same asset are served — the UTA discovery document does, on `eip155:8453` and `eip155:84532`); the tx hash pinned as settlement evidence only; `settlement-unknown` lines carry `valid_after`/`valid_before` bounding the re-check schedule, and a nonce consumed by a mismatched transfer is terminal, not pending. Motivated by the parthod0x/satroot#2 reviews (minia2auk 2026-10-20/21, parthod0x correction 2026-10-24).

---

## 12. How to comment

- Open issue at `github.com/eddyflores100-lang/atc-spec/issues`
- Tag: `v3.0-comment`
- Direct: `legal@alicelabs.site`

— Edison Flores & Alejandro Flores, AliceLabs LLC, 2026-08-20
