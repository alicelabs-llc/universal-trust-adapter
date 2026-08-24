# Interceptor — eBPF Kernel-Level Enforcement

**Proprietary — AliceLabs Source-Available License v1.0 (AL-1.0)**

The Interceptor is AliceLabs' proprietary kernel-level enforcement engine for runtime agent trust. It uses eBPF (Extended Berkeley Packet Filter) to monitor and block policy violations by AI agents at the kernel level — preventing filesystem writes, network egress, and process spawns that exceed declared permissions.

**Status:** Architecture defined, prototype in progress.

---

## What it does

When an agent runs with an ATC credential declaring `filesystem_write: false`, the Interceptor enforces that claim at the kernel level. If the agent attempts a filesystem write, the Interceptor:

1. Detects the syscall via eBPF probe
2. Checks the agent's ATC credential policy
3. Blocks the syscall
4. Logs the violation to an immutable audit trail
5. Optionally triggers revocation of the ATC

This goes **beyond** credential verification — it's runtime enforcement.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  User Space                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │  Agent (Cursor,  │  │  ATC Verifier    │  │  Policy Engine   │   │
│  │  Claude, etc.)   │──│  (UTA, AL-1.0)   │──│  (Interceptor)   │   │
│  └──────────────────┘  └──────────────────┘  └────────┬─────────┘   │
│                                                      │              │
│  ┌──────────────────────────────────────────────────┐ │              │
│  │  Audit Log (immutable, signed)                   │◀┘              │
│  └──────────────────────────────────────────────────┘                │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   │ eBPF maps
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Kernel Space (eBPF)                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │  syscall probe   │  │  network probe   │  │  process probe   │   │
│  │  (open, write)   │  │  (tcp, udp, dns) │  │  (execve, fork)  │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                     │                     │              │
│           └─────────────────────┼─────────────────────┘              │
│                                 ▼                                    │
│           ┌─────────────────────────────────────┐                    │
│           │  eBPF program: enforce policy        │                    │
│           │  • if (ATC.filesystem_write==false)  │                    │
│           │    block open(O_WRONLY)              │                    │
│           │  • if (ATC.network_access=="none")   │                    │
│           │    block connect()                   │                    │
│           │  • if (ATC.shell_access=="none")     │                    │
│           │    block execve()                   │                    │
│           └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Policy rules (5 default enforcement rules)

1. **Filesystem write block** — if `trust_claims.filesystem_write == false`, block `open(O_WRONLY)`, `open(O_RDWR)`, `unlink`, `rename`, `mkdir`
2. **Network egress block** — if `trust_claims.network_access == "none"`, block `connect()`, `sendto()`, `bind()`
3. **Process spawn block** — if `trust_claims.shell_access == "none"`, block `execve()`, `fork()`, `vfork()`
4. **Secrets leak block** — always block reading `/etc/passwd`, `~/.ssh/*`, `~/.aws/credentials`, `~/.config/gcloud/*`, env vars matching `*_KEY`, `*_SECRET`, `*_TOKEN`
5. **Audit trail** — log every syscall the agent attempts (even if allowed) to an immutable signed log

---

## Subdirectory structure (when implemented)

```
proprietary/interceptor/
├── README.md                          ← This file
├── ebpf-probe.c                        ← eBPF C program (kernel-side)
├── policy-engine.ts                    ← User-space policy engine (TypeScript)
├── enforcement-rules.json             ← Declarative policy rules
├── audit-log.ts                       ← Immutable signed audit log writer
├── installer/
│   ├── install.sh                      ← One-command installer
│   └── docker-compose.yml              ← Containerized deployment
└── tests/
    ├── test-filesystem-block.bpf       ← Test: agent tries write, blocked
    ├── test-network-block.bpf          ← Test: agent tries connect, blocked
    └── test-execve-block.bpf           ← Test: agent tries spawn, blocked
```

---

## Deployment options

### Local (developer machine)

```bash
$ curl -fsSL https://atc.alicelabs.site/install.sh | bash
# Installs Interceptor as systemd service, loads eBPF programs
# Reads ATC credentials from ~/.atc/credentials/
# Enforces policy on all processes owned by $USER
```

### Container (Docker / Kubernetes)

```yaml
# docker-compose.yml
services:
  interceptor:
    image: alicelabs/interceptor:latest
    cap_add:
      - SYS_ADMIN   # required for eBPF
      - BPF
    volumes:
      - /sys/fs/bpf:/sys/fs/bpf
      - /var/log/interceptor:/var/log/interceptor
    environment:
      ATC_CREDENTIAL_DIR: /etc/atc/credentials
      AUDIT_LOG_SIGNED: "true"
```

### Cloud (managed)

AliceLabs runs a managed Interceptor service for enterprise customers. ATC credentials are uploaded to a secure vault; the Interceptor enforces policy on cloud-hosted agents.

Contact `legal@alicelabs.site` for cloud deployment pricing.

---

## Why eBPF?

eBPF (Extended Berkeley Packet Filter) is the technology used by:

- **Cilium** — Kubernetes networking
- **Falco** — Runtime security
- **Pixie** — Observability
- **Tetragon** — Security observability

It's a Linux kernel feature (4.x+) that allows running sandboxed programs in kernel space without modifying kernel source or loading kernel modules. The programs are JIT-compiled and verified for safety.

For UTA's Interceptor, eBPF gives us:

1. **Near-zero overhead** — kernel-level execution, no context switches
2. **Comprehensive coverage** — intercepts all syscalls, not just those of instrumented processes
3. **Tamper-resistant** — runs in kernel space, hard for malicious agents to escape
4. **Cross-platform** — runs on any modern Linux (4.x+)

---

## Licensing

All Interceptor code is **proprietary** under AliceLabs Source-Available License v1.0 (AL-1.0).

- ✅ Read source for review
- ✅ Security audit permitted
- ✅ Build for personal non-commercial use
- ❌ Commercial use requires Tier 3 Enterprise license
- ❌ Redistribution prohibited

The Interceptor is only included in Tier 3 (Enterprise) commercial licenses. See `proprietary/COMMERCIAL-LICENSE.md`.

---

## Contact

- Commercial licensing: `legal@alicelabs.site`
- Security disclosures: `legal@alicelabs.site`
- Technical questions: `engineering@alicelabs.site`

— AliceLabs LLC, 2026-08-20
