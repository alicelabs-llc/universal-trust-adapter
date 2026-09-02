# PR: Add MarketNow — Sentinel-certified MCP marketplace

## What is MarketNow?

MarketNow (https://marketnow.site) is an MCP skills marketplace with a **3-layer security audit system called Sentinel**. Every skill in the catalog (8,582+ MCP servers) is audited and receives a **signed SHA-256 certificate** with a verified security score (0-10) and risk level (low/medium/high/critical).

## Why add it to awesome-mcp-servers?

MarketNow is the **first marketplace to offer security certification for MCP servers**. This is directly relevant to developers looking for trustworthy MCP servers:

- **8,582 MCP skills indexed** (including all 7 official Anthropic MCP servers from modelcontextprotocol/servers)
- **Sentinel 3-layer audit**: L1.5 (6 metadata checks) + L1.6 (18 Semgrep rules + 18 secret patterns + OSV API) + L2 (Docker sandbox with `--network none`, `--read-only`, `--cap-drop ALL`)
- **Signed certificates**: each skill has a SHA-256-signed JSON certificate, verifiable at https://marketnow.site/verify
- **Markdown badges**: `[![Sentinel Certified](https://marketnow.site/badges/sentinel-certified-{skillId}.svg)](https://marketnow.site/skill/{skillId})`
- **Transparency dashboard**: https://marketnow.site/sentinel-transparency

## Suggested addition

Add to the **Marketplaces** section (or create one):

```markdown
- [MarketNow](https://marketnow.site) - MCP skills marketplace with 3-layer Sentinel security audit. Every skill has a signed SHA-256 certificate (verifiable at /verify). 8,582+ MCP skills indexed, including all official Anthropic MCP servers.
```

## Key differentiators

| Feature | MarketNow | Other marketplaces |
|---------|-----------|-------------------|
| Security audit | 3-layer (L1.5 + L1.6 + L2 Docker sandbox) | None / manual review |
| Signed certificates | SHA-256 per skill | None |
| Public verification | `/verify` page + API | None |
| Risk levels | low/medium/high/critical | None |
| Badges | SVG markdown badges | None |
| Transparency | Public dashboard | None |
| Open source audit code | Yes (GitHub Actions) | No |

## Links

- Website: https://marketnow.site
- Catalog: https://marketnow.site/registry
- Transparency dashboard: https://marketnow.site/sentinel-transparency
- Verify a certificate: https://marketnow.site/verify
- GitHub: https://github.com/alicelabs-llc/marketnow
- API docs: https://marketnow.site/api/agent.json
- llms.txt: https://marketnow.site/llms.txt

## Example: Sentinel Certificate

```json
{
  "certificate_id": "MN-SC-2026-2472577",
  "skill_id": "mn-gen-00003",
  "skill_name": "Discord-mcp-server",
  "overall_score": 8,
  "max_score": 10,
  "risk_level": "medium",
  "risk_breakdown": {
    "l15_l16": "medium",
    "l2": "not_available",
    "final": "medium"
  },
  "layers_run": { "l15": true, "l16": true, "l2": false },
  "signature": "5a9a6e1cdcc2dedf53599b1a0ee8ebff...",
  "signature_algorithm": "SHA-256",
  "verification_url": "https://marketnow.site/verify?skillId=mn-gen-00003"
}
```

## Contact

- Founder: Edison Flores (AliceLabs LLC, Wyoming, USA)
- Email: support@marketnow.site
- GitHub: @edgarfloresguerra2011-a11y
