// ============================================================================
// MarketNow — MCP Trust Gateway (Audit item #9)
// ============================================================================
// Middleware that intercepts ALL tools/call requests and verifies trust
// BEFORE the tool executes.
//
// Usage in an MCP server:
//   import { TrustGateway } from './mcp-gateway.js';
//   const gateway = new TrustGateway({ min_trust_score: 7 });
//   // In your tools/call handler:
//   const decision = await gateway.check(agentId, toolName, args);
//   if (!decision.allowed) throw new Error(decision.reason);
//
// Flow:
//   tools/call → Gateway → verify ATC → check policy → ALLOW/BLOCK → execute/reject
// ============================================================================

export class TrustGateway {
  constructor(options = {}) {
    this.minTrustScore = options.minTrustScore || 5;
    this.requireAtc = options.requireAtc !== false; // default: true
    this.blockSecretReads = options.blockSecretReads !== false;
    this.blockShellExec = options.blockShellExec !== false;
    this.apiBaseUrl = options.apiBaseUrl || 'https://marketnow.site';
  }

  async check(agentId, toolName, args = {}) {
    // Step 1: Verify agent has a valid ATC
    let trustScore = 0;
    let identity = null;

    if (this.requireAtc) {
      try {
        const res = await fetch(`${this.apiBaseUrl}/api/atc?action=verify&card_id=${agentId}`, {
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!data.valid) {
          return this._block('ATC verification failed', { reason: data.reasons || ['invalid ATC'] });
        }
        trustScore = data.agent_trust_score || 0;
        identity = data;
      } catch (e) {
        return this._block('ATC verification error', { reason: e.message });
      }
    }

    // Step 2: Check trust score
    if (trustScore < this.minTrustScore) {
      return this._block(`Trust score ${trustScore} < minimum ${this.minTrustScore}`, { score: trustScore });
    }

    // Step 3: Check for dangerous arguments
    if (this.blockSecretReads) {
      const dangerous = this._detectSecretReads(args);
      if (dangerous) {
        return this._block(`Secret file access detected: ${dangerous}`, { pattern: dangerous });
      }
    }

    if (this.blockShellExec) {
      const dangerous = this._detectShellExec(args);
      if (dangerous) {
        return this._block(`Shell execution detected: ${dangerous}`, { pattern: dangerous });
      }
    }

    // Step 4: Call the unified Trust API for a policy decision
    try {
      const res = await fetch(`${this.apiBaseUrl}/api/trust?action=bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verifyIn: 'atc-v2',
          issueAs: 'atc-v2',
          policy: { min_trust_score: this.minTrustScore },
          payload: identity?.uts?.format?.raw || identity,
        }),
      });
      const bridge = await res.json();
      if (!bridge.verified) {
        return this._block(bridge.bridge_log || 'Trust bridge failed', bridge);
      }
    } catch (e) {
      // Bridge is optional — proceed if basic checks passed
      console.warn('Trust bridge failed (non-blocking):', e.message);
    }

    // ALLOW
    return this._allow({
      agent_id: agentId,
      tool_name: toolName,
      trust_score: trustScore,
      timestamp: new Date().toISOString(),
    });
  }

  _detectSecretReads(args) {
    const patterns = [
      /\.env/i, /\.env\.local/i, /\.env\.production/i,
      /\.ssh\/id_/i, /\.aws\/credentials/i,
      /\.git\/config/i, /\/etc\/passwd/i,
      /\/etc\/shadow/i, /\.npmrc/i, /\.pypirc/i,
    ];
    const argsStr = JSON.stringify(args);
    for (const p of patterns) {
      if (p.test(argsStr)) return p.source;
    }
    return null;
  }

  _detectShellExec(args) {
    const patterns = [
      /\brm\s+-rf\b/i, /\bcurl\s+.*\|\s*sh\b/i,
      /\bwget\s+.*\|\s*bash\b/i, /\bnc\s+-l\b/i,
      /\bbash\s+-i\b/i, /\bpython\s+-c\b/i,
      /\beval\s*\(/i, /\bexec\s*\(/i,
    ];
    const argsStr = JSON.stringify(args);
    for (const p of patterns) {
      if (p.test(argsStr)) return p.source;
    }
    return null;
  }

  _allow(metadata) {
    return {
      allowed: true,
      decision: 'ALLOW',
      ...metadata,
      evidence_url: `${this.apiBaseUrl}/api/trust/evidence/${metadata.timestamp}`,
    };
  }

  _block(reason, metadata = {}) {
    return {
      allowed: false,
      decision: 'BLOCK',
      reason,
      ...metadata,
      timestamp: new Date().toISOString(),
    };
  }
}
