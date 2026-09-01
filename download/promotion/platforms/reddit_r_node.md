<!-- Target: r/node -->
<!-- Post type: text post -->

**Title:** @marketnow/trust-core — Node.js library to verify AI agent credentials (8 formats, 6.7k/sec)

**Body:**

Hey r/node —

Published a Node.js library: **@marketnow/trust-core** — verifies AI agent credentials in 8 formats.

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(jwtCard);
console.log(result.decision); // 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

**8 formats:** ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509

**12-stage pipeline:** PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION

**Benchmarks:**
- 6,744 verifications/sec (single core)
- 480+ tests
- ESM + CJS dual build
- Zero runtime dependencies (Node.js crypto only)

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
API: https://www.marketnow.site/api/trust

Curious what Node devs think.
