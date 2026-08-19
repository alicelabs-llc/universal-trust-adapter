#!/usr/bin/env python3
# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# MarketNow — L2 Behavioral Analysis (v2.5 — gVisor + enhanced seccomp)
# =====================================================================
#
# This script analyzes results from:
#   1. Docker/gVisor container stdout (passive — grep patterns)
#   2. gVisor syscall log OR strace output (syscall monitoring)
#   3. MCP probe results (active testing — adversarial inputs)
#   4. Filesystem diff (files created/modified outside /tmp)
#   5. Seccomp violations (syscalls blocked by L2.5 seccomp profile)
#
# v2.5 additions:
#   - gVisor syscall log parsing (more detailed than strace)
#   - Seccomp violation detection (blocked syscalls = intent to do bad things)
#   - /proc and /sys access detection (gVisor virtualizes these)
#   - Suspicious file creation detection (.ssh, .env, cron, etc.)
#   - Enhanced scoring with seccomp violations
#
# Usage: python3 scripts/l2-analyze.py
# Env:   SKILL_ID — required
# Input: /tmp/l2_output/stdout.log           (Docker/gVisor container output)
#        /tmp/l2_output/gvisor_syscalls.log   (gVisor or strace syscall log)
#        /tmp/l2_output/probe_results.json    (MCP probe adversarial results)
#        /tmp/l2_output/fs_diff.txt           (filesystem changes diff)
#        /tmp/l2_output/suspicious_files.txt  (suspicious files detected)
#        /tmp/l2_output/seccomp-l25.json      (seccomp profile used)
# Output: /tmp/l2_output/result.json          (final L2 result)
#        /tmp/l2_output/fs_diff.txt        (filesystem changes diff)
# Output: /tmp/l2_output/result.json       (final L2 result)

import json
import re
import os
import datetime
import sys

skill_id = os.environ.get('SKILL_ID')
if not skill_id:
    print('::error::SKILL_ID env var required', file=sys.stderr)
    sys.exit(1)

stdout_path = '/tmp/l2_output/stdout.log'
strace_path = '/tmp/l2_output/strace.log'
probe_path = '/tmp/l2_output/probe_results.json'
fs_diff_path = '/tmp/l2_output/fs_diff.txt'
result_path = '/tmp/l2_output/result.json'

# ═══════════════════════════════════════════════════════════════════════════
# 1. STDOUT ANALYSIS (passive — same as before but enhanced)
# ═══════════════════════════════════════════════════════════════════════════

try:
    with open(stdout_path, 'rb') as f:
        raw = f.read()
    text = raw.decode('utf-8', errors='replace')
except FileNotFoundError:
    text = ''
    raw = b''

stdout_patterns = {
    'network_attempts':    r'ECONNREFUSED|ENOTFOUND|ETIMEDOUT|\bconnect\b|\bfetch\b|\bhttp\b',
    'fs_write_attempts':   r'EROFS|read.only|permission.denied|EACCES',
    'process_spawns':      r'\bspawn\b|\bexec\b|\bfork\b|child_process',
    'credential_leakage':  r'api.key|token|secret|password|private.key|mnemonic',
    'crash_detected':      r'SIGSEGV|SIGKILL|OOM|crash|fatal',
    'dynamic_imports':     r'require\(|import.*dynamic|eval\(',
}

stdout_findings = {}
for key, pat in stdout_patterns.items():
    try:
        stdout_findings[key] = sum(1 for line in text.splitlines() if re.search(pat, line, re.IGNORECASE))
    except re.error:
        stdout_findings[key] = 0

# ═══════════════════════════════════════════════════════════════════════════
# 2. STRACE ANALYSIS (syscall monitoring — NEW)
# ═══════════════════════════════════════════════════════════════════════════

strace_findings = {
    'file_access_sensitive': 0,    # open/openat on /etc/shadow, ~/.ssh, etc.
    'file_write_outside_tmp': 0,   # write/unlink outside /tmp
    'network_connect': 0,          # connect() syscall
    'process_exec': 0,             # execve syscall
    'process_fork': 0,             # fork/clone syscall
    'permission_escalation': 0,    # chmod/chown/setuid
    'sensitive_paths_accessed': [],
}

strace_text = ''
try:
    with open(strace_path, 'r') as f:
        strace_text = f.read()
except FileNotFoundError:
    pass

# Parse strace lines for sensitive syscalls
SENSITIVE_PATHS = [
    '/etc/shadow', '/etc/passwd', '/etc/sudoers',
    '.ssh/id_rsa', '.ssh/id_ed25519', '.ssh/authorized_keys',
    '.aws/credentials', '.env', '.gnupg',
    '/root/.bash_history', '/proc/self/environ',
]

for line in strace_text.splitlines():
    # open/openat on sensitive paths
    if 'open' in line and ('"' in line):
        for path in SENSITIVE_PATHS:
            if path in line:
                strace_findings['file_access_sensitive'] += 1
                strace_findings['sensitive_paths_accessed'].append(path)
                break

    # connect() — network attempts
    if 'connect(' in line and 'AF_INET' in line:
        strace_findings['network_connect'] += 1

    # execve — process execution
    if 'execve(' in line:
        strace_findings['process_exec'] += 1

    # fork/clone — process creation
    if 'fork(' in line or 'clone(' in line:
        strace_findings['process_fork'] += 1

    # chmod/chown/setuid — privilege escalation
    if 'chmod(' in line or 'chown(' in line or 'setuid(' in line:
        strace_findings['permission_escalation'] += 1

    # unlink/write outside /tmp
    if ('unlink(' in line or 'write(' in line) and '/tmp/' not in line:
        # Check if it's a real filesystem path (not a pipe/socket)
        if '"' in line and not any(x in line for x in ['pipe', 'socket', 'dev/null', '/dev/']):
            strace_findings['file_write_outside_tmp'] += 1

# ═══════════════════════════════════════════════════════════════════════════
# 3. MCP PROBE ANALYSIS (active adversarial testing — NEW)
# ═══════════════════════════════════════════════════════════════════════════

probe_findings = {
    'tools_discovered': 0,
    'tools_tested': 0,
    'adversarial_findings': 0,
    'critical_findings': 0,
    'high_findings': 0,
    'details': [],
    'leaked_data': [],
}

probe_data = None
try:
    with open(probe_path, 'r') as f:
        probe_data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass

if probe_data:
    probe_findings['tools_discovered'] = probe_data.get('summary', {}).get('tools_discovered', 0)
    probe_findings['tools_tested'] = probe_data.get('summary', {}).get('tools_tested', 0)
    probe_findings['adversarial_findings'] = probe_data.get('summary', {}).get('adversarial_findings', 0)

    for test in probe_data.get('adversarial_tests', []):
        detail = {
            'tool': test.get('tool'),
            'category': test.get('category'),
            'severity': test.get('severity'),
            'result': test.get('result'),
        }
        probe_findings['details'].append(detail)

        if test.get('result') == 'POTENTIAL_LEAK':
            probe_findings['critical_findings'] += 1
            probe_findings['leaked_data'].append({
                'tool': test.get('tool'),
                'leaked_patterns': test.get('leaked_patterns', []),
            })
        elif test.get('result') == 'accepted' and test.get('severity') == 'critical':
            probe_findings['high_findings'] += 1

# ═══════════════════════════════════════════════════════════════════════════
# 4. FILESYSTEM DIFF ANALYSIS (NEW)
# ═══════════════════════════════════════════════════════════════════════════

fs_findings = {
    'files_created': 0,
    'files_modified': 0,
    'files_deleted': 0,
    'suspicious_changes': [],
}

try:
    with open(fs_diff_path, 'r') as f:
        fs_text = f.read()
    for line in fs_text.splitlines():
        if line.startswith('A '):
            fs_findings['files_created'] += 1
            # Flag suspicious paths
            if any(p in line for p in ['.ssh', '.aws', '.env', 'cron', 'bashrc', 'profile']):
                fs_findings['suspicious_changes'].append(line[:200])
        elif line.startswith('M '):
            fs_findings['files_modified'] += 1
        elif line.startswith('D '):
            fs_findings['files_deleted'] += 1
except FileNotFoundError:
    pass

# ═══════════════════════════════════════════════════════════════════════════
# 5. COMBINED SCORING (enhanced with active + strace + fs)
# ═══════════════════════════════════════════════════════════════════════════

sample = text[:500]
sample = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', sample).replace('\n', ' ').replace('\r', ' ')

# Determine execution status
execution_status = 'ran'
failure_reason = None

if len(raw) == 0:
    execution_status = 'ran_idle'
    failure_reason = 'Empty stdout — MCP server likely started and is waiting for stdin handshake.'
elif re.search(r'Cannot find module|MODULE_NOT_FOUND|Error: Cannot find', text):
    execution_status = 'failed_to_start'
    failure_reason = 'Node.js MODULE_NOT_FOUND — fallback Dockerfile entrypoint mismatch.'
elif re.search(r'Command \[.*\] exited with|sh: .*: not found|No such file or directory', text):
    execution_status = 'failed_to_start'
    failure_reason = 'Container command failed to execute.'
elif re.search(r'Traceback \(most recent call last\)|ImportError|ModuleNotFoundError', text):
    execution_status = 'failed_to_start'
    failure_reason = 'Python crashed on startup.'

# ═══════════════════════════════════════════════════════════════════════════
# 5. L2.5 SECCOMP VIOLATIONS ANALYSIS (NEW — blocked syscalls = malicious intent)
# ═══════════════════════════════════════════════════════════════════════════

seccomp_findings = {
    'total_violations': 0,
    'ptrace_attempted': False,
    'bpf_attempted': False,
    'mount_attempted': False,
    'kexec_attempted': False,
    'clone3_attempted': False,
    'unshare_attempted': False,
    'blocked_syscalls': [],
}

# Check stdout for seccomp violation messages (Docker outputs "Operation not permitted")
if 'Operation not permitted' in text or 'EPERM' in text or 'SCMP_ACT_ERRNO' in text:
    seccomp_findings['total_violations'] = text.count('Operation not permitted') + text.count('EPERM')
    if 'ptrace' in text.lower(): seccomp_findings['ptrace_attempted'] = True
    if 'bpf' in text.lower(): seccomp_findings['bpf_attempted'] = True
    if 'mount' in text.lower(): seccomp_findings['mount_attempted'] = True
    if 'kexec' in text.lower(): seccomp_findings['kexec_attempted'] = True
    if 'clone3' in text.lower(): seccomp_findings['clone3_attempted'] = True
    if 'unshare' in text.lower(): seccomp_findings['unshare_attempted'] = True

# Also check gVisor syscall log for blocked attempts
gvisor_text = ''
try:
    with open('/tmp/l2_output/gvisor_syscalls.log', 'r') as f:
        gvisor_text = f.read()
    if 'EPERM' in gvisor_text or 'denied' in gvisor_text.lower():
        seccomp_findings['total_violations'] += gvisor_text.count('EPERM') + gvisor_text.lower().count('denied')
except FileNotFoundError:
    pass

# ═══════════════════════════════════════════════════════════════════════════
# 6. L2.5 SUSPICIOUS FILES ANALYSIS (NEW — .ssh, .env, cron, keys)
# ═══════════════════════════════════════════════════════════════════════════

suspicious_file_findings = {
    'ssh_files': False,
    'env_files': False,
    'cron_files': False,
    'key_files': False,
    'details': [],
}

suspicious_path = '/tmp/l2_output/suspicious_files.txt'
try:
    with open(suspicious_path, 'r') as f:
        suspicious_content = f.read()
    if '.ssh' in suspicious_content or 'id_rsa' in suspicious_content or 'authorized_keys' in suspicious_content:
        suspicious_file_findings['ssh_files'] = True
    if '.env' in suspicious_content:
        suspicious_file_findings['env_files'] = True
    if 'cron' in suspicious_content:
        suspicious_file_findings['cron_files'] = True
    if '.key' in suspicious_content or '.pem' in suspicious_content or '.p12' in suspicious_content:
        suspicious_file_findings['key_files'] = True
    suspicious_file_findings['details'] = suspicious_content[:500]
except FileNotFoundError:
    pass

# ═══════════════════════════════════════════════════════════════════════════
# 6.5 L2.6 EGRESS PROXY ANALYSIS (NEW — domain allowlist enforcement)
# ═══════════════════════════════════════════════════════════════════════════

egress_findings = {
    'total_requests': 0,
    'allowed_requests': 0,
    'blocked_requests': 0,
    'blocked_domains': [],
    'allowed_domains': [],
    'metadata_endpoint_access': False,
    'localhost_access': False,
    'private_range_access': False,
}

egress_log_path = '/tmp/l2_output/egress_log.json'
try:
    with open(egress_log_path, 'r') as f:
        egress_entries = json.load(f)
    for entry in egress_entries:
        action = entry.get('action', '')
        hostname = entry.get('hostname', '')
        
        if action in ('ALLOWED', 'BLOCKED'):
            egress_findings['total_requests'] += 1
        
        if action == 'ALLOWED':
            egress_findings['allowed_requests'] += 1
            if hostname not in egress_findings['allowed_domains']:
                egress_findings['allowed_domains'].append(hostname)
        
        if action == 'BLOCKED':
            egress_findings['blocked_requests'] += 1
            if hostname not in egress_findings['blocked_domains']:
                egress_findings['blocked_domains'].append(hostname)
        
        # Check for dangerous endpoints
        if '169.254.169.254' in hostname:
            egress_findings['metadata_endpoint_access'] = True
        if hostname in ('127.0.0.1', 'localhost', '0.0.0.0', '::1'):
            egress_findings['localhost_access'] = True
        if any(hostname.startswith(p) for p in ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.']):
            egress_findings['private_range_access'] = True
except (FileNotFoundError, json.JSONDecodeError):
    pass

# ═══════════════════════════════════════════════════════════════════════════
# 7. COMBINED SCORING (v2.5 — 6 analysis layers)
# ═══════════════════════════════════════════════════════════════════════════

# Read gVisor status (written by the workflow)
gvisor_status = 'unknown'
try:
    with open('/tmp/l2_output/gvisor_status.txt', 'r') as f:
        gvisor_status = f.read().strip()
except FileNotFoundError:
    # If gvisor_status.txt doesn't exist, check if runsc was used
    # by looking at gvisor_syscalls.log content
    if gvisor_text:
        gvisor_status = 'gvisor-active'
    else:
        gvisor_status = 'seccomp-fallback'

# Build enhanced result
result = {
    'skill_id': skill_id,
    'timestamp': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    'l2_version': '2.5',
    'sandbox_config': {
        'network': 'none',
        'filesystem': 'read-only',
        'capabilities': 'dropped ALL',
        'memory': '256m',
        'cpu': '0.5',
        'pids': '64',
        'timeout': '60s',
        'gvisor': gvisor_status,
        'seccomp_profile': 'L2.5 strict (blocks ptrace, bpf, mount, kexec, clone3, unshare, etc.)' if gvisor_status == 'seccomp-fallback' else 'n/a (gVisor userspace kernel active)',
    },
    'execution_status': execution_status,
    'failure_reason': failure_reason,
    'analysis_layers': {
        'stdout_passive': stdout_findings,
        'strace_syscalls': strace_findings,
        'mcp_probe_active': probe_findings,
        'filesystem_diff': fs_findings,
        'l25_seccomp_violations': seccomp_findings,
        'l25_suspicious_files': suspicious_file_findings,
        'l26_egress_proxy': egress_findings,
    },
    'stdout_size_bytes': len(raw),
    'stdout_sample': sample,
    'l2_score': 0,
    'l2_risk_level': 'unknown',
}

# Enhanced scoring — combines all 4 analysis layers
if execution_status == 'failed_to_start':
    score = 0
    risk = 'unknown'
else:
    score = 10

    # STDOUT penalties (passive)
    if stdout_findings['network_attempts']    > 0: score -= 3
    if stdout_findings['fs_write_attempts']   > 0: score -= 2
    if stdout_findings['credential_leakage']  > 0: score -= 5
    if stdout_findings['crash_detected']      > 0: score -= 2

    # STRACE penalties (syscall-level — NEW)
    if strace_findings['file_access_sensitive'] > 0: score -= 5  # Critical: accessed /etc/shadow, .ssh, etc.
    if strace_findings['network_connect'] > 0: score -= 3       # High: tried network connect
    if strace_findings['process_exec'] > 0: score -= 3          # High: spawned processes
    if strace_findings['permission_escalation'] > 0: score -= 4 # High: tried chmod/setuid
    if strace_findings['file_write_outside_tmp'] > 0: score -= 2  # Medium: wrote outside /tmp

    # MCP PROBE penalties (active adversarial — NEW)
    if probe_findings['critical_findings'] > 0: score -= 5      # Critical: leaked data in response
    if probe_findings['high_findings'] > 0: score -= 3          # High: accepted critical adversarial input

    # FILESYSTEM penalties (NEW)
    if len(fs_findings['suspicious_changes']) > 0: score -= 4   # High: modified .ssh/.env/cron

    # L2.5 SECCOMP penalties — blocked syscalls = intent to do something bad
    if seccomp_findings['ptrace_attempted']: score -= 4
    if seccomp_findings['bpf_attempted']: score -= 5
    if seccomp_findings['mount_attempted']: score -= 4
    if seccomp_findings['kexec_attempted']: score -= 5
    if seccomp_findings['clone3_attempted']: score -= 3
    if seccomp_findings['unshare_attempted']: score -= 3
    if seccomp_findings['total_violations'] > 0: score -= 2

    # L2.6 EGRESS PROXY penalties — blocked requests = attempted unauthorized access
    if egress_findings['metadata_endpoint_access']: score -= 5  # Critical: tried to access cloud metadata
    if egress_findings['localhost_access']: score -= 4         # High: tried to access local services
    if egress_findings['private_range_access']: score -= 4     # High: tried to access internal network
    if egress_findings['blocked_requests'] > 0: score -= 2     # Medium: tried to contact non-allowlisted domains
    if egress_findings['total_requests'] > 10: score -= 1      # Low: excessive outbound requests

    # L2.5 SUSPICIOUS FILES penalties
    if suspicious_file_findings['ssh_files']: score -= 5
    if suspicious_file_findings['env_files']: score -= 4
    if suspicious_file_findings['cron_files']: score -= 5
    if suspicious_file_findings['key_files']: score -= 5

    score = max(0, score)

    if   score < 2: risk = 'critical'
    elif score < 4: risk = 'high'
    elif score < 7: risk = 'medium'
    else:           risk = 'low'

result['l2_score'] = score
result['l2_risk_level'] = risk

# Add summary of findings
result['findings_summary'] = {
    'total_critical': (
        (1 if stdout_findings['credential_leakage'] > 0 else 0) +
        (1 if strace_findings['file_access_sensitive'] > 0 else 0) +
        probe_findings['critical_findings'] +
        (1 if len(fs_findings['suspicious_changes']) > 0 else 0)
    ),
    'total_high': (
        (1 if stdout_findings['network_attempts'] > 0 else 0) +
        (1 if strace_findings['network_connect'] > 0 else 0) +
        (1 if strace_findings['process_exec'] > 0 else 0) +
        (1 if strace_findings['permission_escalation'] > 0 else 0) +
        probe_findings['high_findings']
    ),
    'sensitive_paths_accessed': strace_findings['sensitive_paths_accessed'],
    'leaked_data': probe_findings['leaked_data'],
    'suspicious_fs_changes': fs_findings['suspicious_changes'],
        'egress_blocked_domains': egress_findings['blocked_domains'],
        'egress_metadata_access': egress_findings['metadata_endpoint_access'],
}

with open(result_path, 'w') as f:
    json.dump(result, f, indent=2)

print('=== L2 RESULT (v2.5 — gVisor + seccomp + suspicious files) ===')
print(json.dumps(result, indent=2))
print(f'=== stdout sample ===')
print(sample)
