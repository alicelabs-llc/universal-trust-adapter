# MarketNow — mcp.so Listing Instructions

> **Status: MANUAL UPDATE REQUIRED**
>
> The mcp.so listing is OUTDATED. It still describes MarketNow as a marketplace with 13K+ skills and crypto payments. The current positioning (v5.0.0) is **Security Infrastructure for AI Agents** with the Sentinel audit pipeline. Use the copy below when contacting mcp.so or any other directory.

mcp.so has Cloudflare protection that blocks automated submissions. Submit manually.

---

## Steps

1. Go to https://mcp.so/submit (or look for the "Submit" / "Add Server" button on the homepage). If you already have a listing (we do), use the "Update" / "Edit" flow.

2. Fill in the form with these values:

### Server Name
```
MarketNow — Security Infrastructure for AI Agents
```

### Tagline / Short Description
```
12 MCP tools (marketnow_* namespace) backed by Sentinel — a 10-layer security audit pipeline that has run 1.2M checks, detected 1,030 threats, and quarantined 80 malicious skills.
```

### Full Description
```
MarketNow is NOT a marketplace. It is security infrastructure for AI agents.

The marketplace (9,248 MCP skills, all free to install) is distribution.
The product is Sentinel — a 10-layer security audit pipeline that determines
whether AI agents should be allowed to trust and execute tools.

10-LAYER AUDIT PIPELINE
  L1.5  Metadata analysis (auth, CORS, OAuth, rate limiting)        [static]
  L1.6  Semgrep rules + secret detection + OSV dependency scan     [static]
  L1.7  Malware pattern detection (binary launchers, install scripts) [static]
  L1.8  Malware family signatures (48 YARA-equivalent rules)       [static]
  L1.9  Prompt injection screening (32 rules, 10 categories)       [static]
  L2.5  gVisor sandbox (network=none, read-only, cap-drop ALL)     [dynamic]
  L3    Runtime MCP Interceptor (real-time JSON-RPC guardrail)      [runtime]
  ATC   Agent Trust Card (Ed25519, RFC 8032, RFC 8785 JCS)         [identity]
  x402  Streaming metered billing ($0.01 USDC per call on Base)    [payment]
  A2A   Remote agent execution                                    [execution]

VERIFIED STATS (all real, all public at /api/audit-report.json)
  - 1,211,488 security checks performed
  - 9,248 MCP skills analyzed
  - 1,030 threats detected
  - 80 skills quarantined (critical risk — blocked from listing)
  - 71 flagged risky
  - 879 flagged caution
  - 8,288 verified safe (score >= 8)
  - 257 gVisor sandbox runs
  - 57 Agent Trust Cards issued
  - 5 runtime interceptor policy rules live

THE MCP SERVER (v1.9.0 — Agent Contract Hardening)
The npm package `marketnow-mcp@1.9.0` exposes 12 tools, all under the
`marketnow_*` namespace prefix for unambiguous tool choice by Claude
Desktop, Cursor, Cline, LangChain, and LlamaIndex agents:

  1.  marketnow_search_skills        — keyword/category/price-bounded search
  2.  marketnow_get_skill           — full skill detail by ID/slug
  3.  marketnow_list_categories     — marketplace taxonomy with counts
  4.  marketnow_get_manifest        — marketplace metadata + security metrics
  5.  marketnow_get_install_command — npx install command for a skill
  6.  marketnow_verify_trust        — verify an Agent Trust Card (ATC)
  7.  marketnow_verify_receipt      — verify a signed delivery proof (rcpt_)
  8.  marketnow_submit_skill         — submit a GitHub repo (L1.5+L1.7 sync, L2 queued)
  9.  marketnow_mint_referral       — mint ref_xxxxxxxx (5% commission)
  10. marketnow_lookup_referral     — referral stats
  11. marketnow_recommend_skills   — AI-ranked skill recommendations for a task
  12. marketnow_get_owasp_compliance — OWASP MCP Cheat Sheet (12 controls) + tool fingerprints + capability manifest

The 12 tools follow four golden rules (see AUDIT.md inside the npm package):
  A. Deterministic `marketnow_` snake_case names
  B. Intent-oriented descriptions (WHEN/WHY, not WHAT)
  C. Strict JSON-Schema (type + enum + pattern + bounds, no `any`)
  D. Structured `{ content, isError }` responses with error code taxonomy

OWASP MCP CHEAT SHEET COMPLIANCE
  - 4 controls LIVE: tool fingerprinting (SHA-256), capability declarations,
    least-privilege policy, structured error responses
  - 8 controls PLANNED for v5.1-v6.0 (see ROADMAP.md)
  - Public matrix: GET https://marketnow.site/api/owasp

PRICING
  Free          $0          Basic Sentinel scan + trust score + public report
  Developer     $49-99      Deep audit + signed report
  Professional  $199-499    Runtime testing + Trust Card + re-audit
  Continuous    $99-499/mo  Monitoring + CVE tracking + auto re-audit
  Enterprise    $5k-50k+/yr Private audits + API + SLA

INSTALL
  npm install -g marketnow-mcp
  npx -y marketnow-mcp
```

### Website URL
```
https://marketnow.site
```

### GitHub Repository
```
https://github.com/alicelabs-llc/marketnow
```

### Categories
```
Security, Marketplace, Aggregator, Certification, Infrastructure
```

### Tags
```
mcp, security, sentinel, audit, owasp, ed25519, agent-trust, tool-fingerprinting, capability-manifest, interceptor, sandbox, gvisor
```

### Install Command
```
npx -y marketnow-mcp
```

### Logo / Icon
Use the MarketNow favicon: https://marketnow.site/favicon.svg

### Features to highlight
- ✅ 12 MCP tools under `marketnow_*` namespace (v1.9.0)
- ✅ 10-layer Sentinel security audit pipeline (L1.5 → L3)
- ✅ 1,211,488 security checks performed (real, public)
- ✅ 80 malicious skills quarantined (transparency report)
- ✅ Agent Trust Card — Ed25519 (RFC 8032), RFC 8785 JCS canonical JSON
- ✅ Runtime MCP Interceptor — 5 policy rules, blocks `.env` / `rm -rf` / process spawns
- ✅ OWASP MCP Cheat Sheet compliance (12 controls, 4 live)
- ✅ Tool fingerprinting (SHA-256) + capability manifest (filesystem/network/shell/credentials/process)
- ✅ x402 streaming payments (USDC on Base, $0.01/call)
- ✅ Strict JSON-Schemas (type + enum + pattern + bounds)
- ✅ Structured `{ content, isError }` error envelope (no stack leaks)
- ✅ 5 languages (EN, ES, PT, ZH, FR)

---

## What's WRONG with the current mcp.so listing (must be fixed)

The current listing (https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y) shows:

| Field | Current (WRONG) | Should be |
|-------|-----------------|-----------|
| Tagline | "9,248 verified MCP-compatible skills" | "Security infrastructure for AI agents — 12 MCP tools backed by Sentinel" |
| Stats | "9,248 skills" | 9,248 skills analyzed, 1,211,488 checks, 80 quarantined |
| Pricing | "Crypto payments (ETH/BSC/SOL/BTC)" | "Free / $49-99 / $199-499 / $99-499/mo / $5k-50k+/yr" |
| Tools | "Transport: SSE/WebSocket/JSON-RPC" | "Transport: stdio only (via `npx marketnow-mcp`)" |
| Config | `"url": "https://marketnow.site/api/mcp"` | `{"mcpServers":{"marketnow":{"command":"npx","args":["-y","marketnow-mcp"]}}}` |
| Tool count | "5 tools" | "12 tools (all `marketnow_*` namespaced)" |

---

## After update

1. mcp.so may take 24–48 hours to reflect changes
2. Verify by visiting the listing URL
3. Share the updated listing on social media
4. Add the mcp.so badge to the homepage

---

## Alternative directories to submit/update

- [x] mcp.so — https://mcp.so/server/marketnow-mcp---aep-agent-exchange-protocol/edgarfloresguerra2011-a11y (UPDATE NEEDED)
- [ ] chat.mcp.so — mirror, updates with mcp.so
- [x] glama.ai — https://glama.ai/mcp/connectors?query=MarketNow+MCP (verify data)
- [x] npm — https://www.npmjs.com/package/marketnow-mcp (auto-updated to v1.9.0)
- [ ] Smithery — https://smithery.ai
- [ ] OpenTools — https://opentools.ai
- [ ] Product Hunt (for v5.0 launch)
- [ ] MCP Registry (official) — https://registry.modelcontextprotocol.io
- [ ] Anthropic MCP servers list — https://github.com/modelcontextprotocol/servers
- [ ] Awesome MCP Servers (patriksimek) — https://github.com/patriksimek/awesome-mcp-servers-2
- [ ] Awesome MCP (abordage) — https://github.com/abordage/awesome-mcp
- [ ] Awesome-MCP-ZH — https://github.com/yzfly/awesome-mcp-zh
