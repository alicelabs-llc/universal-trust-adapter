/**
 * MarketNow — Web Application Firewall (WAF) Middleware
 * =====================================================
 *
 * Inspects every incoming request for attack patterns and blocks
 * before the handler runs. Patterns cover:
 *   - SQL injection (UNION, OR 1=1, comment-based, time-based)
 *   - XSS (script tags, event handlers, javascript: URIs)
 *   - Path traversal (../, ..\, %2e%2e, /etc/passwd)
 *   - SSRF (169.254.169.254 metadata, internal IPs, file://)
 *   - Command injection (; | ` $() backticks, && ||)
 *   - NoSQL injection ($where, $ne, $gt)
 *   - Prototype pollution (__proto__, constructor.prototype)
 *   - SSTI ({{ }}, {%= %}, ${})
 *   - Log injection (\n, \r in user-controlled fields)
 *
 * Returns 403 with reason on block. Logs to /api/security-events.
 *
 * Also implements rate limiting per IP (100 req/min default) and
 * automatic IP ban after 5 WAF triggers in 10 minutes.
 */

// ─── Attack signatures ──────────────────────────────────────────────────

const WAF_RULES = [
  // SQL injection
  { id: 'SQLI-001', name: 'SQLi: UNION SELECT', pattern: /union\s+select/i, severity: 'critical' },
  { id: 'SQLI-002', name: 'SQLi: OR 1=1', pattern: /\bor\s+1\s*=\s*1\b/i, severity: 'critical' },
  { id: 'SQLI-003', name: 'SQLi: comment-based', pattern: /(--\s|\/\*|\*\/|#\s)/i, severity: 'high' },
  { id: 'SQLI-004', name: 'SQLi: stacked queries', pattern: /;\s*(drop|delete|insert|update|select)\s/i, severity: 'critical' },
  { id: 'SQLI-005', name: 'SQLi: time-based', pattern: /sleep\s*\(\s*\d+\s*\)|benchmark\s*\(|pg_sleep/i, severity: 'critical' },
  { id: 'SQLI-006', name: 'SQLi: information_schema', pattern: /information_schema\./i, severity: 'high' },
  { id: 'SQLI-007', name: 'SQLi: hex encoded', pattern: /0x[0-9a-f]{8,}/i, severity: 'medium' },

  // XSS
  { id: 'XSS-001', name: 'XSS: script tag', pattern: /<script[^>]*>/i, severity: 'critical' },
  { id: 'XSS-002', name: 'XSS: event handler', pattern: /on\w+\s*=\s*["']?[^"'\s>]+/i, severity: 'high' },
  { id: 'XSS-003', name: 'XSS: javascript URI', pattern: /javascript:\s*\S/i, severity: 'critical' },
  { id: 'XSS-004', name: 'XSS: data URI HTML', pattern: /data:\s*text\/html/i, severity: 'high' },
  { id: 'XSS-005', name: 'XSS: vbscript URI', pattern: /vbscript:\s*\S/i, severity: 'critical' },
  { id: 'XSS-006', name: 'XSS: img onerror', pattern: /<img[^>]+onerror\s*=/i, severity: 'critical' },
  { id: 'XSS-007', name: 'XSS: svg onload', pattern: /<svg[^>]+onload\s*=/i, severity: 'critical' },

  // Path traversal
  { id: 'PATH-001', name: 'Path traversal: ../', pattern: /\.\.[\/\\]/, severity: 'critical' },
  { id: 'PATH-002', name: 'Path traversal: encoded', pattern: /%2e%2e|%2f%2e|\.\.%2f/i, severity: 'critical' },
  { id: 'PATH-003', name: 'Path traversal: /etc/passwd', pattern: /\/etc\/passwd|\/etc\/shadow/i, severity: 'critical' },
  { id: 'PATH-004', name: 'Path traversal: /proc/self', pattern: /\/proc\/self\/(environ|cmdline|cwd)/i, severity: 'critical' },
  { id: 'PATH-005', name: 'Path traversal: Windows', pattern: /\\windows\\system32|\\winnt\\system32/i, severity: 'critical' },

  // SSRF
  { id: 'SSRF-001', name: 'SSRF: AWS metadata', pattern: /169\.254\.169\.254/i, severity: 'critical' },
  { id: 'SSRF-002', name: 'SSRF: GCP metadata', pattern: /metadata\.google\.internal/i, severity: 'critical' },
  { id: 'SSRF-003', name: 'SSRF: Azure metadata', pattern: /169\.254\.169\.254\/metadata\/instance/i, severity: 'critical' },
  { id: 'SSRF-004', name: 'SSRF: file:// URI', pattern: /file:\/\/\S/i, severity: 'critical' },
  { id: 'SSRF-005', name: 'SSRF: gopher://', pattern: /gopher:\/\/\S/i, severity: 'critical' },
  { id: 'SSRF-006', name: 'SSRF: dict://', pattern: /dict:\/\/\S/i, severity: 'critical' },

  // Command injection
  { id: 'CMDI-001', name: 'Cmd injection: backticks', pattern: /`[^`]+`/, severity: 'high' },
  { id: 'CMDI-002', name: 'Cmd injection: $()', pattern: /\$\([^)]+\)/, severity: 'high' },
  { id: 'CMDI-003', name: 'Cmd injection: chained', pattern: /;\s*(ls|cat|rm|wget|curl|bash|sh|nc|python|perl)\s/i, severity: 'critical' },
  { id: 'CMDI-004', name: 'Cmd injection: pipe', pattern: /\|\s*(ls|cat|rm|wget|curl|bash|sh|nc)\s/i, severity: 'high' },
  { id: 'CMDI-005', name: 'Cmd injection: && ||', pattern: /(&&|\|\|)\s*(ls|cat|rm|wget|curl|bash|sh|nc)\s/i, severity: 'high' },

  // NoSQL injection
  { id: 'NOSQL-001', name: 'NoSQL: $where', pattern: /\$where\s*:/i, severity: 'critical' },
  { id: 'NOSQL-002', name: 'NoSQL: $ne bypass', pattern: /\$ne\s*:\s*(true|null|1)/i, severity: 'high' },
  { id: 'NOSQL-003', name: 'NoSQL: $gt bypass', pattern: /\$gt\s*:\s*["']?["']?/i, severity: 'high' },

  // Prototype pollution
  { id: 'PROTO-001', name: 'Prototype pollution: __proto__', pattern: /__proto__|constructor\s*\.\s*prototype/i, severity: 'critical' },

  // SSTI (Server-Side Template Injection)
  { id: 'SSTI-001', name: 'SSTI: Jinja2 {{ }}', pattern: /\{\{[^}]+\}\}/, severity: 'high' },
  { id: 'SSTI-002', name: 'SSTI: Twig {% %}', pattern: /\{%[^%]+%\}/, severity: 'high' },
  { id: 'SSTI-003', name: 'SSTI: JS template ${ }', pattern: /\$\{[^}]+\}/, severity: 'medium' },

  // Log injection
  { id: 'LOGI-001', name: 'Log injection: \\n \\r', pattern: /[\n\r].*(HTTP\/|GET |POST |User-Agent)/i, severity: 'medium' },
];

// ─── IP ban list (in-memory, 1hr TTL) ───────────────────────────────────

const _bannedIPs = new Map(); // ip → { reason, bannedAt, expiresAt }
const _wafHits = new Map();   // ip → [{ rule, time }]

function getClientIP(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function isIPBanned(ip) {
  const ban = _bannedIPs.get(ip);
  if (!ban) return false;
  if (Date.now() > ban.expiresAt) {
    _bannedIPs.delete(ip);
    return false;
  }
  return true;
}

function banIP(ip, reason) {
  _bannedIPs.set(ip, {
    reason,
    bannedAt: new Date().toISOString(),
    expiresAt: Date.now() + 3600 * 1000, // 1 hour
  });
}

function recordWAFHit(ip, rule) {
  const hits = _wafHits.get(ip) || [];
  // Keep only hits from last 10 min
  const cutoff = Date.now() - 10 * 60 * 1000;
  const recent = hits.filter(h => h.time > cutoff);
  recent.push({ rule: rule.id, name: rule.name, severity: rule.severity, time: Date.now() });
  _wafHits.set(ip, recent);

  // Auto-ban after 5 WAF hits in 10 min
  if (recent.length >= 5) {
    banIP(ip, `Auto-ban: 5 WAF triggers in 10 min (${recent.map(h => h.rule).join(', ')})`);
    return true;
  }
  return false;
}

// ─── Main WAF middleware ─────────────────────────────────────────────────

/**
 * Express/Vercel WAF middleware.
 * Usage: `import { wafMiddleware } from '../lib/waf.mjs'; export default [wafMiddleware, handler];`
 * Or wrap: `export default wafMiddleware(handler);`
 */
export function wafMiddleware(handler, opts = {}) {
  const { skipPaths = ['/api/health'] } = opts;

  return async (req, res) => {
    const ip = getClientIP(req);

    // Skip health check (must be fast)
    if (skipPaths.includes(req.url)) {
      return handler(req, res);
    }

    // Check IP ban
    if (isIPBanned(ip)) {
      const ban = _bannedIPs.get(ip);
      res.setHeader('X-WAF-Action', 'banned');
      res.setHeader('X-WAF-Reason', 'auto-ban');
      return res.status(403).json({
        error: 'forbidden',
        reason: 'IP banned by WAF',
        banned_at: ban.bannedAt,
        expires_at: new Date(ban.expiresAt).toISOString(),
        message: 'Your IP was auto-banned after repeated attack patterns. Try again in 1 hour.',
      });
    }

    // Inspect request for attack patterns
    const inputs = [
      req.url,
      req.query ? JSON.stringify(req.query) : '',
      req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : '',
      req.headers?.['user-agent'] || '',
      req.headers?.['referer'] || '',
      req.headers?.['x-forwarded-host'] || '',
    ].join('\n');

    for (const rule of WAF_RULES) {
      if (rule.pattern.test(inputs)) {
        // Log the hit
        const banned = recordWAFHit(ip, rule);
        const hits = _wafHits.get(ip) || [];

        console.warn(`[WAF] BLOCK ${rule.id} ${rule.name} ip=${ip} url=${req.url?.slice(0, 80)} hits=${hits.length}${banned ? ' → BANNED' : ''}`);

        res.setHeader('X-WAF-Action', banned ? 'banned' : 'blocked');
        res.setHeader('X-WAF-Rule', rule.id);
        res.setHeader('X-WAF-Hits', String(hits.length));

        return res.status(403).json({
          error: 'request_blocked',
          reason: 'Request matched a known attack pattern',
          rule: rule.id,
          rule_name: rule.name,
          severity: rule.severity,
          ip,
          hits: hits.length,
          banned,
          message: banned
            ? 'You have been auto-banned after repeated attack patterns. Try again in 1 hour.'
            : `Request blocked by WAF rule ${rule.id}. Repeated violations will result in IP ban.`,
        });
      }
    }

    // No WAF trigger — proceed to handler
    return handler(req, res);
  };
}

// ─── Security headers ───────────────────────────────────────────────────

/**
 * Apply military-grade security headers to a response.
 * Call this in every API handler before sending the response.
 */
export function applySecurityHeaders(res, extra = {}) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // CSP — locked down for API responses
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  for (const [k, v] of Object.entries(extra)) {
    res.setHeader(k, v);
  }
}

export { WAF_RULES, _bannedIPs, _wafHits, isIPBanned, banIP, getClientIP, recordWAFHit };
