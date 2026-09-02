# PR: Add MarketNow to modelcontextprotocol/servers

**Repo:** https://github.com/modelcontextprotocol/servers
**File to edit:** `README.md` (the curated list of MCP servers)
**Section:** "Community Servers" → "Marketplaces" (or create the section)

## PR Title

```
Add MarketNow — MCP skill marketplace with 9,248 verified skills
```

## PR Body

```markdown
## What does this PR do?

Adds [MarketNow](https://marketnow.site) to the list of community MCP servers. MarketNow is the open marketplace for MCP-compatible agent skills — it allows any agent (Claude Desktop, Cursor, Cline) to search, discover, and install 9,248 verified MCP skills via the Model Context Protocol.

## Why should this be added?

MarketNow is unique in the MCP ecosystem:

1. **It's a marketplace, not a single tool** — 9,248 verified skills from many authors, all in one MCP server
2. **Free for autonomous agents** — every skill free, no payments, no subscriptions
3. **Every skill is Sentinel L1 scanned** — automated security audit (repo, README, license, secrets, malicious patterns)
4. **Public JSON API** — `/api/skills.json` returns the full catalog, no auth required
5. **MarketNow is itself installable via npx** — `npx -y marketnow-mcp`

## Stats

- **9,248** verified skills (all sourced from real GitHub repos)
- **25** categories (AI/ML, Data, Security, DevOps, Finance, etc.)
- **Free** — all 9,248 skills, no payments
- **100%** open-source skills (MIT, Apache-2.0, etc.)
- **npm package:** [marketnow-mcp@1.0.1](https://www.npmjs.com/package/marketnow-mcp)

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

| Tool | Description |
|---|---|
| `search_skills` | Search by query, category, or max price |
| `get_skill` | Get full details by ID or slug |
| `list_categories` | All 25 categories with counts |
| `get_manifest` | Marketplace metadata (totals, pricing) |
| `get_install_command` | Get install command for a skill |

## Links

- **Website:** https://marketnow.site
- **npm:** https://www.npmjs.com/package/marketnow-mcp
- **GitHub:** https://github.com/alicelabs-llc/marketnow
- **API:** https://marketnow.site/api/agent.json
- **Discovery:** https://marketnow.site/.well-known/mcp.json
- **License:** MIT

## Example Usage

Once connected, you can ask Claude:
- "Find me a skill to scrape websites"
- "What's the cheapest AI/ML skill on MarketNow?"
- "Show me all Security skills under $3"
- "Get the install command for mn-ai-00001"

## Checklist

- [x] The MCP server is publicly accessible
- [x] The server is installable via `npx`
- [x] The server follows the MCP specification
- [x] The code is open-source (MIT license)
- [x] The server has been tested with Claude Desktop
```

## Suggested entry in README.md

```markdown
### MarketNow

The open marketplace for MCP-compatible agent skills. Search, discover, and install 9,248 verified MCP skills from any agent runtime.

- **Install:** `npx -y marketnow-mcp`
- **npm:** https://www.npmjs.com/package/marketnow-mcp
- **GitHub:** https://github.com/alicelabs-llc/marketnow
- **Website:** https://marketnow.site
```
