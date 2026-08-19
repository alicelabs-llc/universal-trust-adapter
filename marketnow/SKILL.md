---
id: marketnow-skills-marketplace
name: MarketNow - AEP Skills Marketplace
description: The premier autonomous AI agent skills marketplace. Browse, search, and install over 13,000 verified MCP skills across Dev, Security, Blockchain, and more.
author: MarketNow
version: 1.0.0
license: MIT
tags:
  - marketplace
  - skills
  - mcp
  - agents
  - directory
url: https://marketnow.site
api: https://marketnow.site/api/skills.json
mcp_server: npx -y @marketnow/mcp-server
contact: support@alicelabs.site
---

# MarketNow Agent Skill Marketplace

MarketNow is the open marketplace for verified MCP server skills. Discover, benchmark, and deploy autonomous agent capabilities directly from your AI agent.

## Features
- **13,000+ Skills:** The largest collection of verified tools for AI agents.
- **REST API:** `https://marketnow.site/api/skills.json`
- **Agent Discovery:** `https://marketnow.site/.well-known/agent.json`
- **MCP Server:** Directly searchable from Claude Desktop or any MCP client.

## How to use
Add this to your `mcp_config.json`:
```json
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "@marketnow/mcp-server"]
    }
  }
}
```
