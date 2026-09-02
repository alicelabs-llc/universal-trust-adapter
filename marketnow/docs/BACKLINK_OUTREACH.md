# Backlink Outreach — Tracker y templates

## Por qué backlinks importan

Google usa backlinks como "votos de confianza". Sin backlinks de calidad, Google no indexa ni rankea. Actualmente tenemos ~3 backlinks (HN, libhunt, scraper). Necesitamos 50+ para que Google nos tome en serio.

## Targets (50 sites para conseguir backlinks)

### Tier 1 — MCP/AI Directories (submit tu sitio)
| # | Site | Cómo | Estado |
|---|------|------|--------|
| 1 | mcp.so | Ya listado | ✅ |
| 2 | smithery.ai | Ya listado | ✅ |
| 3 | glama.ai | Ya listado | ✅ |
| 4 | pulsemcp.com | Submit form | ⏳ |
| 5 | mcpmarket.com | Submit form | ⏳ |
| 6 | mcp.directory | Submit form | ⏳ |
| 7 | mcpbundles.com | Contact | ⏳ |
| 8 | mcpmanager.ai | Contact | ⏳ |
| 9 | lobehub.com | Submit | ⏳ |
| 10 | mcpplaygroundonline.com | Submit | ⏳ |

### Tier 2 — Tech blogs (outreach email)
| # | Site | Contact | Ángulo |
|---|------|---------|--------|
| 11 | ox.security | blog@ox.security | "MCP security audit pipeline" |
| 12 | aembit.io | through blog contact | "MCP auth + security" |
| 13 | snyk.io | blog@snyk.io | "npm audit for MCP" |
| 14 | semgrep.dev | blog@semgrep.dev | "Semgrep rules for MCP" |
| 15 | praetorian.com | through contact | "MCP pentest results" |
| 16 | trailofbits.com | through contact | "MCP security research" |
| 17 | cure53.de | through contact | "MCP audit collaboration" |
| 18 | nimblebrain.ai | through blog | "State of MCP security" |
| 19 | pipelab.org | through blog | "MCP security incidents" |
| 20 | practical-devsecops.com | through contact | "OWASP MCP Top 10" |

### Tier 3 — dev.to writers (comment + DM)
| # | Author | Artículo | Ángulo |
|---|--------|----------|--------|
| 21 | @pfenil286 | I scanned 670 MCP servers | Comparar datos |
| 22 | @ecap0 | State of MCP Server Security | Comparar metodología |
| 23 | @chunxiaoxx | gVisor vs Firecracker | Nuestros datos de gVisor |
| 24 | @ricco020 | MCP Security risks | Nuestros hallazgos |
| 25 | @instatunnel | Securing MCP Servers | Nuestro approach |
| 26 | @muend | Secure MCP Bridge | Colaboración |
| 27 | @himanshu_748 | Trust firewall for agents | Trust layer para tools |

### Tier 4 — YouTube (comment on videos)
| # | Video | URL |
|---|-------|-----|
| 28 | Hacking MCP: Zero Protection | youtube.com/watch?v=CpN4DPnfvIw |
| 29 | 5 MCP attacks to be aware of | youtube.com/watch?v=2GEwN-EYWXM |
| 30 | Building MCP Sensitive Data Sentinel | youtube.com/watch?v=l00ZoeYhBwg |
| 31 | Build Remote MCP Server Lab | youtube.com/watch?v=b-99wp-KRJ8 |
| 32 | Best Practices w/IBM Hailey | youtube.com/watch?v=VrNCes10kH8 |
| 33 | Building a Secure AI Agent with MCP | youtube.com/watch?v=rSWBi7Cw-XA |

### Tier 5 — Reddit (comment in threads)
| # | Subreddit | Thread |
|---|-----------|--------|
| 34 | r/mcp | How are you vetting MCP servers |
| 35 | r/mcp | MCP is a security joke |
| 36 | r/mcp | How are you handling auth and security |
| 37 | r/cybersecurity | We audited 100 AI Agent MCP Servers |
| 38 | r/AI_Agents | Beware of MCPs |
| 39 | r/LocalLLaMA | Can someone help me understand MCP |
| 40 | r/LocalLLaMA | We scanned 306 MCP servers |

### Tier 6 — International
| # | Site | Idioma | Artículo |
|---|------|--------|----------|
| 41 | Qiita (JP) | JA | MCPサーバーって安全なの？ |
| 42 | Zenn (JP) | JA | MCP Security Measures |
| 43 | 掘金 (CN) | ZH | MCP安全基础 |
| 44 | V2EX (CN) | ZH | MCP-Server真的有用么 |
| 45 | Habr (RU) | RU | MCP и безопасность агентов |

### Tier 7 — News/Launch
| # | Site | Cómo |
|---|------|------|
| 46 | Product Hunt | Launch (see PRODUCTHUNT_LAUNCH_CHECKLIST.md) |
| 47 | Hacker News | Show HN post |
| 48 | Indie Hackers | Post story |
| 49 | Lobsters | Submit |
| 50 | TechCrunch | Pitch (when we have more traction) |

---

## Email template para bloggers

```
Subject: Security-audited MCP marketplace — relevant for your readers?

Hi [Name],

I read your article "[article title]" — great breakdown of MCP security risks.

I've been building MarketNow (marketnow.site), a marketplace where every MCP server gets security-audited with a 6-layer pipeline:

- L1.5: Static analysis (deps, secrets, licenses)
- L1.6: Pattern-based behavioral analysis  
- L2 v2.0: Active probe (60+ adversarial inputs: path traversal, SSRF, SQL injection, command injection, prompt injection, credential access)
- L2.5: gVisor sandbox (userspace kernel isolation — the tech behind Google Cloud Run)

9,248 servers audited. 3 were removed for leaking environment variables via tools/call.

Would you be interested in a guest post or mention? I can provide:
- Exclusive data from our audit (what vulnerabilities we found in 9,248 servers)
- A technical deep-dive into the gVisor sandbox approach
- A comparison of MCP security tools

Happy to send a draft or jump on a call.

Best,
Edison Flores
AliceLabs LLC
marketnow.site
```

## DM template para dev.to writers

```
Hi @username,

Loved your article on [topic]. I'm building MarketNow — a marketplace where every MCP server gets a 6-layer security audit (including gVisor sandbox).

We've audited 9,248 servers and found [specific finding related to their article]. Thought you might find it interesting for a follow-up post.

Full methodology: marketnow.site/security
Audit results: github.com/alicelabs-llc/marketnow

Would love to compare notes on scanning methodology if you're open to it.

— Edison
```

## YouTube comment template

```
Great video! We've been running gVisor sandbox audits on 9,248 MCP skills at MarketNow (marketnow.site/security). 

Key finding: 3 servers leaked environment variables when sent credential-access prompts via tools/call. The args were passed to eval() without sanitization.

Also caught 1 ptrace() attempt and 1 bpf() attempt — both blocked by gVisor.

Full audit methodology and results: marketnow.site/security
```

## Tracking

Usar una Google Sheet o Notion para trackear:
- Site contactado
- Fecha de contacto
- Método (email/DM/comment)
- Estado (pendiente/respondido/backlink obtenido)
- URL del backlink (si obtenido)

**Meta**: 50 backlinks en 30 días
