# Universal Trust Adapter (UTA)

> Le USB-C de la confiance entre agents IA. Vérifie les crédentials en 8 formats via un pipeline de 12 étapes.

[English](./README.md) · [Español](./README.es.md) · [Português](./README.pt.md) · **Français** · [Deutsch](./README.de.md) · [日本語](./README.ja.md) · [中文](./README.zh.md) · [Русский](./README.ru.md)

## Le problème

Quand un agent IA invoque un outil — un MCP server, une API interne, un microservice — il n'existe pas de façon canonique de répondre à trois questions fondamentales :

1. **Qui a émis la crédential** de cet outil ?
2. **Jusqu'à quand est-elle valide** ?
3. **Quel est son scope** ?

Chaque standard (OAuth, X.509, W3C VC, MCP Cards, etc.) répond différemment. UTA unifie.

## 8 formats supportés

| # | Format | Origine |
|---|--------|---------|
| 1 | ATC v3 (Agent Trust Card) | Proposition d'AliceLabs |
| 2 | JWT (avec `x5c` chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Variante ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

## Pipeline de 12 étapes

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Démarrage rapide

### API publique

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{"card": "...votre crédential..."}'
```

### NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import { verify } from '@marketnow/trust-core';
const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

## Snippets en 14 langages

Voir [`snippets/`](./snippets/) — exemples en Node.js, Python, Bash, Rust, Go, Ruby, PHP, Java, C#, Elixir, Swift, Kotlin, Lua, Deno.

## Benchmarks

- **6 744 vérifications/seconde** (single core)
- **480+ tests** en Node.js
- **23 tests de propriété** (conformance suite)

## Liens

- Repo : https://github.com/alicelabs-llc/universal-trust-adapter
- API : https://www.marketnow.site/api/trust
- Issues : https://github.com/alicelabs-llc/universal-trust-adapter/issues

## Licence

Voir [LICENSE](./LICENSE).
