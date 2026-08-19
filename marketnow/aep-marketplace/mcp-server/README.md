# MarketNow MCP Server

Connect any AI agent directly to the MarketNow skills marketplace via MCP (Model Context Protocol).

## Quick Install

### Claude Desktop / Claude Code

Add to your `claude_desktop_config.json` or `mcp_config.json`:

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

### Manual Install

```bash
npm install -g @marketnow/mcp-server
marketnow-mcp
```

## Available Tools

| Tool | Description |
|------|-------------|
| `search_skills` | Search by keyword, category, price, trust score |
| `get_skill` | Full details + install config for any skill |
| `list_categories` | All marketplace categories with counts |
| `get_top_skills` | Top-rated / most-executed / best-ROI skills |
| `get_free_skills` | All free skills, optionally filtered by category |
| `get_install_config` | Ready-to-paste MCP config for any skill |

## Example Interactions

```
Agent: search_skills(query="email automation", max_price=50)
Agent: get_top_skills(sort_by="trust_score", category="Security")
Agent: get_free_skills()
Agent: get_install_config(skill_id="mn-dev-00001")
```

## API

The underlying REST API is also public:

- `GET https://marketnow.site/api/skills.json` — Full catalog
- `GET https://marketnow.site/api/categories.json` — Categories
- `GET https://marketnow.site/.well-known/agent.json` — Agent discovery

## License

MIT — MarketNow

## Timeline

- **2025**: AliceLabs LLC legally founded in Wyoming, USA (founder Edison Flores, Ecuadorian)
- **2026-03-30**: GitHub organization `github.com/alicelabs-llc` created
- **2026-06-29**: MarketNow launched publicly (first npm release: `marketnow-mcp@1.5.1`)
- **2026-08-09**: Current npm latest: `marketnow-mcp@1.10.0` (15 versions total)
- **2026-08-19**: Independent audit by Z.ai (8 findings F1-F8 applied, see REPORT.pdf)

