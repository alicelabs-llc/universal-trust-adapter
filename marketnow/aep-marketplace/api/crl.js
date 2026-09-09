// /api/crl.js — MarketNow Certificate Revocation List endpoint
// Serves the signed CRL (MNR-CRL-1.0) + everything a stranger needs to verify it.
// Roadmap v5.1 item 5 — revocation + transparency, now real.

import { CRL, REGISTRY_KEY } from '../lib/revocations-data.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed — GET only' });

  return res.status(200).json({
    protocol: 'MNR-CRL-1.0',
    description: 'MarketNow Revocation Registry — signed, append-only revocation list for Agent Trust Cards and CA keys.',
    crl: CRL,
    verification: {
      registry_key: REGISTRY_KEY,
      registry_key_url: '/uta/revocations/registry-key.json',
      steps: [
        '1. Take crl (or /uta/revocations/crl.json) and remove the "signature" object → payload.',
        '2. canonical = "MNR-CRL-1.0:" + JCS(payload)  (RFC 8785 — recursive key sort, minimal escaping).',
        '3. sha256(utf8(canonical)) must equal crl.signature.signed_payload_hash.',
        '4. Ed25519-verify canonical bytes against registry_key.public_key_spki_base64 with crl.signature.value (64-byte hex).',
      ],
      node_snippet: [
        "const { createPublicKey, verify, createHash } = require('node:crypto');",
        "const { crl } = await (await fetch('https://www.marketnow.site/api/crl')).json();",
        "const { signature, ...payload } = crl;",
        "const canonical = 'MNR-CRL-1.0:' + jcs(payload); // RFC 8785",
        "const ok = verify(null, Buffer.from(canonical),",
        "  createPublicKey({ key: Buffer.from(registryKey.public_key_spki_base64, 'base64'), format: 'der', type: 'spki' }),",
        "  Buffer.from(signature.value, 'hex'));",
      ].join('\n'),
    },
    status_resolution: {
      ocsp_endpoint: '/api/ocsp?card_id=… or ?kid=…',
      semantics: ['VALID', 'EXPIRED', 'REVOKED', 'SUSPENDED', 'SUPERSEDED', 'UNKNOWN'],
      fail_closed: 'UNKNOWN → recommendation DENY',
    },
    roadmap: 'v5.1 item 5 — ATC Revocation + Transparency Log',
  });
}
