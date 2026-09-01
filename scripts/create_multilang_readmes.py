#!/usr/bin/env python3
"""
Generate multi-language README files (ES, PT, FR, DE, JA, ZH, RU) for the UTA repo.
Also generate ready-to-post content for 15+ external platforms.
"""
import os
import json

OUT_DIR = "/home/z/my-project/download/promotion/platforms"
README_DIR = "/home/z/my-project/uta-repo"
os.makedirs(OUT_DIR, exist_ok=True)

# ============================================================
# MULTI-LANGUAGE README FILES
# ============================================================

READMES = {
    "README.es.md": """# Universal Trust Adapter (UTA)

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
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
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
""",
    "README.pt.md": """# Universal Trust Adapter (UTA)

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
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
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
""",
    "README.fr.md": """# Universal Trust Adapter (UTA)

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
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
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
""",
    "README.de.md": """# Universal Trust Adapter (UTA)

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
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
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
""",
    "README.ja.md": """# Universal Trust Adapter (UTA)

> AIエージェント間の信頼のためのUSB-C。8つの形式のクレデンシャルを12段階のパイプラインで検証します。

[English](./README.md) · [Español](./README.es.md) · [Português](./README.pt.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · **日本語** · [中文](./README.zh.md) · [Русский](./README.ru.md)

## 問題

AIエージェントがツール（MCPサーバー、内部API、マイクロサービス）を呼び出す際、以下の3つの基本的な質問に答える正統な方法がありません：

1. **そのツールのクレデンシャルを誰が発行したか**？
2. **いつまで有効か**？
3. **スコープは何か**？

各標準（OAuth、X.509、W3C VC、MCP Cardsなど）は異なる方法で答えます。UTAはこれを統一します。

## サポートする8つの形式

| # | 形式 | 由来 |
|---|------|------|
| 1 | ATC v3 (Agent Trust Card) | AliceLabsの提案 |
| 2 | JWT (`x5c` chain付き) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | ZTAバリアント |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

## 12段階のパイプライン

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## クイックスタート

### 公開API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "...あなたのクレデンシャル..."}'
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

## 14言語のスニペット

[`snippets/`](./snippets/) を参照 — Node.js、Python、Bash、Rust、Go、Ruby、PHP、Java、C#、Elixir、Swift、Kotlin、Lua、Denoの例。

## ベンチマーク

- **6,744検証/秒**（シングルコア）
- **480+テスト**（Node.js）
- **23プロパティテスト**（適合スイート）

## リンク

- リポジトリ: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Issues: https://github.com/alicelabs-llc/universal-trust-adapter/issues

## ライセンス

[LICENSE](./LICENSE) を参照。
""",
    "README.zh.md": """# Universal Trust Adapter (UTA)

> AI 代理之间信任的 USB-C。通过 12 阶段管道验证 8 种格式的凭证。

[English](./README.md) · [Español](./README.es.md) · [Português](./README.pt.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [日本語](./README.ja.md) · **中文** · [Русский](./README.ru.md)

## 问题

当 AI 代理调用工具（MCP 服务器、内部 API、微服务）时，没有标准方式回答三个基本问题：

1. **谁颁发**了这个工具的凭证？
2. **有效期到何时**？
3. **范围是什么**？

每个标准（OAuth、X.509、W3C VC、MCP Cards 等）回答方式不同。UTA 统一它们。

## 支持的 8 种格式

| # | 格式 | 来源 |
|---|------|------|
| 1 | ATC v3 (Agent Trust Card) | AliceLabs 提议 |
| 2 | JWT (带 `x5c` 链) | IETF RFC 7519 |
| 3 | W3C Verifiable Credentials | W3C VC Data Model |
| 4 | A2A (Agent-to-Agent) cards | Google A2A Protocol |
| 5 | EAT-AI (Entity Attestation Tokens) | IETF RATS |
| 6 | ZTA (Zero Trust Agent) cards | ZTA 变体 |
| 7 | MCP Server Cards | Anthropic MCP |
| 8 | X.509 certificates | ITU-T |

## 12 阶段管道

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## 快速开始

### 公共 API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "...你的凭证..."}'
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

## 14 种语言的代码片段

参见 [`snippets/`](./snippets/) — Node.js、Python、Bash、Rust、Go、Ruby、PHP、Java、C#、Elixir、Swift、Kotlin、Lua、Deno 的示例。

## 基准测试

- **每秒 6,744 次验证**（单核）
- **480+ 测试**（Node.js）
- **23 属性测试**（一致性套件）

## 链接

- 仓库: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Issues: https://github.com/alicelabs-llc/universal-trust-adapter/issues

## 许可证

参见 [LICENSE](./LICENSE)。
""",
    "README.ru.md": """# Universal Trust Adapter (UTA)

> USB-C для доверия между ИИ-агентами. Проверяет учётные данные в 8 форматах через 12-этапный конвейер.

[English](./README.md) · [Español](./README.es.md) · [Português](./README.pt.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [日本語](./README.ja.md) · [中文](./README.zh.md) · **Русский**

## Проблема

Когда ИИ-агент вызывает инструмент — MCP-сервер, внутренний API, микросервис — нет канонического способа ответить на три основных вопроса:

1. **Кто выпустил** учётные данные этого инструмента?
2. **До какого срока они действительны**?
3. **Какова область действия**?

Каждый стандарт (OAuth, X.509, W3C VC, MCP Cards и т.д.) отвечает по-разному. UTA унифицирует их.

## 8 поддерживаемых форматов

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

## 12-этапный конвейер

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## Быстрый старт

### Публичный API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "...ваши учётные данные..."}'
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

## Сниппеты на 14 языках

См. [`snippets/`](./snippets/) — примеры на Node.js, Python, Bash, Rust, Go, Ruby, PHP, Java, C#, Elixir, Swift, Kotlin, Lua, Deno.

## Бенчмарки

- **6 744 проверки/сек** (одно ядро)
- **480+ тестов** в Node.js
- **23 теста свойств** (конформационный набор)

## Ссылки

- Репозиторий: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Issues: https://github.com/alicelabs-llc/universal-trust-adapter/issues

## Лицензия

См. [LICENSE](./LICENSE).
""",
}

for fname, content in READMES.items():
    path = os.path.join(README_DIR, fname)
    with open(path, "w") as f:
        f.write(content)
    print(f"  ✅ {fname}")

print(f"\n  Total: {len(READMES)} multilingual READMEs created")
