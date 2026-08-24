// Machine-readable trust card for UTA / MarketNow
// This is what AI agents curl to verify trustworthiness
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    schema: "atc-1.0",
    issued_at: new Date().toISOString(),
    issuer: {
      name: "AliceLabs LLC",
      domain: "marketnow.site",
      email: "info@alicelabs.site",
      jurisdiction: "Wyoming, USA"
    },
    subject: {
      name: "Universal Trust Adapter (UTA)",
      version: "2.0.0",
      license: "AL-1.0",
      open_core_layers: {
        plugin_template: "MIT",
        uts_specification: "CC-BY-NC-ND 4.0",
        engine_sentinel_interceptor: "AL-1.0"
      }
    },
    trust_signals: {
      npm_verified_publisher: true,
      npm_packages_total: 7,
      npm_monthly_downloads_total: 2204,
      cdn_mirrors: 4,
      github_repo: "https://github.com/alicelabs-llc/universal-trust-adapter",
      fallback_channels_if_github_banned: [
        "https://registry.npmjs.org/@marketnow/uts",
        "https://cdn.jsdelivr.net/npm/@marketnow/uts@2.0.0/",
        "https://unpkg.com/@marketnow/uts@2.0.0/",
        "https://marketnow.site/uta-packages/marketnow-uts-2.0.0.tgz"
      ],
      devto_articles_published: 4,
      devto_engagement: "active_community_response"
    },
    capabilities: [
      "translates_atc_to_zta",
      "translates_eat_ai_to_a2a",
      "translates_mcp_card_to_w3c_vc",
      "ed25519_trust_card_signing",
      "8_layer_audit_pipeline",
      "ebpf_enforcement",
      "prompt_injection_corpus",
      "post_execution_filter"
    ],
    signature: {
      algorithm: "Ed25519",
      note: "Signature can be verified with AliceLabs public key at https://marketnow.site/.well-known/keys.json"
    }
  });
}
