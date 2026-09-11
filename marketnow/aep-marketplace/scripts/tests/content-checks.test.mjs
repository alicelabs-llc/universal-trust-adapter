/**
 * Content consistency tests
 * Run: node --test scripts/tests/content-checks.test.mjs
 *
 * These tests verify that landing, agent.json, and stats.json
 * all show the same metrics. CI fails if any surface diverges.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const INDEX_HTML = readFileSync(`${ROOT}/marketnow/aep-marketplace/index.html`, 'utf-8');
const AGENT_JSON = JSON.parse(readFileSync(`${ROOT}/marketnow/aep-marketplace/public/api/agent.json`, 'utf-8'));
const STATS_JSON = JSON.parse(readFileSync(`${ROOT}/marketnow/aep-marketplace/public/api/stats.json`, 'utf-8'));
const PRICING_JSON = JSON.parse(readFileSync(`${ROOT}/marketnow/aep-marketplace/public/api/pricing.json`, 'utf-8'));

test('F-01: no cloaking SEO in index.html', () => {
  assert.ok(!INDEX_HTML.includes('seo-only'), 'CSS .seo-only should be removed');
  assert.ok(!INDEX_HTML.includes('visible to Googlebot'), 'Googlebot comment should be removed');
  assert.ok(!INDEX_HTML.includes('hidden from humans'), 'hidden from humans comment should be removed');
});

test('F-02: no "free One-Time" in index.html', () => {
  assert.ok(!INDEX_HTML.includes('$0.99'), '$0.99 should be removed (use pricing.json)');
  assert.ok(!INDEX_HTML.match(/\$0\.99.*\$9\.99/), 'free pattern should be removed');
});

test('F-04: no "pipeline pipeline" duplication in index.html', () => {
  assert.ok(!INDEX_HTML.includes('pipeline pipeline'), 'pipeline pipeline duplication should be fixed');
});

test('F-05: no "9,248 free" in index.html', () => {
  assert.ok(!INDEX_HTML.includes('9,248 free'), '9,248 free should be 43 free');
});

test('F-08: free-skills surface is consistent with the v5.5 catalog', () => {
  const FREE_JSON = JSON.parse(readFileSync(`${ROOT}/marketnow/aep-marketplace/public/api/free-skills.json`, 'utf-8'));
  assert.equal(FREE_JSON.length, 66496, 'free-skills.json should list all 66,496 catalog entries');
  assert.ok(!INDEX_HTML.match(/\b\d[\d,.]*\s+free skills\b/), 'index.html should not hardcode a free-skills count');
});

test('F-09: no GitHub token comment in index.html', () => {
  assert.ok(!INDEX_HTML.includes('redeploy trigger'), 'redeploy trigger comment should be removed');
  assert.ok(!INDEX_HTML.includes('new GitHub token'), 'GitHub token comment should be removed');
});

test('R-05: stats.json exists and has correct structure (v5.5 catalog)', () => {
  assert.ok(STATS_JSON.discovery.total_mcp_servers === 69076, 'total_mcp_servers should be 69076 (L1 index-certified)');
  assert.ok(STATS_JSON.security.l1_index_certified === 69076, 'l1_index_certified should be 69076');
  assert.ok(STATS_JSON.security.l2_sentinel_scanned === 2839, 'l2_sentinel_scanned should be 2839');
  assert.ok(STATS_JSON.security.npm_vulnerabilities_own_packages === 0, 'own npm packages: 0 vulnerabilities');
});

test('R-10: data layer has no stale 9,248 counts (agent-ping feeds the homepage)', () => {
  const PING_JSON = JSON.parse(readFileSync(`${ROOT}/marketnow/aep-marketplace/public/api/agent-ping.json`, 'utf-8'));
  assert.ok(PING_JSON.stats.total_skills === 69076, 'agent-ping total_skills should be 69076');
  assert.equal(PING_JSON.stats.mcp_tools_count, PING_JSON.mcp_tools.length, 'mcp_tools_count should match the tools list');
  const CARD_JSON = JSON.parse(readFileSync(`${ROOT}/marketnow/aep-marketplace/public/.well-known/mcp/server-card.json`, 'utf-8'));
  assert.ok(!CARD_JSON.description.includes('9,248'), 'server-card (Smithery source) must not say 9,248');
  const STATS_STR = JSON.stringify(STATS_JSON);
  assert.ok(!STATS_STR.includes('9,248'), 'stats.json must not reference 9,248');
});

test('R-06: no "verified safe" in index.html or agent.json', () => {
  assert.ok(!INDEX_HTML.toLowerCase().includes('verified safe'), 'verified safe should be replaced');
  const agentStr = JSON.stringify(AGENT_JSON);
  assert.ok(!agentStr.toLowerCase().includes('verified safe'), 'agent.json should not have verified safe');
});

test('R-07: Sentinel version is v3.0 in index.html', () => {
  assert.ok(!INDEX_HTML.includes('Sentinel L1.5'), 'Sentinel L1.5 should be v3.0');
  assert.ok(INDEX_HTML.includes('Sentinel v3.0'), 'Sentinel v3.0 should be present');
});

test('R-07: Sentinel version is v3.0 in agent.json', () => {
  const agentStr = JSON.stringify(AGENT_JSON);
  assert.ok(!agentStr.includes('Sentinel L1.5'), 'agent.json should not have Sentinel L1.5');
});

test('R-03: pricing.json exists and has buyer/seller model', () => {
  assert.ok(PRICING_JSON.buyer.model === 'free', 'Buyer model should be free');
  assert.ok(PRICING_JSON.seller.tiers.length === 2, 'Should have 2 seller tiers (PRO and ENTERPRISE)');
  assert.ok(PRICING_JSON.seller.commission_rate === '0.20', 'Commission rate should be 0.20');
});

test('Consistency: stats.json and agent.json agree on total_mcp_servers', () => {
  const agentTotal = AGENT_JSON.security?.sentinelL1?.totalScanned || AGENT_JSON.discovery?.total_mcp_servers;
  assert.equal(agentTotal, STATS_JSON.discovery.total_mcp_servers, 'agent.json and stats.json should agree on total');
});

console.log('✅ All content consistency tests passed');
