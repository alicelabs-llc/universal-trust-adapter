/*
 * MarketNow Sentinel L4 — Filesystem Monitor (eBPF)
 * ==================================================
 *
 * Intercepts file writes from MCP server processes.
 * If the path is sensitive (~/.ssh, ~/.aws, /etc, etc.),
 * blocks the write and generates a CRITICAL alert.
 *
 * Q4 2026 — Prototype
 */

#include <linux/bpf.h>
#include <linux/ptrace.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

struct file_event {
    u32 pid;
    u64 timestamp;
    int flags;       // open flags (O_WRONLY, O_RDWR, etc.)
    char path[256];  // file path
    char comm[16];   // process name
};

struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 512 * 1024);  // 512KB
} file_events SEC(".maps");

// Sensitive paths that should NEVER be written by MCP servers
// (checked as prefix matches in userspace)
struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 16);
    __type(key, u32);
    __type(value, char[64]);  // sensitive path prefix
} sensitive_paths SEC(".maps");

SEC("tracepoint/syscalls/sys_enter_openat")
int trace_openat(struct trace_event_raw_sys_enter *ctx) {
    int flags = ctx->args[1];
    
    // Only monitor write operations
    if (!(flags & (O_WRONLY | O_RDWR))) return 0;
    
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    // Get filename from args[0] (const char __user *filename)
    // In tracepoint, args[0] is the filename pointer
    char path[256] = {};
    const char *filename = (const char *)ctx->args[0];
    bpf_probe_read_user_str(path, sizeof(path), filename);
    
    struct file_event *event;
    event = bpf_ringbuf_reserve(&file_events, sizeof(*event), 0);
    if (!event) return 0;
    
    event->pid = pid;
    event->timestamp = bpf_ktime_get_ns();
    event->flags = flags;
    __builtin_memcpy(event->path, path, sizeof(event->path));
    bpf_get_current_comm(&event->comm, sizeof(event->comm));
    
    bpf_ringbuf_submit(event, 0);
    
    // Note: actual blocking requires eBPF LSM (Linux Security Module),
    // not just tracepoints. For prototype, we log only.
    // Production version would use BPF_PROG_ATTACH with BPF_LSM.
    
    return 0;
}

SEC("tracepoint/syscalls/sys_enter_unlinkat")
int trace_unlinkat(struct trace_event_raw_sys_enter *ctx) {
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    
    char path[256] = {};
    const char *filename = (const char *)ctx->args[1];
    bpf_probe_read_user_str(path, sizeof(path), filename);
    
    struct file_event *event;
    event = bpf_ringbuf_reserve(&file_events, sizeof(*event), 0);
    if (!event) return 0;
    
    event->pid = pid;
    event->timestamp = bpf_ktime_get_ns();
    event->flags = 0;  // unlink
    __builtin_memcpy(event->path, path, sizeof(event->path));
    bpf_get_current_comm(&event->comm, sizeof(event->comm));
    
    bpf_ringbuf_submit(event, 0);
    return 0;
}

char LICENSE[] SEC("license") = "GPL";
