# MarketNow Roadmap — Security Infrastructure for AI Agents

## Vision

MarketNow is **the verification and enforcement layer for agentic systems**.

Sentinel is the engine. Trust Card is the identity. Interceptor is the enforcement. Trust API is the consumption layer.

The marketplace (9,248 skills) is distribution and dataset — not the product.

## Current State — v5.1 (September 2026)

| Feature | Status | Evidence |
|---------|--------|----------|
| Sentinel 10-layer audit | ✅ Live | 1,211,488 checks performed |
| 9,248 MCP skills analyzed | ✅ Live | All in skills-lite.json |
| 1,030 threats detected | ✅ Live | 80 quarantined, 71 risky |
| Agent Trust Card (ATC) | ✅ Live | 57 Ed25519-signed cards (54 active, 3 revoked) |
| Runtime MCP Interceptor | ✅ Live v1.1.0 | 5 policy rules + revocation gate + TFP pinning (cline-plugin-uta) |
| Trust API | ✅ Live | /api/trust, /api/atc, /api/trust-score |
| **ATC Revocation + Transparency Log (v5.1.5)** | ✅ Live 2026-09-09 | Signed MNR-CRL-1.0 registry + /api/ocsp + /api/crl + marketnow_check_revocation |
| **Cryptographic Tool Fingerprinting (v5.1.1)** | ✅ Live 2026-09-09 | TFP-1.0 (JCS+sha256, drift reports) — MCP tool + npm 1.10.2 + interceptor |
| Sentinel semgrep rules v2 | ✅ 29 rules | +tool poisoning, exfiltration chains, attack chains (MCP-TP/EX/AC/RR) |
| x402 Streaming payments | ✅ Live | /api/stream (USDC on Base) |
| A2A Remote Execution | ✅ Live | /api/execute |
| Skill Stacks | ✅ Live | 5 predefined kits |
| npm packages | ✅ Live | marketnow-mcp v1.10.2 (15 tools) + 6 more |
| Public audit report | ✅ Live | /api/audit-report.json |
| Ed25519 certificates | ✅ Live | RFC 8032 + RFC 8785 JCS |
| Rekor transparency anchors | ✅ 3 entries | logIndex 2762061972, 2764017355, 2764479676 (sigstore.dev) |
| Reproducible build | ✅ Live | tar-layer sha256 519d406a… (agent-trust-card@1.1.2) |

---

## v5.1 — VERIFICATION (Q4 2026)

**Goal: Move from "scanner" to "verification engine"**

### 1. Cryptographic Tool Fingerprinting — ✅ DONE (2026-09-09, TFP-1.0)
- Hash the exact tool definitions (tools/list response) at audit time
- Store: server_hash, tools_hash, schema_hash, description_hash, dependency_hash, commit_hash
- Alert when any hash changes post-audit → auto-revoke Trust Card
- **Shipped**: `marketnow_fingerprint_tool` (MCP live endpoint + npm 1.10.2) — JCS+sha256 per tool + manifest fingerprint + drift reports (added/removed/changed) for pinned manifests. Interceptor (`cline-plugin-uta` v1.1.0) pins/verifies tool surfaces per server.

### 2. Provenance / SLSA-style — 🚧 Partial
- Trust Card includes: source repo, commit SHA, build hash, npm package hash, container hash
- Full chain of custody from source → package → audit → Trust Card

### 3. Evidence-First Findings — 🚧 Partial
- Each finding: Finding ID, Severity, **Confidence %**, Evidence, Location, Reproduction
- Two scores: Risk Score (how dangerous) + Confidence Score (how sure)
- Third metric: Evidence Coverage (% of tool surface verified)

### 4. Reproducible Audits — 🚧 Partial
- Audit ID + Scanner version + Ruleset version + Sandbox image + Timestamp
- Two audits of same version = identical results (or explain difference)

### 5. ATC Revocation + Transparency Log — ✅ DONE (2026-09-09, MNR-CRL-1.0)
- States: VALID, EXPIRED, REVOKED, SUSPENDED, SUPERSEDED
- Public append-only log (Certificate Transparency for agents)
- **Shipped**: signed revocation registry (`/uta/revocations/crl.json`, Ed25519/RFC 8785, delegated key mn-revoc-001) + live status resolution (`/api/ocsp` — was a 404 promise before) + CRL endpoint (`/api/crl`) + `marketnow_check_revocation` MCP tool. Seeded with REAL events: 3 superseded ATCs + mn-ca-002 KEY_COMPROMISE (2026-09-08). Fail-closed semantics throughout.

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
| Verify tool descriptions haven't changed | TFP-1.0 fingerprinting + drift reports | v5.1 ✅ |
| Validate input/output schemas | Schema hash in Trust Card | v5.1 |
| Monitor for tool poisoning | Sentinel rules MCP-TP-001..004 + TFP drift | v5.1 ✅ |
| Implement least privilege | Capability graph + policies | v5.3 |
| Log all tool invocations | Agent identity + audit trail | v5.3 |
| Isolate tool execution | gVisor sandbox (already live) | v5.0 |
| Scan for prompt injection | L1.9 (32 rules, already live) | v5.0 |
| Monitor runtime behavior | Behavioral baseline + drift | v5.2 |
| Verify supply chain integrity | Provenance + SLSA + Rekor anchors | v5.1 🚧 |
| Implement revocation | MNR-CRL-1.0 registry + /api/ocsp + /api/crl | v5.1 ✅ |

## North Star

> **MarketNow is the verification and enforcement layer for all agentic systems.**

*Built by AliceLabs LLC — founder Edison Flores*
