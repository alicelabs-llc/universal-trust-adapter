// Resilience Manifest API
// Returns the list of all download channels for UTA packages
// This makes /api/resilience.json return real JSON (not HTML)

const manifest = {
  schema: "marketnow.resilience.v1",
  generated_at: new Date().toISOString(),
  publisher: {
    name: "AliceLabs LLC",
    domain: "marketnow.site",
    contact: "info@alicelabs.site"
  },
  philosophy: "Code must be downloadable from at least 3 independent channels. No single point of failure.",
  channels: [
    {
      name: "npm-registry",
      priority: 1,
      description: "Official NPM registry — independent of GitHub",
      base_url: "https://registry.npmjs.org/",
      uptime_sla: "99.99%"
    },
    {
      name: "jsdelivr-cdn",
      priority: 2,
      description: "Free global CDN that mirrors NPM packages automatically",
      base_url: "https://cdn.jsdelivr.net/npm/",
      uptime_sla: "99.95%"
    },
    {
      name: "unpkg-cdn",
      priority: 3,
      description: "Alternative CDN that mirrors NPM packages",
      base_url: "https://unpkg.com/",
      uptime_sla: "99.9%"
    },
    {
      name: "marketnow-site-direct",
      priority: 4,
      description: "AliceLabs-owned origin server — independent of NPM and GitHub",
      base_url: "https://marketnow.site/uta-packages/",
      uptime_sla: "best-effort"
    }
  ],
  packages: [
    {
      name: "@marketnow/uts",
      version: "2.0.0",
      description: "Universal Trust Schema v2",
      downloads: [
        "https://registry.npmjs.org/@marketnow/uts/-/uts-2.0.0.tgz",
        "https://cdn.jsdelivr.net/npm/@marketnow/uts@2.0.0/",
        "https://unpkg.com/@marketnow/uts@2.0.0/",
        "https://marketnow.site/uta-packages/marketnow-uts-2.0.0.tgz"
      ]
    },
    {
      name: "@marketnow/trust-core",
      version: "1.0.0",
      description: "UTA Trust Engine Core",
      downloads: [
        "https://registry.npmjs.org/@marketnow/trust-core/-/trust-core-1.0.0.tgz",
        "https://cdn.jsdelivr.net/npm/@marketnow/trust-core@1.0.0/",
        "https://unpkg.com/@marketnow/trust-core@1.0.0/",
        "https://marketnow.site/uta-packages/marketnow-trust-core-1.0.0.tgz"
      ]
    },
    {
      name: "@marketnow/trust-adapters",
      version: "1.0.0",
      downloads: [
        "https://registry.npmjs.org/@marketnow/trust-adapters/-/trust-adapters-1.0.0.tgz",
        "https://cdn.jsdelivr.net/npm/@marketnow/trust-adapters@1.0.0/",
        "https://unpkg.com/@marketnow/trust-adapters@1.0.0/",
        "https://marketnow.site/uta-packages/marketnow-trust-adapters-1.0.0.tgz"
      ]
    },
    {
      name: "@marketnow/trust-gateway",
      version: "1.0.0",
      downloads: [
        "https://registry.npmjs.org/@marketnow/trust-gateway/-/trust-gateway-1.0.0.tgz",
        "https://cdn.jsdelivr.net/npm/@marketnow/trust-gateway@1.0.0/",
        "https://unpkg.com/@marketnow/trust-gateway@1.0.0/",
        "https://marketnow.site/uta-packages/marketnow-trust-gateway-1.0.0.tgz"
      ]
    },
    {
      name: "marketnow-mcp",
      version: "1.10.0",
      description: "MarketNow MCP Server — 13 tools",
      downloads: [
        "https://registry.npmjs.org/marketnow-mcp/-/marketnow-mcp-1.10.0.tgz",
        "https://cdn.jsdelivr.net/npm/marketnow-mcp@1.10.0/",
        "https://unpkg.com/marketnow-mcp@1.10.0/"
      ]
    },
    {
      name: "agent-trust-card",
      version: "1.1.1",
      description: "ATC SDK for Node.js — issue/verify/inspect trust cards",
      downloads: [
        "https://registry.npmjs.org/agent-trust-card/-/agent-trust-card-1.1.1.tgz",
        "https://cdn.jsdelivr.net/npm/agent-trust-card@1.1.1/",
        "https://unpkg.com/agent-trust-card@1.1.1/"
      ]
    }
  ]
};

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(manifest);
}
