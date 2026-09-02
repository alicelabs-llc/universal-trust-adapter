# PR: Add MarketNow to patriksimek/awesome-mcp-servers-2

**Repo:** https://github.com/patriksimek/awesome-mcp-servers-2
**Audience:** Global developers (curated awesome list)

## PR Title

```
Add MarketNow — MCP skill marketplace (9,248 verified skills, free)
```

## PR Body

```markdown
## What does this PR do?

Adds [MarketNow](https://marketnow.site) — the open marketplace for MCP-compatible agent skills.

## Description

MarketNow is a marketplace MCP server that allows any agent (Claude Desktop, Cursor, Cline) to search, discover, and install 9,248 verified MCP skills via the Model Context Protocol. Every skill is sourced from a real GitHub repo and scanned by Sentinel L1 for security before listing.

## Key Features

- **9,248 verified skills** across 25 categories
- **Free** (no payments, no subscriptions)
- **Sentinel L1 security scan** on every submission
- **Public JSON API** (no auth required for reads)
- **MarketNow is itself an MCP server** — `npx -y marketnow-mcp`
- **Affiliate program** (5% commission on referred sales)
- **No seller tiers** — everything is free, for everyone

## MCP Config

```json
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp"]
    }
  }
}
```

## Tools Exposed

1. `search_skills` — Search by query, category, max price
2. `get_skill` — Get full details by ID or slug
3. `list_categories` — All 25 categories with counts
4. `get_manifest` — Marketplace metadata
5. `get_install_command` — Get install command for a skill

## Links

- **Website:** https://marketnow.site
- **npm:** https://www.npmjs.com/package/marketnow-mcp
- **GitHub:** https://github.com/alicelabs-llc/marketnow
- **License:** MIT

## Checklist

- [x] The MCP server is publicly accessible
- [x] Installable via npx
- [x] Open-source (MIT)
- [x] Tested with Claude Desktop
```

## Suggested entry

```markdown
- [MarketNow](https://marketnow.site) — The open marketplace for MCP-compatible agent skills. 9,248 verified skills, free. `[npm: marketnow-mcp]`
```
