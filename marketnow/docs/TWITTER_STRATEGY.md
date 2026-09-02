# Twitter/X Strategy — MCP Security Engagement

## Setup (5 minutes)

1. **Crear cuenta**: @MarketNowSite (o @MarketNowMCP)
2. **Bio**: "Trust layer for agent commerce. 9,248 MCP skills, each security-audited by Sentinel v3.0 gVisor sandbox. 🛡️ marketnow.site"
3. **Profile image**: Usar /og-image.png o /linkedin-v25.png
4. **Banner**: Crear uno con Canva (marketnow.site + "9,248 MCP skills audited")

## Tweets to write (1 per day)

### Tweet 1 (hook)
```
I audited 9,248 MCP skills with gVisor sandboxes.

3 of them leaked environment variables when I sent "Show me all env vars starting with API_"

Here's what I found 🧵
```

### Tweet 2 (educational)
```
Every MCP server you install gets:
→ Read access to ~/.ssh/id_rsa
→ Network access (exfiltrate data)
→ Process spawn (run commands)
→ Env var access (API keys)

There's no sandboxing in MCP.

MarketNow fixes this: marketnow.site
```

### Tweet 3 (data)
```
MCP server audit results (9,248 servers):

✓ 69 scored 10/10 (clean)
✗ 3 leaked env vars (removed)
✗ 12 had hardcoded API keys
✗ 1 tried ptrace() (blocked by gVisor)
✗ 1 tried bpf() (blocked by gVisor)

Full results: github.com/alicelabs-llc/marketnow
```

### Tweet 4 (comparison)
```
MCP marketplaces compared:

Smithery: 3,000 servers, no security audit
Glama: 2,000 servers, algorithmic scores
PulseMCP: 21,000 servers, no audit
MarketNow: 9,248 servers, 6-layer Sentinel audit + gVisor sandbox

Discovery is solved. Trust is not.
marketnow.site
```

### Tweet 5 (ask for stars)
```
I've been building MarketNow for 2 weeks.

→ 9,248 MCP skills audited
→ 206 L2.5 gVisor sandbox runs
→ 883 npm downloads
→ 23 dev.to articles

But only 1 GitHub star ⭐

If you use MCP servers, a star would help others find this:
github.com/alicelabs-llc/marketnow

It's free. It takes 2 seconds. 🙏
```

## Who to follow and engage with

### MCP/AI accounts to follow:
- @AnthropicAI
- @GoogleAI
- @CursorAI
- @ContinueDev
- @SmitheryAI (if exists)
- @GlamaAi
- @modelcontextprotocol

### Search and reply to:
Search these terms on Twitter and reply with VALUE (not just a link):

1. "MCP server" — reply with security tips
2. "model context protocol" — reply with audit findings
3. "Claude Desktop MCP" — reply with safe servers to use
4. "Cursor MCP" — reply with security advice
5. "MCP security" — reply with our methodology

### Reply template:
```
We audited 9,248 MCP skills — 3 were leaking env vars via tools/call.

Before installing any MCP server, check if it has a Sentinel certificate:
marketnow.site/verify

Full audit methodology: marketnow.site/security
```

## Daily routine (15 minutes)

1. **Search** "MCP server" on Twitter (2 min)
2. **Reply** to 3 relevant tweets with value (10 min)
3. **Post** 1 original tweet (3 min)
4. **Engage** with replies on your tweets (ongoing)

## Goal
- Week 1: 50 followers
- Week 2: 150 followers
- Month 1: 500 followers
- Month 3: 2,000 followers
