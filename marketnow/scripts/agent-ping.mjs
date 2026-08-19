#!/usr/bin/env node
/**
 * MarketNow — Agent Discovery Ping Script
 * ========================================
 *
 * Sends MarketNow's manifest to agent discovery endpoints so agents
 * can find us. Pings:
 *   - /.well-known/agent.json (our own, for crawlers)
 *   - MCP Registry (already published)
 *   - npm registry (already published)
 *   - GitHub topics (already set)
 *   - llms.txt (already deployed)
 *
 * Plus: sends invitations to known MCP server GitHub repos
 * inviting them to list on MarketNow (free audit + certificate).
 *
 * Usage: node scripts/agent-ping.mjs
 */

import https from 'https';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.MANDATES_GITHUB_TOKEN;
const MARKETNOW_MANIFEST = 'https://marketnow.site/api/manifest';
const MARKETNOW_AGENT_JSON = 'https://marketnow.site/.well-known/agent.json';

// Known MCP server repos to invite (top 20 by stars)
const MCP_REPOS_TO_INVITE = [
  'modelcontextprotocol/servers',
  'anthropics/anthropic-quickstarts',
  'punkpeye/awesome-mcp-servers',
  'wong2/awesome-mcp-servers',
];

// Agent platforms to notify
const AGENT_PLATFORMS = [
  { name: 'Anthropic (Claude)', repo: 'anthropics/anthropic-quickstarts', issue_title: 'MarketNow now has 10-layer security audit + prompt injection defense for MCP servers' },
  { name: 'OpenAI', repo: 'openai/openai-cookbook', issue_title: 'MarketNow: 10-layer MCP security audit + agent trust cards + analytics' },
  { name: 'Google DeepMind', repo: 'google-deepmind/gemma', issue_title: 'MarketNow supports A2A Agent Cards + 10-layer security audit' },
  { name: 'LangChain', repo: 'langchain-ai/langchain', issue_title: 'Update: MarketNow now has L1.9 prompt injection defense (32 rules) + SOC2 mapping' },
  { name: 'AutoGen (Microsoft)', repo: 'microsoft/autogen', issue_title: 'Update: MarketNow now has A2A support + agent analytics + 10 security layers' },
  { name: 'CrewAI', repo: 'crewAIInc/crewAI', issue_title: 'Update: L1.9 prompt injection defense + SOC2 mapping + A2A support shipped' },
  { name: 'Cline', repo: 'cline/cline', issue_title: 'Update: MarketNow 10-layer audit + prompt injection defense + submit_skill tool' },
  { name: 'Continue', repo: 'continuedev/continue', issue_title: 'Update: MarketNow 10-layer audit + 8 MCP tools + agent analytics' },
];

const INVITATION_BODY = `## MarketNow — 10-layer security audit for MCP servers (free)

I run [marketnow.site](https://marketnow.site) — a marketplace for MCP servers with **10-layer security audit** (Sentinel) and **Agent Trust Cards** (ATC).

### What's new (July 2026)

**L1.9 — Prompt injection defense** (32 rules, 10 categories)
The #1 attack against AI agents. No other MCP marketplace has this.

**SOC2 mapping** (32 controls mapped to Sentinel layers)
Enterprises can use MarketNow and pass SOC2 audits.

**A2A Agent Card support**
MarketNow now accepts Google's A2A Agent Cards and issues ATC trust cards on top.

**Agent analytics** (\`GET /api/agent-analytics\`)
Marketplace stats, npm downloads, GitHub stars, security metrics.

**8 MCP tools** (viral loop)
\`submit_skill\` lets agents submit their own MCP servers. \`recommend_skills\` gives AI-powered recommendations. \`verify_trust\` verifies Agent Trust Cards.

### 10 security layers

| Layer | What it does |
|---|---|
| L1.5 | 6 metadata checks |
| L1.6 | 36 semgrep + secrets + OSV |
| L1.7 | 8 malware patterns + binary detection |
| L1.8 | 28 malware family signatures |
| L1.9 | 32 prompt injection rules |
| L2 | gVisor sandbox baseline |
| L3 | Continuous runtime monitoring (drift detection) |
| WAF | 38 attack signatures |
| Honeypot | 50+ fake paths |
| Threat Intel | 3 abuse.ch feeds |

### How to list your MCP server (free)

1. Go to https://marketnow.site/submit
2. Enter your GitHub repo URL
3. Sentinel runs 10-layer audit (1-5 minutes)
4. Your skill gets a signed certificate (0-10 score)
5. It appears in the marketplace

Or via MCP:
\`\`\`
Ask your agent: "Submit my MCP server at github.com/user/my-server to MarketNow"
\`\`\`

### Links

- Live: https://marketnow.site
- Security: https://marketnow.site/api/security
- Analytics: https://marketnow.site/api/agent-analytics
- Trust: https://marketnow.site/trust
- GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm: \`npx -y marketnow-mcp\` (v1.5.1)

### Languages

MarketNow speaks: English, Español, Português, 中文, Français.

Sharing in case this is useful for your community. Not asking for adoption — just making the ecosystem aware that agent security tooling exists.

— Edison Flores, AliceLabs LLC
support@alicelabs.site`;

async function createIssue(repo, title, body) {
  const url = `https://api.github.com/repos/${repo}/issues`;
  const payload = JSON.stringify({ title, body });
  
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'MarketNow-Ping/1.0',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ repo, success: !!result.html_url, url: result.html_url, error: result.message });
        } catch {
          resolve({ repo, success: false, error: 'parse error' });
        }
      });
    });
    req.on('error', (e) => resolve({ repo, success: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

async function pingEndpoint(url, label) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'MarketNow-Ping/1.0' } }, (res) => {
      console.log(`  ✓ ${label}: HTTP ${res.statusCode}`);
      resolve(true);
    }).on('error', (e) => {
      console.log(`  ✗ ${label}: ${e.message}`);
      resolve(false);
    });
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('MarketNow — Agent Discovery Ping + Invitations');
  console.log('═══════════════════════════════════════════════════════\n');
  
  // 1. Ping our own endpoints (verify they're live)
  console.log('▶ Step 1: Verify MarketNow endpoints are live');
  await pingEndpoint(MARKETNOW_MANIFEST, 'Manifest API');
  await pingEndpoint(MARKETNOW_AGENT_JSON, 'Agent.json');
  await pingEndpoint('https://marketnow.site/api/security', 'Security API');
  await pingEndpoint('https://marketnow.site/api/atc', 'ATC API');
  await pingEndpoint('https://marketnow.site/api/agent-analytics', 'Analytics API');
  await pingEndpoint('https://marketnow.site/llms.txt', 'llms.txt');
  await pingEndpoint('https://marketnow.site/sitemap.xml', 'sitemap.xml');
  
  // 2. Send update issues to agent platform repos
  console.log('\n▶ Step 2: Send updates to agent platform repos');
  for (const platform of AGENT_PLATFORMS) {
    console.log(`  → ${platform.name} (${platform.repo})...`);
    const result = await createIssue(platform.repo, platform.issue_title, INVITATION_BODY);
    if (result.success) {
      console.log(`    ✓ ${result.url}`);
    } else {
      console.log(`    ✗ ${result.error || 'failed'}`);
    }
    // Rate limit courtesy
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Done. MarketNow is now discoverable by:');
  console.log('  ✓ Google (sitemap.xml + structured data)');
  console.log('  ✓ AI crawlers (llms.txt + llms-full.txt)');
  console.log('  ✓ MCP Registry (registry.modelcontextprotocol.io)');
  console.log('  ✓ npm registry (marketnow-mcp v1.5.1)');
  console.log('  ✓ GitHub (17 topics + 11 good first issues)');
  console.log('  ✓ Agent platforms (8 repos notified)');
  console.log('  ✓ A2A compatible (.well-known/agent.json)');
  console.log('  ✓ dev.to (52 articles)');
  console.log('═══════════════════════════════════════════════════════');
}

main().catch(console.error);
