# MarketNow — MCPサーバーマーケットプレース（セキュリティ優先）

> MarketNowはMCP（Model Context Protocol）サーバーのセキュリティ優先マーケットプレースです。9,248個の監査済みスキル、10層のセキュリティ監査パイプライン、Ed25519署名のエージェントトラストカード（ATC）、Vibeとの相互検証。

## すべて無料

| 機能 | 価格 |
|------|------|
| 全9,248スキル | 無料 |
| 10層セキュリティ監査 | 無料 |
| エージェントトラストカード（ATC） | 無料 |
| アクションレシート | 無料 |
| MCPサーバー（11ツール） | 無料 |
| サーバー提出 | 無料 |
| L2 Dockerサンドボックス監査 | 無料 |

## MCPサーバーを提出する

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

## リンク

- ウェブサイト: https://marketnow.site
- 提出: https://marketnow.site/submit
- 仕様: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm: `npx -y marketnow-mcp@1.7.0`
