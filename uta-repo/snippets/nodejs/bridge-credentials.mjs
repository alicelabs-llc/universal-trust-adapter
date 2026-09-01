/**
 * UTA Bridge — Verify in ecosystem A, issue equivalent in B (Node.js).
 * Use case: Agent A speaks JWT, Agent B speaks W3C VC.
 */
import { bridge, verify } from '@marketnow/trust-core';

const jwtCard = 'eyJ...';
const w3cCard = await bridge({
  card: jwtCard,
  target_format: 'W3C_VC',
  target_issuer: 'did:web:bridge.example',
  preserve_scope: true,
  preserve_subject: true,
  ttl_seconds: 3600,
});
console.log('Bridged W3C VC:', JSON.stringify(w3cCard, null, 2));
const result = await verify(w3cCard);
console.log('Verification in ecosystem B:', result.decision);
