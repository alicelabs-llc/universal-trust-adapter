/**
 * @marketnow/trust-adapter-zta
 * Anthropic Zero Trust Framework adapter — with REAL signature verification
 *
 * P5-2: Adds real Ed25519 signature verification.
 *
 * ZTA (Zero-Trust Agent) cards carry an optional `signature` block with an
 * Ed25519 signature over canonicalize(zta_without_signature). The signature
 * is computed with domain "UTA-ZTA-CARD" — preventing cross-format reuse
 * (a ZTA sig cannot be replayed as an ATC v3 sig).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';
export interface ZTACard {
    agent_id: string;
    agent_name?: string;
    description?: string;
    identity?: {
        public_key?: string;
        key_algorithm?: 'Ed25519' | 'ECDSA-P256' | 'RSA-2048';
        did?: string;
    };
    trust?: {
        score: number;
        confidence: 'low' | 'medium' | 'high';
        evidence: Array<{
            type: string;
            source: string;
            result: 'pass' | 'fail' | 'warn' | 'info';
            details?: string;
            timestamp?: string;
        }>;
    };
    capabilities?: {
        provides?: string[];
        requires?: string[];
    };
    policy?: Record<string, unknown>;
    metadata?: {
        issued_at: string;
        expires_at?: string;
        revoked?: boolean;
        revocation_url?: string;
        version?: string;
    };
    /** P5-2: optional Ed25519 signature block */
    signature?: {
        algorithm: 'Ed25519 (RFC 8032)';
        value: string;
        domain: string;
        key_id: string;
        signed_by: string;
        signed_at: string;
    };
}
export interface ZTAIssueParams {
    agent_id: string;
    agent_name?: string;
    description?: string;
    public_key?: string;
    did?: string;
    trust_score: number;
    confidence: 'low' | 'medium' | 'high';
    evidence?: Array<{
        type: string;
        source: string;
        result: 'pass' | 'fail' | 'warn' | 'info';
        details?: string;
        timestamp?: string;
    }>;
    provides?: string[];
    requires?: string[];
    policy?: Record<string, unknown>;
    expires_in_days: number;
    issuer_did: string;
    issuer_name: string;
    issuer_private_key_pem: string;
    issuer_key_id: string;
}
export declare function issueZTACard(params: ZTAIssueParams): ZTACard;
export interface ZTAVerifyResult {
    valid: boolean;
    issues: string[];
    signature_valid: boolean;
    issuer_did?: string;
    agent_id?: string;
    expired: boolean;
    trust_score?: number;
}
export declare function verifyZTACard(card: ZTACard, issuerPublicKeyPem: string, options?: {
    now?: Date;
    skipExpiry?: boolean;
}): ZTAVerifyResult;
export declare class ZTAAdapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "beta";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(input: IssueInput, keys: IssuerKeys): Promise<unknown>;
}
export declare const ZTA_DOMAIN = "UTA-ZTA-CARD";
