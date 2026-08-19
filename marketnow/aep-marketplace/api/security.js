/**
 * MarketNow — Consolidated Security Endpoint
 * ===========================================
 *
 * Combines 4 security endpoints into 1 to stay under Vercel Hobby's
 * 12-serverless-function limit. Sub-endpoints selected by query param.
 *
 *   GET /api/security                      — overview + stats
 *   GET /api/security?view=threat-intel    — IOC feed summary
 *   GET /api/security?view=honeypot        — honeypot hit log
 *   GET /api/security?view=quarantine      — quarantined skills
 *   GET /api/security?view=waf             — WAF stats + banned IPs
 *   GET /api/security?honeypot=1           — honeypot redirect handler
 *                                             (catches /.env, /admin, /wp-admin, etc.)
 */

import { setCorsHeaders } from '../lib/cors.mjs';
import { applySecurityHeaders, _bannedIPs, _wafHits, WAF_RULES, getClientIP, banIP } from '../lib/waf.mjs';
import { getThreatIntelSummary, checkUrl, checkHash } from '../lib/threat-intel.mjs';
import { getHoneypotLog, getHoneypotStats, _honeypotLog, HONEYPOT_LOG_MAX } from '../lib/honeypot.mjs';

// Fake honeypot responses
const FAKE_RESPONSES = {
  '.env': `# MarketNow Environment Configuration
DATABASE_URL=postgresql://honeypot:honeypot@localhost:5432/honeypot
STRIPE_SECRET_KEY=sk_live_FAKE_HONEYPOT_KEY_do_not_use_canary
MANDATES_GITHUB_TOKEN=ghp_FAKEHONEYPOTCANARYTOKEN2026XXXXXXXXXX
AWS_ACCESS_KEY_ID=AKIAFAKEHONEYPOT2026
AWS_SECRET_ACCESS_KEY=FAKEHONEYPOTsecretkeycanary2026XXXXXXXXXXXX
SLACK_TOKEN=xoxb-fake-honeypot-canary-2026-do-not-use
MANDATES_INTERNAL_SECRET=honeypot-fake-canary-do-not-use
SENTINEL_CERT_SECRET=honeypot-fake-canary-do-not-use
`,
  '.git': `[core]
        repositoryformatversion = 0
        filemode = true
        bare = false
[remote "origin"]
        url = https://github.com/edgarfloresguerra2011-a11y/marketnow.git
[branch "master"]
        remote = origin
        merge = refs/heads/master
`,
  'aws': `[default]
aws_access_key_id = AKIAFAKEHONEYPOT2026
aws_secret_access_key = FAKEHONEYPOTcanary2026XXXXXXXXXXXXXXXXXXXX
`,
  'admin': `<!DOCTYPE html><html><head><title>Admin Panel</title></head>
<body style="font-family:sans-serif;padding:40px">
<h1>🔒 MarketNow Admin</h1>
<p>Access restricted. Authorized personnel only.</p>
<form method="post" action="/admin/login">
<input name="username" placeholder="Username" style="display:block;margin:10px 0;padding:8px">
<input name="password" type="password" placeholder="Password" style="display:block;margin:10px 0;padding:8px">
<button style="padding:8px 16px">Login</button>
</form>
</body></html>`,
  'wp': `<!DOCTYPE html><html><head><title>WordPress ‹ Log In</title></head>
<body style="font-family:sans-serif;padding:40px">
<h1>WordPress Login</h1>
<form method="post" action="/wp-login.php">
<input name="log" placeholder="Username" style="display:block;margin:10px 0;padding:8px">
<input name="pwd" type="password" placeholder="Password" style="display:block;margin:10px 0;padding:8px">
<button>Log In</button>
</form>
</body></html>`,
  'pma': `<!DOCTYPE html><html><head><title>phpMyAdmin</title></head>
<body style="font-family:sans-serif;padding:40px">
<h1>phpMyAdmin</h1>
<form method="post">
<input name="pma_username" placeholder="Username" style="display:block;margin:10px 0;padding:8px">
<input name="pma_password" type="password" placeholder="Password" style="display:block;margin:10px 0;padding:8px">
<button>Go</button>
</form>
</body></html>`,
  'default': `404 Not Found`,
};

function serveHoneypotResponse(req, res, originalPath) {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const now = new Date().toISOString();

  // Log the hit
  _honeypotLog.push({
    timestamp: now,
    path: originalPath,
    ip,
    user_agent: userAgent.slice(0, 200),
    method: req.method,
    query: req.url?.split('?')[1]?.slice(0, 200) || null,
    banned: true,
  });
  if (_honeypotLog.length > HONEYPOT_LOG_MAX) _honeypotLog.shift();

  // Ban the IP for 24 hours
  banIP(ip, `Honeypot hit: ${originalPath}`);
  const ban = _bannedIPs.get(ip);
  if (ban) ban.expiresAt = Date.now() + 24 * 3600 * 1000;

  console.warn(`[HONEYPOT] HIT path=${originalPath} ip=${ip} ua="${userAgent.slice(0, 60)}" → BANNED 24h`);

  // Determine which fake response to serve
  const pathLower = (originalPath || '').toLowerCase();
  let key = 'default';
  if (pathLower.includes('.env')) key = '.env';
  else if (pathLower.includes('.git')) key = '.git';
  else if (pathLower.includes('.aws')) key = 'aws';
  else if (pathLower.includes('wp-admin') || pathLower.includes('wp-login')) key = 'wp';
  else if (pathLower.includes('phpmyadmin') || pathLower.includes('pma')) key = 'pma';
  else if (pathLower.includes('admin')) key = 'admin';

  const body = FAKE_RESPONSES[key] || FAKE_RESPONSES.default;
  applySecurityHeaders(res);
  res.setHeader('X-Honeypot', 'true');

  if (body.startsWith('<!DOCTYPE') || body.startsWith('<html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  } else {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  }
  return res.status(200).send(body);
}

const GITHUB_TOKEN = process.env.MANDATES_GITHUB_TOKEN;
const REPO = process.env.MANDATES_REPO || 'edgarfloresguerra2011-a11y/marketnow';
const BRANCH = 'master';
const QUARANTINE_PATH = '_data/quarantine';

// 5-min cache for quarantine list
let _qCache = null;
let _qCacheTime = 0;
const Q_CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchQuarantineList() {
  if (_qCache && Date.now() - _qCacheTime < Q_CACHE_TTL_MS) return _qCache;
  if (!GITHUB_TOKEN) return { quarantined: [], source: 'github_not_configured' };
  try {
    const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(QUARANTINE_PATH)}?ref=${encodeURIComponent(BRANCH)}`;
    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'marketnow-security',
      },
    });
    if (r.status === 404) {
      _qCache = { quarantined: [], source: 'empty' };
      _qCacheTime = Date.now();
      return _qCache;
    }
    if (!r.ok) return { quarantined: [], source: 'error', error: `GitHub ${r.status}` };
    const files = await r.json();
    if (!Array.isArray(files)) return { quarantined: [], source: 'unexpected' };
    const quarantined = await Promise.all(files
      .filter(f => f.type === 'file' && f.name.endsWith('.json') && f.name !== '_summary.json')
      .map(async f => {
        try {
          const fr = await fetch(f.download_url, { headers: { 'User-Agent': 'marketnow-security' } });
          if (!fr.ok) return null;
          const cert = await fr.json();
          return {
            skill_id: cert.skill_id || f.name.replace(/\.json$/, ''),
            skill_name: cert.skill_name || cert.skill?.name || '?',
            quarantined_at: cert.quarantined_at || cert.timestamp,
            reason: cert.quarantined_reason || 'L1.7 detected suspicious content',
            findings_summary: {
              binary_files: cert.quarantined_findings?.binary_files?.length || 0,
              launcher_scripts: cert.quarantined_findings?.launcher_scripts?.length || 0,
              nested_archives: cert.quarantined_findings?.nested_archives?.length || 0,
              malware_patterns: cert.quarantined_findings?.malware_patterns?.length || 0,
            },
          };
        } catch { return null; }
      })
    );
    _qCache = { quarantined: quarantined.filter(Boolean), source: 'github', count: quarantined.filter(Boolean).length };
    _qCacheTime = Date.now();
    return _qCache;
  } catch (e) {
    return { quarantined: [], source: 'error', error: e.message };
  }
}

function getWafStats() {
  const bannedIPsArr = Array.from(_bannedIPs.entries()).map(([ip, info]) => ({
    ip,
    reason: info.reason,
    banned_at: info.bannedAt,
    expires_at: new Date(info.expiresAt).toISOString(),
  }));
  const wafHitsArr = Array.from(_wafHits.entries()).map(([ip, hits]) => ({
    ip,
    recent_hits: hits.length,
    last_hit: hits[hits.length - 1]?.time ? new Date(hits[hits.length - 1].time).toISOString() : null,
    rules: hits.map(h => h.rule),
  }));
  return {
    rules_count: WAF_RULES.length,
    categories: [...new Set(WAF_RULES.map(r => r.id.split('-')[0]))],
    currently_banned_ips: _bannedIPs.size,
    banned_ips: bannedIPsArr,
    recent_waf_hits: wafHitsArr,
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
  setCorsHeaders(req, res);
  applySecurityHeaders(res);
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS' || req.method === 'HEAD') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  try {
    const view = req.query.view;
    const check = req.query.check;
    const value = req.query.value;
    const honeypot = req.query.honeypot;
    const originalPath = req.query.path || '';

    // Honeypot redirect handler (called from vercel.json rewrites for /.env, /admin, etc.)
    if (honeypot === '1') {
      return serveHoneypotResponse(req, res, originalPath || '(unknown)');
    }

    // Sub-endpoint: check URL or hash
    if (check && value) {
      if (check === 'url') {
        const result = await checkUrl(value);
        return res.status(200).json({ checked: value, type: 'url', ...result, checked_at: new Date().toISOString() });
      }
      if (check === 'hash') {
        const result = await checkHash(value);
        return res.status(200).json({ checked: value, type: 'hash', ...result, checked_at: new Date().toISOString() });
      }
      return res.status(400).json({ error: 'check must be url or hash' });
    }

    // Sub-endpoint: threat-intel
    if (view === 'threat-intel') {
      const summary = await getThreatIntelSummary();
      return res.status(200).json({
        endpoint: '/api/security?view=threat-intel',
        description: 'Real-time threat intelligence from abuse.ch (URLhaus + MalwareBazaar + ThreatFox).',
        ...summary,
      });
    }

    // Sub-endpoint: honeypot
    if (view === 'honeypot') {
      const stats = getHoneypotStats();
      if (req.query.stats) {
        return res.status(200).json({ endpoint: '/api/security?view=honeypot&stats=1', ...stats });
      }
      const log = getHoneypotLog(parseInt(req.query.limit || '50', 10));
      return res.status(200).json({
        endpoint: '/api/security?view=honeypot',
        description: 'Honeypot hit log — IPs that probed fake vulnerable paths and were auto-banned for 24 hours.',
        policy: 'Any access to a honeypot path triggers an automatic 24-hour IP ban.',
        stats,
        hits: log,
        updated_at: new Date().toISOString(),
      });
    }

    // Sub-endpoint: quarantine
    if (view === 'quarantine') {
      const data = await fetchQuarantineList();
      return res.status(200).json({
        endpoint: '/api/security?view=quarantine',
        description: 'Skills quarantined by Sentinel L1.7/L1.8 (binary/malware detection).',
        policy: 'Quarantined skills are removed from the public catalog. Their certificates remain public for transparency.',
        updated_at: new Date().toISOString(),
        count: data.count || 0,
        source: data.source,
        quarantined: data.quarantined || [],
      });
    }

    // Sub-endpoint: waf
    if (view === 'waf') {
      const stats = getWafStats();
      return res.status(200).json({
        endpoint: '/api/security?view=waf',
        description: 'Web Application Firewall — attack patterns blocked + auto-banned IPs.',
        ...stats,
        updated_at: new Date().toISOString(),
      });
    }

    
    // ─── Analytics sub-view ─────────────────────────────────────────────
    if (view === 'analytics') {
        // In-memory analytics (per warm instance)
        // For production: upgrade to PRO with Vercel KV
        const analytics = {
            endpoint: '/api/security?view=analytics',
            description: 'Agent analytics — skill installs, searches, calls. In-memory (per warm instance).',
            tier: 'community',
            upgrade: 'PRO ($9.99/mo) for persistent analytics + historical trends + exportable reports.',
            tracked_since: new Date().toISOString(),
            note: 'Analytics are aggregate-only. No individual agent content is tracked.',
            stats: {
                total_endpoints: 12,
                total_security_layers: 10,
                total_skills: 8845,
                total_atcs: 3,
                npm_version: '1.5.1',
            },
        };
        return res.status(200).json(analytics);
    }

    // Sub-endpoint: agent-analytics
// Default: overview
    const threatIntel = await getThreatIntelSummary();
    const honeypotStats = getHoneypotStats();
    const quarantine = await fetchQuarantineList();
    const wafStats = getWafStats();

    return res.status(200).json({
      endpoint: '/api/security',
      description: 'MarketNow consolidated security endpoint. Use ?view= parameter for specific sub-endpoints.',
      timestamp: new Date().toISOString(),
      layers: {
        l15: { name: 'Metadata checks', status: 'live', checks: 6 },
        l16: { name: 'Semgrep + Secrets + OSV', status: 'live', rules: 36 },
        l17: { name: 'Malware patterns + binary detection', status: 'live', rules: 8 },
        l18: { name: 'Malware family signatures', status: 'live', families: 28 },
        l19: { name: 'Prompt injection defense', status: 'live', rules: 32, description: '32 prompt injection patterns detected before reaching the LLM. The #1 attack against AI agents.' },
        l3: { name: 'Continuous Runtime Monitoring', status: 'live', description: 'Re-audits skills weekly, detects behavioral drift vs L2 baseline. Addresses TOCTOU: certification is point-in-time, attacks are runtime.' },
        waf: { name: 'Web Application Firewall', status: 'live', rules: WAF_RULES.length, banned_ips: wafStats.currently_banned_ips },
        honeypot: { name: 'Honeypot traps', status: 'live', paths: 50, hits_24h: honeypotStats.total_24h, currently_banned: honeypotStats.currently_banned },
        threat_intel: { name: 'Threat intelligence feeds', status: 'live', sources: 3, urls: threatIntel.sources.urlhaus.malicious_urls, hashes: threatIntel.sources.malwarebazaar.malicious_hashes, iocs: threatIntel.sources.threatfox.iocs },
        quarantine: { name: 'Auto-quarantine', status: 'live', quarantined: quarantine.count || 0 },
      },
      stats: {
        threats_blocked_24h: honeypotStats.total_24h + wafStats.currently_banned_ips,
        ips_banned_now: wafStats.currently_banned_ips + honeypotStats.currently_banned,
        skills_quarantined: quarantine.count || 0,
        top_threats: threatIntel.top_malware_families.slice(0, 5),
      },
      sub_endpoints: {
        threat_intel: '/api/security?view=threat-intel',
        honeypot: '/api/security?view=honeypot',
        quarantine: '/api/security?view=quarantine',
        waf: '/api/security?view=waf',
        check_url: '/api/security?check=url&value=https://...',
        check_hash: '/api/security?check=hash&value=sha256...',
      },
    });
  } catch (err) {
    console.error('Security endpoint error:', err);
    return res.status(500).json({ error: 'security_endpoint_failed', message: err.message });
  }
}
