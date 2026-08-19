# MarketNow — Marché de serveurs MCP (sécurité d'abord)

> MarketNow est un marché de serveurs MCP (Model Context Protocol) axé sur la sécurité. 9 248 compétences auditées, pipeline d'audit à 10 couches, cartes de confiance Ed25519 (ATC), vérification croisée avec Vibe.

## Tout est gratuit

| Fonction | Prix |
|----------|------|
| Les 9 248 compétences | 0€ |
| Audit de sécurité à 10 couches | 0€ |
| Carte de confiance (ATC) | 0€ |
| Reçus signés | 0€ |
| Serveur MCP (11 outils) | 0€ |
| Soumettre votre serveur | 0€ |
| Audit sandbox L2 Docker | 0€ |

## Soumettre votre serveur MCP

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/votre-username/votre-serveur-mcp"}'
```

## Liens

- Site web : https://marketnow.site
- Soumettre : https://marketnow.site/submit
- Spécifications : https://marketnow.site/api/atc?action=spec
- GitHub : https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm : `npx -y marketnow-mcp@1.7.0`
