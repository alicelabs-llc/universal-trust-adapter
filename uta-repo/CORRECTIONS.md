# Universal Trust Adapter (UTA) — Status & Corrections

> Applied 2026-08-20 based on external strategic review (17 points)

## Corrections Applied

### C-1: Honest implementation status (was "8 adapters", now accurate)

**Before:** "8 adapters implemented"
**After:** Clearly separates IMPLEMENTED vs PLANNED

| Format | Status | Crypto verification | Type |
|--------|--------|--------------------|----|
| ATC v2.0 | ✅ Implemented | ✅ Ed25519 real | Trust credential |
| EAT-AI | ✅ Implemented | ⚠️ Schema only (CWT/CBOR decode pending) | Attestation |
| ZTA | ✅ Implemented | ⚠️ Schema only (Anthropic signature TBD) | Trust credential |
| A2A Agent Card | ✅ Implemented | ⚠️ No crypto (metadata format) | Capability/identity metadata |
| MCP Server Card | ✅ Implemented | ⚠️ No crypto (no signature in spec) | Server metadata |
| W3C VC | ❌ Planned | ❌ Pending | Credential model |
| OAuth/OIDC | ❌ Planned | ❌ Pending | Identity/authorization |
| SPIFFE SVID | ❌ Planned | ❌ Pending | Workload identity |

**Translation pairs:** 5 implemented × 4 = **20 directed pairs** (not 30, not 56)

### C-2: Reframed conceptual thesis

**Before:** "translates between ALL trust credential formats"
**After:** "UTA normalizes heterogeneous agent identity, capability, authorization and attestation signals into a common trust representation"

The 8 formats are NOT equivalent. They are different types:
- **Trust credentials:** ATC, ZTA, EAT-AI
- **Identity/authorization:** OAuth/OIDC, SPIFFE
- **Credential models:** W3C VC
- **Metadata formats:** A2A Agent Card, MCP Server Card

UTS handles this by having optional fields — metadata formats populate fewer UTS fields than trust credentials.

### C-3: 3-Layer licensing model (was MNNC-1.0 everywhere)

```
Layer 1: UTS Specification        → Open (CC-BY 4.0 — anyone can read and implement)
Layer 2: UTA Reference SDK        → Apache 2.0 (open source, anyone can fork and use)
Layer 3: MarketNow Trust Cloud    → MNNC-1.0 proprietary (the commercial product)
```

This resolves the contradiction: UTA can be a universal standard (open) while MarketNow remains proprietary (commercial).

### C-4: ATC version freeze

| Version | Status | Rule |
|---------|--------|------|
| ATC 1.0 | **Stable — DO NOT TOUCH** | npm `agent-trust-card@1.1.1` stays at 1.0 |
| ATC 2.0 | **Legacy / deprecated** | Migrated to v3 or stays at v1 |
| ATC 3.0 | **Draft** | Multi-signature (Ed25519 + EAT-CWT + W3C VC) — experimental |

**Rule:** UTA must be backwards compatible with ATC 1.0 stable.

### C-5: Separated crypto implementation from stubs

**Before:** All adapters listed as "implemented"
**After:** Each adapter clearly states:

```
Schema translation:       ✅ IMPLEMENTED
Format detection:         ✅ IMPLEMENTED
Policy enforcement:       ✅ IMPLEMENTED
Cryptographic verification: ⚠️ PARTIAL (ATC has real Ed25519; others are schema-only)
Cryptographic issuance:    ⚠️ PARTIAL (ATC can issue; others produce unsigned output)
Production interoperability: ❌ PENDING (no external implementation has verified UTA output yet)
```

### C-6: Test vectors published

Official conformance test vectors at `/spec/test-vectors/`:
- `valid-atc.json` — valid ATC v2.0 card
- `invalid-signature.json` — tampered signature
- `expired-atc.json` — past expires_at
- `revoked-atc.json` — status=revoked
- `valid-zta.json` — valid ZTA credential
- `valid-a2a.json` — valid A2A Agent Card
- `atc-to-uts.json` — ATC → UTS expected output
- `uts-to-zta.json` — UTS → ZTA expected output

### C-7: Domain separation

```
marketnow.site        → Marketplace + Discovery (commercial)
universal-trust-adapter.vercel.app → UTA API (reference implementation)
atc.alicelabs.site    → ATC spec (protocol surface)
uta.alicelabs.site    → UTS spec + UTA docs (protocol surface)
```

### C-8: Positioned relative to UTCP

```
UTCP  → HOW do I CALL the tool?    (tool calling protocol)
UTA   → HOW do I TRUST the tool?   (trust interoperability)
MarketNow → WHERE do I FIND it + SHOULD I ALLOW it? (discovery + enforcement)
```

UTA does NOT compete with UTCP. It complements it.
