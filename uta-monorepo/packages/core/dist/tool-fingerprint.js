"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINGERPRINT_ALGORITHM = exports.FINGERPRINT_VERSION = void 0;
exports.computeToolFingerprint = computeToolFingerprint;
exports.computeFingerprintSet = computeFingerprintSet;
exports.diffFingerprints = diffFingerprints;
exports.fingerprintFromToolsList = fingerprintFromToolsList;
const node_crypto_1 = require("node:crypto");
// ============================================================================
// Hash helpers
// ============================================================================
/**
 * Compute SHA-256 of a string, return hex.
 */
function sha256(input) {
    return (0, node_crypto_1.createHash)('sha256').update(input, 'utf8').digest('hex');
}
/**
 * Canonicalize a JSON object for hashing.
 * RFC 8785 JCS (simplified): sort keys recursively, no whitespace.
 *
 * This is the same canonicalization used by ATC signatures — using a
 * different canonicalization here would mean two verifiers comparing
 * the "same" tool definition would get different hashes.
 */
function canonicalize(obj) {
    if (obj === null || obj === undefined)
        return 'null';
    if (typeof obj === 'string')
        return JSON.stringify(obj);
    if (typeof obj === 'number' || typeof obj === 'boolean')
        return JSON.stringify(obj);
    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalize).join(',') + ']';
    }
    if (typeof obj === 'object') {
        const keys = Object.keys(obj).sort();
        const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k]));
        return '{' + pairs.join(',') + '}';
    }
    return JSON.stringify(obj);
}
/**
 * Hash a JSON-serializable object using canonical form.
 */
function hashObject(obj) {
    return sha256(canonicalize(obj));
}
/**
 * Compute the fingerprint of a single tool.
 *
 * Tool hash = SHA-256(canonical(tool_name + description_hash + input_schema_hash))
 *
 * The tool_name is included in the tool_hash so that two tools with the same
 * description but different names produce different hashes (catches typosquatting).
 */
function computeToolFingerprint(tool) {
    const toolName = tool.name ?? '';
    const description = tool.description ?? '';
    const inputSchema = tool.inputSchema ?? {};
    const outputSchema = tool.outputSchema ?? null;
    const descriptionHash = sha256(description);
    const inputSchemaHash = hashObject(inputSchema);
    const outputSchemaHash = outputSchema ? hashObject(outputSchema) : null;
    // Combined tool hash: tool_name + description_hash + input_schema_hash
    // (output_schema_hash is informational, not part of the combined hash,
    //  because many MCP servers don't define output schemas)
    const toolHashInput = JSON.stringify({
        tool_name: toolName,
        description_hash: descriptionHash,
        input_schema_hash: inputSchemaHash,
    });
    const toolHash = sha256(toolHashInput);
    return {
        tool_name: toolName,
        description_hash: descriptionHash,
        input_schema_hash: inputSchemaHash,
        output_schema_hash: outputSchemaHash,
        tool_hash: toolHash,
    };
}
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
function computeFingerprintSet(params) {
    const { serverUrl, transport, tools } = params;
    // Server hash: URL + transport
    const serverHashInput = JSON.stringify({ url: serverUrl, transport });
    const serverHash = sha256(serverHashInput);
    // Per-tool fingerprints
    const toolFingerprints = tools
        .map(computeToolFingerprint)
        .sort((a, b) => a.tool_name.localeCompare(b.tool_name));
    // Tools hash: sorted concatenation of all tool_hashes
    const toolsHashInput = toolFingerprints.map((t) => t.tool_hash).join('|');
    const toolsHash = sha256(toolsHashInput);
    return {
        server_hash: serverHash,
        tools_hash: toolsHash,
        tools: toolFingerprints,
        manifest_hash: params.manifest ? hashObject(params.manifest) : null,
        lockfile_hash: params.lockfile ? hashObject(params.lockfile) : null,
        dependency_hash: params.dependencyTree ? hashObject(params.dependencyTree) : null,
        commit_sha: params.commitSha ?? null,
        npm_tarball_hash: params.npmTarballHash ?? null,
        container_hash: params.containerDigest ?? null,
        computed_at: new Date().toISOString(),
        fingerprint_version: '1.0.0',
    };
}
// ============================================================================
// Fingerprint comparison
// ============================================================================
/**
 * Severity classification per changed field.
 *
 * Rationale:
 * - server_hash change = server URL/transport changed → critical (different server entirely)
 * - tools_set_changed = tools added/removed → warn (could be benign feature add, could be attack)
 * - tool_descriptions_changed = tool surface modified → critical (signature of post-audit drift)
 * - manifest_changed = package.json modified → warn (could be version bump, could be malice)
 * - lockfile_changed = deps updated → info (normal in CI/CD)
 * - dependency_changed = transitive dep changed → warn (supply chain risk)
 * - commit_changed = source code updated → info (normal in dev)
 * - npm_tarball_changed = package re-published → critical (could be republished with malice)
 * - container_changed = image rebuilt → warn (could be normal, could be drift)
 */
const SEVERITY_MAP = {
    server_changed: 'critical',
    tools_set_changed: 'warn',
    // tool_descriptions_changed is an array, handled specially
    manifest_changed: 'warn',
    lockfile_changed: 'info',
    dependency_changed: 'warn',
    commit_changed: 'info',
    npm_tarball_changed: 'critical',
    container_changed: 'warn',
};
/**
 * Compare two fingerprint sets and produce a diff.
 *
 * @param audited  The fingerprint set stored in the ATC (audit-time snapshot)
 * @param current  The fingerprint set computed from the current live tools/list
 */
function diffFingerprints(audited, current) {
    const serverChanged = audited.server_hash !== current.server_hash;
    // Tools set change: did the set of tool_names change?
    const auditedNames = new Set(audited.tools.map((t) => t.tool_name));
    const currentNames = new Set(current.tools.map((t) => t.tool_name));
    const toolsSetChanged = auditedNames.size !== currentNames.size ||
        [...auditedNames].some((n) => !currentNames.has(n));
    // Per-tool description changes: tools that exist in both but with different hashes
    const toolDescriptionsChanged = [];
    for (const auditedTool of audited.tools) {
        const currentTool = current.tools.find((t) => t.tool_name === auditedTool.tool_name);
        if (currentTool && currentTool.tool_hash !== auditedTool.tool_hash) {
            toolDescriptionsChanged.push(auditedTool.tool_name);
        }
    }
    const manifestChanged = (audited.manifest_hash !== null || current.manifest_hash !== null) &&
        audited.manifest_hash !== current.manifest_hash;
    const lockfileChanged = (audited.lockfile_hash !== null || current.lockfile_hash !== null) &&
        audited.lockfile_hash !== current.lockfile_hash;
    const dependencyChanged = (audited.dependency_hash !== null || current.dependency_hash !== null) &&
        audited.dependency_hash !== current.dependency_hash;
    const commitChanged = audited.commit_sha !== null &&
        current.commit_sha !== null &&
        audited.commit_sha !== current.commit_sha;
    const npmTarballChanged = audited.npm_tarball_hash !== null &&
        current.npm_tarball_hash !== null &&
        audited.npm_tarball_hash !== current.npm_tarball_hash;
    const containerChanged = audited.container_hash !== null &&
        current.container_hash !== null &&
        audited.container_hash !== current.container_hash;
    // Severity classification
    let severity = 'none';
    if (serverChanged || toolDescriptionsChanged.length > 0 || npmTarballChanged) {
        severity = 'critical';
    }
    else if (toolsSetChanged || manifestChanged || dependencyChanged || containerChanged) {
        severity = 'warn';
    }
    else if (lockfileChanged || commitChanged) {
        severity = 'info';
    }
    // Auto-revoke on critical changes
    const shouldAutoRevoke = severity === 'critical';
    // Summary
    const changes = [];
    if (serverChanged)
        changes.push(`server URL/transport changed`);
    if (toolsSetChanged) {
        const added = [...currentNames].filter((n) => !auditedNames.has(n));
        const removed = [...auditedNames].filter((n) => !currentNames.has(n));
        if (added.length > 0)
            changes.push(`tools added: ${added.join(', ')}`);
        if (removed.length > 0)
            changes.push(`tools removed: ${removed.join(', ')}`);
    }
    if (toolDescriptionsChanged.length > 0) {
        changes.push(`tool descriptions changed: ${toolDescriptionsChanged.join(', ')}`);
    }
    if (manifestChanged)
        changes.push('package.json modified');
    if (lockfileChanged)
        changes.push('lockfile updated');
    if (dependencyChanged)
        changes.push('dependency tree changed');
    if (commitChanged)
        changes.push(`commit ${audited.commit_sha?.slice(0, 8)} → ${current.commit_sha?.slice(0, 8)}`);
    if (npmTarballChanged)
        changes.push('npm tarball re-published');
    if (containerChanged)
        changes.push('container image rebuilt');
    const summary = changes.length === 0
        ? 'No changes detected — fingerprint matches audit-time snapshot'
        : `${changes.length} change(s) detected: ${changes.join('; ')}`;
    return {
        server_changed: serverChanged,
        tools_set_changed: toolsSetChanged,
        tool_descriptions_changed: toolDescriptionsChanged,
        manifest_changed: manifestChanged,
        lockfile_changed: lockfileChanged,
        dependency_changed: dependencyChanged,
        commit_changed: commitChanged,
        npm_tarball_changed: npmTarballChanged,
        container_changed: containerChanged,
        severity,
        should_auto_revoke: shouldAutoRevoke,
        summary,
    };
}
// ============================================================================
// Convenience: minimal fingerprint (just tools/list response)
// ============================================================================
/**
 * Compute a minimal fingerprint from just the MCP tools/list response.
 * Useful for verifiers that only have the live response and want to compare
 * against an audited snapshot.
 *
 * @param serverUrl  Server URL or path
 * @param transport  Transport type
 * @param toolsList  Raw tools/list response from the MCP server
 */
function fingerprintFromToolsList(serverUrl, transport, toolsList) {
    const tools = Array.isArray(toolsList) ? toolsList : (toolsList.tools ?? []);
    return computeFingerprintSet({
        serverUrl,
        transport,
        tools,
    });
}
// ============================================================================
// Export summary
// ============================================================================
exports.FINGERPRINT_VERSION = '1.0.0';
exports.FINGERPRINT_ALGORITHM = {
    hash: 'SHA-256',
    canonicalization: 'RFC 8785 JCS (simplified)',
    description: 'Per-tool: SHA-256(canonical(description)). Combined: SHA-256(sorted(tool_hashes).join("|")).',
};
