# @marketnow/trust-mcp-middleware

MCP middleware that wraps any server's `tools/call` handler with the MarketNow TrustGateway: **no credential → no execution.**

Every `tools/call` request must carry an agent credential (`_meta.utta_credential`). The middleware verifies it through `@marketnow/trust-gateway` (fail-closed), denies invalid requests with a structured `TRUST_GATEWAY_DENY` error, and emits signed audit receipts for allowed calls.

## Install

```bash
npm install @marketnow/trust-mcp-middleware
```

## Quick start

```js
const { withUTATrust, attachCredential, MCPServerWrapper } = require('@marketnow/trust-mcp-middleware');

// Wrap an existing handler
const trustedCall = withUTATrust(handler, { min_trust_score: 5, generateReceipts: true });

// Client side: attach the credential to a request
const request = attachCredential(
  { method: 'tools/call', params: { name: 'get_weather', arguments: { city: 'Quito' } } },
  credential
);
const result = await trustedCall(request);
// → denied (TRUST_GATEWAY_DENY) if the credential fails verification
```

### Full server wrapper

```js
const { MCPServerWrapper } = require('@marketnow/trust-mcp-middleware');

const server = new MCPServerWrapper({ min_trust_score: 5 });
server.registerTool('get_weather', async (req) => {
  return { content: [{ type: 'text', text: 'sunny' }] };
});
const response = await server.handleCall(request); // credential enforced + receipt emitted
```

## Exports

| Export | What it does |
|---|---|
| `MCPTrustMiddleware` | Intercepts `tools/call`, verifies credentials, emits receipts |
| `MCPServerWrapper` | Convenience wrapper: tool registry + enforcement in one |
| `withUTATrust(handler, config)` | One-liner to wrap an existing handler |
| `attachCredential(request, credential, popResponse?)` | Client-side helper to attach `_meta.utta_credential` |

## Behavior

- **Fail-closed**: no credential in `_meta.utta_credential` → `TRUST_GATEWAY_DENY`, `isError: true`.
- **Non-tools/call methods** (initialize, tools/list...) pass through untouched.
- **Receipts**: allowed calls get a signed receipt (`ReceiptGenerator`), retrievable via `middleware.getReceipt(id)` / `listReceipts()`.

Dependencies: `@marketnow/trust-gateway` (verification), `@marketnow/trust-core` (Ed25519 keys).

Part of the MarketNow trust stack — see the [universal-trust-adapter repo](https://github.com/alicelabs-llc/universal-trust-adapter) and [marketnow.site](https://www.marketnow.site).

## License

Dual-licensed under **MIT OR Apache-2.0, at your option** — free for any use, including
commercial use. This repo and all MarketNow npm packages (marketnow-mcp v1.14.0+,
agent-trust-card v1.4.0+, @marketnow/*) ship dual-licensed: see
[LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
Trademarks ("MarketNow", "UTA", "ATC") are reserved by AliceLabs LLC — see [NOTICE](NOTICE).
