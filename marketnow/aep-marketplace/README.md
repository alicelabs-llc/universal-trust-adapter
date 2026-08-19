# MarketNow — Agent Skill Marketplace (MCP)

> The largest open marketplace of MCP skills for AI agents — 13,800+ curated tools and skills ready to install in one click.

**Live site:** https://marketnow.site  
**MCP Endpoint:** https://marketnow.site/api/mcp  

## What is MarketNow?

MarketNow is an **Agent Skill Marketplace** that exposes thousands of MCP (Model Context Protocol) tools to AI agents and developers. It acts as a central hub where:

- 🤖 **AI Agents** can discover and use skills automatically
- 👩‍💻 **Developers** can browse, install, and integrate tools via MCP
- 🏪 **Skill Providers** can list their MCP servers for global discovery

## MCP Integration

Connect any MCP-compatible AI client (Claude, Cursor, Windsurf, etc.) to MarketNow:

### Remote SSE (recommended)
```json
{
  "mcpServers": {
    "marketnow": {
      "url": "https://marketnow.site/api/mcp",
      "type": "sse"
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `search_skills` | Search 13,800+ skills by name, category, or keyword |
| `get_skill` | Get detailed info about a specific skill |
| `list_categories` | List all skill categories |
| `install_skill` | Get installation instructions for a skill |

## Stats

- 📦 **13,800+** skills indexed
- 🗂️ **20+** categories (AI, DevOps, Messaging, Finance, etc.)
- 🔄 Updated daily via automated crawlers
- ⚡ Sub-100ms search response time

## Categories

`AI` · `DevOps` · `Finance` · `Messaging` · `Database` · `Productivity` · `Code` · `Search` · `Media` · `General` · and more

## Tech Stack

- **Frontend:** React + Vite (deployed on Cloudflare Pages)
- **Backend:** Cloudflare Workers (edge-deployed, global)
- **Storage:** Cloudflare KV (skill metadata cache)
- **MCP Protocol:** SSE-based remote server

## Links

- 🌐 Website: https://marketnow.site
- 🔌 MCP API: https://marketnow.site/api/mcp
- 📘 OpenAPI Spec: https://marketnow.site/api/openapi.json (YAML: https://marketnow.site/api/openapi.yaml)

## License

MIT © AliceLabs

## Timeline

- **2025**: AliceLabs LLC legally founded in Wyoming, USA (founder Edison Flores, Ecuadorian)
- **2026-03-30**: GitHub organization `github.com/alicelabs-llc` created
- **2026-06-29**: MarketNow launched publicly (first npm release: `marketnow-mcp@1.5.1`)
- **2026-08-09**: Current npm latest: `marketnow-mcp@1.10.0` (15 versions total)
- **2026-08-19**: Independent audit by Z.ai (8 findings F1-F8 applied, see REPORT.pdf)

