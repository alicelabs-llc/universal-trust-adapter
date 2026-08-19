/**
 * MarketNow — Tool Catalog Diffing (L3 enhancement)
 * ================================================
 *
 * Detects when an MCP server adds or removes tools after certification.
 * Part of L3 continuous runtime monitoring.
 *
 * How it works:
 *   1. At L2 certification time, we capture the tool catalog (names + inputSchema hashes)
 *   2. On each L3 re-audit (weekly), we re-probe the MCP server's tool list
 *   3. If tools changed, we flag it as "tool_catalog_drift"
 *
 * Drift levels:
 *   - low: 1-2 new tools added (common, non-critical)
 *   - medium: tools removed or renamed (suspicious)
 *   - high: new tool with filesystem/network capabilities (potentially dangerous)
 *   - critical: tool catalog completely changed (likely compromised)
 */

/**
 * Capture a tool catalog fingerprint from an MCP server.
 * @param {Object} mcpProbeResult - result from L2 MCP probe
 * @returns {Object} fingerprint
 */
export function captureToolFingerprint(mcpProbeResult) {
  const tools = mcpProbeResult.tools_discovered || [];
  return {
    captured_at: new Date().toISOString(),
    tool_count: tools.length,
    tools: tools.map(t => ({
      name: t.name,
      // Hash the input schema to detect silent changes
      schema_hash: hashSchema(t.inputSchema),
      // Categorize by capability for drift analysis
      capabilities: categorizeTool(t),
    })),
  };
}

/**
 * Compare two tool fingerprints and return drift findings.
 * @param {Object} baseline - original fingerprint from certification
 * @param {Object} current - current fingerprint from re-audit
 * @returns {Object} { drift_level, added, removed, changed, summary }
 */
export function diffToolCatalogs(baseline, current) {
  const baselineTools = new Map(baseline.tools.map(t => [t.name, t]));
  const currentTools = new Map(current.tools.map(t => [t.name, t]));

  const added = [];
  const removed = [];
  const changed = [];

  // Find added tools
  for (const [name, tool] of currentTools) {
    if (!baselineTools.has(name)) {
      added.push(tool);
    } else {
      // Check if schema changed
      const base = baselineTools.get(name);
      if (base.schema_hash !== tool.schema_hash) {
        changed.push({
          name,
          old_hash: base.schema_hash,
          new_hash: tool.schema_hash,
        });
      }
    }
  }

  // Find removed tools
  for (const [name, tool] of baselineTools) {
    if (!currentTools.has(name)) {
      removed.push(tool);
    }
  }

  // Determine drift level
  let driftLevel = 'none';

  // Critical: entire catalog changed
  if (removed.length > baseline.tool_count * 0.5) {
    driftLevel = 'critical';
  }
  // High: new tool with dangerous capabilities
  else if (added.some(t => t.capabilities.includes('filesystem') || t.capabilities.includes('network'))) {
    driftLevel = 'high';
  }
  // Medium: tools removed or renamed
  else if (removed.length > 0 || changed.length > 0) {
    driftLevel = 'medium';
  }
  // Low: 1-2 new tools added
  else if (added.length > 0) {
    driftLevel = 'low';
  }

  return {
    drift_level: driftLevel,
    added: added.map(t => t.name),
    removed: removed.map(t => t.name),
    changed: changed.map(c => c.name),
    baseline_count: baseline.tool_count,
    current_count: current.tool_count,
    summary: `${added.length} added, ${removed.length} removed, ${changed.length} changed`,
  };
}

/**
 * Hash an input schema for comparison.
 */
function hashSchema(schema) {
  const crypto = require('crypto');
  const canonical = JSON.stringify(schema, Object.keys(schema || {}).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Categorize a tool by its capabilities based on its schema.
 */
function categorizeTool(tool) {
  const caps = [];
  const schema = tool.inputSchema || {};
  const props = schema.properties || {};
  const required = schema.required || [];

  // Filesystem
  if (props.path || props.file || props.filename || props.directory) {
    caps.push('filesystem');
  }

  // Network
  if (props.url || props.endpoint || props.host || props.domain) {
    caps.push('network');
  }

  // Code execution
  if (props.command || props.code || props.script || props.eval) {
    caps.push('execution');
  }

  // Database
  if (props.query || props.sql || props.table || props.collection) {
    caps.push('database');
  }

  // Credentials
  if (props.token || props.key || props.password || props.secret) {
    caps.push('credentials');
  }

  return caps.length > 0 ? caps : ['unknown'];
}
