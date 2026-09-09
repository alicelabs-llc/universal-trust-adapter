# @marketnow/trust-gateway

**MCP middleware for enforcing trust decisions on agent tool calls.**

`@marketnow/trust-gateway` sits between an agent runtime and its tool servers: every `tools/call` passes through a configurable trust gate that verifies the caller's credential (Agent Trust Card / EAT), scores trust with a 12-stage verification pipeline, and emits signed audit receipts for every decision.

```
agent ──tools/call──▶ [ TrustGateway.check() ] ──▶ tool server
                          │  credential verify (Ed25519 + JCS)
                          │  policy (min score, stage gates)
                          ▼
                    ReceiptStore (signed, hash-chained)
```

## Install

```bash
npm install @marketnow/trust-gateway
```

Zero runtime dependencies. Node ≥ 16 (uses `node:crypto` Ed25519 only).

## Quick start

```js
const { TrustGateway, withTrustGateway } = require('@marketnow/trust-gateway');

const gateway = new TrustGateway({
  min_trust_score: 5,
  require_pinned_ca: true,   // card must chain to a pinned CA
});

// Decision object: { allowed: boolean, reason, trust_score }
const decision = await gateway.check(agentCredential, 'search_web', { q: 'weather' });
if (!decision.allowed) console.error('DENY:', decision.reason);

// Or wrap a handler — denials throw TRUST_GATEWAY_DENY:<reason>
const secured = withTrustGateway(myToolHandler, gateway);
```

## Signed receipts

Every allow/deny is recorded by `ReceiptGenerator` / `ReceiptStore`: hash-chained,
Ed25519-signed audit receipts you can replay later to prove *what was allowed and why*.

```js
const { ReceiptStore } = require('@marketnow/trust-gateway');
const store = new ReceiptStore('/var/log/uta/receipts.jsonl');
```

## What's inside

| Export | Purpose |
|---|---|
| `TrustGateway` | Policy gate for `tools/call` (allow/deny + reason) |
| `withTrustGateway(handler, gw)` | One-liner middleware wrapper |
| `DEFAULT_CONFIG` | Reference policy (min score 5, pinned CA, stage gates) |
| `ReceiptGenerator` / `ReceiptStore` | Signed, hash-chained audit trail |
| `verifyCredential` | Standalone 12-stage credential verification |

## Verification pipeline

The gate delegates to a 12-stage pipeline (signature → canonical form (RFC 8785 JCS) →
PoP → validity window → CA pinning → ... → trust score). Fail-closed: any stage error
denies the call with the stage name in `reason`.

## Project

Part of the [Universal Trust Adapter](https://github.com/alicelabs-llc/universal-trust-adapter)
stack — live public infrastructure at [marketnow.site](https://www.marketnow.site):

- MCP endpoint with trust tools: `https://www.marketnow.site/api/mcp`
- OCSP-style revocation: `https://www.marketnow.site/api/ocsp`
- Signed CRL: `https://www.marketnow.site/api/crl`

Sister packages: `@marketnow/trust-core`, `@marketnow/trust-adapters`,
`@marketnow/cline-trust-plugin` (interceptor with revocation gate).

## 1.0.2 — what changed

- **Fix**: published 1.0.1 tarball was missing the `core/` runtime files
  (`dist/index.js` required `../core/*` → `require()` threw on a clean install).
  The needed core modules are now vendored under `core/` — the package is fully
  self-contained.
- README, LICENSE (AL-1.0) and NOTICE now ship in the tarball (npm page was blank).
- Dependencies removed — zero-dep install.

## License

AL-1.0 (AliceLabs Source-Available). See `LICENSE-AL-1.0`. Commercial licensing:
legal@alicelabs.site
