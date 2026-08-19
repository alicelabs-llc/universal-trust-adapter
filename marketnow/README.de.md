# MarketNow — MCP-Server-Marktplatz (Sicherheit zuerst)

> MarketNow ist ein sicherheitsorientierter Marktplatz für MCP-Server (Model Context Protocol). 9.248 geprüfte Skills, 10-Schicht-Sicherheits-Pipeline, Ed25519-signierte Agent Trust Cards (ATC).

## Alles kostenlos

| Funktion | Preis |
|----------|-------|
| Alle 9.248 Skills | 0€ |
| 10-Schicht-Sicherheitsaudit | 0€ |
| Agent Trust Card (ATC) | 0€ |
| MCP-Server (11 Tools) | 0€ |
| Server einreichen | 0€ |
| L2 Docker-Sandbox-Audit | 0€ |

## MCP-Server einreichen

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/dein-username/dein-mcp-server"}'
```

## Links

- Webseite: https://marketnow.site
- Einreichen: https://marketnow.site/submit
- Spezifikation: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm: `npx -y marketnow-mcp@1.7.0`
