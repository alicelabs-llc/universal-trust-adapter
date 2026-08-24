/**
 * MarketNow — Honeypot Endpoint
 * ==============================
 *
 * Fake vulnerable endpoints designed to attract attackers:
 *   - /admin (fake admin panel)
 *   - /.env (fake environment file with canary tokens)
 *   - /wp-admin (fake WordPress login)
 *   - /.git/config (fake git leak)
 *   - /phpmyadmin (fake phpMyAdmin)
 *   - /api/internal/debug (fake debug endpoint)
 *
 * Any access to these endpoints is logged with:
 *   - IP, User-Agent, full request headers
 *   - Timestamp, requested path, query string
 *   - Whether the IP is in threat intel feeds
 *
 * After 1 honeypot hit, the IP is auto-banned for 24 hours.
 * Logs are publicly viewable at /api/honeypot (transparency).
 *
 * Honeypots also serve as early warning: a spike in honeypot hits
 * means someone is scanning the site for vulnerabilities.
 */

import { applySecurityHeaders, getClientIP, banIP, _bannedIPs } from '../lib/waf.mjs';
import { checkIOC } from '../lib/threat-intel.mjs';

// In-memory honeypot hit log (last 500 entries)
const HONEYPOT_LOG_MAX = 500;
const _honeypotLog = [];

// Honeypot paths — these should NEVER be accessed by legitimate users
const HONEYPOT_PATHS = new Set([
  '/admin',
  '/admin/',
  '/admin/login',
  '/admin.php',
  '/administrator',
  '/.env',
  '/.env.local',
  '/.env.production',
  '/wp-admin',
  '/wp-admin/',
  '/wp-login.php',
  '/wp-config.php',
  '/.git/config',
  '/.git/HEAD',
  '/.git/index',
  '/phpmyadmin',
  '/phpmyadmin/',
  '/phpMyAdmin',
  '/pma',
  '/mysql',
  '/api/internal/debug',
  '/api/debug',
  '/api/v1/debug',
  '/api/internal/secrets',
  '/api/internal/keys',
  '/server-status',
  '/server-info',
  '/cgi-bin/',
  '/cgi-bin/php',
  '/config.php',
  '/config.json',
  '/backup',
  '/backup.sql',
  '/database.sql',
  '/.ssh/id_rsa',
  '/.ssh/id_ed25519',
  '/id_rsa',
  '/.aws/credentials',
  '/.aws/config',
  '/.google-cloud/credentials.json',
  '/stripe-secret.key',
  '/.npmrc',
  '/.dockerenv',
  '/docker-compose.yml',
  '/Dockerfile',
  '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
  '/.well-known/security.txt.bak',
  '/sitemap.xml.bak',
  '/.DS_Store',
  '/Thumbs.db',
  '/web.config',
  '/robots.txt.bak',
]);

// Fake responses for each honeypot path
const FAKE_RESPONSES = {
  '/.env': `# MarketNow Environment Configuration
# WARNING: This file is a honeypot. Any access is logged and the IP is banned.

DATABASE_URL=postgresql://honeypot:honeypot@localhost:5432/honeypot
STRIPE_SECRET_KEY=sk_live_FAKE_HONEYPOT_KEY_do_not_use_this_is_a_canary_token
MANDATES_GITHUB_TOKEN=ghp_REDACTEDXXXXX
AWS_ACCESS_KEY_ID=AKIAFAKEHONEYPOT2026
AWS_SECRET_ACCESS_KEY=FAKEHONEYPOTsecretkeydonotuse2026XXXXXXXXXXXXXXXXXXXX
SLACK_TOKEN=xoxb-fake-honeypot-token-2026-do-not-use
MANDATES_INTERNAL_SECRET=honeypot-fake-internal-secret-do-not-use
SENTINEL_CERT_SECRET=honeypot-fake-cert-secret-do-not-use
`,
  '/.git/config': `[core]
        repositoryformatversion = 0
        filemode = true
        bare = false
        logallrefupdates = true
[remote "origin"]
        url = https://github.com/alicelabs-llc/marketnow.git
        fetch = +refs/heads/*:refs/remotes/origin/*
[branch "master"]
        remote = origin
        merge = refs/heads/master
# HONEYPOT: This is a fake .git/config. Access is logged and IP is banned.
`,
  '/.aws/credentials': `[default]
aws_access_key_id = AKIAFAKEHONEYPOT2026
aws_secret_access_key = FAKEHONEYPOTsecretkeydonotuse2026XXXXXXXXXXXXXXXXXXXX
# HONEYPOT: This is fake. Access logged.
`,
};

/**
 * Check if a request path is a honeypot. If so, log + ban + return true.
 */
export async function checkHoneypot(req, res) {
  const path = req.url?.split('?')[0];
  if (!HONEYPOT_PATHS.has(path)) return false;

  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const referer = req.headers['referer'] || '';
  const now = new Date().toISOString();

  // Check threat intel for the IP
  let threatIntel = null;
  try {
    threatIntel = await checkIOC(ip);
  } catch {}

  // Log the hit
  const entry = {
    timestamp: now,
    path,
    ip,
    user_agent: userAgent.slice(0, 200),
    referer: referer.slice(0, 200),
    method: req.method,
    query: req.url?.split('?')[1]?.slice(0, 200) || null,
    headers: {
      'accept-language': req.headers['accept-language']?.slice(0, 50) || null,
      'accept-encoding': req.headers['accept-encoding']?.slice(0, 50) || null,
      'x-forwarded-for': req.headers['x-forwarded-for']?.slice(0, 100) || null,
    },
    threat_intel: threatIntel?.found ? threatIntel : null,
    banned: true,
  };

  _honeypotLog.push(entry);
  if (_honeypotLog.length > HONEYPOT_LOG_MAX) {
    _honeypotLog.shift();
  }

  // Ban the IP for 24 hours
  banIP(ip, `Honeypot hit: ${path}`);
  _bannedIPs.get(ip).expiresAt = Date.now() + 24 * 3600 * 1000; // 24h for honeypot

  // Console warning
  console.warn(`[HONEYPOT] HIT path=${path} ip=${ip} ua="${userAgent.slice(0, 60)}" → BANNED 24h`);

  // Return fake response (looks real to attacker)
  applySecurityHeaders(res);
  res.setHeader('X-Honeypot', 'true');

  // Different responses for different paths
  if (FAKE_RESPONSES[path]) {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(FAKE_RESPONSES[path]);
  }

  if (path.includes('wp-admin') || path.includes('wp-login')) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html><html><head><title>WordPress Login</title></head>
<body><h1>WordPress Login</h1>
<form method="post" action="/wp-login.php">
<input name="log" placeholder="Username"><br>
<input name="pwd" type="password" placeholder="Password"><br>
<button>Login</button>
</form>
<!-- HONEYPOT: This is fake. Access logged and IP banned. -->
</body></html>`);
  }

  if (path.includes('admin')) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html><html><head><title>Admin Panel</title></head>
<body><h1>MarketNow Admin</h1>
<p>Access restricted.</p>
<!-- HONEYPOT: This is fake. Access logged and IP banned. -->
</body></html>`);
  }

  if (path.includes('phpmyadmin') || path.includes('pma')) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html><html><head><title>phpMyAdmin</title></head>
<body><h1>phpMyAdmin</h1>
<form method="post"><input name="username"><input name="password" type="password"><button>Go</button></form>
<!-- HONEYPOT: This is fake. -->
</body></html>`);
  }

  // Generic 404 for other paths (but still log + ban)
  return res.status(404).json({ error: 'Not found' });
}

/**
 * Get honeypot log (for /api/honeypot transparency endpoint).
 */
export function getHoneypotLog(limit = 50) {
  return _honeypotLog.slice(-limit).reverse();
}

export function getHoneypotStats() {
  const by24h = _honeypotLog.filter(e => Date.now() - new Date(e.timestamp).getTime() < 24 * 3600 * 1000);
  const byPath = {};
  for (const e of by24h) {
    byPath[e.path] = (byPath[e.path] || 0) + 1;
  }
  const byIP = {};
  for (const e of by24h) {
    byIP[e.ip] = (byIP[e.ip] || 0) + 1;
  }
  return {
    total_24h: by24h.length,
    total_logged: _honeypotLog.length,
    top_paths: Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, count]) => ({ path, count })),
    top_ips: Object.entries(byIP).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ip, count]) => ({ ip, count })),
    currently_banned: _bannedIPs.size,
  };
}

export { HONEYPOT_PATHS, _honeypotLog, HONEYPOT_LOG_MAX };
