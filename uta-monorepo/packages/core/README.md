# @marketnow/trust-core

**UTA Verification Core** — the cryptographic heart of the Universal Trust Adapter. 12-stage verification pipeline, Ed25519 (RFC 8032), canonical JSON (RFC 8785 JCS), Proof of Possession, revocation (CRL + OCSP + Bitstring Status List) and supply-chain verification (SBOM + SPDX + Sigstore). Zero runtime dependencies.

```bash
npm install @marketnow/trust-core
```

## Exports

| Export | What it does |
|---|---|
| `verifyCredential(credential, context)` | Runs the **12-stage verification pipeline** and returns a structured `VerificationResult` with per-stage results |
| `TrustEngine` | Composable trust-decision engine over the pipeline |
| `sign` / `verify` | Ed25519 (RFC 8032) signatures over JCS-canonicalized payloads |
| `canonicalize` / `canonicalHash` | RFC 8785 JCS canonicalization + SHA-256 canonical hashing |
| `generateEd25519KeyPair` | Keypair generation for issuing and verifying |
| `generatePoPChallenge` / `createPoPResponse` / `verifyPoP` | **Proof of Possession** flows (bind a key to an artifact) |
| `computeArtifactBinding` / `DOMAINS` | Domain-separated artifact binding (signature domains) |
| `verify` (credential form) | Stage-level checks including revocation (CRL, OCSP, bitstring status list) and supply chain (SBOM/SPDX, Sigstore) |

## Quick start

```js
import { verifyCredential, canonicalize } from '@marketnow/trust-core';

const result = await verifyCredential(card, {
  now: new Date(),
  fetchCrl: async (url) => /* fetch + parse CRL */,
});

if (result.valid) {
  console.log('all 12 stages passed');
} else {
  for (const stage of result.stages) {
    if (!stage.passed) console.error(stage.stage, stage.reason);
  }
}
```

## Design principles

- **Fail-closed**: unknown revocation state or unreachable evidence never counts as "valid".
- **Deterministic**: RFC 8785 JCS canonicalization before every hash/signature — no parser-differential ambiguity.
- **Zero dependencies**: only Node's built-in `node:crypto`.
- **Typed end-to-end**: full TypeScript types ship in `dist/*.d.ts`.

## Related packages

- `@marketnow/trust-adapters` — protocol adapters (A2A, ATC, EAT, MCP, OAuth, SPIFFE)
- `@marketnow/trust-gateway` — runtime gateway (`TrustGateway`, `withTrustGateway`)
- `marketnow-mcp` — MCP server exposing the live trust tools
- `agent-trust-card` — ATC/1.0 SDK and CLI

## License

AL-1.0 (Apache-style, attribution required). See `LICENSE-AL-1.0` and `NOTICE`. © 2025–2026 AliceLabs LLC (Wyoming, USA).
