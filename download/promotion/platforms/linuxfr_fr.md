<!-- Platform: linuxfr.org (French dev platform, equivalent of HN for FR) -->
<!-- Submission type: journal/article -->
<!-- Language: French -->
<!-- Tags: sécurité, IA, chiffrement -->

# Universal Trust Adapter : le USB-C de la confiance entre agents IA

## Le problème

Quand un agent IA invoque un outil — un MCP server, une API interne, un microservice — il n'existe pas de façon canonique de répondre à trois questions fondamentales :

1. **Qui a émis la crédential** de cet outil ?
2. **Jusqu'à quand est-elle valide** ?
3. **Quel est son scope** ?

Chaque standard (OAuth, X.509, W3C VC, MCP Cards, etc.) répond différemment. UTA unifie.

## La solution : UTA

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA accepte **8 formats de crédentials** :

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

Et les traite via un pipeline de **12 étapes** :

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Utilisation

### API publique

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{{"card": "...votre crédential..."}}'
```

### NPM

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';
const result = await verify(card);
// result.decision: 'PERMIT' | 'DENY' | 'UNDETERMINED'
```

## Benchmarks

- **6 744 vérifications/seconde** (single core)
- **480+ tests** en Node.js
- **23 tests de propriété**

## Documentation en français

README français : https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.fr.md

## Pourquoi cela compte en francophonie

La francophonie tech est vive — Paris, Montréal, Bruxelles, Genève, Tunis, Dakar. Les startups francophones construisent des agents IA pour la finance, la santé, l'éducation. Dans tous ces secteurs, **la confiance entre agents n'est pas optionnelle**.

## Liens

- Repo : https://github.com/alicelabs-llc/universal-trust-adapter
- API : https://www.marketnow.site/api/trust
- Snippets en 14 langages : https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Licence

Apache 2.0
