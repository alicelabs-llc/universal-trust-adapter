/**
 * MarketNow — Security middleware integration
 * ============================================
 *
 * Vercel doesn't support true middleware (unlike Next.js), so this module
 * exports a helper that wraps any handler with:
 *   1. Honeypot check (ban attackers hitting fake paths)
 *   2. WAF (block SQLi/XSS/SSRF/path traversal/command injection)
 *   3. Security headers (CSP, HSTS, X-Frame-Options, etc.)
 *
 * Usage in any /api/*.js:
 *   import { secure } from '../lib/secure.mjs';
 *   export default secure(async (req, res) => { ... });
 *
 * For existing handlers that already set CORS, use:
 *   import { secureLight } from '../lib/secure.mjs';
 *   export default secureLight(handler);
 *
 * secureLight only applies honeypot + WAF (no security headers, since
 * the handler sets its own).
 */

import { wafMiddleware, applySecurityHeaders } from '../lib/waf.mjs';
import { checkHoneypot } from '../lib/honeypot.mjs';

/**
 * Full security wrapper: honeypot → WAF → security headers → handler.
 * Use for NEW endpoints.
 */
export function secure(handler) {
  return async (req, res) => {
    // 1. Honeypot check (ban + return fake response if hit)
    const honeypotHit = await checkHoneypot(req, res);
    if (honeypotHit) return;

    // 2. Apply security headers
    applySecurityHeaders(res);

    // 3. WAF (rate limit + attack pattern detection + auto-ban)
    return wafMiddleware(handler)(req, res);
  };
}

/**
 * Light wrapper: honeypot + WAF only. Use for EXISTING endpoints that
 * already manage their own headers + CORS.
 */
export function secureLight(handler) {
  return async (req, res) => {
    // 1. Honeypot check
    const honeypotHit = await checkHoneypot(req, res);
    if (honeypotHit) return;

    // 2. WAF
    return wafMiddleware(handler)(req, res);
  };
}

export { applySecurityHeaders, wafMiddleware, checkHoneypot };
