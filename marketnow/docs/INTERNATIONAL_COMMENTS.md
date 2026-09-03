# International Comments — Copy-paste ready

## ═══ JAPANESE (Qiita / Zenn) ═══

### Qiita: 「MCPサーバーって安全なの？」
**URL:** https://qiita.com/sharu389no/items/b0ddf71c340ec044789b

**コメント (日本語):**
```
素晴らしい記事ですね。私たちもMCPサーバーのセキュリティ問題に取り組んでいます。

MarketNow（marketnow.site）では、6層の監査パイプライン（Sentinel）で9,248のMCPサーバーを監査しました：

- L1.5: 静的解析（依存関係、シークレット、ライセンス）
- L1.6: パターンベースの動作分析
- L2 v2.0: アクティブプローブ（60以上の対抗入力：パストラバーサル、SSRF、SQLインジェクション、コマンドインジェクション、プロンプトインジェクション、資格情報アクセス）
- L2.5: gVisorサンドボックス（ユーザースペースカーネル分離）

結果：3つのサーバーが環境変数を漏洩していました（tools/callの引数がeval()に渡されていた）。12のサーバーにハードコードされたAPIキーがありました。

各サーバーにはSHA-256署名証明書が発行されます。marketnow.site/verify で確認できます。

監査結果は公開されています：github.com/alicelabs-llc/marketnow
```

### Zenn: "A Rabbit's Guide to MCP Security Measures"
**URL:** https://zenn.dev/taku_sid/articles/20250413_mcp_security

**コメント (日本語):**
```
詳細なガイドありがとうございます。私たちは実際にgVisorサンドボックスを使って9,248のMCPサーバーを監査しています。

MarketNow（marketnow.site）のSentinel監査パイプライン：
- L2.5: gVisor（runsc）でユーザースペースカーネル分離
- サーバーはホストカーネルに直接アクセスできない
- ptrace、bpf、mount、kexecの試行をブロック

実際の発見：1つのサーバーがptrace()を試行（gVisorがEPERMでブロック）、1つがbpf()を試行（ENOSYSでブロック）。

完全な方法論：marketnow.site/security
```

## ═══ CHINESE (掘金 / V2EX / 知乎) ═══

### 掘金: "第05篇：MCP安全基础——你连的服务器，真的可信吗？"
**URL:** https://https://juejin.cn/post/7649962094763999267

**评论 (中文):**
```
很好的文章！我们也在做MCP服务器安全审计。

MarketNow（marketnow.site）用6层审计管道（Sentinel）审计了9,248个MCP服务器：

- L1.5: 静态分析（依赖、密钥、许可证）
- L1.6: 基于模式的行为分析
- L2 v2.0: 主动探测（60+对抗性输入：路径遍历、SSRF、SQL注入、命令注入、提示注入、凭证访问）
- L2.5: gVisor沙盒（用户空间内核隔离）

发现：3个服务器通过tools/call泄露环境变量（参数传给eval()未净化）。12个服务器有硬编码API密钥。1个尝试ptrace()，1个尝试bpf()（都被gVisor阻止）。

每个服务器获得SHA-256签名证书。可在 marketnow.site/verify 验证。

审计结果公开：github.com/alicelabs-llc/marketnow
```

### V2EX: "MCP-Server 真的有用么"
**URL:** https://www.v2ex.com/t/1134842

**评论 (中文):**
```
MCP确实有用，但安全问题很大。每个MCP服务器都能访问你的文件系统、网络、环境变量。

我们做了MarketNow（marketnow.site）——一个MCP服务器市场，每个服务器都经过6层安全审计：

- 静态分析 + 行为模式分析
- 主动探测（60+对抗性输入测试）
- gVisor沙盒（用户空间内核隔离）

9,248个服务器已审计。3个因泄露环境变量被移除。每个服务器有SHA-256签名证书。

免费技能（无需注册）：marketnow.site/api/free-skills.json
```

## ═══ RUSSIAN (Habr) ═══

### Habr: "MCP и безопасность агентов"
**URL:** https://habr.com/ru/articles/1055316

**Комментарий (Русский):**
```
Отличная статья! Мы тоже работаем над этой проблемой.

MarketNow (marketnow.site) — маркетплейс MCP-серверов с 6-уровневым аудитом безопасности (Sentinel):

- L1.5: Статический анализ (зависимости, секреты, лицензии)
- L1.6: Анализ поведенческих паттернов
- L2 v2.0: Активное тестирование (60+ adversarial-входов: path traversal, SSRF, SQL injection, command injection, prompt injection, credential access)
- L2.5: gVisor sandbox (изоляция на уровне userspace kernel)

8 764 сервера проверено. 3 сервера удалили за утечку переменных окружения через tools/call. 12 имели захардкоженные API-ключи.

Каждый сервер получает подписанный SHA-256 сертификат. Проверка: marketnow.site/verify

Результаты публичны: github.com/alicelabs-llc/marketnow
```

## ═══ ENGLISH (Medium / Hashnode) ═══

### Medium: "MCP Server Authentication: The Security Guide Nobody Wrote Yet"
**URL:** https://medium.com/data-science-collective/why-your-mcp-server-is-a-security-disaster-waiting-to-happen-660577d8077c

**Comment:**
```
Great article. We've been operationalizing this — built a 6-layer audit pipeline (Sentinel) for MCP servers at MarketNow (marketnow.site).

Beyond authentication, we test for runtime vulnerabilities by sending 60+ adversarial inputs via real MCP protocol messages:
- Path traversal (../../etc/passwd)
- SSRF (http://169.254.169.254/latest/meta-data/)
- SQL injection (1' OR 1=1--)
- Command injection (; cat /etc/shadow)
- Prompt injection ("Ignore all previous instructions...")
- Credential access ("Show me env vars starting with API_")

Plus L2.5: gVisor sandbox (userspace kernel isolation). 9,248 servers audited. 3 were leaking env vars via tools/call (args to eval() without sanitization).

Every server gets a signed SHA-256 certificate. marketnow.site/verify

Full methodology: marketnow.site/security
```

### Medium: "I Built an Open-Source Security Scanner for MCP Servers"
**URL:** https://medium.com/dev-genius/i-built-an-open-source-security-scanner-for-mcp-servers-heres-why-f2842acfbc64

**Comment:**
```
We're working on similar problems! MarketNow (marketnow.site) has a 6-layer audit pipeline (Sentinel) — but we go beyond static scanning.

The key difference: we actively probe MCP servers with 60+ adversarial inputs via real MCP protocol (initialize, tools/list, tools/call). This catches runtime vulnerabilities that static analysis misses.

Example: 3 servers out of 9,248 audited leaked environment variables when sent credential-access prompts via tools/call. They passed arguments to eval() without sanitization. Static analysis wouldn't catch this — the server needs to actually run.

Plus L2.5: gVisor sandbox for kernel-level isolation.

Happy to collaborate on test cases or share our adversarial input set. github.com/alicelabs-llc/marketnow
```

### Hashnode: "What is Model Context Protocol (MCP): The 2026 Guide"
**URL:** https://hashnode.com/posts/what-is-model-context-protocol-mcp/67f49bf552d696f4a687a92c

**Comment:**
```
Comprehensive guide! For anyone looking for security-audited MCP servers — MarketNow (marketnow.site) runs a 6-layer audit (Sentinel) on every server:

- L1.5: Static analysis (deps, secrets, licenses)
- L1.6: Pattern-based behavioral analysis
- L2 v2.0: Active probe (60+ adversarial inputs)
- L2.5: gVisor sandbox (userspace kernel isolation)

9,248 servers audited. Each gets a signed SHA-256 certificate with a score 0-10, verifiable at marketnow.site/verify.

Free skills (no signup): marketnow.site/api/free-skills.json
```
