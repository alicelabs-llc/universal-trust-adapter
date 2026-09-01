<!-- Platform: juejin.cn (Chinese dev platform, ~10M monthly users) -->
<!-- Submission type: article -->
<!-- Category: 后端, AI, 安全 -->
<!-- Language: Chinese (Simplified) -->

# AI 代理的凭证验证：8 种格式统一处理的 12 阶段管道

## 前言

随着 AI 代理越来越多地调用工具（MCP 服务器、内部 API、微服务），一个关键问题浮出水面：如何验证工具的凭证？

每个标准（OAuth/JWT、X.509、W3C VC、MCP Cards 等）回答方式不同，代理不知道用哪个标准。

## UTA 解决方案

**Universal Trust Adapter (UTA)** — https://github.com/alicelabs-llc/universal-trust-adapter

支持 **8 种凭证格式**：

1. ATC v3 (Agent Trust Card) - AliceLabs 提议
2. JWT (带 `x5c` 链) - IETF RFC 7519
3. W3C Verifiable Credentials - W3C VC Data Model
4. A2A (Agent-to-Agent) cards - Google A2A Protocol
5. EAT-AI (Entity Attestation Tokens) - IETF RATS
6. ZTA (Zero Trust Agent) cards - ZTA 变体
7. MCP Server Cards - Anthropic MCP
8. X.509 certificates - ITU-T

## 12 阶段管道

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

每个阶段：

1. **PARSER**: 解析原始字节
2. **DETECT**: 识别格式
3. **SCHEMA**: 验证必填字段
4. **CRYPTO**: 验证签名
5. **ISSUER**: 解析颁发者身份
6. **KEY_BINDING**: 验证签名密钥绑定
7. **POP**: 证明持有
8. **PROVENANCE**: 追溯来源
9. **LIFECYCLE**: 验证有效期
10. **EVIDENCE**: 收集审计证据
11. **POLICY**: 应用策略
12. **DECISION**: 做出决定

## 使用方法

### 公共 API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \
  -H "Content-Type: application/json" \
  -d '{{"card": "...你的凭证..."}}'
```

### NPM 安装

```bash
npm install @marketnow/trust-core
```

```javascript
import {{ verify }} from '@marketnow/trust-core';

const result = await verify(card);
if (result.decision === 'PERMIT') {
  // 凭证有效，执行工具
} else {
  console.log(result.failed_stage);
}
```

## 基准测试

- **每秒 6,744 次验证**（单核）
- **480+ 测试**（Node.js）
- **23 属性测试**（一致性套件）

## 中文文档

完整中文 README: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/README.zh.md

## 链接

- 仓库: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- 14 种语言的代码片段: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets

## 许可证

Apache 2.0
