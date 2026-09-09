/**
 * @marketnow/trust-core
 * Network/Filesystem/Process Behavior Analysis — v5.2.3
 *
 * Maps all outbound connections, file reads/writes, process spawns during
 * sandbox execution. Flags suspicious patterns:
 * - Cloud metadata endpoints (169.254.169.254)
 * - Credential files (.env, .aws/credentials, .ssh/id_rsa)
 * - System files (/etc/passwd, /etc/shadow)
 * - Shell escapes and process spawns
 *
 * Part of v5.2 BEHAVIOR roadmap (Issue #4).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export type BehaviorFlag = 'credential_file_access' | 'cloud_metadata_access' | 'system_file_access' | 'shell_spawn' | 'network_egress_blocked' | 'dns_over_https' | 'excessive_network_egress' | 'unexpected_process_spawn' | 'write_to_system_path' | 'delete_operation';
export type FlagSeverity = 'info' | 'warn' | 'critical';
export interface NetworkConnection {
    host: string;
    port: number;
    protocol: 'http' | 'https' | 'tcp' | 'udp' | 'dns' | 'doh';
    bytes_sent: number;
    bytes_received: number;
    is_blocked: boolean;
    timestamp: string;
}
export interface FileAccess {
    path: string;
    mode: 'read' | 'write' | 'delete' | 'create';
    bytes: number;
    is_blocked: boolean;
    timestamp: string;
}
export interface ProcessSpawn {
    command: string;
    args: string[];
    exit_code: number | null;
    duration_ms: number;
    is_blocked: boolean;
    timestamp: string;
}
export interface BehaviorAnalysisResult {
    /** Server being analyzed */
    server_id: string;
    server_version: string;
    /** All network connections observed */
    network_connections: NetworkConnection[];
    /** All file accesses observed */
    file_accesses: FileAccess[];
    /** All process spawns observed */
    process_spawns: ProcessSpawn[];
    /** All flags raised */
    flags: Array<{
        type: BehaviorFlag;
        severity: FlagSeverity;
        description: string;
        evidence: string;
        timestamp: string;
    }>;
    /** Classification of the server's behavior */
    classification: 'read-only' | 'write-capable' | 'credential-accessing' | 'network-heavy' | 'shell-capable' | 'suspicious';
    /** Risk assessment */
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    risk_score: number;
    /** Recommendations */
    recommendations: string[];
    /** Analysis timestamp */
    analyzed_at: string;
    analysis_version: '1.0.0';
}
/**
 * Analyze the runtime behavior of an MCP server from sandbox observations.
 *
 * @param networkConnections  All network connections observed during sandbox
 * @param fileAccesses         All file accesses observed during sandbox
 * @param processSpawns        All process spawns observed during sandbox
 * @param serverId             Server identifier
 * @param serverVersion        Server version
 */
export declare function analyzeBehavior(networkConnections: NetworkConnection[], fileAccesses: FileAccess[], processSpawns: ProcessSpawn[], params: {
    server_id: string;
    server_version: string;
}): BehaviorAnalysisResult;
export declare const PATTERNS: {
    credential_files: RegExp[];
    system_files: RegExp[];
    cloud_metadata_hosts: string[];
    doh_providers: string[];
    shell_escapes: RegExp[];
    destructive_commands: RegExp[];
};
export declare const BEHAVIOR_ANALYSIS_VERSION = "1.0.0";
