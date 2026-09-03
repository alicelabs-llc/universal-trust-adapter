---
title: "MarketNow is now Trust Infrastructure for AI Agents — unified Trust API live"
published: true
description: "MarketNow has evolved from 'npm for MCP servers' into a 7-subsystem trust infrastructure. The new /api/trust endpoint combines Sentinel, ATC, Interceptor, and policy evaluation into a single decision. Here's the architecture."
tags: mcp, ai, security, atc
date: 2026-08-17T17:30:00Z
---

MarketNow is no longer a marketplace. It's **trust infrastructure for AI agents**.

Today I'm shipping the **Unified Trust API** (`POST /api/trust`) — a single endpoint that combines all 7 subsystems into one decision: should an agent be allowed to use a tool?

---

## The 7 subsystems

After an external audit identified that MarketNow had evolved far beyond a marketplace, I'm now positioning it explicitly as what it actually is:

```
DISCOVER → SENTINEL → IDENTITY → TRUST → POLICY → ENFORCEMENT → AUDIT
```

| Subsystem | What it answers | Live endpoint |
|-----------|----------------|---------------|
| **Discovery** | "What tools exist?" | `/api/skills.json` (9,248 MCP skills) |
| **Sentinel** | "Is this tool safe?" | 10-layer audit pipeline (L1.5→L3) |
| **ATC** | "Who is this agent?" | `/api/atc?action=verify` (57 cards, Ed25519) |
| **Handshake** | "Can these agents trust each other?" | Trust negotiation protocol |
| **Interceptor** | "Is this action allowed?" | `POST /api/interceptor` (8 enforcement rules) |
| **Mandates** | "Does this agent have authority?" | `/api/mandates` (delegated authority) |
| **Audit Log** | "What happened?" | Git-based tamper-evident ledger |

The marketplace is now **one application on top of the infrastructure**, not the product itself.

---

## The killer feature: `POST /api/trust`

One endpoint. One decision. All 7 subsystems feed into it.

```bash
curl -X POST https://marketnow.site/api/trust \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "my-bot-001",
    "skill_id": "mn-gen-00003",
    "action": "execute",
    "policy": {
      "min_trust_score": 7,
      "allow_filesystem_write": false,
      "allow_network": "allowlist",
      "allow_shell": false,
      "require_atc": true
    }
  }'
```

Response:

```json
{
  "allowed": true,
  "agent_trust_score": 9,
  "tool_security_score": 8,
  "identity_verified": true,
  "artifact_verified": false,
  "policy_compliant": true,
  "certificate_id": "ATC-2026-7777670",
  "expires_at": "2026-10-21T03:36:17.670Z",
  "evidence": {
    "sentinel": { "sentinel_score": 8, "sentinel_version": "v2.5" },
    "atc": { "card_id": "ATC-2026-7777670", "trust_score": 9 },
    "interceptor": { "decision": "allow" }
  },
  "reasons": [
    "Tool security score 8/10 meets minimum 7",
    "ATC ATC-2026-7777670 verified — agent trust score 9/10",
    "Interceptor: action allowed"
  ],
  "decision_authority": "consumer",
  "architecture": "DISCOVER → SENTINEL → IDENTITY → TRUST → POLICY → ENFORCEMENT → AUDIT"
}
```

### What it does internally

1. **Sentinel assessment**: fetches the skill's security score from the catalog
2. **ATC verification**: looks up the agent's trust card, verifies signature + revocation + expiry
3. **Policy evaluation**: checks the skill's declared capabilities against the caller's policy (filesystem, network, shell, credentials, process)
4. **Interceptor decision**: runs the requested action through the 8-rule runtime interceptor
5. **Final decision**: combines all 4 checks into `allowed: true|false` with full evidence trail

### The policy engine

The `policy` field in the request is a simple JSON object:

```json
{
  "min_trust_score": 7,           // minimum Sentinel score (0-10)
  "allow_filesystem_write": false, // block tools that write to filesystem
  "allow_network": "allowlist",    // none | allowlist | all
  "allow_shell": "none",           // none | sandboxed | unrestricted
  "allow_credentials_access": false, // block .env, .aws, .ssh reads
  "allow_process_spawn": false,    // block exec/spawn/fork
  "require_atc": true,             // require valid Agent Trust Card
  "require_continuous_monitoring": false, // require L3 active
  "max_payment_amount_usd": 0      // cap for mandate-based purchases
}
```

This is the **policy engine** the auditor recommended. It's live now.

---

## The Interceptor is now documented as enforcement

The auditor noted that the Interceptor's public documentation was insufficient for its importance. Here's what it actually does:

```
Agent → MCP tool call → Interceptor → 8 rules → ALLOW / BLOCK / WARN
```

8 enforcement rules (v1.2.0):

| Rule | What it blocks |
|------|---------------|
| BLOCK_SECRET_FILES | `.env`, `.aws/credentials`, `.ssh/id_rsa`, `.npmrc`, `.pypirc` |
| BLOCK_DANGEROUS_CMDS | `rm -rf`, `DROP TABLE`, `mkfs`, `dd if=`, fork bombs, `chmod 777` |
| BLOCK_PROCESS_SPAWN | `child_process`, `exec()`, `spawn()`, `fork()` |
| BLOCK_SYSTEM_WRITES | `/etc/`, `/root/`, `/var/log`, `/boot/`, `C:\Windows\` |
| BLOCK_SYSTEM_READS | `/etc/passwd`, `/etc/shadow`, `/proc/self`, `/sys/class` |
| BLOCK_REVERSE_SHELL | `bash -i`, `sh -i`, `nc -l`, `ncat`, `/dev/tcp/`, `python -c`, `perl -e`, `socat` |
| BLOCK_REMOTE_EXEC | `curl|sh`, `wget|bash`, `eval()`, `os.system`, `subprocess.call` |
| WARN_NETWORK | Non-allowlisted HTTP/HTTPS calls (warns, doesn't block) |

All 7 attack vectors tested, 7/7 blocked. Live at `POST https://marketnow.site/api/interceptor`.

---

## What this means for the positioning

The auditor's key insight was:

> **"No intentes que MarketNow sea el lugar donde los agentes encuentran herramientas. Haz que sea la capa que un agente consulta antes de confiar, instalar, ejecutar, autorizar o pagar por una herramienta u otro agente."**

That's exactly what `/api/trust` does. It's the layer an agent consults **before** acting.

### The revenue model

The marketplace generates commissions. That's small.

The **Trust API** is the business:
- Free tier: 100 trust decisions/day
- Developer ($49/mo): 10K/day
- Professional ($199/mo): 100K/day + custom policies
- Enterprise ($5k-50k+/yr): unlimited + private registries + SIEM integration + SOC2 evidence

### The moat

Not the catalog (anyone can scrape 9,248 MCP skills). Not the UI. Not the pricing.

The moat is:
- **Security evidence** (1.2M checks, 80 quarantined, historical data)
- **Trust identity** (57 ATCs issued, Ed25519 signed, revocation infrastructure)
- **Provenance** (commit SHA + artifact digest linking)
- **Runtime enforcement** (8-rule interceptor, live, fail-closed)
- **Agent commerce** (mandates, audit trail)

---

## What changed on the site

- Homepage H1: "npm for MCP servers" → **"Trust Infrastructure for AI Agents"**
- SEO content: leads with the 7-subsystem architecture, not the catalog
- Meta tags: "trust infrastructure, AI agent trust, agent identity" (not "mcp marketplace")
- New endpoint: `POST /api/trust` (the killer feature)
- New documentation: interceptor is now described as enforcement layer with 8 rules

---

## What's next (auditor's priorities)

1. ✅ **Interceptor** — documented as enforcement, 8 rules, 7/7 attack vectors blocked
2. ✅ **ATC** — interoperable, independently verifiable (proven by @anp2network)
3. ✅ **Policy engine** — live as part of `/api/trust`
4. 🔲 **Sentinel versioning** — artifact_digest + sentinel_version in each certificate
5. 🔲 **Handshake protocol** — formal specification
6. 🔲 **Integrations** — Claude/Cline/Cursor/AutoGen/CrewAI adapters
7. 🔲 **Security API** — `marketnow.verify()` as a standalone SDK function

Items 1-3 are done. Items 4-7 are the next 30 days.

---

*Edgar Flores, AliceLabs LLC. Trust API: [marketnow.site/api/trust](https://marketnow.site/api/trust). ATC/1.0 spec: [marketnow.site/atc](https://marketnow.site/atc). Interceptor: [marketnow.site/api/interceptor](https://marketnow.site/api/interceptor).*
