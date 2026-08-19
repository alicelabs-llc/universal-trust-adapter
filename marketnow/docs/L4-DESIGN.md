# Sentinel L4 — In-Process Runtime Monitoring Design Document

## Status: Design (not yet implemented)
## Target: Q4 2026

## Problem

L1.5-L1.8 audit skills at import time (static). L2 runs a sandbox baseline (point-in-time). L3 re-audits weekly (periodic). But none of these watch the skill's behavior in real-time on the user's machine.

Community feedback (4 independent reviewers):
- @Correctover: "Certification is point-in-time. Attacks are runtime."
- @wrencalloway: "A skill that ships clean and pulls its payload at runtime."
- @mads_hansen: "Package safety and runtime safety are different problems."
- @mayank609: "A server can pass certification but still behave unexpectedly."

L3 mitigates this with weekly re-attestation. L4 solves it with real-time monitoring.

## Design

### Architecture

```
┌─────────────────────────────────────────────────┐
│  User's Machine                                 │
│                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ AI Agent │───▶│ MCP      │───▶│ L4 Probe │  │
│  │ (Claude) │    │ Server   │    │ (eBPF/ES)│  │
│  └──────────┘    └──────────┘    └────┬─────┘  │
│                                       │         │
│                                       ▼         │
│  ┌──────────────────────────────────────────┐   │
│  │ L4 Monitor (local daemon)               │   │
│  │                                          │   │
│  │ • Syscall interception (eBPF/Endpoint)  │   │
│  │ • Tool catalog diffing                  │   │
│  │ • Network egress monitoring             │   │
│  │ • File access tracking                  │   │
│  │ • Process spawn logging                 │   │
│  │ • Credential access detection           │   │
│  │                                          │   │
│  │ → Alert if behavior deviates from L2    │   │
│  │   baseline (stored in ATC)              │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Platform-specific implementation

**Linux: eBPF**
- Attach probes to `sys_enter_connect`, `sys_enter_openat`, `sys_enter_execve`
- Track per-process: which files opened, which sockets connected, which processes spawned
- Compare against L2 baseline fingerprint (from ATC)
- No kernel module needed — eBPF is safe and sandboxed

**macOS: Endpoint Security framework**
- Requires `com.apple.developer.endpoint-security.client` entitlement
- Subscribe to: `EXEC`, `OPEN`, `RENAME`, `WRITE`, `SOCKET`, `CONNECT`
- Same comparison logic as Linux
- Requires user approval (TCC prompt)

**Windows: ETW (Event Tracing for Windows)**
- Subscribe to: process, file, network, registry providers
- Same comparison logic
- No admin privileges needed for user-space ETW

### What L4 monitors

| Event | Baseline check | Alert severity |
|---|---|---|
| New file read | Was this path in L2 baseline? | LOW if outside declared paths |
| New file write | Was this path allowed? | HIGH if outside /tmp |
| Network connect | Was this domain in L2 baseline? | HIGH if new domain |
| Process spawn | Was this command in L2 baseline? | CRITICAL if new process |
| Env var access | Was this var accessed in L2? | HIGH if new credential access |
| Tool catalog change | Did tools/list change? | CRITICAL — possible injection |
| DNS lookup | Was this domain queried? | MEDIUM if new domain |

### Alert flow

1. L4 probe detects deviation from baseline
2. L4 daemon checks ATC for the skill's L2 baseline fingerprint
3. If deviation is CRITICAL → kill the MCP server process immediately
4. If deviation is HIGH → log + notify user + flag for re-audit
5. If deviation is MEDIUM → log for periodic review
6. All alerts sent to `/api/security?view=l4` (if user opts in)

### Privacy

- L4 runs **locally** — no data sent to MarketNow servers unless user opts in
- Only behavioral metadata is logged (paths, domains, commands) — never file contents
- User can disable L4 at any time
- User can review all logged events locally

### Implementation plan

| Phase | What | Timeline |
|---|---|---|
| 1 | Design document (this) | Done |
| 2 | Linux eBPF prototype | Q4 2026 |
| 3 | macOS Endpoint Security | Q4 2026 |
| 4 | Windows ETW | Q1 2027 |
| 5 | ATC baseline integration | Q4 2026 |
| 6 | User alert UI | Q1 2027 |
| 7 | Opt-in telemetry | Q1 2027 |

### What L4 does NOT solve

- **In-memory code injection**: if an attacker injects code into the MCP server's process memory, L4 sees the syscalls but not the injected code itself. Requires memory introspection (out of scope).
- **Side-channel attacks**: timing-based or cache-based attacks are invisible to syscall monitoring.
- **Encrypted exfiltration**: if the skill sends data to a domain that WAS in the baseline but via a different protocol, L4 might not flag it.

### Open questions

1. **Distribution**: how do we ship the L4 daemon? npm package? Homebrew? .deb?
2. **Permissions**: eBPF needs root on Linux. Can we use unprivileged eBPF?
3. **Performance**: what's the overhead of syscall interception on MCP server latency?
4. **Baseline format**: should the L2 fingerprint be embedded in the ATC, or fetched on-demand?

— *AliceLabs LLC — marketnow.site*
