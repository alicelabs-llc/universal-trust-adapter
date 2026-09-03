# MarketNow — Directory Submission Kit

## 1. mcp.directory/submit (mejor impacto, auto-pull)
1. Abrir https://mcp.directory/submit
2. Ingresar GitHub URL: `https://github.com/alicelabs-llc/marketnow`
3. Ellos auto-detectan: name, description, stars, README → publicado en 24h

---

## 2. mcp.so/submit

| Campo | Valor |
|---|---|
| **Type** | MCP Server |
| **Name** | MarketNow Skills Marketplace |
| **URL** | `https://github.com/alicelabs-llc/marketnow` |
| **Server Config** | Ver JSON abajo |

```json
{
  "marketnow-search": {
    "command": "",
    "url": "https://marketnow.site/mcp/sse",
    "type": "sse",
    "description": "9,248 MCP skills with Sentinel verification"
  }
}
```

---

## 3. PulseMCP (pulsemcp.com/servers)
1. Abrir https://pulsemcp.com
2. Click "Submit" en la nav (requiere login)
3. Datos:
   - Name: `MarketNow Skills Marketplace`
   - Description: `Search and discover 9,248 MCP-compatible skills with Sentinel security verification`
   - Endpoint: `https://marketnow.site/mcp/sse`
   - Website: `https://marketnow.site`

---

## server.json (ya desplegado)
`https://marketnow.site/api/server.json`
→ Incluido en la repo como `public/api/server.json`

## MCP Endpoint (ya funcional desde mi edge)
- SSE: `https://marketnow.site/mcp/sse` ✅
- Messages: `POST https://marketnow.site/mcp/messages` ✅
- Tools: `search_skills`, `get_skill`, `list_categories`
