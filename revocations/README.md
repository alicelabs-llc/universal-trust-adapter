# MarketNow Revocation Registry (MNR-CRL-1.0)

Public, signed, append-only revocation list for Agent Trust Cards and CA keys.
This is the "Certificate Transparency for agents" piece of roadmap **v5.1 item 5** —
it existed as a *promised* feature on `/api/trust?action=revocation` and is now a
*real, verifiable* artifact.

## Artifacts
| File | Purpose |
|------|---------|
| `crl.json` | The signed CRL — Ed25519 signature over RFC 8785 JCS canonical payload |
| `registry-key.json` | Public key of the registry signing key (mn-revoc-002) + verification steps |

## Endpoints (live)
- `GET /api/crl` — serves the CRL + verification instructions
- `GET/POST /api/ocsp?card_id=ATC-2026-5837752` — per-subject status resolution (nonce anti-replay, fail-closed)
- `GET /api/ocsp?kid=mn-ca-002` — CA-key status resolution

## Semantics (roadmap v5.1.5)
States: `VALID`, `EXPIRED`, `REVOKED`, `SUSPENDED`, `SUPERSEDED`, `UNKNOWN`.
Unknown subjects answer `UNKNOWN` with recommendation `DENY` (fail-closed).

## History
| Subject | Status | Since | Reason |
|---------|--------|-------|--------|
| ATC-2026-5837752 | REVOKED (SUPERSEDED) | 2026-07-18 | Replaced with Sentinel-cert-linked ATC |
| ATC-2026-5936297 | REVOKED (SUPERSEDED) | 2026-07-22 | Buggy canonicalization, re-issued |
| ATC-2026-9880252 | REVOKED (SUPERSEDED) | 2026-07-23 | Re-signing under RFC 8785 |
| mn-ca-002 | REVOKED (KEY_COMPROMISE) | 2026-09-08 | Private key committed publicly |
| ATC-2026-1509360 | REVOKED | 2026-08-09 | test (propagated to CRL 2026-09-17) |

Registry updates happen via new CRL versions in the source repo
(`marketnow/_data/atc` + this build) — each version is independently verifiable
against the same public key.

**Key rotation 2026-09-17:** mn-revoc-001 → mn-revoc-002 during scheduled CRL
renewal (the previous CRL's next_update window elapsed). registry-key.json is the
authoritative anchor; it carries the rotation history.
