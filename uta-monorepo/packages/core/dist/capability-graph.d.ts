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
export type CapabilityLevel = 'none' | 'read' | 'read-write' | 'full';
export type NetworkScope = 'none' | 'allowlist' | 'all';
export type ShellAccess = 'none' | 'sandboxed' | 'unrestricted';
export type CredentialAccess = 'none' | 'env_allowlist' | 'all_env' | 'file_access';
export interface CapabilityManifest {
    /** Tool identifier */
    tool_id: string;
    tool_name: string;
    tool_version: string;
    /** Filesystem capabilities */
    filesystem: {
        read: CapabilityLevel;
        write: CapabilityLevel;
        allowed_paths: string[];
        denied_paths: string[];
    };
    /** Network capabilities */
    network: {
        egress: NetworkScope;
        ingress: NetworkScope;
        allowed_hosts: string[];
        denied_hosts: string[];
        allowed_ports: number[];
    };
    /** Shell capabilities */
    shell: {
        exec: ShellAccess;
        spawn: ShellAccess;
        allowed_commands: string[];
        denied_commands: string[];
    };
    /** Credential access */
    credentials: {
        read_env: CredentialAccess;
        read_files: CredentialAccess;
        allowed_env_vars: string[];
        denied_env_vars: string[];
    };
    /** Process capabilities */
    process: {
        subprocess: 'none' | 'allowlist' | 'all';
        signals: 'own' | 'all';
        allowed_processes: string[];
    };
    /** Payment capabilities */
    payment: {
        max_spend_usd: number;
        allowed_merchants: string[];
        require_approval_above: number;
    };
    /** Data egress */
    data: {
        pii_access: boolean;
        secrets_access: boolean;
        external_api_calls: boolean;
        data_residency: string[];
    };
    /** Manifest version */
    manifest_version: '1.0.0';
}
export interface CapabilityCheckResult {
    /** The capability being checked */
    capability: string;
    /** Whether the action is allowed */
    allowed: boolean;
    /** Reason if denied */
    reason?: string;
    /** The rule that triggered the decision */
    rule?: string;
}
export interface CapabilityMatchResult {
    /** Does the manifest cover all required capabilities? */
    matches: boolean;
    /** Capabilities that are satisfied */
    satisfied: string[];
    /** Capabilities that are NOT satisfied */
    unsatisfied: Array<{
        capability: string;
        required: string;
        actual: string;
        reason: string;
    }>;
}
/**
 * Deep-partial capability requirements — only the fields you specify are
 * enforced (used by org policies: "filesystem read only, no shell", etc.).
 * Unlike Partial<CapabilityManifest>, nested groups may also be partial.
 */
export interface CapabilityRequirements {
    tool_id?: string;
    tool_name?: string;
    tool_version?: string;
    filesystem?: Partial<CapabilityManifest['filesystem']>;
    network?: Partial<CapabilityManifest['network']>;
    shell?: Partial<CapabilityManifest['shell']>;
    credentials?: Partial<CapabilityManifest['credentials']>;
    process?: Partial<CapabilityManifest['process']>;
    payment?: Partial<CapabilityManifest['payment']>;
    data?: Partial<CapabilityManifest['data']>;
    manifest_version?: '1.0.0';
}
/** Minimal safe capability set — read-only, no network, no shell */
export declare const MINIMAL_SAFE: Partial<CapabilityManifest>;
/** Full access capability set — everything allowed (use with caution) */
export declare const FULL_ACCESS: Partial<CapabilityManifest>;
/**
 * Check if a filesystem access is allowed by the capability manifest.
 */
export declare function checkFilesystemAccess(manifest: CapabilityManifest, path: string, mode: 'read' | 'write' | 'delete'): CapabilityCheckResult;
/**
 * Check if a network connection is allowed.
 */
export declare function checkNetworkAccess(manifest: CapabilityManifest, host: string, port: number): CapabilityCheckResult;
/**
 * Check if a shell command is allowed.
 */
export declare function checkShellAccess(manifest: CapabilityManifest, command: string): CapabilityCheckResult;
/**
 * Check if an environment variable read is allowed.
 */
export declare function checkCredentialAccess(manifest: CapabilityManifest, envVar: string): CapabilityCheckResult;
/**
 * Check if a payment is allowed.
 */
export declare function checkPaymentAccess(manifest: CapabilityManifest, amountUsd: number, merchant?: string): CapabilityCheckResult;
/**
 * Check if a capability manifest satisfies a set of requirements.
 */
export declare function matchCapabilities(manifest: CapabilityManifest, requirements: CapabilityRequirements): CapabilityMatchResult;
export declare const CAPABILITY_GRAPH_VERSION = "1.0.0";
export declare const CAPABILITY_LEVELS: {
    readonly filesystem: readonly ["none", "read", "read-write", "full"];
    readonly network: readonly ["none", "allowlist", "all"];
    readonly shell: readonly ["none", "sandboxed", "unrestricted"];
    readonly credentials: readonly ["none", "env_allowlist", "all_env", "file_access"];
};
