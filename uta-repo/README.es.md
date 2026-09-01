# Universal Trust Adapter (UTA)

> El USB-C de la confianza entre agentes IA. Verifica credenciales en 8 formatos a través de un pipeline de 12 etapas.

[English](./README.md) · **Español** · [Português](./README.pt.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [日本語](./README.ja.md) · [中文](./README.zh.md) · [Русский](./README.ru.md)

## El problema

Cuando un agente IA invoca un tool — un MCP server, una API interna, un microservicio — no hay forma canónica de responder a tres preguntas básicas:

1. **¿Quién emitió la credencial** de ese tool?
2. **¿Hasta cuándo es válida**?
3. **¿Qué scope tiene**?

Cada estándar (OAuth, X.509, W3C VC, MCP Cards, etc.) responde la pregunta de manera distinta. UTA los unifica.

## 8 formatos soportados

| # | Formato | Origen |
|---|---------|--------|
| 1 | ATC v3 (Agent Trust Card) | Propuesta de AliceLabs |
| 2 | JWT (con `x5c` chain) | IETF RFC 7519 |
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

## Inicio rápido

### API pública

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{"card": "...tu credencial..."}'
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

## Snippets en 14 lenguajes

Ver [`snippets/`](./snippets/) — ejemplos en Node.js, Python, Bash, Rust, Go, Ruby, PHP, Java, C#, Elixir, Swift, Kotlin, Lua, Deno.

## Benchmarks

- **6,744 verificaciones/segundo** (single core)
- **480+ tests** en Node.js
- **23 property tests** (conformance suite)

## Enlaces

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Issues: https://github.com/alicelabs-llc/universal-trust-adapter/issues

## Licencia

Ver [LICENSE](./LICENSE).
