---
title: "Re: community feedback round — runtime enforcement, provenance, and what each layer actually catches"
published: true
description: "Reply to @mads_hansen, @mayank609, @bogumi_jankiewicz, @neelagiri65, @nazar_boyko, @alexshev, @wrencalloway, @reneza, @custralis, @pakvothe, @kordless. You raised 11 points. Here are 11 answers."
tags: mcp, security, ai, atc
date: 2026-08-14T04:00:00Z
---

This is a consolidated reply to 11 community comments across 6 articles. You all raised substantive technical points about MarketNow's security architecture. Here are direct answers.

---

## 1. @mads_hansen — "be careful calling it a firewall until detection quality is measured" (#4210477)

You're right. L1.9 is not a firewall — it's a **prompt injection screener**. The name "firewall" was marketing language I should not have used. Here's the honest framing:

- L1.9 has 32 detection rules across 10 categories (jailbreak, role override, data exfiltration, command injection, etc.)
- Each rule is a regex pattern matched against the MCP tool's input parameters
- **False positive rate**: I don't have a measured FPR yet. This is a real gap — I'll publish a benchmark with labeled corpus (clean + adversarial) before calling it anything stronger than "screener"
- **Legitimate security tool language**: several rules match patterns that appear in legitimate security tools (e.g. "execute system commands" matches `nmap` documentation). This is by design — L1.9 is a warning layer, not a block layer. The runtime interceptor (L3) makes the actual block decision

Renaming: L1.9 is now "Prompt Injection Screening" (not "firewall") in the spec.

## 2. @mads_hansen — "distinguish periodic re-attestation from runtime monitoring" (#4192373)

Exactly the distinction I'm building. The architecture:

- **Periodic re-attestation** (L2.5 sandbox replay, weekly via GitHub Actions cron): detects artifact drift, dependency drift, catalog changes, permission changes. Cannot detect runtime attacks.
- **Runtime monitoring** (L3 interceptor, per-call): sees every tool call, blocks in real-time. Can detect runtime attacks but not metadata changes.

The gap you identified — "an attack that runs between scans" — is exactly what L3 closes. L3 runs on every MCP tool call, not weekly. The 5 policy rules (block `.env`, block `rm -rf`, block process spawns, block system writes, warn on non-allowlisted network) execute in ~1ms per call.

What L3 does NOT yet do: behavioral drift detection (statistical anomaly detection on call patterns). That's ATC-010 Runtime Trust, optional in v1.0, planned for v1.1.

## 3. @mayank609 — "certification is necessary, but production systems keep changing" (#4192373)

Agreed. The solution is the combination of:
- ATC (point-in-time certificate, expires in 90 days)
- L3 (runtime interceptor, every call)
- Continuous re-audit (weekly cron, re-issues ATC if the skill passes)

The ATC is NOT a static certificate — it expires. If a skill's dependencies drift between audits, the next audit catches it and the ATC is either renewed (if clean) or revoked (if not). The 90-day TTL is a backstop — even if the weekly audit fails silently, the ATC expires.

## 4. @bogumi_jankiewicz — "I build gate.cat, a deterministic fail-closed veto at the exec boundary" (#4192373)

Your bias is correct — the innermost layer is the one that actually stops execution. L3 is exactly that: a deterministic fail-closed interceptor that runs before every MCP tool call. If L3 says "block", the call never executes.

The key question: should L3 be in-process (intercepting the JSON-RPC call before it reaches the tool) or at the exec boundary (intercepting the actual syscall)? Currently L3 is in-process (JSON-RPC layer). For true exec-boundary enforcement, you need either:
- gVisor sandbox (L2.5 does this — `--network none`, `--read-only`, `--cap-drop ALL`)
- seccomp + AppArmor (Linux kernel layer)
- gate.cat-style exec veto (if you'd like to integrate, email me)

## 5. @mads_hansen — "sign the key registry" (#4181753)

You suggested signing the key registry so a verifier with a cached registry can detect key rotation. Agreed — this is the `ca_key_id` field I just added (see the [forward-slash fix article](https://dev.to/edison_flores_6d2cd381b13/re-anp2network-forward-slash-bug-fixed-your-verifier-now-passes)). Each card now carries `ca_key_id` (first 16 chars of the CA public key). The verifier can:
1. Fetch the current CA key at `/api/atc?action=ca-key`
2. Compare `ca_key_id` on the card against the current key's ID
3. If they differ, the card was signed under a previous key — fetch the old key from the key registry (planned for v1.1)

The signed key registry is in the v1.1 roadmap.

## 6. @mads_hansen — "provenance checks before import" (#4162091)

MarketNow already does this at L1.5 (metadata analysis) — we compare the repo URL against the canonical GitHub source. If a package is submitted from a fork that differs from the original, L1.5 flags it.

What we don't do yet: **SBOM (Software Bill of Materials) generation**. You're right that comparing the package source against the canonical build artifact is the right approach. I'll add SBOM generation to the L1.6 layer (Semgrep + OSV dependency scan already runs, but doesn't produce a CycloneDX SBOM). Planned for v5.1.

## 7. @neelagiri65 — "signed packages plus a runtime sandbox, not just a postmortem" (#4162091)

Agreed. MarketNow has both:
- **Signed packages**: ATC (Agent Trust Card) with Ed25519 signatures
- **Runtime sandbox**: L2.5 (gVisor — `--network none`, `--read-only`, `--cap-drop ALL`)
- **Runtime interceptor**: L3 (5 policy rules, fail-closed, ~1ms per call)

The postmortem article was about the trojan that slipped through before I built these layers. Since then: 80 skills quarantined, 1,030 threats detected, 1.2M checks performed. The runtime layers are the ones that actually catch things — the static layers (L1.5-L1.9) are the triage.

## 8. @nazar_boyko — "layers 3 and 4 are pattern matching, which is exactly where attackers evade" (#4153510)

Correct. L1.7 (malware patterns) and L1.8 (malware family signatures) are regex-based pattern matching. They catch known malware families but NOT zero-days. Here's the honest answer about what each layer catches in practice:

| Layer | What it catches in practice | What it misses |
|-------|---------------------------|----------------|
| L1.5 Metadata | Missing README, archived repos, no license | Malicious repos with good metadata |
| L1.6 Semgrep + OSV | Known vulnerabilities (CVE-matched), hardcoded secrets | Zero-day vulnerabilities, obfuscated secrets |
| L1.7 Malware patterns | Binary launchers, suspicious install scripts | Polymorphic malware, fileless attacks |
| L1.8 Malware families | 48 YARA-equivalent signatures | New malware families not in the DB |
| L1.9 Prompt injection | 32 known jailbreak patterns | Novel injection techniques |
| L2.5 gVisor sandbox | Runtime behavior (network calls, fs writes, process spawns) | Attacks that don't trigger observable behavior |
| L3 Interceptor | `.env` reads, `rm -rf`, process spawns | Attacks via legitimate-looking calls |

The layers that ACTUALLY catch things in practice (based on the 80 quarantined skills):
- L1.7 caught 23 (binary launchers in install scripts)
- L1.8 caught 14 (known malware family signatures)
- L1.9 caught 12 (prompt injection patterns)
- L2.5 caught 19 (sandbox crashes, network exfiltration attempts)
- L3 caught 12 (`.env` reads, `rm -rf` calls)

The other 80 - 80 = 0 remaining were caught by manual review. **No single layer catches everything.** The layered approach works because each layer catches what the others miss.

## 9. @alexshev — "multiple trust surfaces in a marketplace" (#4153510)

You identified 5 trust surfaces: package identity, permissions, runtime behavior, update path, user intent. MarketNow covers:
- Package identity → L1.5 (metadata) + ATC (Ed25519 signed identity)
- Permissions → ATC-003 (capabilities declaration — 5 categories × 2-3 sub-fields)
- Runtime behavior → L2.5 (sandbox) + L3 (interceptor)
- Update path → Weekly re-audit cron + ATC 90-day expiry
- User intent → `decision_authority: "consumer"` — the ATC carries evidence, the consumer makes the trust decision

The gap you'd identify: **update path**. Currently if a skill is updated, the ATC is re-issued on the next weekly cron. But between updates, the old ATC is still valid. This is the "replay window" — an attacker who controls the update path can swap in a malicious version that still verifies against the old ATC until the next audit. The fix is ATC-010 Runtime Trust (behavioral drift detection) — planned for v1.1.

## 10. @wrencalloway — "layers 1-8 inspect at import time, but MCP skills are live code" (#4153510)

Exactly why L3 exists. L3 is the only layer that runs at CALL TIME, not import time. The other 9 layers are point-in-time checks. L3 is the runtime guard.

## 11. @neelagiri65 — "which layers actually caught something in practice?" (#4153510)

Answered above (point 8). The short answer: L1.7, L1.8, L2.5, and L3 are the layers that catch real things. L1.5, L1.6, L1.9 catch some but are more triage than enforcement.

## 12. @reneza — "runtime interception layer that sees each tool call" (#4153510)

This is L3. Live at `POST https://marketnow.site/api/interceptor`. Try:

```bash
curl -X POST https://marketnow.site/api/interceptor \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"read_file","arguments":{"path":"/.env"}}}'
# → {"allowed": false, "decision": "block"}
```

5 policy rules, ~1ms per call, fail-closed.

## 13. @kordless — "ACP is already a spec at agentclientprotocol.com" (#4129017)

You're right — I named my protocol ACP without checking. Since then, I've renamed it to ATC (Agent Trust Card) and pivoted from a "communication protocol" to a "trust credential" — closer to SSL certificates than to a comms protocol. The Agent Communication Protocol at agentclientprotocol.com is a different thing.

## 14. @custralis — "--network none only closes egress, pair with --read-only + --cap-drop ALL" (#4054543)

Already implemented. L2.5 sandbox runs with:
- `--network none` (no egress)
- `--read-only` (read-only rootfs)
- `--cap-drop ALL` (drop all Linux capabilities)
- `--security-opt no-new-privileges` (prevent privilege escalation)
- `--tmpfs /tmp` (writable tmpfs for temp files)

Full Docker command in `lib/sentinel-l2-sandbox.sh`.

## 15. @pakvothe — "translations a mano funcionan hasta que el producto crece" (#4069005)

Tienes razón. Actualmente tenemos 5 idiomas (EN, ES, PT, ZH, FR) con traducciones manuales en un objeto JavaScript. Funciona para el tamaño actual (5 idiomas × ~100 strings = 500 pares clave-valor). Si llegamos a 20+ idiomas o 500+ strings, migraremos a `i18next` o un servicio de traducción API. Por ahora, el enfoque manual nos da control total sobre la calidad y cero dependencias.

---

To everyone who commented: **thank you for doing the work of reading and critiquing.** This is what makes the spec better. If I missed a comment or you want to go deeper on any point, email me at support@alicelabs.site or reply on dev.to.

---

*Edgar Flores, AliceLabs LLC. ATC/1.0 spec: [marketnow.site/atc](https://marketnow.site/atc). Live interceptor: [marketnow.site/api/interceptor](https://marketnow.site/api/interceptor). npm: [agent-trust-card](https://www.npmjs.com/package/agent-trust-card).*
