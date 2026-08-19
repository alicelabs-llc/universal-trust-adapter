/*
 * MarketNow Sentinel L4 — Process Monitor (eBPF)
 * ================================================
 *
 * Intercepts process creation from MCP server processes.
 * If the spawned binary is not in the L2 baseline allowlist,
 * generates a CRITICAL alert.
 *
 * Q4 2026 — Prototype
 */

#include <linux/bpf.h>
#include <linux/sched.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

struct process_event {
    u32 pid;          // child PID
    u32 parent_pid;   // parent PID
    u64 timestamp;
    char comm[16];     // child process name
    char parent_comm[16]; // parent process name
    char filename[256]; // executable path
};

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024);
} process_events SEC(".maps);

// Process allowlist from L2 baseline
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 256);
    __type(key, char[16]);  // process name
    __type(value, u8);      // 1 = allowed
} process_allowlist SEC(".maps");

SEC("tracepoint/syscalls/sys_enter_execve")
int trace_execve(struct trace_event_raw_sys_enter *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u32 parent_pid = bpf_get_current_pid_tgid() & 0xFFFFFFFF;
    
    // Get executable filename
    char filename[256] = {};
    const char *user_filename = (const char *)ctx->args[0];
    bpf_probe_read_user_str(filename, sizeof(filename), user_filename);
    
    // Extract process name (last component of path)
    char comm[16] = {};
    // Simple basename extraction
    int last_slash = -1;
    for (int i = 0; i < 255 && filename[i]; i++) {
        if (filename[i] == '/') last_slash = i;
    }
    int start = last_slash + 1;
    for (int i = 0; i < 15 && filename[start + i]; i++) {
        comm[i] = filename[start + i];
    }
    
    // Check if process is in allowlist
    u8 *allowed = bpf_map_lookup_elem(&process_allowlist, comm);
    if (allowed && *allowed == 1) {
        return 0;  // Process is in L2 baseline — allowed
    }
    
    // Process NOT in allowlist — generate CRITICAL alert
    struct process_event *event;
    event = bpf_ringbuf_reserve(&process_events, sizeof(*event), 0);
    if (!event) return 0;
    
    event->pid = pid;
    event->parent_pid = parent_pid;
    event->timestamp = bpf_ktime_get_ns();
    __builtin_memcpy(event->comm, comm, sizeof(event->comm));
    bpf_get_current_comm(&event->parent_comm, sizeof(event->parent_comm));
    __builtin_memcpy(event->filename, filename, sizeof(event->filename));
    
    bpf_ringbuf_submit(event, 0);
    
    return 0;
}

char LICENSE[] SEC("license") = "GPL";
