/**
 * @marketnow/gateway
 * BLOQUE K: Trust Gateway — MCP Middleware + Enforcement
 *
 * Intercepts ALL tools/call requests and verifies trust BEFORE execution.
 * Flow: tools/call → extract identity → verify ATC → PoP → policy → ALLOW/BLOCK
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
import { type VerificationResult } from '../core/verification-pipeline.js';
export interface GatewayConfig {
    min_trust_score: number;
    require_pop: boolean;
    require_artifact_binding: boolean;
    block_secret_reads: boolean;
    block_shell_exec: boolean;
    ca_public_key?: string;
    api_base_url?: string;
    /** P3-5: List of trusted issuer DIDs. If empty, issuer trust is enforced
     *  by the pipeline's default fail-closed behavior (DENY unknown).
     *  Configure with the list of DIDs you want to ALLOW. */
    allowed_issuers?: string[];
}
export declare const DEFAULT_CONFIG: GatewayConfig;
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
export declare class TrustGateway {
    private config;
    constructor(config?: Partial<GatewayConfig>);
    /**
     * Check if a tools/call request should be allowed.
     *
     * @param agentCredential - The agent's ATC credential
     * @param toolName - The tool being called
     * @param args - The tool arguments
     * @param popResponse - Optional PoP response (if require_pop is true)
     * @returns GatewayDecision
     */
    check(agentCredential: unknown, toolName: string, args?: Record<string, unknown>, popResponse?: unknown): Promise<GatewayDecision>;
    private detectSecretReads;
    private detectShellExec;
    private hashArgs;
    private extractAgentId;
    private extractTrustScore;
    private deny;
}
export declare function withTrustGateway(handler: (args: Record<string, unknown>) => Promise<unknown>, gateway: TrustGateway): (agentCredential: unknown, toolName: string, args: Record<string, unknown>) => Promise<unknown>;
