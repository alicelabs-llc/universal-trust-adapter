# Universal Trust Adapter (UTA)

> Das USB-C der Vertrauensstellung zwischen KI-Agenten. Verifiziert Credentials in 8 Formaten durch eine 12-stufige Pipeline.

[English](./README.md) · [Español](./README.es.md) · [Português](./README.pt.md) · [Français](./README.fr.md) · **Deutsch** · [日本語](./README.ja.md) · [中文](./README.zh.md) · [Русский](./README.ru.md)

## Das Problem

Wenn ein KI-Agent ein Tool aufruft — einen MCP-Server, eine interne API, einen Microservice — gibt es keine kanonische Möglichkeit, drei grundlegende Fragen zu beantworten:

1. **Wer hat die Credentials** für dieses Tool ausgestellt?
2. **Bis wann sind sie gültig**?
3. **Welchen Scope haben sie**?

Jeder Standard (OAuth, X.509, W3C VC, MCP Cards, etc.) beantwortet die Frage unterschiedlich. UTA vereinheitlicht.

## 8 unterstützte Formate

| # | Format | Ursprung |
|---|--------|----------|
| 1 | ATC v3 (Agent Trust Card) | AliceLabs-Vorschlag |
| 2 | JWT (mit `x5c`-Chain) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) Cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) Cards | ZTA-Variante |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509-Zertifikate | ITU-T |

## 12-stufige Pipeline

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Schnellstart

### Öffentliche API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{"card": "...Ihre Credential..."}'
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

## Snippets in 14 Sprachen

Siehe [`snippets/`](./snippets/) — Beispiele in Node.js, Python, Bash, Rust, Go, Ruby, PHP, Java, C#, Elixir, Swift, Kotlin, Lua, Deno.

## Benchmarks

- **6.744 Verifizierungen/Sekunde** (single core)
- **480+ Tests** in Node.js
- **23 Property-Tests** (Conformance-Suite)

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Issues: https://github.com/alicelabs-llc/universal-trust-adapter/issues

## Lizenz

Siehe [LICENSE](./LICENSE).
