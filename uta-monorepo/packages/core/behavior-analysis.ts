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

// ============================================================================
// Types
// ============================================================================

export type BehaviorFlag =
  | 'credential_file_access'
  | 'cloud_metadata_access'
  | 'system_file_access'
  | 'shell_spawn'
  | 'network_egress_blocked'
  | 'dns_over_https'
  | 'excessive_network_egress'
  | 'unexpected_process_spawn'
  | 'write_to_system_path'
  | 'delete_operation';

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
  risk_score: number; // 0-10

  /** Recommendations */
  recommendations: string[];

  /** Analysis timestamp */
  analyzed_at: string;
  analysis_version: '1.0.0';
}

// ============================================================================
// Suspicious patterns
// ============================================================================

const CREDENTIAL_FILE_PATTERNS = [
  /\.env$/i,
  /\.env\./i,
  /\.aws\/credentials/i,
  /\.aws\/config/i,
  /\.ssh\/id_/i,
  /\.ssh\/authorized_keys/i,
  /\.npmrc$/i,
  /\.git-credentials$/i,
  /\.netrc$/i,
  /\.docker\/config/i,
  /kubeconfig/i,
  /\.gcp\/.*key/i,
  /\.config\/gcloud/i,
];

const SYSTEM_FILE_PATTERNS = [
  /^\/etc\/passwd/i,
  /^\/etc\/shadow/i,
  /^\/etc\/sudoers/i,
  /^\/etc\/hosts/i,
  /^\/proc\//i,
  /^\/sys\//i,
  /^\/var\/log\//i,
  /^\/boot\//i,
  /^\/root\//i,
];

const CLOUD_METADATA_HOSTS = [
  '169.254.169.254',        // AWS/GCP/Azure metadata
  'metadata.google.internal', // GCP metadata
  '169.254.169.253',        // Azure metadata
  '100.100.100.200',         // Alibaba Cloud metadata
  'metadata.aws.internal',
];

const DOH_PROVIDERS = [
  'cloudflare-dns.com',
  'dns.google',
  'dns.quad9.net',
  'doh.opendns.com',
  '1.1.1.1',
  '8.8.8.8',
];

const SHELL_ESCAPE_PATTERNS = [
  /bash\s+-c/i,
  /sh\s+-c/i,
  /zsh\s+-c/i,
  /\/bin\/sh/i,
  /\/bin\/bash/i,
  /powershell/i,
  /cmd\.exe/i,
];

const DESTRUCTIVE_COMMANDS = [
  /rm\s+-rf/i,
  /rm\s+-r/i,
  /DROP\s+TABLE/i,
  /DROP\s+DATABASE/i,
  /TRUNCATE/i,
  /DELETE\s+FROM/i,
  /format\s+/i,
  /mkfs/i,
  /dd\s+if=/i,
  /shutdown/i,
  /reboot/i,
];

// ============================================================================
// Analysis functions
// ============================================================================

/**
 * Analyze network connections for suspicious patterns.
 */
function analyzeNetwork(connections: NetworkConnection[]): Array<{ type: BehaviorFlag; severity: FlagSeverity; description: string; evidence: string }> {
  const flags: Array<{ type: BehaviorFlag; severity: FlagSeverity; description: string; evidence: string }> = [];

  for (const conn of connections) {
    // Cloud metadata access
    if (CLOUD_METADATA_HOSTS.some(h => conn.host === h || conn.host.includes(h))) {
      flags.push({
        type: 'cloud_metadata_access',
        severity: 'critical',
        description: `Cloud metadata endpoint accessed: ${conn.host}`,
        evidence: `${conn.host}:${conn.port} (${conn.protocol}) at ${conn.timestamp}`,
      });
    }

    // DNS-over-HTTPS (bypasses local resolver)
    if (conn.protocol === 'doh' || DOH_PROVIDERS.some(p => conn.host.includes(p))) {
      flags.push({
        type: 'dns_over_https',
        severity: 'warn',
        description: `DNS-over-HTTPS request to ${conn.host} (bypasses local resolver)`,
        evidence: `${conn.host} (${conn.protocol}) at ${conn.timestamp}`,
      });
    }

    // Blocked connections
    if (conn.is_blocked) {
      flags.push({
        type: 'network_egress_blocked',
        severity: 'warn',
        description: `Network egress blocked: ${conn.host}`,
        evidence: `Blocked ${conn.host}:${conn.port} at ${conn.timestamp}`,
      });
    }
  }

  // Excessive network egress (> 10 unique hosts)
  const uniqueHosts = new Set(connections.map(c => c.host));
  if (uniqueHosts.size > 10) {
    flags.push({
      type: 'excessive_network_egress',
      severity: 'warn',
      description: `Excessive network egress: ${uniqueHosts.size} unique hosts contacted`,
      evidence: `Hosts: ${Array.from(uniqueHosts).slice(0, 5).join(', ')}...`,
    });
  }

  return flags;
}

/**
 * Analyze file accesses for suspicious patterns.
 */
function analyzeFilesystem(accesses: FileAccess[]): Array<{ type: BehaviorFlag; severity: FlagSeverity; description: string; evidence: string }> {
  const flags: Array<{ type: BehaviorFlag; severity: FlagSeverity; description: string; evidence: string }> = [];

  for (const access of accesses) {
    // Credential file access
    if (CREDENTIAL_FILE_PATTERNS.some(p => p.test(access.path))) {
      flags.push({
        type: 'credential_file_access',
        severity: 'critical',
        description: `Credential file accessed: ${access.path} (${access.mode})`,
        evidence: `${access.mode} ${access.path} (${access.bytes}B) at ${access.timestamp}`,
      });
    }

    // System file access
    if (SYSTEM_FILE_PATTERNS.some(p => p.test(access.path))) {
      flags.push({
        type: 'system_file_access',
        severity: 'critical',
        description: `System file accessed: ${access.path}`,
        evidence: `${access.mode} ${access.path} at ${access.timestamp}`,
      });
    }

    // Write to system path
    if (access.mode === 'write' && /^\/(etc|usr|bin|sbin|boot|proc|sys)/i.test(access.path)) {
      flags.push({
        type: 'write_to_system_path',
        severity: 'critical',
        description: `Write to system path: ${access.path}`,
        evidence: `write ${access.path} (${access.bytes}B) at ${access.timestamp}`,
      });
    }

    // Delete operation
    if (access.mode === 'delete') {
      flags.push({
        type: 'delete_operation',
        severity: 'warn',
        description: `File deleted: ${access.path}`,
        evidence: `delete ${access.path} at ${access.timestamp}`,
      });
    }
  }

  return flags;
}

/**
 * Analyze process spawns for suspicious patterns.
 */
function analyzeProcesses(spawns: ProcessSpawn[]): Array<{ type: BehaviorFlag; severity: FlagSeverity; description: string; evidence: string }> {
  const flags: Array<{ type: BehaviorFlag; severity: FlagSeverity; description: string; evidence: string }> = [];

  for (const spawn of spawns) {
    const fullCommand = `${spawn.command} ${spawn.args.join(' ')}`;

    // Shell escape
    if (SHELL_ESCAPE_PATTERNS.some(p => p.test(fullCommand))) {
      flags.push({
        type: 'shell_spawn',
        severity: 'critical',
        description: `Shell escape detected: ${spawn.command}`,
        evidence: `${fullCommand} at ${spawn.timestamp}`,
      });
    }

    // Destructive command
    if (DESTRUCTIVE_COMMANDS.some(p => p.test(fullCommand))) {
      flags.push({
        type: 'shell_spawn',
        severity: 'critical',
        description: `Destructive command detected: ${fullCommand}`,
        evidence: `${fullCommand} at ${spawn.timestamp}`,
      });
    }

    // Unexpected process spawn (any spawn is suspicious in sandbox)
    if (!spawn.is_blocked) {
      flags.push({
        type: 'unexpected_process_spawn',
        severity: 'warn',
        description: `Process spawned: ${spawn.command}`,
        evidence: `${fullCommand} (exit: ${spawn.exit_code}) at ${spawn.timestamp}`,
      });
    }
  }

  return flags;
}

// ============================================================================
// Main analysis function
// ============================================================================

/**
 * Analyze the runtime behavior of an MCP server from sandbox observations.
 *
 * @param networkConnections  All network connections observed during sandbox
 * @param fileAccesses         All file accesses observed during sandbox
 * @param processSpawns        All process spawns observed during sandbox
 * @param serverId             Server identifier
 * @param serverVersion        Server version
 */
export function analyzeBehavior(
  networkConnections: NetworkConnection[],
  fileAccesses: FileAccess[],
  processSpawns: ProcessSpawn[],
  params: { server_id: string; server_version: string },
): BehaviorAnalysisResult {
  const { server_id, server_version } = params;

  // Run all analyzers
  const networkFlags = analyzeNetwork(networkConnections);
  const fileFlags = analyzeFilesystem(fileAccesses);
  const processFlags = analyzeProcesses(processSpawns);

  const allFlags = [...networkFlags, ...fileFlags, ...processFlags];

  // Add timestamps to flags
  const flagsWithTimestamps = allFlags.map(f => ({
    ...f,
    timestamp: new Date().toISOString(),
  }));

  // Classification
  let classification: BehaviorAnalysisResult['classification'] = 'read-only';

  if (flagsWithTimestamps.some(f => f.type === 'credential_file_access' || f.type === 'cloud_metadata_access')) {
    classification = 'credential-accessing';
  } else if (processSpawns.length > 0) {
    classification = 'shell-capable';
  } else if (fileAccesses.some(f => f.mode === 'write')) {
    classification = 'write-capable';
  } else if (networkConnections.length > 5) {
    classification = 'network-heavy';
  }

  // If any critical flags, mark as suspicious
  if (flagsWithTimestamps.some(f => f.severity === 'critical')) {
    classification = 'suspicious';
  }

  // Risk score (0-10)
  const criticalCount = flagsWithTimestamps.filter(f => f.severity === 'critical').length;
  const warnCount = flagsWithTimestamps.filter(f => f.severity === 'warn').length;

  let riskScore = 0;
  if (criticalCount > 0) riskScore = Math.min(10, 5 + criticalCount * 2);
  else if (warnCount > 0) riskScore = Math.min(5, warnCount);

  const riskLevel = riskScore >= 8 ? 'critical' : riskScore >= 5 ? 'high' : riskScore >= 3 ? 'medium' : 'low';

  // Recommendations
  const recommendations: string[] = [];
  if (classification === 'credential-accessing') {
    recommendations.push('BLOCK: Server attempted to access credential files. Do not trust.');
  }
  if (classification === 'suspicious') {
    recommendations.push('BLOCK: Critical behavior flags detected during sandbox analysis.');
  }
  if (classification === 'shell-capable') {
    recommendations.push('WARN: Server can spawn processes. Require additional approval before deployment.');
  }
  if (networkFlags.some(f => f.type === 'cloud_metadata_access')) {
    recommendations.push('BLOCK: Cloud metadata access detected. This is a credential exfiltration vector.');
  }
  if (networkFlags.some(f => f.type === 'dns_over_https')) {
    recommendations.push('WARN: DNS-over-HTTPS detected. Server is bypassing local DNS resolver.');
  }
  if (fileFlags.some(f => f.type === 'write_to_system_path')) {
    recommendations.push('BLOCK: Write to system path detected. This can compromise the host.');
  }
  if (processFlags.some(f => f.type === 'shell_spawn')) {
    recommendations.push('BLOCK: Shell escape or destructive command detected.');
  }
  if (recommendations.length === 0) {
    recommendations.push('PASS: No suspicious behavior detected during sandbox analysis.');
  }

  return {
    server_id,
    server_version,
    network_connections: networkConnections,
    file_accesses: fileAccesses,
    process_spawns: processSpawns,
    flags: flagsWithTimestamps,
    classification,
    risk_level: riskLevel as 'low' | 'medium' | 'high' | 'critical',
    risk_score: riskScore,
    recommendations,
    analyzed_at: new Date().toISOString(),
    analysis_version: '1.0.0',
  };
}

// ============================================================================
// Exported pattern lists (for testing and customization)
// ============================================================================

export const PATTERNS = {
  credential_files: CREDENTIAL_FILE_PATTERNS,
  system_files: SYSTEM_FILE_PATTERNS,
  cloud_metadata_hosts: CLOUD_METADATA_HOSTS,
  doh_providers: DOH_PROVIDERS,
  shell_escapes: SHELL_ESCAPE_PATTERNS,
  destructive_commands: DESTRUCTIVE_COMMANDS,
};

export const BEHAVIOR_ANALYSIS_VERSION = '1.0.0';
