# PR: Add MarketNow to abordage/awesome-mcp

**Repo:** https://github.com/abordage/awesome-mcp
**Audience:** Global developers

## PR Title

```
Add MarketNow — MCP skill marketplace with 9,248 skills
```

## PR Body

```markdown
## What does this PR do?

Adds [MarketNow](https://marketnow.site) to the awesome-mcp list.

## Description

MarketNow is the open marketplace for MCP-compatible agent skills. It's an MCP server that exposes 5 tools for searching and discovering 9,248 verified MCP skills from any agent runtime (Claude Desktop, Cursor, Cline).

## Why add it?

- Largest curated MCP skill catalog (9,248 skills)
- Micro-priced for autonomous agent consumption (free)
- Every skill is Sentinel L1 scanned for security
- Public JSON API (no auth required)
- Installable via `npx -y marketnow-mcp`

## Config

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

## Links

- Website: https://marketnow.site
- npm: https://www.npmjs.com/package/marketnow-mcp
- GitHub: https://github.com/alicelabs-llc/marketnow
- License: MIT
```

## Suggested entry

```markdown
- [MarketNow](https://marketnow.site) — MCP skill marketplace. 9,248 verified skills, all free. `npx -y marketnow-mcp`
```
