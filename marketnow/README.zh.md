# MarketNow — MCP技能市场（安全优先）

> MarketNow是MCP（模型上下文协议）服务器的安全优先市场。9,248个经过安全审计的技能，10层安全审计管道，Ed25519签名的代理信任卡（ATC），以及与Vibe的跨代理互验证。

## 一切免费

| 功能 | 价格 |
|------|------|
| 所有9,248个技能 | 免费 |
| 10层安全审计 | 免费 |
| 代理信任卡（ATC） | 免费 |
| 动作收据 | 免费 |
| MCP服务器（11个工具） | 免费 |
| 提交你的服务器 | 免费 |
| L2 Docker沙箱审计 | 免费 |

## 如何提交你的MCP服务器

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

提交后：
1. L1.5元数据检查（同步，~5秒）
2. L1.7恶意软件检测（同步）
3. L2 Docker沙箱审计（~2分钟，GitHub Actions）
4. 如果通过（分数≥7）：自动加入目录 + 签发ATC

## 10层安全审计

| 层 | 检查内容 |
|----|---------|
| L1.5 | 元数据（README、许可证、未归档、未过期） |
| L1.6 | 36条Semgrep规则 + 18种密钥模式 + OSV依赖扫描 |
| L1.7 | 8种恶意软件模式 + 二进制/启动器检测 |
| L1.8 | 28种恶意软件家族签名（Emotet、LockBit等） |
| L1.9 | 32条提示注入防御规则 |
| L2 | Docker沙箱（gVisor，无网络，只读文件系统） |
| L3 | 持续运行时监控（每周重新审计） |
| WAF | 38种攻击签名 |
| 蜜罐 | 50+虚假路径，24小时自动封禁 |
| 威胁情报 | abuse.ch数据源 |

## 跨代理互验证（与Vibe的互跳）

MarketNow和Vibe（vibes-coded.com）实现了双向收据验证：
- MarketNow验证Vibe收据：`GET /api/atc?action=verify-vibe-receipt`
- Vibe验证MarketNow收据：`GET /api/atc?action=verify-receipt&receipt_id=...`
- 两个独立的CA，无合并代码，公开账本

## 链接

- 网站：https://marketnow.site
- 提交：https://marketnow.site/submit
- 规范：https://marketnow.site/api/atc?action=spec
- GitHub：https://github.com/alicelabs-llc/marketnow
- npm：`npx -y marketnow-mcp@1.7.0`

## 免责声明

MarketNow由AliceLabs LLC（美国怀俄明州）运营。所有市场功能免费。收入来自需要优先审计、分析和SOC2映射的卖家的Sentinel订阅。

## Timeline

- **2025**: AliceLabs LLC legally founded in Wyoming, USA (founder Edison Flores, Ecuadorian)
- **2026-03-30**: GitHub organization `github.com/alicelabs-llc` created
- **2026-06-29**: MarketNow launched publicly (first npm release: `marketnow-mcp@1.5.1`)
- **2026-08-09**: Current npm latest: `marketnow-mcp@1.10.0` (15 versions total)
- **2026-08-19**: Independent audit by Z.ai (8 findings F1-F8 applied, see REPORT.pdf)

