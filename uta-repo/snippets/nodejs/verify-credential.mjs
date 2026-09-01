/**
 * Universal Trust Adapter — Verify any AI agent credential (Node.js)
 * Supports 8 formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Card, X.509
 *
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 * API:  https://www.marketnow.site/api/trust
 * NPM:  @marketnow/trust-core
 */

import { verify } from '@marketnow/trust-core';

const jwtCard = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...';

const result = await verify(jwtCard);

console.log('Decision:', result.decision);     // 'PERMIT' | 'DENY' | 'UNDETERMINED'
console.log('Format:', result.detected_format); // 'JWT'
console.log('Issuer:', result.issuer);

if (result.decision === 'PERMIT') {
  console.log('Credential valid — proceed with tool execution');
} else {
  console.error(`Failed at stage: ${result.failed_stage}`);
  process.exit(1);
}
