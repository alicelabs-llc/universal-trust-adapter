<!-- Target: r/typescript -->
<!-- Post type: text post -->

**Title:** Built a TypeScript credential verification library — 8 formats, 12-stage pipeline, 6.7k verifications/sec

**Body:**

Hey r/typescript —

Open-sourced a TypeScript library: **@marketnow/trust-core** — https://github.com/alicelabs-llc/universal-trust-adapter

It verifies AI agent credentials in 8 formats (ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509) through a 12-stage pipeline.

```typescript
import { verify } from '@marketnow/trust-core';

const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
// result.detected_format: 'JWT' | 'W3C_VC' | 'MCP_CARD' | ...
// result.stages: { PARSER: 'OK', DETECT: 'JWT', CRYPTO: 'OK', ... }
```

**Stats:**
- 6,744 verifications/sec (single core)
- 480+ tests
- 23 property tests
- Zero runtime dependencies (only crypto primitives)
- TypeScript-first, ESM/CJS dual build
- Public API also available: https://www.marketnow.site/api/trust

Curious what TypeScript devs think of the API shape. Repo: https://github.com/alicelabs-llc/universal-trust-adapter
