<!-- Platform: heise.de (German tech news, ~20M monthly users) -->
<!-- Submission type: forum post / news tip -->
<!-- Language: German -->
<!-- Section: Security, Developer -->

# Universal Trust Adapter: Das USB-C der Vertrauensstellung zwischen KI-Agenten

## Das Problem

Wenn ein KI-Agent ein Tool aufruft — einen MCP-Server, eine interne API, einen Microservice — gibt es keine kanonische Möglichkeit, drei grundlegende Fragen zu beantworten:

1. **Wer hat die Credentials** für dieses Tool ausgestellt?
2. **Bis wann sind sie gültig**?
3. **Welchen Scope haben sie**?

Jeder Standard (OAuth, X.509, W3C VC, MCP Cards, etc.) beantwortet die Frage unterschiedlich. UTA vereinheitlicht.

## Die Lösung: UTA

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

UTA akzeptiert **8 Credential-Formate**:

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

Und verarbeitet sie durch eine **12-stufige Pipeline**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Verwendung

### Öffentliche API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{{"card": "...Ihre Credential..."}}'
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

- **6.744 Verifizierungen/Sekunde** (single core)
- **480+ Tests** in Node.js
- **23 Property-Tests**

## Deutsche Dokumentation

README deutsch: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.de.md

## Warum das im DACH-Raum zählt

Der DACH-Raum hat eine der stärksten Tech-Communitys Europas. Deutsche, österreichische und Schweizer Startups bauen KI-Agenten für Industrie 4.0, Finanzwesen, Gesundheit. In all diesen Sektoren ist **Vertrauen zwischen Agenten nicht optional**.

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Snippets in 14 Sprachen: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Lizenz

Apache 2.0
