# @marketnow/trust-adapters

**Trust adapters for every major agent identity format — ATC v3, EAT-AI, A2A, ZTA, MCP, W3C VC, OAuth/OIDC, SPIFFE, X.509.**

One normalization layer: credentials in any of the supported formats are adapted to a
common trust-engine input, so your verification pipeline never forks per format.

```
ATC ─┐ EAT ─┐ A2A ─┐                    ┌─ TrustEngine.evaluate()
MCP ─┤ VC  ─┤ ZTA ─┼─▶ format adapter ──┤      (Ed25519, JCS RFC 8785,
OIDC ─┤ SPIFFE ─┘  X.509                └      PoP, trust scoring)
```

## Install

```bash
npm install @marketnow/trust-adapters
```

Zero runtime dependencies. Node ≥ 16 (`node:crypto` only).

## Quick start

```js
const { TrustEngine, createEngineWithAllAdapters } = require('@marketnow/trust-adapters');

// Engine with every adapter registered:
const engine = createEngineWithAllAdapters();

// Or pick adapters:
const { TrustEngine, MCPAdapter, A2AAdapter } = require('@marketnow/trust-adapters');
const eng = new TrustEngine();
eng.register(new MCPAdapter());
eng.register(new A2AAdapter());

// Normalize + evaluate any supported credential
const result = engine.evaluate(credential);
// → { trust_score, stages: [...], verified: boolean }
```

## Adapters

| Adapter | Format |
|---|---|
| `ATCAdapter` | Agent Trust Card v3 (MarketNow / UTA) |
| `EATAdapter` | EAT-AI (IETF agent tokens) |
| `A2AAdapter` | A2A agent cards (agent card trust extensions) |
| `ZTAAdapter` | ZTA zero-trust assertions |
| `MCPAdapter` | Model Context Protocol credentials |
| `OAuthAdapter` | OAuth 2.0 / OIDC ID tokens |
| `VCAdapter` | W3C Verifiable Credentials |
| `SPIFFEAdapter` | SPIFFE SVID workload identity |
| `X509Adapter` | X.509 certificate credentials |

## Project

Part of the [Universal Trust Adapter](https://github.com/alicelabs-llc/universal-trust-adapter)
stack — live public infrastructure at [marketnow.site](https://www.marketnow.site):

- MCP endpoint with trust tools: `https://www.marketnow.site/api/mcp`
- OCSP-style revocation: `https://www.marketnow.site/api/ocsp`

Sister packages: `@marketnow/trust-core` (primitives), `@marketnow/trust-gateway`
(MCP middleware), `@marketnow/cline-trust-plugin`.

## 1.0.2 — what changed

- **Fix**: published 1.0.1 tarball was missing the `core/` runtime files
  (`dist/*.js` required `../core/crypto.js` and `../core/trust-engine.js` →
  `require()` threw on a clean install). The needed core modules are now vendored
  under `core/` — the package is fully self-contained.
- README, LICENSE (AL-1.0) and NOTICE now ship in the tarball (npm page was blank).
- Dependencies removed — zero-dep install.

## License

Dual-licensed under **MIT OR Apache-2.0, at your option** — free for any use, including
commercial use. This repo and all MarketNow npm packages (marketnow-mcp v1.14.0+,
agent-trust-card v1.4.0+, @marketnow/*) ship dual-licensed: see
[LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
Trademarks ("MarketNow", "UTA", "ATC") are reserved by AliceLabs LLC — see [NOTICE](NOTICE).
