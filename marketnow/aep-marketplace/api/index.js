// ============================================================================
// MarketNow — Unified API Router (replaces ALL 12 lambdas with 1)
// ============================================================================
// This single file handles ALL /api/* routes via internal routing.
// Deploy as api/index.js — Vercel serves it as ONE function.
// Breaks the 12-function Hobby limit.
// ============================================================================

import { setCorsHeaders } from '../lib/cors.mjs';

// ── Import all handlers ─────────────────────────────────────────────────────
import atcHandler from './atc.js';
import searchHandler from './search.js';
import mandatesHandler from './mandates.js';
import securityHandler from './security.js';
import owaspHandler from './owasp.js';
import agentPurchaseHandler from './agent-purchase.js';
import agentEconomyHandler from './agent-economy.js';
import auditSkillHandler from './audit-skill.js';
import mcpHandler from './mcp.js';
import manifestHandler from './manifest.js';
import stripeWebhookHandler from './stripe-webhook.js';

// ── Import Universal Trust Adapter ─────────────────────────────────────────
import { handleTrust } from './trust-handler.mjs';

// ── Route table ─────────────────────────────────────────────────────────────
const ROUTES = {
  // ATC endpoints (the big one — handles action=trust, verify, ca-key, etc.)
  '/api/atc': atcHandler,
  
  // Universal Trust API (new — replaces the standalone trust.js lambda)
  '/api/trust': null,  // handled inline by trust-handler.mjs
  
  // Skills / search
  '/api/search': searchHandler,
  '/api/skills.json': searchHandler,
  '/api/skills-lite.json': searchHandler,
  '/api/free-skills.json': searchHandler,
  '/api/categories.json': searchHandler,
  
  // Mandates
  '/api/mandates': mandatesHandler,
  
  // Security
  '/api/security': securityHandler,
  '/api/owasp': owaspHandler,
  '/api/interceptor': agentEconomyHandler,  // _mode=interceptor
  
  // Commerce
  '/api/agent-purchase': agentPurchaseHandler,
  '/api/stripe-webhook': stripeWebhookHandler,
  
  // Agent economy (interceptor, stream, stacks, execute)
  '/api/agent-economy': agentEconomyHandler,
  '/api/execute': agentEconomyHandler,
  '/api/stacks': agentEconomyHandler,
  '/api/stream': agentEconomyHandler,
  
  // Audit
  '/api/audit-skill': auditSkillHandler,
  
  // MCP
  '/api/mcp': mcpHandler,
  
  // Manifest
  '/api/manifest': manifestHandler,
  
  // Agent discovery
  '/api/agent.json': null,  // served as static file from public/
  '/api/agent-ping.json': null,  // handled inline
  '/api/policies.json': null,  // served as static file
};

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCorsHeaders(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse the URL to get the path
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  
  // ── Health check (inline, no separate lambda needed) ────────────────────
  if (pathname === '/api/health' || pathname === '/api/ping') {
    return res.status(200).json({
      status: 'ok',
      version: '5.0.0',
      atc_version: '2.0',
      uts_version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      architecture: 'unified-router (1 lambda instead of 12)',
    });
  }

  // ── Agent ping (inline) ──────────────────────────────────────────────────
  if (pathname === '/api/agent-ping.json') {
    return res.status(200).json({
      service: 'MarketNow',
      version: '5.0.0',
      atc_version: '2.0',
      mcp_version: '1.10.0',
      mcp_tools_count: 13,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Universal Trust API (inline) ─────────────────────────────────────────
  if (pathname === '/api/trust') {
    return handleTrust(req, res);
  }

  // ── Route to the correct handler ────────────────────────────────────────
  // Check exact match first
  let handler = ROUTES[pathname];
  
  // If no exact match, try prefix matching (for /api/atc?action=... etc.)
  if (!handler) {
    for (const [route, h] of Object.entries(ROUTES)) {
      if (h && pathname.startsWith(route)) {
        handler = h;
        break;
      }
    }
  }

  if (handler) {
    return handler(req, res);
  }

  // ── 404 for unknown API routes ──────────────────────────────────────────
  return res.status(404).json({
    error: 'not_found',
    path: pathname,
    available_routes: Object.keys(ROUTES).filter(k => ROUTES[k] !== null),
  });
}
