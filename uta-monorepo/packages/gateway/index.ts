/**
 * @marketnow/gateway
 * BLOQUE K: Trust Gateway — MCP Middleware + Enforcement
 *
 * Intercepts ALL tools/call requests and verifies trust BEFORE execution.
 * Flow: tools/call → extract identity → verify ATC → PoP → policy → ALLOW/BLOCK
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import { verifyCredential, type VerificationContext, type VerificationResult } from '../core/verification-pipeline.js';
import { canonicalize, canonicalHash } from '../core/crypto.js';
import { ActionReceipt, ReceiptGenerator, ReceiptStore } from './receipts.js';

// ============================================================================
// Trust Gateway Configuration
// ============================================================================

export interface GatewayConfig {
  min_trust_score: number;
  require_pop: boolean;
  require_artifact_binding: boolean;
  block_secret_reads: boolean;
  block_shell_exec: boolean;
  ca_public_key?: string; // PEM
  api_base_url?: string;
  /** P3-5: List of trusted issuer DIDs. If empty, issuer trust is enforced
   *  by the pipeline's default fail-closed behavior (DENY unknown).
   *  Configure with the list of DIDs you want to ALLOW. */
  allowed_issuers?: string[];
}

export const DEFAULT_CONFIG: GatewayConfig = {
  min_trust_score: 5,
  require_pop: false,
  require_artifact_binding: false,
  block_secret_reads: true,
  block_shell_exec: true,
};

// ============================================================================
// Gateway Decision
// ============================================================================

export interface GatewayDecision {
  allowed: boolean;
  decision: 'ALLOW' | 'DENY';
  agent_id: string;
  tool_name: string;
  trust_score: number;
  reason?: string;
  verification?: VerificationResult;
  evidence_hash?: string;
  timestamp: string;
  args_hash?: string;
}

// ============================================================================
// Trust Gateway
// ============================================================================

export class TrustGateway {
  private config: GatewayConfig;

  constructor(config: Partial<GatewayConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a tools/call request should be allowed.
   *
   * @param agentCredential - The agent's ATC credential
   * @param toolName - The tool being called
   * @param args - The tool arguments
   * @param popResponse - Optional PoP response (if require_pop is true)
   * @returns GatewayDecision
   */
  async check(
    agentCredential: unknown,
    toolName: string,
    args: Record<string, unknown> = {},
    popResponse?: unknown
  ): Promise<GatewayDecision> {
    const timestamp = new Date().toISOString();
    const argsHash = this.hashArgs(args);

    // Step 1: Verify the agent's credential
    const verifyCtx: VerificationContext = {
      credential: agentCredential,
      ca_public_key: this.config.ca_public_key,
      pop_response: popResponse as any,
      policy: {
        min_trust_score: this.config.min_trust_score,
        require_pop: this.config.require_pop,
        require_artifact_binding: this.config.require_artifact_binding,
        allowed_issuers: this.config.allowed_issuers,
      },
    };

    const verification = await verifyCredential(verifyCtx);

    if (verification.decision === 'DENY') {
      return {
        allowed: false,
        decision: 'DENY',
        agent_id: 'unknown',
        tool_name: toolName,
        trust_score: 0,
        reason: `Verification failed at ${verification.failure_stage}: ${verification.failure_reason}`,
        verification,
        timestamp,
        args_hash: argsHash,
      };
    }

    // Step 2: Extract trust score from the verification result
    const trustScore = this.extractTrustScore(verification, agentCredential);

    // Step 3: Check for dangerous arguments
    if (this.config.block_secret_reads) {
      const secretPattern = this.detectSecretReads(args);
      if (secretPattern) {
        return this.deny('Secret file access detected: ' + secretPattern, agentCredential, toolName, trustScore, argsHash, timestamp);
      }
    }

    if (this.config.block_shell_exec) {
      const shellPattern = this.detectShellExec(args);
      if (shellPattern) {
        return this.deny('Shell execution detected: ' + shellPattern, agentCredential, toolName, trustScore, argsHash, timestamp);
      }
    }

    // Step 4: ALLOW
    return {
      allowed: true,
      decision: 'ALLOW',
      agent_id: this.extractAgentId(agentCredential),
      tool_name: toolName,
      trust_score: trustScore,
      verification,
      timestamp,
      args_hash: argsHash,
    };
  }

  // ── Secret file detection ──
  private detectSecretReads(args: Record<string, unknown>): string | null {
    const patterns = [
      /\.env/i, /\.env\.local/i, /\.env\.production/i,
      /\.ssh\/id_/i, /\.aws\/credentials/i,
      /\.git\/config/i, /\/etc\/passwd/i, /\/etc\/shadow/i,
      /\.npmrc/i, /\.pypirc/i, /\.docker\/config/i,
    ];
    const argsStr = canonicalize(args);
    for (const p of patterns) {
      if (p.test(argsStr)) return p.source;
    }
    return null;
  }

  // ── Shell execution detection ──
  private detectShellExec(args: Record<string, unknown>): string | null {
    const patterns = [
      /\brm\s+-rf\b/i, /\bcurl\s+.*\|\s*sh\b/i, /\bwget\s+.*\|\s*bash\b/i,
      /\bnc\s+-l\b/i, /\bbash\s+-i\b/i, /\bpython\s+-c\b/i,
      /\beval\s*\(/i, /\bexec\s*\(/i, /\bsubprocess/i,
    ];
    const argsStr = canonicalize(args);
    for (const p of patterns) {
      if (p.test(argsStr)) return p.source;
    }
    return null;
  }

  // ── Helpers ──
  private hashArgs(args: Record<string, unknown>): string {
    // P1-6: Use JCS for deterministic hashing (not JSON.stringify)
    // This ensures that two objects with the same content but different key order
    // produce the same hash.
    const canonical = canonicalize(args);
    return `sha256:${canonicalHash(canonical)}`; // Full 64-char hash, not truncated
  }

  private extractAgentId(credential: unknown): string {
    const c = credential as Record<string, any>;
    return c.subject?.agent_id || c.payload?.agent_id || c.agent_id || 'unknown';
  }

  private extractTrustScore(verification: VerificationResult, credential: unknown): number {
    const c = credential as Record<string, any>;
    return c.assessment?.score || c.payload?.trust?.sentinel_review_score || c.trust?.score || 0;
  }

  private deny(
    reason: string, credential: unknown, toolName: string,
    trustScore: number, argsHash: string, timestamp: string
  ): GatewayDecision {
    return {
      allowed: false,
      decision: 'DENY',
      agent_id: this.extractAgentId(credential),
      tool_name: toolName,
      trust_score: trustScore,
      reason,
      timestamp,
      args_hash: argsHash,
    };
  }
}

// ============================================================================
// MCP Middleware — wraps a tools/call handler with Trust Gateway
// ============================================================================

export function withTrustGateway(
  handler: (args: Record<string, unknown>) => Promise<unknown>,
  gateway: TrustGateway
): (agentCredential: unknown, toolName: string, args: Record<string, unknown>) => Promise<unknown> {
  return async (agentCredential: unknown, toolName: string, args: Record<string, unknown>) => {
    // 1. Gateway check
    const decision = await gateway.check(agentCredential, toolName, args);

    // 2. If denied, throw with the reason
    if (!decision.allowed) {
      throw new Error(`TRUST_GATEWAY_DENY: ${decision.reason}`);
    }

    // 3. If allowed, execute the actual handler
    return handler(args);
  };
}
