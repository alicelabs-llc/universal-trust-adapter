# MarketNow Roadmap — Security Infrastructure for AI Agents

## Vision

MarketNow is **the verification and enforcement layer for agentic systems**.

Sentinel is the engine. Trust Card is the identity. Interceptor is the enforcement. Trust API is the consumption layer.

The marketplace (9,248 skills) is distribution and dataset — not the product.

## Current State — v5.0.0 (August 2026)

| Feature | Status | Evidence |
|---------|--------|----------|
| Sentinel 10-layer audit | ✅ Live | 1,211,488 checks performed |
| 9,248 MCP skills analyzed | ✅ Live | All in skills-lite.json |
| 1,030 threats detected | ✅ Live | 80 quarantined, 71 risky |
| Agent Trust Card (ATC) | ✅ Live | 57 Ed25519-signed cards |
| Runtime MCP Interceptor | ✅ Live | 5 policy rules, blocks .env/rm-rf |
| Trust API | ✅ Live | /api/trust-score?skillId=X |
| x402 Streaming payments | ✅ Live | /api/stream (USDC on Base) |
| A2A Remote Execution | ✅ Live | /api/execute |
| Skill Stacks | ✅ Live | 5 predefined kits |
| npm packages | ✅ Live | marketnow-mcp v1.8.0 + install-stack v1.1.0 |
| Public audit report | ✅ Live | /api/audit-report.json |
| Ed25519 certificates | ✅ Live | RFC 8032 + RFC 8785 JCS |

---

## v5.1 — VERIFICATION (Q4 2026)

**Goal: Move from "scanner" to "verification engine"**

### 1. Cryptographic Tool Fingerprinting
- Hash the exact tool definitions (tools/list response) at audit time
- Store: server_hash, tools_hash, schema_hash, description_hash, dependency_hash, commit_hash
- Alert when any hash changes post-audit → auto-revoke Trust Card

### 2. Provenance / SLSA-style
- Trust Card includes: source repo, commit SHA, build hash, npm package hash, container hash
- Full chain of custody from source → package → audit → Trust Card

### 3. Evidence-First Findings
- Each finding: Finding ID, Severity, **Confidence %**, Evidence, Location, Reproduction
- Two scores: Risk Score (how dangerous) + Confidence Score (how sure)
- Third metric: Evidence Coverage (% of tool surface verified)

### 4. Reproducible Audits
- Audit ID + Scanner version + Ruleset version + Sandbox image + Timestamp
- Two audits of same version = identical results (or explain difference)

### 5. ATC Revocation + Transparency Log
- States: VALID, EXPIRED, REVOKED, SUSPENDED, SUPERSEDED
- Public append-only log (Certificate Transparency for agents)

---

## v5.2 — BEHAVIOR (Q1 2027)

**Goal: Don't just scan code — verify runtime behavior**

### 1. Behavioral Baseline
- Record: API endpoints, request frequency, file access, network calls, process spawns
- Store as baseline profile per tool version

### 2. Drift Detection
- Compare runtime vs baseline → auto-degrade score → auto-revoke on critical

### 3. Network/Filesystem/Process Behavior Analysis
- Map all outbound connections, file reads/writes, process spawns during sandbox
- Flag: cloud metadata, .env, .aws, .ssh, /etc/passwd
- Classify: read-only, write-capable, credential-accessing

---

## v5.3 — POLICY (Q2 2027)

**Goal: Move from score → decision engine**

### 1. Capability Graph
- Trust Card declares: filesystem.read, network.discord.com, shell.execute=NO
- Machine-readable capability manifest per tool

### 2. Organization Policies
- Enterprise: "score ≥ 8 AND no filesystem AND no shell"
- Per-org risk context (same tool = safe for A, blocked for B)

### 3. Agent Identity + Task Identity
- Every execution: agent_id, task_id, session_id → full audit trail

### 4. Approval Workflow
- Score 5-7 → REQUIRE_APPROVAL | Score < 5 → BLOCK | No Trust Card → REQUIRE_APPROVAL

---

## v5.4 — TRAJECTORY (Q3 2027)

**Goal: Detect multi-step attack chains**

### 1. Multi-Tool Attack Chain Analysis
- Track sequences: search → read → extract URL → download → execute → exfiltrate
- Each action individually ALLOW, but chain = BLOCK

### 2. Cross-Tool Privilege Escalation
- Tool A (low) + Tool B (high) = CRITICAL (attack graph)

### 3. Data Flow Tracking
- Track: untrusted_input → LLM → MCP → tool → database → external API
- Flag: USER_SECRET → external-domain (exfiltration)

### 4. Trajectory Risk Scoring
- Score entire session trajectory → block call #8 because 1-7 suspicious

---

## v6.0 — AGENT SECURITY PLATFORM (Q4 2027)

### Multi-Protocol: MCP + A2A + OpenAI tools + Plugins + APIs
### AgentBOM: Identity + Software + Capabilities + AI + Security + Trust
### Cross-Agent Trust: Agent A delegates to Agent B (verify Trust Card first)
### Memory Poisoning Detection
### Typosquatting Detection: Levenshtein distance, package age, publisher
### Supply Chain Graph: MCP → npm → GitHub → dependencies → CVEs
### Continuous Verification: Every commit/CVE/dependency change triggers re-audit
### External Adversarial Red-Team

---

## OWASP MCP Cheat Sheet Alignment

| OWASP Recommendation | MarketNow Implementation | Version |
|---------------------|------------------------|---------|
| Verify tool descriptions haven't changed | Cryptographic fingerprinting | v5.1 |
| Validate input/output schemas | Schema hash in Trust Card | v5.1 |
| Monitor for tool poisoning | Runtime drift detection | v5.2 |
| Implement least privilege | Capability graph + policies | v5.3 |
| Log all tool invocations | Agent identity + audit trail | v5.3 |
| Isolate tool execution | gVisor sandbox (already live) | v5.0 |
| Scan for prompt injection | L1.9 (32 rules, already live) | v5.0 |
| Monitor runtime behavior | Behavioral baseline + drift | v5.2 |
| Verify supply chain integrity | Provenance + SLSA | v5.1 |
| Implement revocation | ATC revocation + transparency log | v5.1 |

## North Star

> **MarketNow is the verification and enforcement layer for all agentic systems.**

*Built by AliceLabs LLC — founder Edison Flores*
