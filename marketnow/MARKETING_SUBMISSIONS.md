# MarketNow — Global MCP Directory Submission Plan (v5.0.0)

> Positioning: **Security Infrastructure for AI Agents** (not a marketplace).
> Product: **Sentinel** — 10-layer security audit pipeline.
> Distribution: 9,248 MCP skills (all free to install).
> npm: `marketnow-mcp@1.9.0` — 12 tools, all `marketnow_*` namespaced.

This document contains:
1. Complete list of MCP directories worldwide (US, China, Europe)
2. Pre-written submission copy reflecting v5.0.0 positioning
3. Status tracking for each directory

---

## Current Listings (verified)

| # | Directory | Country | URL | Status | Action Needed |
|---|-----------|---------|-----|--------|---------------|
| 1 | mcp.so | US | https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y | ⚠️ Listed (data OUTDATED) | Email to update — see `MCP_SO_LISTING.md` |
| 2 | chat.mcp.so | US | (mirror of #1) | ⚠️ Mirror outdated | Updates with mcp.so |
| 3 | glama.ai | US | https://glama.ai/mcp/connectors?query=MarketNow+MCP | ⚠️ Listed (verify data) | Submit update request |
| 4 | npm | US | https://www.npmjs.com/package/marketnow-mcp | ✅ Published v1.9.0 | Auto-updates on publish |

---

## Directories to Submit / Update

### Tier 1 — Official / High Authority

| # | Directory | Country | URL | How to Submit |
|---|-----------|---------|-----|---------------|
| 5 | MCP Registry (official) | US | https://registry.modelcontextprotocol.io | PR to https://github.com/modelcontextprotocol/registry |
| 6 | Anthropic MCP Servers | US | https://github.com/modelcontextprotocol/servers | PR to add to README |
| 7 | GitHub MCP Registry | US | https://github.blog/ai-and-ml/github-copilot/meet-the-github-mcp-registry | Via GitHub Copilot settings |
| 8 | JFrog Universal MCP Registry | US/IL | https://investors.jfrog.com/2026/JFrog-Unveils-Universal-MCP-Registry | Contact JFrog |

### Tier 2 — Major Directories

| # | Directory | Country | URL | How to Submit |
|---|-----------|---------|-----|---------------|
| 9 | Smithery | US | https://smithery.ai | Sign up → Submit server |
| 10 | Awesome MCP Servers (mcpservers.org) | US | https://mcpservers.org | PR to their GitHub repo |
| 11 | MCP Market | US | https://mcpmarket.com/sell | Form on /sell page |
| 12 | MCP.Directory | US | https://mcp.directory | Submit form |
| 13 | MCPBundles | US | https://www.mcpbundles.com | Contact via site |
| 14 | MCPManager | US | https://mcpmanager.ai | Contact via site |
| 15 | Cursor Marketplace | US | https://cursor.com/marketplace | Apply as plugin developer |
| 16 | Composio | US/IN | https://composio.dev | List as alternative |
| 17 | TrueFoundry | US | https://www.truefoundry.com | Contact for listing |

### Tier 3 — Chinese Directories

| # | Directory | Country | URL | How to Submit |
|---|-----------|---------|-----|---------------|
| 18 | MCP Hub China (mcp-cn.com) | China | https://mcp-cn.com | 提交服务 (Submit service) |
| 19 | ModelScope MCP 广场 | China | https://www.modelscope.cn/mcp | Alibaba's MCP hub — submit via ModelScope account |
| 20 | Awesome-MCP-ZH | China | https://github.com/yzfly/awesome-mcp-zh | PR to GitHub repo (Chinese) |
| 21 | Fit2Cloud Hub | China | https://bbs.fit2cloud.com/t/topic/12752 | Post in their community |
| 22 | Zhihu (MCP navigation) | China | https://zhuanlan.zhihu.com/p/2036834950998127996 | Article on Zhihu |

### Tier 4 — European / Other

| # | Directory | Country | URL | How to Submit |
|---|-----------|---------|-----|---------------|
| 23 | Higress MCP Marketplace | EU/China | https://mcp.higress.ai | Submit via their site |
| 24 | XPack MCP Marketplace | EU | https://github.com/xpack-ai/XPack-MCP-Marketplace | PR to GitHub repo |
| 25 | Syncfusion MCP Marketplace | EU | https://help.syncfusion.com/code-studio/reference/configure-properties/mcp/marketplace | Contact Syncfusion |

### Tier 5 — Awesome Lists / Aggregators

| # | Directory | Country | URL | How to Submit |
|---|-----------|---------|-----|---------------|
| 26 | Awesome MCP Servers (patriksimek) | CZ | https://github.com/patriksimek/awesome-mcp-servers-2 | PR to GitHub repo |
| 27 | Awesome MCP (abordage) | EU | https://github.com/abordage/awesome-mcp | PR to GitHub repo |
| 28 | Awesome MCP Devtools | US | https://github.com/punkpeye/awesome-mcp-devtools | PR to GitHub repo |
| 29 | Reddit r/mcp | US | https://www.reddit.com/r/mcp | Post in community |
| 30 | Reddit r/ClaudeAI | US | https://www.reddit.com/r/ClaudeAI | Post in community |
| 31 | Reddit r/MCPservers | US | https://www.reddit.com/r/MCPservers | Post in community |

---

## Pre-Written Submission Content (v5.0.0)

### Standard Description (use for all directories)

```markdown
**MarketNow** — Security infrastructure for AI agents. Not a marketplace.

🔗 URL: https://marketnow.site
📦 npm: marketnow-mcp@1.9.0 (https://www.npmjs.com/package/marketnow-mcp)
💻 GitHub: https://github.com/alicelabs-llc/marketnow
🔌 MCP Server: `npx -y marketnow-mcp`
📖 OWASP Compliance: https://marketnow.site/api/owasp
📊 Audit Report: https://marketnow.site/api/audit-report.json

**What it is:**
MarketNow is security infrastructure for AI agents. The marketplace
(9,248 MCP skills, all free to install) is distribution; the product
is Sentinel — a 10-layer security audit pipeline that determines
whether AI agents should be allowed to trust and execute tools.

**Stats (all real, all public):**
- 1,211,488 security checks performed
- 9,248 MCP skills analyzed
- 1,030 threats detected
- 80 skills quarantined (critical — blocked from listing)
- 8,288 verified safe (score >= 8)
- 257 gVisor sandbox runs
- 57 Agent Trust Cards issued (Ed25519, RFC 8032)

**10-Layer Sentinel Audit Pipeline:**
- L1.5 Metadata analysis (auth, CORS, OAuth, rate limiting)
- L1.6 Semgrep + secret detection + OSV dependency scan
- L1.7 Malware pattern detection (binary launchers, install scripts)
- L1.8 Malware family signatures (48 YARA-equivalent rules)
- L1.9 Prompt injection screening (32 rules, 10 categories)
- L2.5 gVisor sandbox (network=none, read-only, cap-drop ALL)
- L3 Runtime MCP Interceptor (5 policy rules, real-time)
- ATC Agent Trust Card (Ed25519, RFC 8032, RFC 8785 JCS)
- x402 Streaming metered billing ($0.01 USDC per call on Base)
- A2A Remote agent execution

**MCP Server v1.9.0 — 12 tools, all `marketnow_*` namespaced:**
1.  marketnow_search_skills         — keyword/category/price-bounded search
2.  marketnow_get_skill            — full skill detail by ID/slug
3.  marketnow_list_categories      — marketplace taxonomy with counts
4.  marketnow_get_manifest         — marketplace metadata + security metrics
5.  marketnow_get_install_command — npx install command for a skill
6.  marketnow_verify_trust         — verify an Agent Trust Card (ATC)
7.  marketnow_verify_receipt       — verify a signed delivery proof (rcpt_)
8.  marketnow_submit_skill          — submit a GitHub repo (L1.5+L1.7 sync, L2 queued)
9.  marketnow_mint_referral        — mint ref_xxxxxxxx (5% commission)
10. marketnow_lookup_referral      — referral stats
11. marketnow_recommend_skills    — AI-ranked skill recommendations
12. marketnow_get_owasp_compliance — OWASP MCP Cheat Sheet (12 controls) + tool fingerprints + capability manifest

**Agent Contract (4 golden rules):**
- A. Deterministic `marketnow_` snake_case tool names
- B. Intent-oriented descriptions (WHEN/WHY, not WHAT)
- C. Strict JSON-Schema (type + enum + pattern + bounds)
- D. Structured `{ content, isError }` responses with error code taxonomy

**Pricing:**
- Free ($0): Basic Sentinel scan, trust score, public report
- Developer ($49-99): Deep audit + signed report
- Professional ($199-499): Runtime testing + Trust Card + re-audit
- Continuous ($99-499/mo): Monitoring + CVE tracking + auto re-audit
- Enterprise ($5k-50k+/yr): Private audits + API + SLA

**MCP Config (Claude Desktop / Cursor / Cline):**
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp"]
    }
  }
}

**License:** AliceLabs LLC Proprietary (MNNC-1.0)
```

### Email Template — For mcp.so Update Request

**To:** support@mcp.so (or via their contact form)
**Subject:** Update MarketNow listing — repositioned as Security Infrastructure (v5.0.0)

```
Hi mcp.so team,

I'm the maintainer of MarketNow (https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y).

Our positioning has fundamentally changed and the listing is now inaccurate. Could you please update it?

Current (OUTDATED):
- Tagline: "9,248 verified MCP-compatible skills"
- Pricing: "Crypto payments (ETH/BSC/SOL/BTC)"
- Transport: "SSE/WebSocket/JSON-RPC"
- Config: "url": "https://marketnow.site/api/mcp"
- Tools: 5

Correct (CURRENT — v5.0.0):
- Tagline: "Security infrastructure for AI agents — 12 MCP tools backed by Sentinel"
- Positioning: Security infrastructure, NOT a marketplace. The marketplace (9,248 skills, all free) is distribution; the product is Sentinel.
- Stats: 1,211,488 security checks, 1,030 threats detected, 80 quarantined (critical)
- Transport: stdio only (via `npx -y marketnow-mcp`)
- Config: {"mcpServers":{"marketnow":{"command":"npx","args":["-y","marketnow-mcp"]}}}
- Tools: 12, all `marketnow_*` namespaced (v1.9.0)
- Pricing: Free / $49-99 / $199-499 / $99-499/mo / $5k-50k+/yr

You can verify all current data at:
- https://marketnow.site/api/manifest.json (server metadata)
- https://marketnow.site/api/audit-report.json (transparency report)
- https://marketnow.site/api/owasp (OWASP MCP compliance matrix)
- https://www.npmjs.com/package/marketnow-mcp (npm package, v1.9.0)

npm package: marketnow-mcp@1.9.0
GitHub: https://github.com/alicelabs-llc/marketnow

Thanks for maintaining mcp.so — it's a great resource for the MCP community!

Best,
Edgar Flores
support@alicelabs.site
```

### Email Template — For New Directory Submissions

**Subject:** MarketNow submission — Security infrastructure for AI agents (Sentinel audit pipeline)

```
Hi [Directory Name] team,

I'd like to submit MarketNow to your MCP directory.

**MarketNow** is security infrastructure for AI agents. Not a marketplace.
The marketplace (9,248 MCP skills, all free to install) is distribution;
the product is Sentinel — a 10-layer security audit pipeline that has
performed 1,211,488 checks, detected 1,030 threats, and quarantined
80 malicious skills.

Stats (all real, all public at /api/audit-report.json):
- 1,211,488 security checks performed
- 9,248 MCP skills analyzed
- 1,030 threats detected
- 80 quarantined (critical — blocked from listing)
- 8,288 verified safe (score >= 8)
- 257 gVisor sandbox runs
- 57 Agent Trust Cards issued (Ed25519, RFC 8032)

MCP Server v1.9.0 — 12 tools, all `marketnow_*` namespaced:
1. marketnow_search_skills
2. marketnow_get_skill
3. marketnow_list_categories
4. marketnow_get_manifest
5. marketnow_get_install_command
6. marketnow_verify_trust
7. marketnow_verify_receipt
8. marketnow_submit_skill
9. marketnow_mint_referral
10. marketnow_lookup_referral
11. marketnow_recommend_skills
12. marketnow_get_owasp_compliance

The 12 tools follow the 4 golden rules for autonomous agent consumption:
- A. Deterministic `marketnow_` snake_case names
- B. Intent-oriented descriptions
- C. Strict JSON-Schema (type + enum + pattern + bounds)
- D. Structured `{ content, isError }` responses

Pricing:
- Free ($0): Basic Sentinel scan, trust score, public report
- Developer ($49-99): Deep audit + signed report
- Professional ($199-499): Runtime testing + Trust Card + re-audit
- Continuous ($99-499/mo): Monitoring + CVE tracking + auto re-audit
- Enterprise ($5k-50k+/yr): Private audits + API + SLA

URLs:
- Website: https://marketnow.site
- npm: https://www.npmjs.com/package/marketnow-mcp
- GitHub: https://github.com/alicelabs-llc/marketnow
- OWASP compliance: https://marketnow.site/api/owasp
- Audit report: https://marketnow.site/api/audit-report.json
- MCP config:
  {
    "mcpServers": {
      "marketnow": {
        "command": "npx",
        "args": ["-y", "marketnow-mcp"]
      }
    }
  }

License: AliceLabs LLC Proprietary (MNNC-1.0)

Please let me know if you need any additional information.

Best,
Edgar Flores
support@alicelabs.site
```

### Chinese Submission Template (中文)

**Subject:** MarketNow 提交 — AI 代理安全基础设施

```
您好,

我想将 MarketNow 提交到您的 MCP 目录.

MarketNow 是 AI 代理的安全基础设施 (不是市场).
市场 (9,248 个 MCP 技能, 全部免费安装) 是分发层;
产品是 Sentinel — 一个 10 层安全审计管道.

统计 (全部真实, 公开在 /api/audit-report.json):
- 1,211,488 次安全检查
- 9,248 个 MCP 技能已分析
- 1,030 个威胁已检测
- 80 个技能已隔离 (严重风险, 阻止发布)
- 8,288 个已验证安全 (评分 >= 8)
- 257 次 gVisor 沙箱运行
- 57 个代理信任卡已签发 (Ed25519, RFC 8032)

MCP 服务器 v1.9.0 — 12 个工具, 全部使用 `marketnow_*` 命名空间:
1. marketnow_search_skills
2. marketnow_get_skill
3. marketnow_list_categories
4. marketnow_get_manifest
5. marketnow_get_install_command
6. marketnow_verify_trust
7. marketnow_verify_receipt
8. marketnow_submit_skill
9. marketnow_mint_referral
10. marketnow_lookup_referral
11. marketnow_recommend_skills
12. marketnow_get_owasp_compliance

定价:
- 免费 ($0): 基本 Sentinel 扫描, 信任评分, 公开报告
- 开发者 ($49-99): 深度审计 + 签名报告
- 专业 ($199-499): 运行时测试 + 信任卡 + 重新审计
- 持续 ($99-99/月): 监控 + CVE 跟踪 + 自动重新审计
- 企业 ($5k-50k+/年): 私有审计 + API + SLA

链接:
- 网站: https://marketnow.site
- npm: https://www.npmjs.com/package/marketnow-mcp
- GitHub: https://github.com/alicelabs-llc/marketnow
- OWASP 合规: https://marketnow.site/api/owasp
- 审计报告: https://marketnow.site/api/audit-report.json

MCP 配置:
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp"]
    }
  }
}

许可证: AliceLabs LLC 专有 (MNNC-1.0)

如果您需要任何其他信息, 请告诉我.

此致,
Edgar Flores
support@alicelabs.site
```

### GitHub PR Template (for awesome-mcp repos)

````markdown
## Add MarketNow — Security infrastructure for AI agents (Sentinel audit pipeline)

This PR adds [MarketNow](https://marketnow.site), security infrastructure for AI agents.

### Why this should be included

MarketNow is unique among MCP servers because:

1. **It's security infrastructure, not a single tool** — Sentinel, a 10-layer audit pipeline, has performed 1,211,488 checks and quarantined 80 malicious skills.
2. **Strict agent contract** — All 12 tools use the `marketnow_*` namespace prefix with intent-oriented descriptions, strict JSON-Schemas (type + enum + pattern + bounds), and structured `{ content, isError }` responses.
3. **OWASP MCP Cheat Sheet compliance** — 4 of 12 controls live, 8 planned (public matrix at /api/owasp).
4. **Tool fingerprinting** — SHA-256 hashes on every tool definition, plus capability manifest (filesystem/network/shell/credentials/process).
5. **Agent Trust Card** — Ed25519 (RFC 8032) signed identity with RFC 8785 JCS canonical JSON.

### Stats (all real, all public)
- 1,211,488 security checks performed
- 9,248 MCP skills analyzed
- 1,030 threats detected
- 80 quarantined (critical — blocked from listing)
- 8,288 verified safe (score >= 8)
- 257 gVisor sandbox runs
- 57 Agent Trust Cards issued

### MCP Config
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

### Tools exposed (12, all `marketnow_*`)
1. `marketnow_search_skills` — keyword/category/price-bounded search
2. `marketnow_get_skill` — full skill detail by ID/slug
3. `marketnow_list_categories` — marketplace taxonomy with counts
4. `marketnow_get_manifest` — marketplace metadata + security metrics
5. `marketnow_get_install_command` — npx install command for a skill
6. `marketnow_verify_trust` — verify an Agent Trust Card (ATC)
7. `marketnow_verify_receipt` — verify a signed delivery proof (rcpt_)
8. `marketnow_submit_skill` — submit a GitHub repo (L1.5+L1.7 sync, L2 queued)
9. `marketnow_mint_referral` — mint ref_xxxxxxxx (5% commission)
10. `marketnow_lookup_referral` — referral stats
11. `marketnow_recommend_skills` — AI-ranked recommendations
12. `marketnow_get_owasp_compliance` — OWASP MCP Cheat Sheet compliance

### Links
- Website: https://marketnow.site
- npm: https://www.npmjs.com/package/marketnow-mcp
- GitHub: https://github.com/alicelabs-llc/marketnow
- OWASP: https://marketnow.site/api/owasp
- Audit: https://marketnow.site/api/audit-report.json
````

### Reddit Post Template (r/mcp)

**Title:** MarketNow — Security infrastructure for AI agents. 12 MCP tools backed by a 10-layer Sentinel audit pipeline (1.2M checks, 80 quarantined). v1.9.0 with full OWASP MCP Cheat Sheet compliance matrix.

**Body:**
```
Hey r/mcp — I want to share MarketNow, which has fundamentally changed
since the last time I posted.

We repositioned from "MCP marketplace" to **security infrastructure
for AI agents**. The marketplace (9,248 skills, all free to install)
is distribution; the product is Sentinel — a 10-layer security audit
pipeline.

**Verified stats (all public at /api/audit-report.json):**
- 1,211,488 security checks performed
- 9,248 MCP skills analyzed
- 1,030 threats detected
- 80 quarantined (critical — blocked from listing)
- 8,288 verified safe (score >= 8)
- 257 gVisor sandbox runs
- 57 Agent Trust Cards issued (Ed25519, RFC 8032)

**MCP Server v1.9.0 — 12 tools, all `marketnow_*` namespaced:**
1. marketnow_search_skills
2. marketnow_get_skill
3. marketnow_list_categories
4. marketnow_get_manifest
5. marketnow_get_install_command
6. marketnow_verify_trust
7. marketnow_verify_receipt
8. marketnow_submit_skill
9. marketnow_mint_referral
10. marketnow_lookup_referral
11. marketnow_recommend_skills
12. marketnow_get_owasp_compliance (NEW — OWASP MCP Cheat Sheet matrix)

**Agent contract — 4 golden rules:**
- A. Deterministic `marketnow_` snake_case tool names
- B. Intent-oriented descriptions (WHEN/WHY, not WHAT)
- C. Strict JSON-Schema (type + enum + pattern + bounds)
- D. Structured `{ content, isError }` responses with error code taxonomy

**OWASP MCP Cheat Sheet compliance:**
- 4 controls LIVE: tool fingerprinting (SHA-256), capability declarations,
  least-privilege policy, structured error responses
- 8 controls PLANNED for v5.1-v6.0 (see ROADMAP.md in the repo)
- Public matrix: GET https://marketnow.site/api/owasp

**Try it:**
- npm: https://www.npmjs.com/package/marketnow-mcp
- Install: `npx -y marketnow-mcp`
- Audit report: https://marketnow.site/api/audit-report.json
- OWASP matrix: https://marketnow.site/api/owasp

Would love feedback — especially from anyone building MCP-consuming agents
who has hit the "tool ambiguity → JSON generation failure" problem.
v1.9.0 is the release that finally fixed it for us.
```

---

## Anthropic / Google / OpenAI — Clarification

- **Anthropic** doesn't have a public directory, but they maintain the official MCP servers list at https://github.com/modelcontextprotocol/servers — submit a PR there.
- **Google** doesn't have an MCP directory. Vertex AI Agent Builder uses MCP but doesn't list third-party servers publicly.
- **OpenAI** doesn't support MCP natively in ChatGPT (as of mid-2026). When they do, MarketNow will be ready since we already have the MCP server.

---

## Action Plan (Priority Order)

### Week 1 — Quick wins
1. ✅ Email mcp.so to update outdated listing (use template above)
2. ✅ Submit to Smithery (sign up + form)
3. ✅ PR to modelcontextprotocol/servers (official Anthropic list)
4. ✅ PR to modelcontextprotocol/registry (official registry)
5. ✅ PR to yzfly/awesome-mcp-zh (Chinese audience)
6. ✅ Submit to mcpmarket.com/sell
7. ✅ Post on r/mcp, r/ClaudeAI, r/MCPservers

### Week 2 — Chinese expansion
8. ✅ Submit to mcp-cn.com
9. ✅ Submit to ModelScope MCP 广场 (Alibaba)
10. ✅ Article on Zhihu (Chinese Quora)
11. ✅ PR to patriksimek/awesome-mcp-servers-2
12. ✅ PR to abordage/awesome-mcp

### Week 3 — European + enterprise
13. ✅ Contact Higress
14. ✅ Contact JFrog (Universal MCP Registry)
15. ✅ Contact Syncfusion
16. ✅ Submit to MCP.Directory
17. ✅ Submit to MCPBundles

### Ongoing
- Monitor each directory for accuracy
- Re-submit when major updates happen (e.g. v1.10.0 release)
- Track inbound traffic from each directory
