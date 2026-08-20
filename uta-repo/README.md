# Universal Trust Adapter (UTA)

**The USB-C of agent trust.**

UTA translates between ALL trust credential formats used by AI agents — ATC, EAT-AI (IETF), ZTA (Anthropic), A2A Agent Card (Google), MCP Server Card (Anthropic) — via a canonical Universal Trust Schema (UTS).

Like Zapier connects applications, **UTA connects trust standards**.

Built by **Edison Flores** & **Alejandro Flores** at **AliceLabs LLC** (Wyoming, USA). MNNC-1.0 licensed.

## Install

```bash
npm install universal-trust-adapter
```

## Use

```javascript
import { handleTrust } from 'universal-trust-adapter/api/trust.js';

// Verify any format (auto-detect)
const result = await fetch('https://universal-trust-adapter.vercel.app/api/trust?action=verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ payload: anyCredential })
});

// Translate ATC → ZTA
const translated = await fetch('https://universal-trust-adapter.vercel.app/api/trust?action=translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: 'zta', payload: atcCard })
});

// Bridge: verify ZTA, issue ATC with attestation chaining
const bridge = await fetch('https://universal-trust-adapter.vercel.app/api/trust?action=bridge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    verifyIn: 'zta',
    issueAs: 'atc-v2',
    policy: { min_trust_score: 7 },
    payload: ztaCredential
  })
});
```

## Supported formats

| Format | Status | Owner |
|--------|--------|-------|
| ATC v2.0 | stable | AliceLabs |
| EAT-AI | beta | IETF |
| ZTA | beta | Anthropic |
| A2A Agent Card | beta | Google / AAIF |
| MCP Server Card | beta | Anthropic |
| W3C VC | planned | W3C |
| OAuth/OIDC | planned | IETF |
| SPIFFE SVID | planned | CNCF |

## API

Live at: https://universal-trust-adapter.vercel.app/api/trust

## License

MNNC-1.0 — AliceLabs Modified Non-Commercial License. See [LICENSE](./LICENSE).
