"use strict";
/**
 * @marketnow/gateway
 * BLOQUE K: Trust Gateway — MCP Middleware + Enforcement
 *
 * Intercepts ALL tools/call requests and verifies trust BEFORE execution.
 * Flow: tools/call → extract identity → verify ATC → PoP → policy → ALLOW/BLOCK
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustGateway = exports.DEFAULT_CONFIG = void 0;
exports.withTrustGateway = withTrustGateway;
const verification_pipeline_js_1 = require("../core/verification-pipeline.js");
const crypto_js_1 = require("../core/crypto.js");
exports.DEFAULT_CONFIG = {
    min_trust_score: 5,
    require_pop: false,
    require_artifact_binding: false,
    block_secret_reads: true,
    block_shell_exec: true,
};
// ============================================================================
// Trust Gateway
// ============================================================================
class TrustGateway {
    config;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_CONFIG, ...config };
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
    async check(agentCredential, toolName, args = {}, popResponse) {
        const timestamp = new Date().toISOString();
        const argsHash = this.hashArgs(args);
        // Step 1: Verify the agent's credential
        const verifyCtx = {
            credential: agentCredential,
            ca_public_key: this.config.ca_public_key,
            pop_response: popResponse,
            policy: {
                min_trust_score: this.config.min_trust_score,
                require_pop: this.config.require_pop,
                require_artifact_binding: this.config.require_artifact_binding,
                allowed_issuers: this.config.allowed_issuers,
            },
        };
        const verification = await (0, verification_pipeline_js_1.verifyCredential)(verifyCtx);
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
    detectSecretReads(args) {
        const patterns = [
            /\.env/i, /\.env\.local/i, /\.env\.production/i,
            /\.ssh\/id_/i, /\.aws\/credentials/i,
            /\.git\/config/i, /\/etc\/passwd/i, /\/etc\/shadow/i,
            /\.npmrc/i, /\.pypirc/i, /\.docker\/config/i,
        ];
        const argsStr = (0, crypto_js_1.canonicalize)(args);
        for (const p of patterns) {
            if (p.test(argsStr))
                return p.source;
        }
        return null;
    }
    // ── Shell execution detection ──
    detectShellExec(args) {
        const patterns = [
            /\brm\s+-rf\b/i, /\bcurl\s+.*\|\s*sh\b/i, /\bwget\s+.*\|\s*bash\b/i,
            /\bnc\s+-l\b/i, /\bbash\s+-i\b/i, /\bpython\s+-c\b/i,
            /\beval\s*\(/i, /\bexec\s*\(/i, /\bsubprocess/i,
        ];
        const argsStr = (0, crypto_js_1.canonicalize)(args);
        for (const p of patterns) {
            if (p.test(argsStr))
                return p.source;
        }
        return null;
    }
    // ── Helpers ──
    hashArgs(args) {
        // P1-6: Use JCS for deterministic hashing (not JSON.stringify)
        // This ensures that two objects with the same content but different key order
        // produce the same hash.
        const canonical = (0, crypto_js_1.canonicalize)(args);
        return `sha256:${(0, crypto_js_1.canonicalHash)(canonical)}`; // Full 64-char hash, not truncated
    }
    extractAgentId(credential) {
        const c = credential;
        return c.subject?.agent_id || c.payload?.agent_id || c.agent_id || 'unknown';
    }
    extractTrustScore(verification, credential) {
        const c = credential;
        return c.assessment?.score || c.payload?.trust?.sentinel_review_score || c.trust?.score || 0;
    }
    deny(reason, credential, toolName, trustScore, argsHash, timestamp) {
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
exports.TrustGateway = TrustGateway;
// ============================================================================
// MCP Middleware — wraps a tools/call handler with Trust Gateway
// ============================================================================
function withTrustGateway(handler, gateway) {
    return async (agentCredential, toolName, args) => {
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
