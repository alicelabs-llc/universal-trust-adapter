# PR: Add MarketNow to yzfly/awesome-mcp-zh

**Repo:** https://github.com/yzfly/awesome-mcp-zh
**Audience:** Chinese developers (MCP 资源精选)
**Language:** Chinese (中文)

## PR Title

```
添加 MarketNow — MCP 技能市场 (9,248 验证技能)
```

## PR Body

```markdown
## 这个 PR 做什么？

添加 [MarketNow](https://marketnow.site) 到 MCP 服务器列表. MarketNow 是 MCP 兼容代理技能的开放市场 — 允许任何代理 (Claude Desktop, Cursor, Cline) 通过 Model Context Protocol 搜索, 发现和安装 9,248 验证的 MCP 技能.

## 为什么应该添加？

MarketNow 在 MCP 生态系统中是独特的:

1. **它是一个市场, 不是一个单一工具** — 9,248 个来自多个作者的验证技能, 全部在一个 MCP 服务器中
2. **对自主代理完全免费** — 所有技能免费, 无任何付款 (无订阅)
3. **每个技能都经过 Sentinel L1 扫描** — 自动安全审计 (仓库, README, 许可证, 密钥, 恶意模式)
4. **公共 JSON API** — `/api/skills.json` 返回完整目录, 无需认证
5. **MarketNow 本身可通过 npx 安装** — `npx -y marketnow-mcp`

## 统计

- **9,248** 验证技能 (全部来自真实 GitHub 仓库)
- **25** 类别 (AI/ML, 数据, 安全, DevOps, 金融等)
- **free** 每个技能 (平均 $2.50, 一次性付款)
- **100%** 开源技能 (MIT, Apache-2.0 等)
- **npm 包:** [marketnow-mcp@1.0.1](https://www.npmjs.com/package/marketnow-mcp)

## MCP 配置

```json
{
  "mcpServers": {
    "marketnow": {
      "command": "npx",
      "args": ["-y", "marketnow-mcp"]
    }
  }
}
```

## 暴露的工具

| 工具 | 描述 |
|---|---|
| `search_skills` | 按查询, 类别或最高价格搜索 |
| `get_skill` | 按 ID 或 slug 获取完整详情 |
| `list_categories` | 所有 25 个类别及其计数 |
| `get_manifest` | 市场元数据 (总数, 定价) |
| `get_install_command` | 获取技能的安装命令 |

## 链接

- **网站:** https://marketnow.site
- **npm:** https://www.npmjs.com/package/marketnow-mcp
- **GitHub:** https://github.com/alicelabs-llc/marketnow
- **API:** https://marketnow.site/api/agent.json
- **许可证:** MIT
```

## Suggested entry in README.md (Chinese)

```markdown
### MarketNow

MCP 兼容代理技能的开放市场. 搜索, 发现和安装 9,248 验证的 MCP 技能.

- **安装:** `npx -y marketnow-mcp`
- **npm:** https://www.npmjs.com/package/marketnow-mcp
- **GitHub:** https://github.com/alicelabs-llc/marketnow
- **网站:** https://marketnow.site
```
