<!-- Platform: qiita.com (Japanese dev platform, ~10M monthly users) -->
<!-- Submission type: article -->
<!-- Language: Japanese -->
<!-- Tags: AI, セキュリティ, 認証, MCP -->

# AIエージェントのクレデンシャル検証：8つの形式を統一する12段階パイプライン

## はじめに

AIエージェントがツール（MCPサーバー、内部API、マイクロサービス）を呼び出す際、そのツールのクレデンシャルが「誰が発行したか」「いつまで有効か」「スコープは何か」を検証する標準的な方法がありません。

各標準（OAuth、X.509、W3C VC、MCP Cardsなど）は異なる方法でこれに答えます。UTAはこれらを統一します。

## UTAとは

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

8つのクレデンシャル形式をサポート：

1. ATC v3 (Agent Trust Card)
2. JWT (`x5c` chain付き)
3. W3C Verifiable Credentials
4. A2A (Agent-to-Agent) cards
5. EAT-AI (Entity Attestation Tokens)
6. ZTA (Zero Trust Agent) cards
7. MCP Server Cards
8. X.509 certificates

12段階のパイプラインで処理：

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

## 使い方

### 公開API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{{"card": "...クレデンシャル..."}}'
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

## ベンチマーク

- **6,744検証/秒**（シングルコア）
- **480+テスト**（Node.js）
- **23プロパティテスト**（適合スイート）

## 日本語ドキュメント

README日本語版: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.ja.md

## リンク

- リポジトリ: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- スニペット（14言語）: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## ライセンス

Apache 2.0
