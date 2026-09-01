# Universal Trust Adapter (UTA)

> O USB-C da confiança entre agentes de IA. Verifica credenciais em 8 formatos através de um pipeline de 12 etapas.

[English](./README.md) · [Español](./README.es.md) · **Português** · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [日本語](./README.ja.md) · [中文](./README.zh.md) · [Русский](./README.ru.md)

## O problema

Quando um agente de IA invoca uma ferramenta — um MCP server, uma API interna, um microserviço — não há forma canônica de responder a três perguntas básicas:

1. **Quem emitiu a credencial** dessa ferramenta?
2. **Até quando é válida**?
3. **Qual o escopo**?

Cada padrão (OAuth, X.509, W3C VC, MCP Cards, etc.) responde de forma diferente. UTA unifica.

## 8 formatos suportados

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

## Pipeline de 12 etapas

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Início rápido

### API pública

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{"card": "...sua credencial..."}'
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

## Snippets em 14 linguagens

Veja [`snippets/`](./snippets/) — exemplos em Node.js, Python, Bash, Rust, Go, Ruby, PHP, Java, C#, Elixir, Swift, Kotlin, Lua, Deno.

## Benchmarks

- **6.744 verificações/segundo** (single core)
- **480+ testes** em Node.js
- **23 testes de propriedade** (conformance suite)

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Issues: https://github.com/alicelabs-llc/universal-trust-adapter/issues

## Licença

Veja [LICENSE](./LICENSE).
