---
title: "回复：审计严格度 vs 性能开销的平衡 — 我们在生产环境的做法"
published: true
description: "Reply to @topstar_ai's Chinese comment on balancing audit rigor vs performance overhead. Covers our 10-layer pipeline architecture, what's static (fast) vs dynamic (slow), and how we batch the slow checks."
tags: mcp, security, ai, performance
date: 2026-08-12T20:45:00Z
---

This is a public reply to [@topstar_ai's comment](https://dev.to/edison_flores_6d2cd381b13/mian-fei-mcpan-quan-shen-ji-10ceng-shen-ji-ed25519xin-ren-qia-zhong-wen-ban--32oi) on the Chinese version of our MCP security audit article.

原文问题：
> 对audit的10层次划分非常有意思，尤其是L2的Docker沙箱使用gVisor，无网络的限制可以有效防止审计过程中的安全风险。同时，使用Semgrep规则和密钥模式检测可以快速发现代码中的潜在安全问题。
>
> **有一个问题想要讨论一下：在实际使用中，如何平衡审计的严格程度和服务器的性能开销，特别是在大规模的MCP服务器部署中？**

很好的问题。这是我们花了 8 个月才搞清楚的事。答案分三层：

---

## 1. 把 10 层拆成"静态层"和"动态层"

10 层审计听起来很贵，但实际成本分布是这样的：

| 层 | 类型 | 单次成本 | 大规模可行性 |
|---|---|---|---|
| L1.5 元数据 | 静态 | ~50ms | ✅ 完全可行 |
| L1.6 Semgrep + 密钥 + OSV | 静态 | ~800ms | ✅ 完全可行 |
| L1.7 恶意模式 | 静态 | ~30ms | ✅ 完全可行 |
| L1.8 恶意家族签名 (48 条) | 静态 | ~80ms | ✅ 完全可行 |
| L1.9 Prompt injection (32 条) | 静态 | ~40ms | ✅ 完全可行 |
| L2.5 gVisor 沙箱 | **动态** | **3–30 秒** | ⚠️ 不能每请求跑 |
| L3 Runtime Interceptor | **运行时** | **~1ms/调用** | ✅ 每调用跑 |
| ATC 签发 | 加密 | ~5ms | ✅ 完全可行 |
| x402 支付 | 网络 | ~50ms | ✅ 完全可行 |
| A2A 远程执行 | 网络 | 100ms+ | ⚠️ 仅按需 |

**关键发现**：前 5 层（L1.5–L1.9）全部静态，单次审计总成本 ~1 秒。这意味着大规模 MCP 部署可以 **每个 server 入网时跑一次静态审计**，把结果缓存到 ATC 里。

**L2.5 沙箱** 是唯一真正贵的层（3–30 秒），但它在大部分情况下不需要重跑。我们在生产环境的做法是：

- **新 server 入网** → 跑全 10 层（含沙箱）
- **server 更新** → 跑 L1.5–L1.9（静态）+ 差异检测，如果差异在受信范围内，跳过沙箱
- **每周自动重审** → GitHub Actions cron 跑全 10 层，结果写到 ATC
- **疑似异常** → 立即跑沙箱（手动触发或自动触发）

## 2. ATC 作为"审计证据缓存"

这是 ATC 的核心设计意图之一。ATC 不是"证书"——它是**审计证据的可移植容器**。

```
┌─────────────────────────────────────────────────┐
│  ATC (Agent Trust Card)                          │
│                                                  │
│  contains:                                       │
│    - sentinel_review_score: 9/10                │
│    - audit_pipeline: "L1.5 → L1.9 → L2.5 → L3" │
│    - audit_completed_at: 2026-08-10T12:00Z       │
│    - static_checks: { semgrep: 36 rules, ... }  │
│    - dynamic_checks: { sandbox_run: true, ... } │
│    - runtime_checks: { interceptor: 5 rules }   │
│    - findings: [...]                            │
│                                                  │
│  → 签名后，消费方 agent 离线验证                │
│    不需要重新跑审计                              │
└─────────────────────────────────────────────────┘
```

这意味着：**审计只在签发时跑一次**。之后所有 agent 都用 ATC 里的证据做决策，不需要重跑。这把"严格审计"的成本从"每次调用"摊销到"每次签发"。

我们在生产环境的成本结构：

- **每个 MCP server 签发一次 ATC** → 一次性 ~5 秒（含沙箱）
- **每次 agent 调用** → 验证 ATC ~5ms（Ed25519 + JCS + SHA-256）
- **每周重审** → 后台 cron，不阻塞调用

也就是说：**大规模部署的边际成本趋近于零**。1 个 server 还是 10000 个 server，每调用成本都是 5ms。

## 3. L3 Runtime Interceptor 是"实时严格度"

L1–L2 是"入网审计"——签发 ATC 时跑一次。L3 是"调用审计"——每次 tool call 都跑。L3 的 5 条规则：

1. Block reads of `.env`, `.aws/credentials`, `.ssh/id_rsa`
2. Block `rm -rf`, `DROP TABLE`, `mkfs`
3. Block process spawns (`exec`, `spawn`, `child_process`)
4. Block system writes (`/etc/`, `/root/`, `C:\Windows`)
5. Warn on non-allowlisted network calls

每条规则是简单的正则匹配 + JSON-RPC 参数检查，单次成本 ~1ms。可以在线上每调用跑，不阻塞。

Live endpoint 你可以试：
```bash
curl -X POST https://marketnow.site/api/interceptor \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"read_file","arguments":{"path":"/.env"}}}'
# → { "allowed": false, "decision": "block" }
```

## 总结

**严格度 vs 性能** 的平衡点在哪？

- **入网审计**（L1.5–L1.9，静态）→ 跑一次，缓存到 ATC，~1 秒
- **入网审计**（L2.5，沙箱）→ 跑一次，缓存到 ATC，~5–30 秒
- **运行时审计**（L3，interceptor）→ 每调用跑，~1ms
- **审计验证**（ATC 验证）→ 每调用跑，~5ms

所以"大规模 MCP 部署"的总成本：
- N 个 servers × ~5 秒签发成本 = 一次性
- M 次 agent 调用 × ~6ms 验证成本 = 持续

在我们的生产数据（9,248 skills，1,211,488 检查）下：
- 平均每个 skill 跑了 ~131 次检查（含每周重审）
- 总审计时间 ~7 天（cron 分布）
- 平均每次 agent 调用的 ATC 验证延迟 < 5ms

这就是"既严格又快"的架构。

如果你在生产环境遇到了具体的性能瓶颈，告诉我具体场景（server 数量、调用 QPS、延迟目标），我可以帮你算下应该跑哪些层、跳过哪些层。

---

*Edgar Flores, AliceLabs LLC. ATC/1.0 规范：[marketnow.site/atc](https://marketnow.site/atc)。npm SDK：[agent-trust-card](https://www.npmjs.com/package/agent-trust-card)。Live interceptor：[marketnow.site/api/interceptor](https://marketnow.site/api/interceptor)。*
