"use strict";
/**
 * @marketnow/trust-core
 * Capability Graph — v5.3.1
 *
 * Machine-readable capability manifest per tool.
 * Trust Card declares capabilities like:
 *   filesystem.read, network.discord.com, shell.execute=NO
 *
 * Part of v5.3 POLICY roadmap (Issue #5).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CAPABILITY_LEVELS = exports.CAPABILITY_GRAPH_VERSION = exports.FULL_ACCESS = exports.MINIMAL_SAFE = void 0;
exports.checkFilesystemAccess = checkFilesystemAccess;
exports.checkNetworkAccess = checkNetworkAccess;
exports.checkShellAccess = checkShellAccess;
exports.checkCredentialAccess = checkCredentialAccess;
exports.checkPaymentAccess = checkPaymentAccess;
exports.matchCapabilities = matchCapabilities;
// ============================================================================
// Predefined capability levels
// ============================================================================
/** Minimal safe capability set — read-only, no network, no shell */
exports.MINIMAL_SAFE = {
    filesystem: {
        read: 'read',
        write: 'none',
        allowed_paths: ['/tmp/', '/var/lib/mcp/'],
        denied_paths: ['/.env', '~/.aws/', '~/.ssh/', '/etc/passwd'],
    },
    network: {
        egress: 'none',
        ingress: 'none',
        allowed_hosts: [],
        denied_hosts: [],
        allowed_ports: [],
    },
    shell: {
        exec: 'none',
        spawn: 'none',
        allowed_commands: [],
        denied_commands: ['rm', 'dd', 'mkfs', 'shutdown', 'reboot'],
    },
    credentials: {
        read_env: 'none',
        read_files: 'none',
        allowed_env_vars: [],
        denied_env_vars: ['*'],
    },
    process: {
        subprocess: 'none',
        signals: 'own',
        allowed_processes: [],
    },
    payment: {
        max_spend_usd: 0,
        allowed_merchants: [],
        require_approval_above: 0,
    },
    data: {
        pii_access: false,
        secrets_access: false,
        external_api_calls: false,
        data_residency: [],
    },
};
/** Full access capability set — everything allowed (use with caution) */
exports.FULL_ACCESS = {
    filesystem: {
        read: 'full',
        write: 'full',
        allowed_paths: ['/'],
        denied_paths: [],
    },
    network: {
        egress: 'all',
        ingress: 'all',
        allowed_hosts: [],
        denied_hosts: [],
        allowed_ports: [],
    },
    shell: {
        exec: 'unrestricted',
        spawn: 'unrestricted',
        allowed_commands: [],
        denied_commands: [],
    },
    credentials: {
        read_env: 'all_env',
        read_files: 'file_access',
        allowed_env_vars: [],
        denied_env_vars: [],
    },
    process: {
        subprocess: 'all',
        signals: 'all',
        allowed_processes: [],
    },
    payment: {
        max_spend_usd: 100,
        allowed_merchants: [],
        require_approval_above: 10,
    },
    data: {
        pii_access: true,
        secrets_access: true,
        external_api_calls: true,
        data_residency: [],
    },
};
// ============================================================================
// Capability checking
// ============================================================================
const SENSITIVE_PATHS = [
    /^\.env$/i, /^\.env\./i, /^\.aws\//i, /^\.ssh\//i, /^\.npmrc$/i,
    /^\/etc\/passwd/i, /^\/etc\/shadow/i, /^\/etc\/sudoers/i,
    /^\/root\//i, /^\/proc\//i, /^\/sys\//i,
];
const DANGEROUS_COMMANDS = [
    'rm -rf', 'rm -r', 'DROP TABLE', 'DROP DATABASE', 'TRUNCATE',
    'DELETE FROM', 'format', 'mkfs', 'dd if=', 'shutdown', 'reboot',
    ':(){:|:&};:', // fork bomb
];
/**
 * Check if a filesystem access is allowed by the capability manifest.
 */
function checkFilesystemAccess(manifest, path, mode) {
    // Check denied paths first
    for (const denied of manifest.filesystem.denied_paths) {
        const pattern = new RegExp(denied.replace(/\*/g, '.*'));
        if (pattern.test(path)) {
            return { capability: `filesystem.${mode}`, allowed: false, reason: `Path ${path} is in denied list`, rule: 'denied_path' };
        }
    }
    // Check sensitive paths
    if (SENSITIVE_PATHS.some(p => p.test(path))) {
        if (mode === 'write' || mode === 'delete') {
            return { capability: `filesystem.${mode}`, allowed: false, reason: `Sensitive path: ${path}`, rule: 'sensitive_path' };
        }
        if (manifest.credentials.read_files === 'none') {
            return { capability: `filesystem.${mode}`, allowed: false, reason: `Credential file access blocked: ${path}`, rule: 'credential_protection' };
        }
    }
    // Check allowed paths
    if (manifest.filesystem.allowed_paths.length > 0) {
        const inAllowed = manifest.filesystem.allowed_paths.some(allowed => path.startsWith(allowed));
        if (!inAllowed) {
            return { capability: `filesystem.${mode}`, allowed: false, reason: `Path ${path} not in allowlist`, rule: 'not_allowlisted' };
        }
    }
    // Check write level
    if (mode === 'write' && manifest.filesystem.write === 'none') {
        return { capability: 'filesystem.write', allowed: false, reason: 'Write access not granted', rule: 'no_write_capability' };
    }
    if (mode === 'delete' && manifest.filesystem.write !== 'read-write' && manifest.filesystem.write !== 'full') {
        return { capability: 'filesystem.delete', allowed: false, reason: 'Delete requires write access', rule: 'insufficient_write_level' };
    }
    return { capability: `filesystem.${mode}`, allowed: true };
}
/**
 * Check if a network connection is allowed.
 */
function checkNetworkAccess(manifest, host, port) {
    // Check denied hosts
    for (const denied of manifest.network.denied_hosts) {
        if (host.includes(denied)) {
            return { capability: 'network.egress', allowed: false, reason: `Host ${host} is denied`, rule: 'denied_host' };
        }
    }
    // Cloud metadata endpoints
    if (host === '169.254.169.254' || host === 'metadata.google.internal') {
        return { capability: 'network.egress', allowed: false, reason: 'Cloud metadata endpoint blocked', rule: 'cloud_metadata_blocked' };
    }
    // Check egress level
    if (manifest.network.egress === 'none') {
        return { capability: 'network.egress', allowed: false, reason: 'Network egress is disabled', rule: 'no_egress' };
    }
    if (manifest.network.egress === 'allowlist') {
        const inAllowed = manifest.network.allowed_hosts.some(allowed => host === allowed || host.endsWith('.' + allowed));
        if (!inAllowed) {
            return { capability: 'network.egress', allowed: false, reason: `Host ${host} not in allowlist`, rule: 'not_allowlisted' };
        }
    }
    // Check port restrictions
    if (manifest.network.allowed_ports.length > 0) {
        if (!manifest.network.allowed_ports.includes(port)) {
            return { capability: 'network.egress', allowed: false, reason: `Port ${port} not allowed`, rule: 'port_not_allowed' };
        }
    }
    return { capability: 'network.egress', allowed: true };
}
/**
 * Check if a shell command is allowed.
 */
function checkShellAccess(manifest, command) {
    // Check dangerous commands
    for (const dangerous of DANGEROUS_COMMANDS) {
        if (command.toLowerCase().includes(dangerous.toLowerCase())) {
            return { capability: 'shell.exec', allowed: false, reason: `Dangerous command: ${dangerous}`, rule: 'dangerous_command' };
        }
    }
    // Check denied commands
    for (const denied of manifest.shell.denied_commands) {
        if (command.includes(denied)) {
            return { capability: 'shell.exec', allowed: false, reason: `Command denied: ${denied}`, rule: 'denied_command' };
        }
    }
    // Check shell access level
    if (manifest.shell.exec === 'none') {
        return { capability: 'shell.exec', allowed: false, reason: 'Shell access disabled', rule: 'no_shell_access' };
    }
    if (manifest.shell.exec === 'sandboxed') {
        // In sandboxed mode, check allowed commands
        if (manifest.shell.allowed_commands.length > 0) {
            const cmdBase = command.split(' ')[0];
            const inAllowed = manifest.shell.allowed_commands.includes(cmdBase);
            if (!inAllowed) {
                return { capability: 'shell.exec', allowed: false, reason: `Command ${cmdBase} not in sandbox allowlist`, rule: 'sandbox_violation' };
            }
        }
    }
    return { capability: 'shell.exec', allowed: true };
}
/**
 * Check if an environment variable read is allowed.
 */
function checkCredentialAccess(manifest, envVar) {
    if (manifest.credentials.read_env === 'none') {
        return { capability: 'credentials.read_env', allowed: false, reason: 'Env var access disabled', rule: 'no_env_access' };
    }
    // Check denied env vars
    for (const denied of manifest.credentials.denied_env_vars) {
        if (denied === '*' || envVar === denied) {
            return { capability: 'credentials.read_env', allowed: false, reason: `Env var ${envVar} is denied`, rule: 'denied_env_var' };
        }
    }
    // Check sensitive env var names
    if (envVar.match(/SECRET|KEY|TOKEN|PASSWORD|CREDENTIAL|PRIVATE/i)) {
        if (manifest.credentials.read_env !== 'all_env') {
            return { capability: 'credentials.read_env', allowed: false, reason: `Sensitive env var: ${envVar}`, rule: 'sensitive_env_var' };
        }
    }
    // Check allowlist
    if (manifest.credentials.read_env === 'env_allowlist') {
        if (!manifest.credentials.allowed_env_vars.includes(envVar)) {
            return { capability: 'credentials.read_env', allowed: false, reason: `Env var ${envVar} not in allowlist`, rule: 'not_allowlisted' };
        }
    }
    return { capability: 'credentials.read_env', allowed: true };
}
/**
 * Check if a payment is allowed.
 */
function checkPaymentAccess(manifest, amountUsd, merchant) {
    if (amountUsd > manifest.payment.max_spend_usd) {
        return { capability: 'payment', allowed: false, reason: `Amount ${amountUsd} exceeds max spend ${manifest.payment.max_spend_usd}`, rule: 'max_spend_exceeded' };
    }
    if (merchant && manifest.payment.allowed_merchants.length > 0) {
        if (!manifest.payment.allowed_merchants.includes(merchant)) {
            return { capability: 'payment', allowed: false, reason: `Merchant ${merchant} not allowed`, rule: 'merchant_not_allowed' };
        }
    }
    if (amountUsd > manifest.payment.require_approval_above) {
        return { capability: 'payment', allowed: false, reason: `Amount ${amountUsd} requires approval (threshold: ${manifest.payment.require_approval_above})`, rule: 'approval_required' };
    }
    return { capability: 'payment', allowed: true };
}
// ============================================================================
// Manifest matching (check if a manifest satisfies required capabilities)
// ============================================================================
/**
 * Check if a capability manifest satisfies a set of requirements.
 */
function matchCapabilities(manifest, requirements) {
    const satisfied = [];
    const unsatisfied = [];
    // Check filesystem
    if (requirements.filesystem) {
        if (requirements.filesystem.read && manifest.filesystem.read !== requirements.filesystem.read) {
            const levelOrder = ['none', 'read', 'read-write', 'full'];
            const reqLevel = levelOrder.indexOf(requirements.filesystem.read);
            const actLevel = levelOrder.indexOf(manifest.filesystem.read);
            if (actLevel < reqLevel) {
                unsatisfied.push({ capability: 'filesystem.read', required: requirements.filesystem.read, actual: manifest.filesystem.read, reason: 'Insufficient read level' });
            }
            else {
                satisfied.push('filesystem.read');
            }
        }
        if (requirements.filesystem.write && manifest.filesystem.write !== requirements.filesystem.write) {
            const levelOrder = ['none', 'read', 'read-write', 'full'];
            const reqLevel = levelOrder.indexOf(requirements.filesystem.write);
            const actLevel = levelOrder.indexOf(manifest.filesystem.write);
            if (actLevel < reqLevel) {
                unsatisfied.push({ capability: 'filesystem.write', required: requirements.filesystem.write, actual: manifest.filesystem.write, reason: 'Insufficient write level' });
            }
            else {
                satisfied.push('filesystem.write');
            }
        }
    }
    // Check network
    if (requirements.network) {
        if (requirements.network.egress) {
            const scopeOrder = ['none', 'allowlist', 'all'];
            const reqScope = scopeOrder.indexOf(requirements.network.egress);
            const actScope = scopeOrder.indexOf(manifest.network.egress);
            if (actScope < reqScope) {
                unsatisfied.push({ capability: 'network.egress', required: requirements.network.egress, actual: manifest.network.egress, reason: 'Insufficient network egress' });
            }
            else {
                satisfied.push('network.egress');
            }
        }
    }
    // Check shell
    if (requirements.shell) {
        if (requirements.shell.exec) {
            const shellOrder = ['none', 'sandboxed', 'unrestricted'];
            const reqShell = shellOrder.indexOf(requirements.shell.exec);
            const actShell = shellOrder.indexOf(manifest.shell.exec);
            if (actShell < reqShell) {
                unsatisfied.push({ capability: 'shell.exec', required: requirements.shell.exec, actual: manifest.shell.exec, reason: 'Insufficient shell access' });
            }
            else {
                satisfied.push('shell.exec');
            }
        }
    }
    // Check payment
    if (requirements.payment) {
        if (requirements.payment.max_spend_usd !== undefined) {
            if (manifest.payment.max_spend_usd < requirements.payment.max_spend_usd) {
                unsatisfied.push({ capability: 'payment.max_spend', required: String(requirements.payment.max_spend_usd), actual: String(manifest.payment.max_spend_usd), reason: 'Insufficient max spend' });
            }
            else {
                satisfied.push('payment.max_spend');
            }
        }
    }
    // Check credentials
    if (requirements.credentials) {
        if (requirements.credentials.read_env) {
            const credOrder = ['none', 'env_allowlist', 'all_env', 'file_access'];
            const reqCred = credOrder.indexOf(requirements.credentials.read_env);
            const actCred = credOrder.indexOf(manifest.credentials.read_env);
            if (actCred < reqCred) {
                unsatisfied.push({ capability: 'credentials.read_env', required: requirements.credentials.read_env, actual: manifest.credentials.read_env, reason: 'Insufficient credential access' });
            }
            else {
                satisfied.push('credentials.read_env');
            }
        }
    }
    return {
        matches: unsatisfied.length === 0,
        satisfied,
        unsatisfied,
    };
}
// ============================================================================
// Constants
// ============================================================================
exports.CAPABILITY_GRAPH_VERSION = '1.0.0';
exports.CAPABILITY_LEVELS = {
    filesystem: ['none', 'read', 'read-write', 'full'],
    network: ['none', 'allowlist', 'all'],
    shell: ['none', 'sandboxed', 'unrestricted'],
    credentials: ['none', 'env_allowlist', 'all_env', 'file_access'],
};
