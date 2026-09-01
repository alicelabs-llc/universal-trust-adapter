<!-- Platform: habr.com (Russian dev platform, ~20M monthly users) -->
<!-- Submission type: article -->
<!-- Language: Russian -->
<!-- Hub: Information Security, AI, Programming -->

# Universal Trust Adapter: USB-C для доверия между ИИ-агентами

## Проблема

Когда ИИ-агент вызывает инструмент — MCP-сервер, внутренний API, микросервис — нет канонического способа ответить на три основных вопроса:

1. **Кто выпустил** учётные данные этого инструмента?
2. **До какого срока они действительны**?
3. **Какова область действия**?

Каждый стандарт (OAuth, X.509, W3C VC, MCP Cards и т.д.) отвечает по-разному. UTA унифицирует их.

## Что такое UTA

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

Поддерживает **8 форматов** учётных данных:

| # | Формат | Источник |
|---|--------|----------|
| 1 | ATC v3 (Agent Trust Card) | Предложение AliceLabs |
| 2 | JWT (с цепочкой `x5c`) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | Вариант ZTA |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

И обрабатывает их через **12-этапный конвейер**:

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Использование

### Публичный API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{{"card": "...ваши учётные данные..."}}'
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

## Бенчмарки

- **6 744 проверки/сек** (одно ядро)
- **480+ тестов** в Node.js
- **23 теста свойств** (конформационный набор)

## Документация на русском

README русская версия: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.ru.md

## Ссылки

- Репозиторий: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Сниппеты на 14 языках: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## Лицензия

Apache 2.0
