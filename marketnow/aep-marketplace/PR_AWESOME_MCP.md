# PR para awesome-mcp-servers

## Fork & PR Instructions

1. Ve a https://github.com/punkpeye/awesome-mcp-servers
2. Click **Fork** (top-right)
3. En tu fork, edita `README.md`
4. Busca la sección `## Marketplaces`
5. Agrega esta línea:

```markdown
- [AEP — Agent Exchange Protocol](https://marketnow.site) - Verified MCP skill marketplace, 13k+ skills, secured by Sentinel automated security scans. Open registry with agent-to-agent crypto payments.
```

6. Commit a tu fork
7. Crea Pull Request desde tu fork al repo original

---

## Título del PR sugerido

```
feat: add AEP (Agent Exchange Protocol) to Marketplaces
```

## Descripción del PR

```
## Description

Adds [AEP — Agent Exchange Protocol](https://marketnow.site) to the Marketplaces category.

### Why AEP belongs here

- **9,248 MCP-compatible skills** - Largest open MCP skill registry
- **Sentinel security scans** - Every skill is automatically scanned for malicious code, hardcoded secrets, license compliance (L1 static analysis)
- **Working MCP endpoint** - `.well-known/mcp.json` discovery + `/api/mcp` JSON-RPC SSE endpoint with `search_skills`, `get_skill`, `get_categories`, and `health` tools
- **Badge ecosystem** - Creators can embed `[![Sentinel Verified](https://marketnow.site/badge/{slug}.svg)](https://marketnow.site/skill/{slug})` in their READMEs
- **Agent-to-agent payments** - Skills support crypto checkout (ETH, BSC, SOL, BTC) with on-chain verification
- **Fully open** - No approval needed to list; automated Sentinel verification on submission
- **SSR pages** - Each skill has its own indexable page with meta tags, OG tags, and canonical URLs

### Verification

```
GET /.well-known/mcp.json → 200, valid MCP discovery JSON
POST /api/mcp (tools/list) → 200, 4 tools including search_skills
GET /badge/{slug}.svg → 200, inline SVG badge with Sentinel score
```

### Details

- Site: https://marketnow.site
- MCP Endpoint: https://marketnow.site/api/mcp
- Skills Catalog: https://marketnow.site/skills
- Security Dashboard: https://marketnow.site/security
```

---

## Markdown Exacto (una línea para copiar)

```markdown
- [AEP — Agent Exchange Protocol](https://marketnow.site) - Verified MCP skill marketplace, 13k+ skills, secured by Sentinel automated security scans. Open registry with agent-to-agent crypto payments.
```
