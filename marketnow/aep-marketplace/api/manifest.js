import { setCorsHeaders } from '../lib/cors.mjs';

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  res.status(200).json({
    service: 'MarketNow',
    version: '5.0.0',
    description: 'Security infrastructure for AI agents. Sentinel audits MCP servers and agent tools, produces security evidence and trust scores, and enables agents and organizations to determine which tools are safe to use.',
    positioning: 'Security infrastructure for AI agents — not a marketplace. The marketplace is distribution; Sentinel is the product.',
    homepage: 'https://marketnow.site',
    
    products: {
      sentinel: {
        name: 'Sentinel',
        tagline: 'AI Agent Security Engine',
        description: '10-layer security audit pipeline for MCP servers and agent tools',
        layers: [
          { id: 'L1.5', name: 'Metadata Analysis', type: 'static' },
          { id: 'L1.6', name: 'Semgrep + Secrets + OSV', type: 'static' },
          { id: 'L1.7', name: 'Malware Pattern Detection', type: 'static' },
          { id: 'L1.8', name: 'Malware Family Signatures (48)', type: 'static' },
          { id: 'L1.9', name: 'Prompt Injection Screening (32 rules)', type: 'static' },
          { id: 'L2.5', name: 'gVisor Sandbox Isolation', type: 'dynamic' },
          { id: 'L3', name: 'Runtime MCP Interceptor', type: 'runtime' },
          { id: 'ATC', name: 'Agent Trust Card (Ed25519)', type: 'identity' },
          { id: 'x402', name: 'Streaming Metered Billing', type: 'payment' },
          { id: 'A2A', name: 'Remote Agent Execution', type: 'execution' },
        ],
      },
      trust_card: {
        name: 'Trust Card',
        tagline: 'Cryptographically verifiable security identity for AI tools',
        algorithm: 'Ed25519 (RFC 8032)',
        canonical_json: 'RFC 8785 JCS',
        verify_endpoint: 'GET /api/atc?action=verify&card_id=ATC-2026-XXXXX',
        ca_key_endpoint: 'GET /api/atc?action=ca-key',
      },
      interceptor: {
        name: 'MCP Interceptor',
        tagline: 'Real-time JSON-RPC guardrail',
        endpoint: 'POST /api/interceptor',
        rules: 5,
        actions: ['allow', 'block', 'warn'],
      },
    },

    pricing: {
      free: { price: 0, features: ['Basic Sentinel scan', 'Trust score', 'Public report', 'Public listing'] },
      developer: { price: '$49-99', features: ['Deep static analysis', 'Dependency analysis', 'Malware scan', 'Prompt injection', 'Sandbox', 'Signed report'] },
      professional: { price: '$199-499', features: ['Deep audit', 'Runtime testing', 'Remediation', 'Trust Card', 'Re-audit'] },
      continuous: { price: '$99-499/month', features: ['Continuous monitoring', 'CVE tracking', 'Dependency drift', 'Auto re-audit', 'Trust score updates'] },
      enterprise: { price: '$5k-50k+/year', features: ['Private MCP audits', 'Custom policies', 'Compliance evidence', 'API', 'Dashboards', 'SLA'] },
    },

    connect: {
      mcp_stdio: { command: 'npx -y marketnow-mcp', npm: 'https://www.npmjs.com/package/marketnow-mcp' },
      mcp_http: { url: 'https://marketnow.site/api/mcp', transport: 'SSE + JSON-RPC', protocol_version: '2024-11-05' },
      rest_api: { base_url: 'https://marketnow.site/api' },
    },

    endpoints: {
      search: { method: 'GET', path: '/api/search?q={query}', description: 'Search MCP skills', auth: 'none' },
      atc: { method: 'ANY', path: '/api/atc', description: 'Agent Trust Card — issue, verify, revoke', auth: 'rate-limited' },
      interceptor: { method: 'POST', path: '/api/interceptor', description: 'Real-time MCP call interceptor', auth: 'none' },
      stream: { method: 'POST', path: '/api/stream', description: 'Streaming metered billing (x402 USDC)', auth: 'payment' },
      stacks: { method: 'GET', path: '/api/stacks', description: 'Agent skill bundles', auth: 'none' },
      execute: { method: 'POST', path: '/api/execute', description: 'A2A remote execution', auth: 'ATC + mandate' },
      trust_score: { method: 'GET', path: '/api/trust-score?skillId={id}', description: 'Compact trust score', auth: 'none' },
      audit: { method: 'POST', path: '/api/audit-skill', description: 'Trigger Sentinel audit', auth: 'github' },
      audit_report: { method: 'GET', path: '/api/audit-report.json', description: 'Full transparency report — safe, risky, and quarantined skills', auth: 'none' },
    },

    stats: {
      total_skills: 9248,
      audited: 5662,
      l25_tested: 257,
      // NOTE: All 9,248 skills in the catalog are free to INSTALL (it's distribution).
      // The paid product is Sentinel (security audit). See `pricing` block above.
      // The legacy `free_skills: 9248` field was removed in v5.0.0 to avoid implying
      // the platform itself is free — Sentinel audits are paid at the Developer tier and above.
      atc_issued: 57,
      security_checks_performed: 1211488,
      threats_detected: 1030,
      critical_blocked: 80,
      verified_safe: 8288,
      quarantined: 81,
      risky_skills: 54,
      safe_skills: 8238,
      sentinel_version: 'L1.5 → L3 (10 layers) + Interceptor + ATC + x402 + A2A',
    },

    security: {
      audit_pipeline: 'Sentinel L1.5 → L1.9 → L2.5 gVisor → L3 Interceptor',
      certificate_algorithm: 'Ed25519 (RFC 8032)',
      canonical_json: 'RFC 8785 JCS',
      verify_url: 'https://marketnow.site/verify',
      interceptor_url: 'https://marketnow.site/api/interceptor',
    },

    timestamp: new Date().toISOString(),
  });
}
