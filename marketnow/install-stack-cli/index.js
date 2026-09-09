#!/usr/bin/env node
/**
 * MarketNow Install Stack CLI v1.2.0
 * ===================================
 *
 * One-command curated skill-stack installs for Claude Desktop, Cursor and Cline.
 *
 * Usage:
 *   npx -y marketnow-install-stack <stack-name> [agent]
 *   npx -y marketnow-install-stack security-analyst
 *   npx -y marketnow-install-stack financial-auditor cursor
 *   npx -y marketnow-install-stack --list
 *
 * Stacks resolve to live catalog categories on https://www.marketnow.site
 * (GET /api/skills?category=...&filter=free) with an embedded fallback list
 * so the CLI also works offline. Output: merged MCP config written to the
 * agent config file (if the directory exists) or a ready-to-paste snippet.
 *
 * v1.2.0 (September 2026) — Reliability release:
 *   - Fixed: the CLI now follows HTTP redirects and targets
 *     https://www.marketnow.site directly (the apex domain 308-redirects;
 *     the old build failed with "Unexpected token 'R', Redirecting...").
 *   - Fixed: /api/stacks no longer exists server-side; stacks now resolve
 *     against the LIVE catalog (/api/skills?category=...) with an embedded
 *     offline fallback (the old build was permanently broken).
 *   - Fixed: --help / -h now print usage instead of being treated as a
 *     stack name.
 *   - Each skill's real install command (npx / uvx / pip) from the catalog
 *     is used to build the mcpServers entry.
 *   - Same merge-with-existing-config behavior for claude / cursor / cline.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_BASE = 'https://www.marketnow.site';
const CONFIG_PATHS = {
  claude: path.join(os.homedir(), '.claude', 'claude_desktop_config.json'),
  cursor: path.join(os.homedir(), '.cursor', 'mcp.json'),
  cline: path.join(os.homedir(), '.cline', 'config.json'),
};

// ─── Stack registry: stack name -> live catalog category ───────────────────
// The "stack" concept maps to a curated slice of the live MarketNow catalog.
const STACKS = {
  'financial-auditor':  { category: 'Finance',        display: 'Financial Auditor',  limit: 6 },
  'security-analyst':   { category: 'Security',       display: 'Security Analyst',   limit: 6 },
  'data-pipeline':      { category: 'Data',           display: 'Data Pipeline',      limit: 6 },
  'dev-productivity':   { category: 'Developer Tools',display: 'Dev Productivity',   limit: 6 },
  'growth-hacking':     { category: 'AI/ML',          display: 'Growth Hacking',     limit: 6 },
};

// Embedded offline fallback (real catalog entries, free, with live install
// commands). Used when the catalog API is unreachable.
const FALLBACK_SKILLS = {
  'Finance': [
    { id: 'agentpay-vn',        name: 'agentpay-vn',        install: 'uvx agentpay-vn' },
    { id: 'alchemy-mcp-server', name: 'alchemy-mcp-server', install: 'npx -y alchemy-mcp-server' },
  ],
  'Security': [
    { id: 'marketnow-mcp',  name: 'marketnow-mcp',  install: 'npx -y marketnow-mcp' },
  ],
  'Data': [
    { id: 'agent-discovery-mcp', name: 'agent-discovery-mcp', install: 'npx -y agent-discovery-mcp' },
  ],
  'Developer Tools': [
    { id: 'marketnow-mcp', name: 'marketnow-mcp', install: 'npx -y marketnow-mcp' },
  ],
  'AI/ML': [
    { id: 'marketnow-mcp', name: 'marketnow-mcp', install: 'npx -y marketnow-mcp' },
  ],
};

// ─── HTTP with redirect following ───────────────────────────────────────────
function fetchJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 4) return reject(new Error('too many redirects'));
    https.get(url, { headers: { 'User-Agent': 'marketnow-install-stack/1.2.0 (+https://marketnow.site)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const next = new URL(res.headers.location, url).toString();
        return resolve(fetchJson(next, redirects + 1));
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`API HTTP ${res.statusCode}`));
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('invalid JSON from API')); }
      });
    }).on('error', reject);
  });
}

// ─── Parse an install command into { command, args } for mcpServers ────────
function parseInstall(install) {
  if (!install || typeof install !== 'string') return null;
  const variant = install.split('||')[0].trim(); // first option of alternatives
  const parts = variant.split(/\s+/).filter(Boolean);
  const cmd = parts[0];
  if (!cmd) return null;
  if (cmd === 'npx' || cmd === 'uvx' || cmd === 'bunx' || cmd === 'docker' || cmd === 'node') {
    return { command: cmd, args: parts.slice(1) };
  }
  if (cmd === 'pip' || cmd === 'pip3' || cmd === 'uv' || cmd === 'python' || cmd === 'python3') {
    // "pip install X" / "uv pip install X" -> run as uvx X (standard MCP python runner)
    const pkg = parts.filter((p) => p !== 'install' && p !== 'pip')[0];
    if (pkg) return { command: 'uvx', args: [pkg] };
  }
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function usage() {
  console.log('MarketNow Install Stack v1.2.0 — curated skill stacks for your agent');
  console.log('');
  console.log('Usage:');
  console.log('  npx -y marketnow-install-stack <stack-name> [agent]');
  console.log('  npx -y marketnow-install-stack --list');
  console.log('');
  console.log('Stacks:');
  for (const [name, s] of Object.entries(STACKS)) {
    console.log(`  ${name.padEnd(18)} ${s.display}  (top ${s.limit} free ${s.category} skills)`);
  }
  console.log('');
  console.log('Agents: claude (default), cursor, cline');
  console.log('Catalog: https://www.marketnow.site');
}

async function listStacks() {
  console.log('MarketNow catalog — live category counts:');
  try {
    for (const [name, s] of Object.entries(STACKS)) {
      const d = await fetchJson(`${API_BASE}/api/skills?category=${encodeURIComponent(s.category)}&limit=1`);
      console.log(`  ${name.padEnd(18)} ${String(d.total).padStart(6)} skills in ${s.category}`);
    }
  } catch {
    console.log('  (catalog unreachable — offline mode still works with embedded fallback)');
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const arg1 = process.argv[2];

  if (!arg1 || arg1 === '--help' || arg1 === '-h' || arg1 === 'help') {
    usage();
    process.exit(0);
  }
  if (arg1 === '--list' || arg1 === 'list') {
    await listStacks();
    process.exit(0);
  }

  const stackName = arg1;
  const targetAgent = process.argv[3] || 'claude';
  const stack = STACKS[stackName];
  if (!stack) {
    console.error(`✗ Unknown stack "${stackName}". Run with --list to see available stacks.`);
    process.exit(1);
  }
  const configPath = CONFIG_PATHS[targetAgent];
  if (!configPath) {
    console.error(`✗ Unknown agent "${targetAgent}". Supported: claude, cursor, cline.`);
    process.exit(1);
  }

  // Resolve skills: live catalog first, embedded fallback second
  let skills = [];
  let source = 'live-catalog';
  try {
    const d = await fetchJson(
      `${API_BASE}/api/skills?category=${encodeURIComponent(stack.category)}&filter=free&limit=${stack.limit}`
    );
    skills = (d.skills || []).map((s) => ({ id: s.slug || s.id, name: s.name, install: s.install }));
  } catch {
    source = 'embedded-fallback (catalog unreachable)';
    skills = FALLBACK_SKILLS[stack.category] || [];
  }
  if (!skills.length) {
    source = 'embedded-fallback (empty category)';
    skills = FALLBACK_SKILLS[stack.category] || [];
  }

  console.log(`✓ Stack: ${stack.display} [${source}]`);
  console.log(`  Skills: ${skills.length}`);
  console.log('');

  // Build mcpServers config from real install commands
  const servers = {};
  let skipped = 0;
  for (const s of skills) {
    const parsed = parseInstall(s.install);
    const key = (s.name || s.id).replace(/[^a-zA-Z0-9_-]/g, '-');
    if (parsed) {
      servers[key] = { command: parsed.command, args: parsed.args };
    } else {
      // No runnable install command -> route through the MarketNow MCP server
      servers[key] = { command: 'npx', args: ['-y', 'marketnow-mcp'] };
      skipped++;
    }
  }
  const config = { mcpServers: servers };

  // Write (merge) or print
  if (fs.existsSync(path.dirname(configPath))) {
    let existing = { mcpServers: {} };
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!existing.mcpServers) existing.mcpServers = {};
    } catch { /* corrupt file -> start fresh */ }
    Object.assign(existing.mcpServers, config.mcpServers);
    const backup = configPath + '.marketnow-backup';
    try { fs.copyFileSync(configPath, backup); } catch { /* no file yet */ }
    fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
    console.log(`✓ Config written to ${configPath} (backup at ${backup})`);
    console.log(`  Added ${Object.keys(servers).length} MCP servers for ${targetAgent}`);
  } else {
    console.log(`Paste this into your ${targetAgent} MCP config:\n`);
    console.log(JSON.stringify(config, null, 2));
  }
  if (skipped) {
    console.log(`\nℹ ${skipped} skill(s) had no runnable install command — routed via marketnow-mcp.`);
  }
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
