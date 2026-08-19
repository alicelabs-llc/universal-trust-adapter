/*
 * MarketNow Sentinel L4 — Network Monitor (eBPF)
 * ================================================
 *
 * Intercepts outbound TCP connections from MCP server processes.
 * If the destination domain is not in the L2 baseline allowlist,
 * generates an alert.
 *
 * Q4 2026 — Prototype (not yet integrated into production)
 *
 * Build: 
 *   clang -O2 -g -target bpf -c network_monitor.c -o network_monitor.o
 * 
 * Load:
 *   bpftool prog load network_monitor.o /sys/fs/bpf/marketnow_l4_net
 * 
 * Attach:
 *   bpftool kprobe attach tcp_v4_connect /sys/fs/bpf/marketnow_l4_net
 */

#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/in.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>

// Event structure sent to userspace
struct network_event {
    u32 pid;
    u32 uid;
    u32 daddr;       // destination IP
    u16 dport;       // destination port
    u64 timestamp;
    char comm[16];   // process name
};

// Ring buffer for events
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024);  // 256KB
} events SEC(".maps");

// Allowlist map (populated from L2 baseline)
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1024);
    __type(key, u32);    // destination IP
    __type(value, u8);   // 1 = allowed
} network_allowlist SEC(".maps");

// Alert counter
struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key, u32);
    __type(value, u64);
} alert_count SEC(".maps");

SEC("kprobe/tcp_v4_connect")
int BPF_KPROBE(trace_tcp_v4_connect, struct sock *sk, struct sockaddr *uaddr, int addr_len) {
    struct sockaddr_in *sin = (struct sockaddr_in *)uaddr;
    u32 daddr = sin->sin_addr.s_addr;
    u16 dport = ntohs(sin->sin_port);
    
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u32 uid = bpf_get_current_uid_gid();
    
    // Check if destination is in allowlist
    u8 *allowed = bpf_map_lookup_elem(&network_allowlist, &daddr);
    if (allowed && *allowed == 1) {
        // Destination is in L2 baseline allowlist — allowed
        return 0;
    }
    
    // Destination NOT in allowlist — generate alert
    struct network_event *event;
    event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
    if (!event) return 0;
    
    event->pid = pid;
    event->uid = uid;
    event->daddr = daddr;
    event->dport = dport;
    event->timestamp = bpf_ktime_get_ns();
    bpf_get_current_comm(&event->comm, sizeof(event->comm));
    
    bpf_ringbuf_submit(event, 0);
    
    // Increment alert counter
    u32 key = 0;
    u64 *count = bpf_map_lookup_elem(&alert_count, &key);
    if (count) __sync_fetch_and_add(count, 1);
    
    return 0;
}

SEC("kprobe/tcp_v6_connect")
int BPF_KPROBE(trace_tcp_v6_connect, struct sock *sk, struct sockaddr *uaddr, int addr_len) {
    // Same logic as v4 but for IPv6
    // For prototype, just log
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    struct network_event *event;
    event = bpf_ringbuf_reserve(&events, sizeof(*event), 0);
    if (!event) return 0;
    
    event->pid = pid;
    event->uid = 0;
    event->daddr = 0;  // IPv6 would need larger field
    event->dport = 0;
    event->timestamp = bpf_ktime_get_ns();
    bpf_get_current_comm(&event->comm, sizeof(event->comm));
    
    bpf_ringbuf_submit(event, 0);
    return 0;
}

char LICENSE[] SEC("license") = "GPL";
