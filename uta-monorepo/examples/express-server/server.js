/**
 * Example: Express.js server with UTA trust enforcement.
 *
 * Run:
 *   npm install express @marketnow/trust-gateway
 *   node server.js
 *
 * Then test with:
 *   curl http://localhost:3000/api/search \
 *     -H "Content-Type: application/json" \
 *     -H "x-uta-credential: <credential-json>" \
 *     -d '{"query":"hello"}'
 */

const express = require('express');
const { TrustGateway } = require('@marketnow/trust-gateway');

const app = express();
app.use(express.json());

// Configure the trust gateway
const gateway = new TrustGateway({
  ca_public_key: process.env.CA_PUBLIC_KEY_PEM || '',  // Set this!
  min_trust_score: 5,
  block_secret_reads: true,
  block_shell_exec: true,
  allowed_issuers: ['did:marketnow:ca'],
});

// Trust middleware
async function trustMiddleware(req, res, next) {
  const credHeader = req.headers['x-uta-credential'];
  if (!credHeader) {
    return res.status(401).json({ error: 'No UTA credential provided' });
  }

  let credential;
  try {
    credential = JSON.parse(credHeader);
  } catch {
    return res.status(400).json({ error: 'Invalid credential JSON' });
  }

  const decision = await gateway.check(credential, req.path, req.body || {});
  if (!decision.allowed) {
    return res.status(403).json({
      error: 'TRUST_GATEWAY_DENY',
      reason: decision.reason,
    });
  }

  req.uta = decision;
  next();
}

// Public route
app.get('/health', (req, res) => res.json({ ok: true }));

// Protected routes
app.post('/api/search', trustMiddleware, (req, res) => {
  res.json({
    result: `Searching for: ${req.body.query}`,
    agent: req.uta.agent_id,
    trust_score: req.uta.trust_score,
  });
});

app.post('/api/fetch', trustMiddleware, (req, res) => {
  res.json({
    result: `Fetching: ${req.body.url}`,
    agent: req.uta.agent_id,
  });
});

app.listen(3000, () => {
  console.log('Example server on http://localhost:3000');
  console.log('Set CA_PUBLIC_KEY_PEM env var to your CA public key');
});
