# Sentinel L4 — In-Process Runtime Monitoring (Design Update)

## Status: Design (Q4 2026 implementation target)
## Updated: August 2026

## Problem

L1.5-L1.9 audit at import time (static). L2 runs a sandbox baseline (point-in-time). L3 re-audits weekly (periodic). L4 watches the skill's behavior **in real-time** on the user's machine.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  User's Machine                                 │
│                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ AI Agent │───▶│ MCP      │───▶│ L4 Probe │  │
│  │ (Claude) │    │ Server   │    │ (eBPF/ES)│  │
│  └──────────┘    └──────────┘    └────┬─────┘  │
│                                       │         │
│                              ┌────────▼────────┐│
│                              │ L4 Policy Engine ││
│                              │ (userspace)     ││
│                              └────────┬────────┘│
│                                       │         │
│                              ┌────────▼────────┐│
│                              │ Alert / Block   ││
│                              │ / Log / Revoke  ││
│                              └─────────────────┘│
└─────────────────────────────────────────────────┘
```

## eBPF Hooks (Linux)

L4 uses eBPF to intercept syscalls **without modifying the MCP server**:

### 1. Network hooks
```c
// eBPF program attached to tcp_connect
SEC("kprobe/tcp_v4_connect")
int trace_connect(struct pt_regs *ctx) {
    // Log: which domain is the MCP server trying to reach?
    // If not in allowlist → alert
}
```

Monitored:
- `tcp_v4_connect` / `tcp_v6_connect` — outbound TCP connections
- `udp_sendmsg` — DNS queries, UDP traffic
- `connect` syscall — all connection attempts

Policy: if the MCP server attempts to connect to a domain NOT in its
L2 baseline allowlist → **alert + log**.

### 2. Filesystem hooks
```c
// eBPF program attached to openat
SEC("tracepoint/syscalls/sys_enter_openat")
int trace_openat(struct trace_event_raw_sys_enter *ctx) {
    // Log: which file is the MCP server trying to open?
    // If sensitive path → alert
}
```

Monitored:
- `openat` — file opens (read and write)
- `unlink` / `unlinkat` — file deletions
- `rename` / `renameat` — file renames

Policy: if the MCP server writes to `~/.ssh/`, `~/.aws/`, `~/.config/`,
`/etc/`, or any path outside its working directory → **block + alert**.

### 3. Process hooks
```c
// eBPF program attached to execve
SEC("tracepoint/syscalls/sys_enter_execve")
int trace_execve(struct trace_event_raw_sys_enter *ctx) {
    // Log: what process is the MCP server trying to spawn?
    // If not in allowlist → block
}
```

Monitored:
- `execve` / `execveat` — new process creation
- `fork` / `clone` / `clone3` — process duplication
- `ptrace` — process tracing (debugger/injection)

Policy: if the MCP server spawns a process NOT in its L2 baseline → **block**.

### 4. Credential hooks
```c
// eBPF program attached to read of /proc/self/environ
SEC("kprobe/proc_env_read")
int trace_env_read(struct pt_regs *ctx) {
    // Log: is the MCP server reading environment variables?
    // If yes → alert (potential credential exfiltration)
}
```

Monitored:
- Reads of `/proc/self/environ` — environment variable access
- Reads of `~/.aws/credentials`, `~/.ssh/id_*` — credential files
- Reads of browser cookie stores — session theft

Policy: any access to credential files → **block + alert + revoke ATC**.

## Endpoint Security (macOS)

On macOS, eBPF is not available. We use Apple's Endpoint Security framework:

```swift
import EndpointSecurity

// Register an ES client
let client = new ESClient()
client.subscribe(eventTypes: [.exec, .open, .network])

// Block unauthorized file access
client.handle { event in
    if event.type == .open && event.path.isSensitive {
        return .deny
    }
}
```

Same policies as eBPF, different implementation.

## Policy Engine (userspace)

The policy engine runs in userspace and receives events from eBPF/ES:

```python
class L4PolicyEngine:
    def __init__(self, baseline):
        self.baseline = baseline  # from L2 certification
        self.alerts = []
    
    def on_network_connect(self, domain, port):
        if domain not in self.baseline.network_allowlist:
            self.alert("network_drift", f"New connection to {domain}:{port}")
    
    def on_file_write(self, path):
        if is_sensitive_path(path):
            self.block("file_violation", f"Write to sensitive path: {path}")
            self.revoke_atc()
    
    def on_process_spawn(self, binary):
        if binary not in self.baseline.process_allowlist:
            self.block("process_drift", f"New process: {binary}")
```

## Alert Levels

| Level | Trigger | Action |
|-------|---------|--------|
| INFO | New network domain (not in baseline) | Log only |
| WARN | New tool added (tool catalog drift) | Log + notify user |
| HIGH | File write outside working directory | Block + alert |
| CRITICAL | Credential file access | Block + alert + revoke ATC |
| CRITICAL | Process spawn not in baseline | Block + alert |

## Integration with L3

L4 events feed into L3's drift detection:
- L4 detects runtime drift → L3 records it in the weekly re-audit
- L3 re-audit triggers L4 policy update (new baseline)
- If L4 revokes an ATC, L3 marks the skill as "runtime_compromised"

## Implementation Plan (Q4 2026)

1. **Week 1-2**: eBPF programs (network + filesystem hooks)
2. **Week 3**: Policy engine (userspace, Python or Rust)
3. **Week 4**: macOS Endpoint Security implementation
4. **Week 5**: Integration with L3 (drift feed)
5. **Week 6**: Testing with real MCP servers
6. **Week 7**: Documentation + open source release

## What L4 does NOT do

- Does NOT modify the MCP server (passive monitoring)
- Does NOT slow down the agent (eBPF is kernel-level, near-zero overhead)
- Does NOT require root on macOS (ES framework works with user consent)
- Does NOT replace L2 sandbox (complementary, not替代)

## References

- eBPF: https://ebpf.io/
- Endpoint Security: https://developer.apple.com/documentation/endpointsecurity
- gVisor (L2): https://gvisor.dev/
- Community feedback: @Correctover, @wrencalloway, @mayank609 (CrewAI #6463)
