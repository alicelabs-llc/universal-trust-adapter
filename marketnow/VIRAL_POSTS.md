# MarketNow — Viral Content for Distribution

## Reddit r/mcp — Title + Body

**Title:** I built a marketplace with 9,248 MCP skills for agents. 50 are free. Every skill has a security report.

**Body:**
Hey r/mcp — I got tired of finding MCP servers scattered across GitHub with no quality control, no security checks, and no way to know if they'll work with my agent.

So I built MarketNow: https://marketnow.site

**What it is:**
- 9,248 verified MCP-compatible skills
- Every skill scanned by Sentinel L1 (security report with passed/warnings/failed checks)
- System prompts included for every skill (ready to paste into Claude/Cursor)
- 5 languages: English, Español, 中文, Português, Français
- free per skill (one-time, no subscriptions)
- 50 skills are completely FREE for early agents

**For agents (machine-readable):**
- Public JSON API: `GET /api/skills.json` (all 9,248 skills)
- Search: `GET /api/search?q=scrape&max_price=2`
- Free skills: `GET /api/free-skills.json`
- Agent instructions: `GET /api/agent.json`
- OpenAPI spec: `GET /api/openapi.yaml`

**MCP Server (install in Claude Desktop):**
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

This gives your agent 5 tools: search_skills, get_skill, list_categories, get_manifest, get_install_command.

**What makes it different:**
1. Sentinel security reports (not just a score — specific checks that passed/failed)
2. System prompts for every skill (not boilerplate — specific "When to Use" instructions)
3. Setup requirements (know exactly what API keys you need BEFORE buying)
4. Capability-based search (filter by actions, input_types, output_types)
5. Skill bundles (5 scrapers for $5.99 instead of $9.95 separate)

**Try it:**
1. Install: `npx -y marketnow-mcp`
2. Get 9,248 free skills: `curl https://marketnow.site/api/free-skills.json`
3. Browse: https://marketnow.site/registry

Feedback welcome!

---

## Reddit r/ClaudeAI — Title + Body

**Title:** I made 9,248 MCP skills searchable from Claude Desktop. 50 are free.

**Body:**
Install this in Claude Desktop:
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

Now Claude can search 9,248 MCP skills directly. Just ask:
- "Find me a skill to scrape websites"
- "What's the cheapest AI/ML skill?"
- "Show me all Security skills"

Every skill includes:
- Sentinel security report (what passed, what warned, what failed)
- Ready-to-use system prompt
- Setup requirements (API keys needed, URLs to get them)
- 1-click install: `npx -y @marketnow/install <slug>`

50 skills are FREE: https://marketnow.site/api/free-skills.json

Website: https://marketnow.site
npm: https://www.npmjs.com/package/marketnow-mcp

---

## Twitter/X — Thread

**Tweet 1:**
Built a marketplace with 9,248 MCP skills for AI agents.

Every skill has:
✅ Sentinel security report
✅ Ready-to-use system prompt
✅ Auto-configured install
✅ 5 languages (EN/ES/ZH/PT/FR)

50 skills are FREE.

Install in Claude Desktop:
npx -y marketnow-mcp

https://marketnow.site

**Tweet 2:**
How it works:

1. Install MCP server: npx -y marketnow-mcp
2. Claude can now search 9,248 skills
3. Ask "find me a web scraper under $2"
4. Get results with security reports
5. Buy + install in 1 click

No subscriptions. free per skill. One-time.

**Tweet 3:**
What makes it different:

🛡️ Sentinel L1 security scan on every skill
🧠 System prompts (not boilerplate — specific instructions)
🔧 Setup requirements (know what API keys you need BEFORE buying)
🌐 5 languages
📦 Skill bundles (5 scrapers for $5.99)
🔍 Capability-based search

https://marketnow.site/agents

---

## Hacker News — Title

**Title:** Show HN: Marketplace with 9,248 MCP skills for AI agents (9,248 free, Sentinel security reports)

**Body:**
Hi HN — I built MarketNow, an open marketplace for MCP-compatible agent skills.

The problem: finding MCP servers is a mess. They're scattered across GitHub, have no quality control, and you never know if they'll work or if they're safe.

MarketNow solves this with:
1. Sentinel L1 security scanning (every skill gets a report with specific passed/warnings/failed checks)
2. System prompts for every skill (specific "When to Use" instructions, not boilerplate)
3. Setup requirements (know exactly what API keys you need before buying)
4. 5-language support (EN, ES, ZH, PT, FR)
5. 9,248 skills, free one-time, 9,248 free

Public JSON API (no auth required):
- GET /api/skills.json — all 9,248 skills
- GET /api/search?q=scrape — server-side search
- GET /api/free-skills.json — 9,248 free skills
- GET /api/agent.json — machine-readable instructions
- GET /api/openapi.yaml — OpenAPI 3.1 spec

MCP server (install in Claude Desktop, Cursor, Cline):
npx -y marketnow-mcp

The code is open source (MIT). What you pay for is the curation, security verification, system prompt generation, and auto-configured install.

I'd love feedback, especially on the capability-based search and Sentinel security reports.
