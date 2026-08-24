# Universal Trust API — REST Specification

**Version:** 1.0.0
**Base URL:** `https://atc.alicelabs.site/api/trust`
**Auth:** Bearer token (optional for read endpoints, required for issue/bridge)
**Rate limits:** 60/min anonymous, 600/min authenticated

---

## Endpoints

### `GET /api/trust/formats`

List all supported formats and their adapter status.

**Response 200:**
```json
{
  "formats": [
    { "id": "atc-v2", "name": "ATC v2.0", "status": "stable" },
    { "id": "atc-v3", "name": "ATC v3.0 (multi-sig)", "status": "beta" },
    { "id": "eat-ai", "name": "IETF EAT-AI (CWT/CBOR)", "status": "experimental" },
    { "id": "zta", "name": "Anthropic ZTA", "status": "experimental" },
    { "id": "a2a-card", "name": "Google A2A Agent Card", "status": "experimental" },
    { "id": "mcp-card", "name": "MCP Server Card", "status": "stable" },
    { "id": "w3c-vc", "name": "W3C Verifiable Credentials 2.0", "status": "stable" },
    { "id": "oauth-token", "name": "OAuth 2.0 / OIDC Token (JWT)", "status": "stable" },
    { "id": "spiffe-svid", "name": "SPIFFE SVID", "status": "experimental" }
  ]
}
```

---

### `POST /api/trust/translate`

Translate a payload from one format to another.

**Request:**
```json
{
  "from": "atc-v3",
  "to": "eat-ai",
  "payload": { ... ATC v3 credential ... }
}
```

`from` is optional — if omitted, the engine auto-detects.

**Response 200:**
```json
{
  "detected_format": "atc-v3",
  "translated_to": "eat-ai",
  "uts": { ... UniversalTrustSchema ... },
  "payload": { ... or "base64:..." for binary formats ... },
  "warnings": [
    "Field 'trust_claims.owasp_top_10' has no equivalent in EAT-AI; preserved in format.raw"
  ]
}
```

**Response 422** (detection failed):
```json
{
  "error": "Could not detect source format. Specify 'from' explicitly.",
  "supported_formats": ["atc-v3", "eat-ai", "zta", ...]
}
```

---

### `POST /api/trust/verify`

Verify any payload (auto-detect format).

**Request:**
```json
{
  "payload": { ... any format ... },
  "options": {
    "offline": true,
    "skip_ocsp": true,
    "artifact_path": "/local/path/to/artifact"
  }
}
```

**Response 200:**
```json
{
  "valid": true,
  "detected_format": "zta",
  "verified_via": "zta",
  "uts": { ... UniversalTrustSchema ... },
  "warnings": [
    "Trust score 6 below recommended threshold 7"
  ]
}
```

**Response 200 (invalid):**
```json
{
  "valid": false,
  "detected_format": "atc-v3",
  "reason": "Signature verification failed: proof_bytes invalid",
  "uts": null
}
```

---

### `POST /api/trust/issue`

Issue a credential in multiple formats simultaneously.

**Auth:** Required (Bearer token with `issue` scope).

**Request:**
```json
{
  "subject": {
    "id": "my-agent-001",
    "name": "My Agent",
    "type": "agent"
  },
  "identity": {
    "public_key": "base64:...",
    "key_algorithm": "Ed25519"
  },
  "trust": {
    "score": 8,
    "confidence": "high",
    "evidence": [
      {
        "type": "static-analysis",
        "source": "Sentinel L1.5",
        "result": "pass",
        "timestamp": "2026-08-20T00:00:00Z"
      }
    ],
    "assessor": "AliceLabs Trust CA"
  },
  "capabilities": {
    "provides": ["search", "read"],
    "protocols": ["mcp", "a2a"]
  },
  "policy": {
    "filesystem_access": "read",
    "shell_access": "none"
  },
  "expires_in_days": 90,
  "formats": ["atc-v3", "eat-ai", "zta", "w3c-vc"]
}
```

**Response 200:**
```json
{
  "credentials": {
    "atc-v3": { ... ATC v3 credential with signatures[] ... },
    "eat-ai": "base64:...",
    "zta": { ... ZTA payload ... },
    "w3c-vc": { ... W3C VC ... }
  },
  "uts": { ... UniversalTrustSchema of the issued credential ... }
}
```

---

### `POST /api/trust/bridge`

Verify in one ecosystem, re-issue as another.

**Auth:** Required.

**Request:**
```json
{
  "verify_in": "zta",
  "issue_as": "atc-v3",
  "payload": { ... ZTA from Anthropic ... },
  "policy": {
    "min_trust_score": 7,
    "require_attestation": false
  }
}
```

**Response 200 (success):**
```json
{
  "verified": true,
  "original": {
    "format": "zta",
    "uts": { ... }
  },
  "issued": {
    "format": "atc-v3",
    "credential": { ... ATC v3 ... }
  },
  "bridge_log": "ZTA score 8 → ATC score 8 (1:1 mapping via UTS)"
}
```

**Response 200 (verification failed):**
```json
{
  "verified": false,
  "bridge_log": "Verification failed: ZTA signature invalid"
}
```

**Response 200 (policy violation):**
```json
{
  "verified": false,
  "bridge_log": "Trust score 5 below threshold 7"
}
```

---

### `POST /api/trust/detect`

Detect the format of an unknown payload without verifying.

**Request:**
```json
{
  "payload": { ... or "base64:..." for binary ... }
}
```

**Response 200:**
```json
{
  "detected_format": "eat-ai",
  "confidence": 0.95,
  "alternatives": [
    { "format": "w3c-vc", "confidence": 0.30 }
  ]
}
```

**Response 200 (no match):**
```json
{
  "detected_format": null,
  "alternatives": []
}
```

---

### `GET /api/trust/registry`

List trusted issuers (Trust Registry).

**Response 200:**
```json
{
  "version": "1.0",
  "last_updated": "2026-08-20T00:00:00Z",
  "issuers": [
    {
      "did": "did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z",
      "name": "AliceLabs Trust CA",
      "supported_formats": ["atc-v3", "eat-ai", "w3c-vc"],
      "since": "2026-01-01T00:00:00Z",
      "status": "active",
      "revocation_endpoint": "https://atc.alicelabs.site/api/v2/ocsp",
      "policy_url": "https://atc.alicelabs.site/trust-registry/al-ca-policy"
    }
  ]
}
```

---

## Error responses

All errors follow this format:

```json
{
  "error": {
    "code": "DETECTION_FAILED",
    "message": "Could not detect format",
    "documentation_url": "https://atc.alicelabs.site/docs/errors#detection-failed",
    "request_id": "req_abc123"
  }
}
```

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `INVALID_PAYLOAD` | Payload is not valid JSON / CBOR |
| 401 | `UNAUTHORIZED` | Bearer token required for this endpoint |
| 403 | `FORBIDDEN` | Token lacks required scope |
| 404 | `FORMAT_NOT_FOUND` | Requested format not registered |
| 422 | `DETECTION_FAILED` | Could not detect format; specify `from` explicitly |
| 422 | `TRANSLATION_LOSSY` | Translation loses fields; warnings array populated |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Server error; check logs with `request_id` |

---

## SDK usage (preferred over raw API)

```typescript
import { createEngineWithAllAdapters } from '@marketnow/trust-core';

const engine = createEngineWithAllAdapters();

// Translate ATC → EAT-AI (no API call needed — runs locally)
const atcCard = loadATC();
const eatToken = engine.translate(atcCard, { to: 'eat-ai' });

// Verify any format (auto-detect, runs locally)
const result = await engine.verifyAny(unknownPayload);

// Bridge: verify ZTA, re-issue as ATC v3
const bridge = await engine.bridge({
  verify_in: 'zta',
  issue_as: 'atc-v3',
  payload: ztaPayload,
  policy: { min_trust_score: 7 },
});
```

The REST API is a thin wrapper around the SDK for non-JS environments. The SDK is preferred because:
- No network calls (works offline)
- No rate limits
- No data leaves the verifier's machine (privacy)
- Sub-millisecond latency

---

## Versioning

- API uses URL-based versioning: `/api/trust/v1/*`, `/api/trust/v2/*` (future)
- Breaking changes increment the major version
- New endpoints / fields are additive (no version bump)

## License

API spec: CC-BY-4.0
Reference implementation: MIT
