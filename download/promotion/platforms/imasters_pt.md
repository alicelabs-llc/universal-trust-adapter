<!-- Platform: imasters.com.br (Brazilian dev platform) -->
<!-- Submission type: article -->
<!-- Language: Portuguese (Brazilian) -->
<!-- Category: Desenvolvimento, IA, Segurança -->

# Universal Trust Adapter: verificando credenciais de agentes de IA em 8 formatos

## Introdução

Quando um agente de IA invoca uma ferramenta — um MCP server, uma API interna, um microserviço — não há forma canônica de responder a três perguntas básicas:

1. **Quem emitiu a credencial** dessa ferramenta?
2. **Até quando é válida**?
3. **Qual o escopo**?

Cada padrão (OAuth, X.509, W3C VC, MCP Cards, etc.) responde de forma diferente. UTA unifica.

## O que é UTA

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

Aceita **8 formatos de credenciais**:

| # | Formato | Origem |
|---|---------|--------|
| 1 | ATC v3 (Agent Trust Card) | Proposta da AliceLabs |
| 2 | JWT (com `x5c` chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Variante ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

E processa através de um pipeline de **12 etapas**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Como usar

### API pública

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{{"card": "...sua credencial..."}}'
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

- **6.744 verificações/segundo** (single core)
- **480+ testes** em Node.js
- **23 testes de propriedade**

## Documentação em português

README em português: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.pt.md

## Por que isto importa no Brasil

O Brasil tem uma das maiores comunidades de desenvolvedores do mundo. Startups brasileiras estão construindo agentes de IA para fintech, agritech, healthtech — setores onde a **confiança entre agentes não é opcional**.

UTA foi projetado para isto: ser uma biblioteca pequena, rápida, sem dependências pesadas, que qualquer dev pode integrar em uma tarde.

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Snippets em 14 linguagens: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Licença

Apache 2.0
