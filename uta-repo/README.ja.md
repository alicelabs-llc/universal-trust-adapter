# Universal Trust Adapter (UTA)

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
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
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
