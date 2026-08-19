/**
 * MarketNow — CORS Configuration
 * 
 * GET endpoints: Allow * (public read access for agents)
 * POST endpoints: Restricted to known origins
 */

const ALLOWED_ORIGINS = [
  'https://marketnow.site',
  'https://www.marketnow.site',
  'https://aep-marketplace.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

const POST_ENDPOINTS = [
  '/api/atc',
  '/api/agent-purchase',
  '/api/mandates',
  '/api/interceptor',
  '/api/stream',
  '/api/stacks',
  '/api/execute',
  '/api/audit-skill',
  '/api/stripe-webhook',
];

export function setCorsHeaders(req, res) {
  const origin = req?.headers?.origin || '';
  const path = req?.url?.split('?')[0] || '';
  const method = req?.method || 'GET';

  // POST endpoints: restricted CORS
  if (method === 'POST' && POST_ENDPOINTS.some(ep => path.includes(ep))) {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-ATC-Card-Id, X-Proof-Signature');
      res.setHeader('Vary', 'Origin');
    } else if (!origin) {
      // Allow non-browser clients (curl, agents) without Origin header
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-ATC-Card-Id, X-Proof-Signature');
    }
    // If origin is present but not in allowlist, NO CORS header = browser blocks
  } else {
    // GET endpoints: wildcard CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}
