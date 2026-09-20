# marketnow-install-stack

One-command **curated skill stacks** for Claude Desktop, Cursor, and Cline — backed by the live [MarketNow](https://marketnow.site) catalog of 9,000+ MCP skills.

```bash
npx -y marketnow-install-stack security-analyst
npx -y marketnow-install-stack financial-auditor cursor
npx -y marketnow-install-stack --list
```

## How it works

1. Each stack maps to a **live catalog category** (Security → 180 skills, Finance → 227, Data → 283, Developer Tools → 7,230, AI/ML → 383).
2. The CLI fetches the top free skills in that category from `https://www.marketnow.site/api/skills?category=...&filter=free` (redirect-safe, with an embedded offline fallback).
3. Each skill's **real install command** (`npx -y …` / `uvx …`) becomes an `mcpServers` entry.
4. The config is **merged** into your existing agent config (with an automatic `.marketnow-backup`), or printed as a ready-to-paste snippet.

| Stack | Category | What you get |
|---|---|---|
| `financial-auditor` | Finance | payments, ledgers, market data skills |
| `security-analyst` | Security | MCP defenders, scanners, auth tools |
| `data-pipeline` | Data | DB, ETL, and query skills |
| `dev-productivity` | Developer Tools | the largest MCP category |
| `growth-hacking` | AI/ML | model, eval, and agent skills |

## Agents

`claude` (default → `~/.claude/claude_desktop_config.json`), `cursor` (→ `~/.cursor/mcp.json`), `cline` (→ `~/.cline/config.json`).

## v1.2.0 — reliability release

- Follows HTTP 308 redirects and targets `www.marketnow.site` directly (v1.1.x crashed with `Unexpected token 'R', "Redirecting..."`).
- `/api/stacks` was removed server-side; stacks now resolve against the **live** `/api/skills` catalog with an embedded fallback (v1.1.x was permanently broken).
- `--help` / `-h` / `--list` flags handled properly.
- Real per-skill install commands, config merge with backup.

## License

Dual-licensed under **MIT OR Apache-2.0, at your option** — free for any use, including
commercial use. This repo and all MarketNow npm packages (marketnow-mcp v1.14.0+,
agent-trust-card v1.4.0+, @marketnow/*) ship dual-licensed: see
[LICENSE-MIT](LICENSE-MIT) and [LICENSE-APACHE](LICENSE-APACHE).
Trademarks ("MarketNow", "UTA", "ATC") are reserved by AliceLabs LLC — see [NOTICE](NOTICE).
