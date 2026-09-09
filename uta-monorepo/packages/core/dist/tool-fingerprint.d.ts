/**
 * @marketnow/trust-core
 * Cryptographic Tool Fingerprinting — v5.1.1
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 *
 * Purpose:
 *   Hash the exact tool definitions (MCP tools/list response) at audit time.
 *   Store multiple hash levels: server, tools, schema, description, dependency, commit.
 *   Alert when any hash changes post-audit → auto-revoke Trust Card.
 *
 * Threat model addressed:
 *   - Server-side tool description drift (MCP server changes its tool surface
 *     after audit, scanner saw clean version, real client gets malicious one)
 *   - Dependency update silently changes behavior
 *   - Operator SSH-in patches the deployed binary
 *   - Typosquatting: similar-named tools with subtle behavior differences
 */
/**
 * A single tool fingerprint — covers one MCP tool definition.
 */
export interface ToolFingerprint {
    /** Tool name as returned by tools/list */
    tool_name: string;
    /** SHA-256 of the canonical tool description */
    description_hash: string;
    /** SHA-256 of the canonical JSON Schema for input parameters */
    input_schema_hash: string;
    /** SHA-256 of the canonical JSON Schema for output (if defined) */
    output_schema_hash: string | null;
    /** Combined hash: tool_name + description_hash + input_schema_hash */
    tool_hash: string;
}
/**
 * A complete fingerprint set for an MCP server at a point in time.
 * Stored in the ATC at audit time. Verifiers compare against the live
 * tools/list response to detect drift.
 */
export interface ToolFingerprintSet {
    /** SHA-256 of the server URL + transport (stdio/sse/http) */
    server_hash: string;
    /** SHA-256 of the sorted concatenation of all tool_hashes */
    tools_hash: string;
    /** Array of per-tool fingerprints */
    tools: ToolFingerprint[];
    /** SHA-256 of the package.json or equivalent manifest */
    manifest_hash: string | null;
    /** SHA-256 of the lockfile (package-lock.json / yarn.lock / Cargo.lock) */
    lockfile_hash: string | null;
    /** SHA-256 of the dependency tree (resolved, not declared) */
    dependency_hash: string | null;
    /** Git commit SHA of the source at audit time */
    commit_sha: string | null;
    /** npm tarball SHA-256 */
    npm_tarball_hash: string | null;
    /** Container image digest (sha256:...) if running in a container */
    container_hash: string | null;
    /** When this fingerprint was computed */
    computed_at: string;
    /** Version of the fingerprinting algorithm */
    fingerprint_version: '1.0.0';
}
/**
 * Result of comparing two fingerprint sets.
 */
export interface FingerprintDiff {
    /** Did the server hash change? (server URL or transport) */
    server_changed: boolean;
    /** Did the set of tools change? (added or removed tools) */
    tools_set_changed: boolean;
    /** Did any individual tool's hash change? */
    tool_descriptions_changed: string[];
    /** Did the manifest hash change? (package.json modified) */
    manifest_changed: boolean;
    /** Did the lockfile hash change? (dependency version changed) */
    lockfile_changed: boolean;
    /** Did the dependency tree hash change? (transitive dep updated) */
    dependency_changed: boolean;
    /** Did the commit SHA change? (source code updated) */
    commit_changed: boolean;
    /** Did the npm tarball hash change? (package re-published) */
    npm_tarball_changed: boolean;
    /** Did the container image digest change? (image rebuilt) */
    container_changed: boolean;
    /** Severity: 'none' | 'info' | 'warn' | 'critical' */
    severity: 'none' | 'info' | 'warn' | 'critical';
    /** Should the ATC be auto-revoked based on this diff? */
    should_auto_revoke: boolean;
    /** Human-readable summary */
    summary: string;
}
/**
 * MCP tool definition (subset of the standard MCP tools/list response).
 * Matches the MCP spec at https://spec.modelcontextprotocol.io/specification/2024-11-05/server/tools/
 */
export interface McpToolDefinition {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    annotations?: Record<string, unknown>;
}
/**
 * Compute the fingerprint of a single tool.
 *
 * Tool hash = SHA-256(canonical(tool_name + description_hash + input_schema_hash))
 *
 * The tool_name is included in the tool_hash so that two tools with the same
 * description but different names produce different hashes (catches typosquatting).
 */
export declare function computeToolFingerprint(tool: McpToolDefinition): ToolFingerprint;
/**
 * Compute the fingerprint set for an MCP server.
 *
 * @param serverUrl      The server URL or path (e.g. "stdio:/path/to/server" or "https://...")
 * @param transport      The transport type ("stdio" | "sse" | "http")
 * @param tools          The tools/list response from the server
 * @param manifest       Optional: parsed package.json (or equivalent)
 * @param lockfile       Optional: parsed package-lock.json (or equivalent)
 * @param dependencyTree Optional: resolved dependency tree (npm ls --json output)
 * @param commitSha      Optional: git commit SHA of the source
 * @param npmTarballHash Optional: SHA-256 of the npm tarball
 * @param containerDigest Optional: container image digest
 */
export declare function computeFingerprintSet(params: {
    serverUrl: string;
    transport: 'stdio' | 'sse' | 'http';
    tools: McpToolDefinition[];
    manifest?: Record<string, unknown> | null;
    lockfile?: Record<string, unknown> | null;
    dependencyTree?: Record<string, unknown> | null;
    commitSha?: string | null;
    npmTarballHash?: string | null;
    containerDigest?: string | null;
}): ToolFingerprintSet;
/**
 * Compare two fingerprint sets and produce a diff.
 *
 * @param audited  The fingerprint set stored in the ATC (audit-time snapshot)
 * @param current  The fingerprint set computed from the current live tools/list
 */
export declare function diffFingerprints(audited: ToolFingerprintSet, current: ToolFingerprintSet): FingerprintDiff;
/**
 * Compute a minimal fingerprint from just the MCP tools/list response.
 * Useful for verifiers that only have the live response and want to compare
 * against an audited snapshot.
 *
 * @param serverUrl  Server URL or path
 * @param transport  Transport type
 * @param toolsList  Raw tools/list response from the MCP server
 */
export declare function fingerprintFromToolsList(serverUrl: string, transport: 'stdio' | 'sse' | 'http', toolsList: {
    tools: McpToolDefinition[];
} | McpToolDefinition[]): ToolFingerprintSet;
export declare const FINGERPRINT_VERSION = "1.0.0";
export declare const FINGERPRINT_ALGORITHM: {
    readonly hash: "SHA-256";
    readonly canonicalization: "RFC 8785 JCS (simplified)";
    readonly description: "Per-tool: SHA-256(canonical(description)). Combined: SHA-256(sorted(tool_hashes).join(\"|\")).";
};
