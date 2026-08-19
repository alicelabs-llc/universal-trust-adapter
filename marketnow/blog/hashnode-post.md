---
title: "Free MCP Security Challenge: 10-layer audit + Ed25519 trust card — all $0"
publishDate: "2026-07-29"
tags: ["mcp", "aiagents", "security", "opensource"]
---

Submit your MCP server. Get a free 10-layer security audit + signed Agent Trust Card. No payment, no subscription, no catch.

[Full article on dev.to](https://dev.to/edison_flores_6d2cd381b13/free-mcp-security-challenge-submit-your-server-get-a-10-layer-audit)

## Quick start

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

9,248 audited skills. 18 community-submitted. Everything free.

- Submit: https://marketnow.site/submit
- Spec: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/alicelabs-llc/marketnow
- npm: `npx -y marketnow-mcp@1.7.0`
