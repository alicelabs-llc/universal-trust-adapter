# 🚀 MarketNow / AEP Promotion & Submission Guide

**Generated**: 2026-05-16

## ✅ COMPLETED

### 1. awesome-mcp-servers (punkpeye/awesome-mcp-servers)
- **PR #6472**: https://github.com/punkpeye/awesome-mcp-servers/pull/6472
- AEP added to **Aggregators** section with full description
- Status: **OPEN, MERGEABLE** — labels: has-emoji ✓, valid-name ✓, non-github-url ⚠️ (our URL is not a GitHub repo), missing-glama ⚠️ (no Glama.ai badge)
- Fork: `edgarfloresguerra2011-a11y/awesome-mcp-servers`

---

## 📋 MANUAL SUBMISSIONS (need browser + JS)

### 2. MCP.so — Submit MCP Server
- **URL**: https://mcp.so/submit
- **What to fill**:
  - Type: `Server`
  - Name: `MarketNow MCP - AEP Agent Exchange Protocol`
  - URL: `https://github.com/alicelabs-llc/marketnow`
  - Server Config (JSON):
```json
{
  "mcpServers": {
    "marketnow": {
      "url": "https://marketnow.site/api/mcp"
    }
  }
}
```
- **Alternative**: Create a standalone lightweight GitHub repo `marketnow-mcp-server` with just a README and config

### 3. PulseMCP — Submit Server
- **URL**: https://pulsemcp.com/submit (behind Cloudflare, requires browser)
- Has reCAPTCHA + CSRF protection — must be done manually
- **Details to enter**:
  - Name: `MarketNow MCP — AEP Agent Exchange Protocol`
  - URL: `https://marketnow.site`
  - Type: Server
  - Category: Marketplace / Aggregator

### 4. Smithery.ai — Register Server
- **URL**: https://smithery.ai/docs/publish (or /register)
- Smithery accepts GitHub-based MCP servers
- **Requirements**: Need a GitHub repo with proper MCP server setup
- **Recommended**: Create `marketnow-mcp-server` repo

### 5. Glama.ai MCP Directory
- **URL**: https://glama.ai/mcp/servers
- Submit at: https://glama.ai/mcp/servers/submit (or add by URL)
- Many awesome-mcp-servers entries auto-populate here

### 6. MCPBar / MCPHub
- Search for "submit MCP server" on Google
- Emerging directories that auto-list from awesome-mcp-servers

---

## 📱 TELEGRAM PROMOTION

### Target Telegram Groups

**Agent / AI Agent Groups:**
- `@AI_Agents_Community` — AI agent development
- `@aiagentsmith` — AI agents discussions
- `@autonomousagents` — Autonomous agents
- `@AgenticAI` — Agentic AI community
- `@MCP_Community` — MCP protocol community
- `@AI_Tools_Agents` — AI tools & agents

**Crypto / Wallet Groups:**
- `@cryptowalletnews` — Crypto wallets news
- `@CryptoAgentNetwork` — Crypto + AI agents
- `@DeFi_Agents` — DeFi agents
- `@web3agents` — Web3 agent development
- `@AIAgentCrypto` — AI agent crypto projects
- `@CryptoAIUpdates` — Crypto AI updates

**Developer / Bot Groups:**
- `@botdevelopment` — Bot development
- `@AIBotsDev` — AI bots developers
- `@MCPDevelopers` — MCP server developers
- `@OpenSourceAI` — Open source AI
- `@buildinpublic` — Building in public

### Promotional Message Template

**Short version (for general groups):**
```
🚀 MarketNow — the largest open MCP skill marketplace is LIVE!

🔗 https://marketnow.site
📡 MCP Endpoint: https://marketnow.site/api/mcp

• 9,248 verified MCP skills
• Sentinel automated security scans on every skill
• Agent-to-agent crypto payments (ETH, BSC, SOL, BTC)
• Open registry — submit your own skills
• Free badge ecosystem to prove your skill is secure

Built for agents. Secured by Sentinel. Open to everyone.
```

**Targeted version (for crypto/wallet groups):**
```
💰 Crypto-ready MCP Marketplace NOW LIVE

MarketNow supports agent-to-agent payments on-chain:
• ETH / Base (USDC)
• BSC / Solana / BTC
• No manual approval needed

🧠 9,248 MCP skills ready for your agents
🛡️ Every skill scanned by Sentinel (malware, secrets, license checks)
📡 MCP endpoint: https://marketnow.site/api/mcp

Try it: https://marketnow.site
```

**Technical version (for developer groups):**
```
MCP server with 9,248 skills — open, verified, paid

Endpoint: https://marketnow.site/api/mcp
  ✓ SSE (GET) + WebSocket (Upgrade) + JSON-RPC (POST)
  ✓ 4 tools: search_skills, get_skill, get_categories, health
  
Also features:
- .well-known/mcp.json discovery
- SVGs badges for your README (https://marketnow.site/badge/{slug}.svg)
- Per-skill SSR pages with OG meta tags
- Crypto checkout with on-chain verification

Open source at: github.com/alicelabs-llc/marketnow
```

### How to Post to Telegram Groups
1. Open Telegram
2. Search for group usernames listed above
3. Click "Join Group" or "Send Message"
4. @Dropeabest_bot needs to be added to groups first (admin approval)
5. Post the short or targeted version of the message

---

## 📊 TRACKING

| Directory | Status | URL |
|---|---|---|
| awesome-mcp-servers | ✅ PR #6472 sent (OPEN, MERGEABLE) | https://github.com/punkpeye/awesome-mcp-servers/pull/6472 |
| MCP.so | ⏳ Manual (browser) | https://mcp.so/submit |
| PulseMCP | ⏳ Manual (browser, reCAPTCHA) | https://pulsemcp.com/submit |
| Smithery.ai | ⏳ Manual (browser, GitHub-based) | https://smithery.ai |
| Glama.ai | ⏳ Auto-populates from awesome-mcp | https://glama.ai/mcp/servers |
| MCPBundles | ⚠️ No external submissions accepted (1493 servers) | https://mcpbundles.com |
| Telegram Groups | ⏳ Manual (Telegram app) | See groups above |

---

## 🎯 NEXT BEST ACTIONS (manual, highest impact)

1. **Open https://mcp.so/submit** → Fill form → Submit
2. **Open https://pulsemcp.com/submit** → Fill form → Submit
3. **In Telegram app:**
   - Search `@MCP_Community`, `@AI_Agents_Community`, `@CryptoAgentNetwork`
   - Post the promotional message
   - Add @Dropeabest_bot to groups if admin permits
4. **Monitor PR #6472** — if maintainer requests changes, update the fork
5. **Create standalone `marketnow-mcp-server` GitHub repo** for easier directory submissions
