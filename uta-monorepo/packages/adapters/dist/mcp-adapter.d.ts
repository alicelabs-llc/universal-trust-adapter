/**
 * @marketnow/trust-adapter-mcp
 * MCP (Model Context Protocol) Server Card adapter — with optional signature verification
 *
 * P5-3: MCP Server Cards don't natively carry signatures (they're tool manifests).
 * However, an MCP registry (like the Anthropic registry) can SIGN an MCP card
 * to attest to its reviewed status. This adapter verifies those signatures.
 *
 * The signature is over canonicalize(card_without_signature) with domain
 * "UTA-MCP-CARD" — preventing cross-format reuse.
 *
 * Cards WITHOUT a signature are still considered valid structurally, but get
 * trust_score=0 and a warning. Cards WITH a signature get trust_score
 * promoted to at least 5 (the registry vouches for the card).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';
export interface MCPCard {
    name: string;
    description?: string;
    url?: string;
    version?: string;
    transport?: 'stdio' | 'http' | 'sse' | 'ws';
    tools?: Array<{
        name: string;
        description?: string;
    }>;
    created_at?: string;
    /** P5-3: optional registry signature (Ed25519) */
    signature?: {
        algorithm: 'Ed25519 (RFC 8032)';
        value: string;
        domain: string;
        key_id: string;
        signed_by: string;
        signed_at: string;
    };
}
export interface MCPIssueParams {
    name: string;
    description?: string;
    url?: string;
    version?: string;
    transport?: 'stdio' | 'http' | 'sse' | 'ws';
    tools?: Array<{
        name: string;
        description?: string;
    }>;
    /** Number of days until the signature expires */
    expires_in_days: number;
    /** Registry DID */
    registry_did: string;
    registry_name: string;
    registry_private_key_pem: string;
    registry_key_id: string;
}
export declare function issueMCPCard(params: MCPIssueParams): MCPCard;
export interface MCPVerifyResult {
    valid: boolean;
    issues: string[];
    signature_valid: boolean;
    signed_by?: string;
    signed_at?: string;
    trust_score: number;
    tools_count: number;
}
export declare function verifyMCPCard(card: MCPCard, registryPublicKeyPem?: string): MCPVerifyResult;
export declare class MCPAdapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "stable";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(input: IssueInput, _keys: IssuerKeys): Promise<unknown>;
}
export declare const MCP_DOMAIN = "UTA-MCP-CARD";
