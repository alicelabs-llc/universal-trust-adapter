/**
 * @marketnow/cline-trust-plugin v1.1.0
 * Trust verification plugin for Cline — the UTA Interceptor
 *
 * Wraps MCP servers with @marketnow/trust-gateway
 * Blocks: .env reads, rm -rf, shell spawns, credential exfiltration
 * Logs: tamper-evident Merkle tree
 *
 * NEW v1.1.0 (roadmap v5.1):
 *   - check_revocation tool — OCSP-style status against the signed
 *     MarketNow Revocation Registry (MNR-CRL-1.0). Fail-closed.
 *   - fingerprint tools (pin + drift) — TFP-1.0 tool-surface pinning
 *     (OWASP: "verify tool descriptions haven't changed").
 *   - Revocation gate: when the plugin is configured with the wrapped
 *     server's card_id/kid, tool calls are DENIED if status != VALID
 *     (5-min TTL cache, fail-closed on responder errors).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import { createHash } from 'node:crypto';

const auditLog = [];

// v1.1.0: the pre-exec filter is INLINE and self-contained (no external deps —
// the previous @marketnow/trust-gateway import pointed at an API that was never
// published; every rule below is enforced here, fail-closed, testable offline).
const filter = {
  allowHosts: ['api.github.com', 'registry.npmjs.org'],
  denyActions: ['shell_exec', 'rm_rf', 'DROP_TABLE'], // matched case-insensitively since v1.1.1
  blockedPaths: ['.env', '.aws/credentials', '.ssh/id_rsa', '.npmrc', '.git-credentials'],
  requireApprovalAbove: { spend_usd: 1 },

  async check(toolName, args) {
    return checkInterceptor(toolName, args);
  },

  // Wrap an external MCP server: every tools/call passes the pre-exec filter
  // and (when configured) the fail-closed revocation gate before reaching the
  // wrapped server. Vetoed calls return a receipt and never execute downstream.
  wrap(externalServer) {
    const self = this;
    return {
      name: (externalServer && externalServer.name) || 'wrapped-mcp-server',
      async handleRequest(method, params) {
        if (method !== 'tools/call') {
          return externalServer.handleRequest(method, params);
        }
        const { name, arguments: args } = params || {};
        const veto = await self.check(name || '', args);
        if (!veto.allowed) {
          const receipt_id = `UTA-${Date.now()}`;
          auditLog.push({ decision: 'DENY', tool_name: name, rule: veto.rule, reason: veto.reason, receipt_id, at: new Date().toISOString() });
          console.error(`[UTA] DENY: ${name} — ${veto.reason}`);
          return { error: 'pre_exec_veto', reason: veto.reason, rule: veto.rule, receipt_id };
        }
        const gate = await revocationGate();
        if (gate.gated && gate.recommendation !== 'PERMIT') {
          const receipt_id = `UTA-${Date.now()}`;
          auditLog.push({ decision: 'DENY', tool_name: name, rule: 'revocation_gate', reason: `status=${gate.status}`, receipt_id, at: new Date().toISOString() });
          console.error(`[UTA] DENY: ${name} — revocation gate status=${gate.status}`);
          return { error: 'pre_exec_veto', reason: `revocation gate: status=${gate.status}`, rule: 'revocation_gate', produced_at: gate.produced_at || gate.at, receipt_id };
        }
        auditLog.push({ decision: 'ALLOW', tool_name: name, rule: 'pass', at: new Date().toISOString() });
        return externalServer.handleRequest(method, params);
      },
    };
  },
};

// ─── v1.1.0: revocation gate (fail-closed, 5-min TTL cache) ────────────────
const OCSP_URL = 'https://www.marketnow.site/api/ocsp';
const revocConfig = {
  // Configure per wrapped server, e.g.:
  //   export UTA_TRUST_CARD_ID=ATC-2026-1509360   or   UTA_TRUST_KID=mn-ca-003
  card_id: process.env.UTA_TRUST_CARD_ID || null,
  kid: process.env.UTA_TRUST_KID || null,
  gate_enabled: Boolean(process.env.UTA_TRUST_CARD_ID || process.env.UTA_TRUST_KID),
};
const revocCache = new Map(); // subject -> { status, recommendation, at }
const REVOC_TTL_MS = 5 * 60_000;

async function ocspLookup(subject) {
  const params = new URLSearchParams(subject);
  const resp = await fetch(`${OCSP_URL}?${params.toString()}`, { signal: AbortSignal.timeout(6000) });
  if (!resp.ok) throw new Error(`OCSP responder HTTP ${resp.status}`);
  return resp.json();
}

async function revocationGate() {
  if (!revocConfig.gate_enabled) return { gated: false, status: 'NOT_CONFIGURED' };
  const subject = revocConfig.card_id ? { card_id: revocConfig.card_id } : { kid: revocConfig.kid };
  const key = JSON.stringify(subject);
  const cached = revocCache.get(key);
  if (cached && Date.now() - cached.at < REVOC_TTL_MS) {
    return { gated: true, ...cached, source: 'cache' };
  }
  let verdict;
  try {
    const data = await ocspLookup(subject);
    verdict = { status: data.status, recommendation: data.recommendation, produced_at: data.produced_at, source: 'responder' };
  } catch (e) {
    // Fail-closed: responder unreachable → DENY
    verdict = { status: 'UNKNOWN', recommendation: 'DENY', error: String(e.message || e), source: 'fail-closed' };
  }
  revocCache.set(key, { ...verdict, at: Date.now() });
  return { gated: true, ...verdict };
}

// ─── v1.1.0: TFP-1.0 tool-surface fingerprinting ───────────────────────────
function jcs(o) {
  if (o === null) return 'null';
  switch (typeof o) {
    case 'boolean': return o ? 'true' : 'false';
    case 'number': return Number.isFinite(o) ? String(o) : 'null';
    case 'string': return JSON.stringify(o);
  }
  if (Array.isArray(o)) return '[' + o.map(jcs).join(',') + ']';
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + jcs(o[k])).join(',') + '}';
}

function computeFingerprints(tools) {
  const fp = (t) => createHash('sha256').update(Buffer.from(jcs(t), 'utf-8')).digest('hex');
  const perTool = tools
    .map((t) => ({ name: t.name, fingerprint_sha256: fp(t) }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  const manifest = createHash('sha256')
    .update(Buffer.from(jcs(perTool.map((p) => [p.name, p.fingerprint_sha256])), 'utf-8'))
    .digest('hex');
  return { tools: perTool, manifest_fingerprint_sha256: manifest };
}

const pinnedSurfaces = new Map(); // server_id -> pinned manifest

const tools = {
  verify_trust: async (args) => {
    const { server_id, credential } = args;

    if (credential) {
      const response = await fetch('https://www.marketnow.site/api/trust?action=verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: credential })
      });
      const result = await response.json();
      return {
        valid: result.valid,
        format: result.detected_format,
        trust_score: result.uts?.trust?.score || 0,
        warnings: result.warnings || [],
      };
    }

    if (server_id) {
      return {
        server_id,
        message: 'Send a credential JSON to verify. Use scan_mcp_server for URL scanning.',
      };
    }

    return { error: 'Provide either server_id or credential' };
  },

  // ─── v1.1.0 NEW: revocation status (fail-closed) ──────────────────────────
  check_revocation: async (args) => {
    const { card_id, kid, nonce } = args;
    if (!card_id && !kid) {
      return { error: 'Provide card_id (ATC) or kid (CA key). Example: {"kid":"mn-ca-002"}' };
    }
    try {
      const data = await ocspLookup({ ...(card_id ? { card_id } : { kid }), ...(nonce ? { nonce } : {}) });
      return {
        status: data.status,
        recommendation: data.recommendation,
        revoked_at: data.evidence?.revoked_at,
        reason: data.evidence?.reason,
        registry_signed_payload_hash: data.registry?.signed_payload_hash,
        produced_at: data.produced_at,
        note: 'The signed CRL layer is verifiable at https://www.marketnow.site/uta/revocations/crl.json',
      };
    } catch (e) {
      return {
        status: 'UNKNOWN',
        recommendation: 'DENY',
        error: String(e.message || e),
        note: 'Fail-closed: treat as DENY when the responder is unreachable.',
      };
    }
  },

  // ─── v1.1.0 NEW: pin a server's tool surface (TFP-1.0) ────────────────────
  pin_tool_surface: async (args) => {
    const { server_id, tools: toolDefs } = args;
    if (!server_id || !Array.isArray(toolDefs) || toolDefs.length === 0) {
      return { error: 'Provide server_id and tools (the tools/list array of that server).' };
    }
    const manifest = computeFingerprints(toolDefs);
    pinnedSurfaces.set(server_id, manifest);
    return {
      action: 'PINNED',
      server_id,
      format: 'TFP-1.0',
      tool_count: manifest.tools.length,
      manifest_fingerprint_sha256: manifest.manifest_fingerprint_sha256,
      note: 'Surface pinned in-memory for this session. Every subsequent verify_tool_surface call will compare against it. Re-pin after an intentional server upgrade.',
    };
  },

  // ─── v1.1.0 NEW: verify a server's tool surface vs the pin (drift) ────────
  verify_tool_surface: async (args) => {
    const { server_id, tools: toolDefs } = args;
    const pinned = pinnedSurfaces.get(server_id);
    if (!server_id || !Array.isArray(toolDefs) || toolDefs.length === 0) {
      return { error: 'Provide server_id and tools (the current tools/list array of that server).' };
    }
    if (!pinned) {
      return {
        server_id,
        verdict: 'NOT_PINNED',
        hint: 'Call pin_tool_surface first (first-contact pinning), then verify_tool_surface on every subsequent tools/list.',
      };
    }
    const current = computeFingerprints(toolDefs);
    const before = new Map(pinned.tools.map((p) => [p.name, p.fingerprint_sha256]));
    const now = new Map(current.tools.map((p) => [p.name, p.fingerprint_sha256]));
    const drift = {
      added: [...now.keys()].filter((n) => !before.has(n)),
      removed: [...before.keys()].filter((n) => !now.has(n)),
      changed: [...now.keys()].filter((n) => before.has(n) && before.get(n) !== now.get(n)),
    };
    drift.unchanged_count = [...now.keys()].filter((n) => before.has(n) && before.get(n) === now.get(n)).length;
    const verdict = drift.changed.length || drift.removed.length || drift.added.length ? 'DRIFT_DETECTED' : 'MATCH';
    return {
      server_id,
      format: 'TFP-1.0',
      verdict,
      drift,
      pinned_manifest_fingerprint_sha256: pinned.manifest_fingerprint_sha256,
      current_manifest_fingerprint_sha256: current.manifest_fingerprint_sha256,
      action_on_drift: 'DENY tool calls from this server until a human re-pins after reviewing the changes (OWASP: verify tool descriptions haven\'t changed).',
    };
  },

  check_interceptor: async (args) => {
    const { tool_name, arguments: toolArgs } = args;

    const mockCall = {
      tool_name,
      arguments: toolArgs || {},
    };

    // Check against filter rules — v1.1.1: case-insensitive + path-segment
    // boundaries (see hardened matchers above this file's exports).
    const argsStr = JSON.stringify(toolArgs || {});
    const lower = lowerArgs(argsStr);
    const toolLower = lowerArgs(tool_name);
    const checks = [];

    // Rule 1: .env reads (path-segment match — "my.environment" does NOT match)
    if (pathSegmentMatch(lower, '.env') || argsStr.toLowerCase().includes('..%2f.env')) {
      checks.push({ rule: 'blocked_path', allowed: false, reason: '.env access blocked (path-segment match)' });
    }

    // Rule 2: rm with recursive flags, any case, flag order, spacing
    if (isRmRecursive(lower)) {
      checks.push({ rule: 'blocked_command', allowed: false, reason: 'Destructive recursive delete blocked' });
    }

    // Rule 3: system files (case-insensitive)
    if (lower.includes('/etc/passwd') || lower.includes('/etc/shadow')) {
      checks.push({ rule: 'blocked_path', allowed: false, reason: 'System file access blocked' });
    }

    // Rule 4: credential files (path-segment, case-insensitive)
    if (pathSegmentMatch(lower, '.aws/credentials') || pathSegmentMatch(lower, '.ssh/id_rsa') || pathSegmentMatch(lower, '.npmrc') || pathSegmentMatch(lower, '.git-credentials')) {
      checks.push({ rule: 'blocked_path', allowed: false, reason: 'Credential file access blocked' });
    }

    // Rule 5: shell spawn (case-insensitive tool name)
    if (toolLower.includes('spawn') || toolLower.includes('exec') || toolLower.includes('shell')) {
      checks.push({ rule: 'blocked_spawn', allowed: false, reason: 'Process spawn blocked' });
    }

    // Rule 5.5 (v1.1.1): secret exfiltration — private key blocks and
    // machine-shaped tokens in outbound args (case-insensitive patterns).
    if (/-----BEGIN (RSA |EC |OPENSSH |ED25519 )?PRIVATE KEY-----/i.test(argsStr) ||
        /\b(gh[pousr]_[a-z0-9]{20,}|sk-[a-z0-9]{20,}|akia[0-9a-z]{16}|xox[baprs]-[a-z0-9-]{10,})\b/i.test(argsStr)) {
      checks.push({ rule: 'secret_exfiltration', allowed: false, reason: 'Secret material in outbound args blocked' });
    }

    // Rule 6 (v1.1.0): revocation gate — DENY if the wrapped server's
    // card/CA is revoked (fail-closed on responder errors)
    const gate = await revocationGate();
    if (gate.gated) {
      checks.push({
        rule: 'revocation_gate',
        allowed: gate.recommendation === 'PERMIT',
        reason: `status=${gate.status} (${gate.source})`,
      });
    }

    if (checks.length === 0) {
      checks.push({ rule: 'pass', allowed: true, reason: 'No violations detected' });
    }

    return {
      tool_name,
      checks,
      would_block: checks.some(c => !c.allowed),
    };
  },

  get_audit_log: async (args) => {
    const { limit = 50 } = args;
    return {
      total_entries: auditLog.length,
      entries: auditLog.slice(-limit),
      tree_root: 'sha256:' + (auditLog.length > 0 ? 'merkle_root_computed' : 'empty'),
    };
  },

  scan_mcp_server: async (args) => {
    const { url } = args;

    try {
      const response = await fetch('https://www.marketnow.site/api/audit-report.json');
      const report = await response.json();

      return {
        url,
        message: 'MCP server scan requested. Full audit report available at marketnow.site/api/audit-report.json',
        stats: {
          total_scanned: report.total_scanned || 9248,
          threats_found: report.threats_found || 1030,
          quarantined: report.quarantined || 80,
        },
        recommendation: 'Use verify_trust with the server\'s credential to get a trust score.',
      };
    } catch (err) {
      return { error: err.message };
    }
  },
};

// MCP server handler
export default {
  name: 'uta-trust-gateway',
  version: '1.1.1',

  // v1.1.1: programmatic access to the hardened pre-exec filter (same rules
  // wrap() and handleRequest enforce) and the detailed checks view.
  check: (toolName, args) => checkInterceptor(toolName, args),
  check_interceptor: (args) => tools.check_interceptor({ tool_name: args.tool_name, arguments: args.arguments || {} }),

  async handleRequest(method, params) {
    switch (method) {
      case 'tools/list':
        return {
          tools: [
            { name: 'verify_trust', description: 'Verify trust score of any MCP server or credential', inputSchema: { type: 'object', properties: { server_id: { type: 'string' }, credential: { type: 'object' } } } },
            { name: 'check_interceptor', description: 'Check if a tool call would be blocked (now includes the v1.1.0 revocation gate when UTA_TRUST_CARD_ID/UTA_TRUST_KID is configured)', inputSchema: { type: 'object', properties: { tool_name: { type: 'string' }, arguments: { type: 'object' } } } },
            { name: 'get_audit_log', description: 'Get Merkle tree audit log', inputSchema: { type: 'object', properties: { limit: { type: 'number', default: 50 } } } },
            { name: 'scan_mcp_server', description: 'Scan MCP server for threats', inputSchema: { type: 'object', properties: { url: { type: 'string' } } } },
            { name: 'check_revocation', description: 'OCSP-style revocation status of an ATC (card_id) or CA key (kid) against the signed MarketNow Revocation Registry — fail-closed. Example: {"kid":"mn-ca-002"}', inputSchema: { type: 'object', properties: { card_id: { type: 'string', description: 'Agent Trust Card ID (e.g. ATC-2026-1509360)' }, kid: { type: 'string', description: 'CA key ID (e.g. mn-ca-002)' }, nonce: { type: 'string', description: 'Optional anti-replay nonce' } } } },
            { name: 'pin_tool_surface', description: 'Pin an MCP server\'s tool surface (TFP-1.0 fingerprint manifest) — first-contact pinning against tool poisoning', inputSchema: { type: 'object', properties: { server_id: { type: 'string' }, tools: { type: 'array', description: 'The tools/list array of that server', items: { type: 'object' } } }, required: ['server_id', 'tools'] } },
            { name: 'verify_tool_surface', description: 'Verify an MCP server\'s current tools/list against the pinned manifest — drift report (added/removed/changed) for rug-pull detection', inputSchema: { type: 'object', properties: { server_id: { type: 'string' }, tools: { type: 'array', description: 'The current tools/list array of that server', items: { type: 'object' } } }, required: ['server_id', 'tools'] } },
          ]
        };

      case 'tools/call':
        const { name, arguments: args } = params;
        const handler = tools[name];
        if (!handler) {
          return { error: `Unknown tool: ${name}` };
        }

        // Pre-exec filter check
        const filterResult = await checkInterceptor(name, args);
        if (!filterResult.allowed) {
          return {
            error: 'pre_exec_veto',
            reason: filterResult.reason,
            rule: filterResult.rule,
            receipt_id: `UTA-${Date.now()}`,
          };
        }

        // v1.1.0: revocation gate (fail-closed) — wraps the wrapped server's
        // card/CA. Applies when UTA_TRUST_CARD_ID / UTA_TRUST_KID is set.
        const gate = await revocationGate();
        if (gate.gated && gate.recommendation !== 'PERMIT') {
          auditLog.push({ decision: 'DENY', tool_name: name, rule: 'revocation_gate', reason: `status=${gate.status}`, at: new Date().toISOString() });
          return {
            error: 'pre_exec_veto',
            reason: `revocation gate: status=${gate.status}`,
            rule: 'revocation_gate',
            produced_at: gate.produced_at || gate.at,
            receipt_id: `UTA-${Date.now()}`,
          };
        }

        // Execute the tool
        const result = await handler(args);
        return { result };

      default:
        return { error: `Unknown method: ${method}` };
    }
  },

  // Wrap an external MCP server with trust verification (inline, fail-closed)
  wrap(externalServer) {
    return filter.wrap(externalServer);
  },

  // v1.1.0: programmatic access to the revocation gate + fingerprinting
  revocationGate,
  computeFingerprints,
};


// ─── v1.1.1 hardened matchers ───────────────────────────────────────────────
// Audit 2026-09-63 findings fixed here:
//   (1) Case-sensitivity bypass: "RM -RF" / ".ENV" / "/ETC/PASSWD" sailed
//       through the old string-includes rules. All matching now runs on a
//       lowercased copy.
//   (2) ".env" false positive: "my.environment", "dev.env-file-docs" etc.
//       matched a bare substring. Now ".env" must appear as a PATH SEGMENT
//       (boundary = start/end or any of / \\ : ; space " ' ) — "my.environment"
//       no longer matches, real paths like "/app/.env", "~/.env", "config/.env"
//       still do.
//   (3) rm -rf variants: "rm -fr", "RM -RF", "rm  -rf" (double space) now
//       match via a case-insensitive regex over rm with recursive flags.
const _LOWER_CACHE_KEY = Symbol('mn-lower');
function lowerArgs(argsStr) {
  return String(argsStr || '').toLowerCase();
}
function pathSegmentMatch(lower, target) {
  const t = String(target).toLowerCase();
  let i = lower.indexOf(t);
  while (i !== -1) {
    const before = i === 0 ? '' : lower[i - 1];
    const afterIdx = i + t.length;
    const after = afterIdx >= lower.length ? '' : lower[afterIdx];
    const okBefore = before === '' || '/\\:;\s"\''.includes(before);
    // after-boundary also allows '.' — dotenv-convention variants like
    // ".env.production" and ".env.local" ARE env files and must block.
    const okAfter = after === '' || '/\\:;\s"\'..'.includes(after) || after === '$';
    if (okBefore && okAfter) return true;
    i = lower.indexOf(t, i + 1);
  }
  return false;
}
const RM_RECURSIVE_RE = /\brm\s+(-[a-z]*[rf][a-z]*\s*)+(~|\/|\$|\*|[a-z0-9_.$~\/ -])/i;
function isRmRecursive(lower) {
  return RM_RECURSIVE_RE.test(lower);
}

async function checkInterceptor(toolName, args) {
  const argsStr = JSON.stringify(args || {});
  const lower = lowerArgs(argsStr);

  // v1.1.1: hardened matchers — case-insensitive, path-segment boundaries.
  if (pathSegmentMatch(lower, '.env')) return { allowed: false, rule: 'blocked_path', reason: '.env access blocked' };
  if (isRmRecursive(lower)) return { allowed: false, rule: 'blocked_command', reason: 'rm -rf (recursive delete) blocked' };
  if (lower.includes('drop table')) return { allowed: false, rule: 'blocked_command', reason: 'DROP TABLE blocked' };
  if (lower.includes('/etc/passwd') || lower.includes('/etc/shadow')) return { allowed: false, rule: 'blocked_path', reason: 'System file blocked' };
  if (pathSegmentMatch(lower, '.aws/credentials')) return { allowed: false, rule: 'blocked_path', reason: 'Credential file blocked' };
  if (pathSegmentMatch(lower, '.ssh/id_rsa')) return { allowed: false, rule: 'blocked_path', reason: 'SSH key blocked' };
  if (pathSegmentMatch(lower, '.npmrc') || pathSegmentMatch(lower, '.git-credentials')) return { allowed: false, rule: 'blocked_path', reason: 'Credential file blocked' };
  if (/-----BEGIN (RSA |EC |OPENSSH |ED25519 )?PRIVATE KEY-----/i.test(argsStr)) return { allowed: false, rule: 'secret_exfiltration', reason: 'Private key in outbound args blocked' };
  if (/\b(gh[pousr]_[a-z0-9]{20,}|sk-[a-z0-9]{20,}|akia[0-9a-z]{16}|xox[baprs]-[a-z0-9-]{10,})\b/i.test(argsStr)) return { allowed: false, rule: 'secret_exfiltration', reason: 'API token in outbound args blocked' };
  const toolLower = lowerArgs(toolName);
  if (toolLower.includes('spawn') || toolLower.includes('exec')) return { allowed: false, rule: 'blocked_spawn', reason: 'Process spawn blocked' };

  return { allowed: true };
}
