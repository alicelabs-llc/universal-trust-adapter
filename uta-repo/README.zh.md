# Universal Trust Adapter (UTA)

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
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
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
