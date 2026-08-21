/**
 * @marketnow/trust-adapter-a2a
 * Google A2A (Agent2Agent) Agent Card adapter — with REAL signature verification
 *
 * P4-6: Adds real cryptographic verification of A2A Agent Cards.
 *
 * The A2A spec (https://github.com/google/Agent2Agent) specifies that Agent
 * Cards can optionally carry a `proof` block (Ed25519Signature2020 — same as
 * W3C VC) attesting that the issuer vouches for the agent's identity and
 * capabilities. This adapter verifies that proof.
 *
 * If no `proof` is present, the card is treated as UNVERIFIED (valid=false)
 * — fail-closed. The caller can override this with options.skipCrypto.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';
export interface A2AAgentCard {
    name: string;
    description?: string;
    url?: string;
    version?: string;
    capabilities?: string[];
    public_key?: string;
    oauth_subject?: string;
    issued_at?: string;
    expires_at?: string;
    /** P4-6: optional Ed25519Signature2020 proof block (same as W3C VC). */
    proof?: {
        type: 'Ed25519Signature2020';
        proofValue: string;
        proofPurpose: 'assertionMethod';
        created: string;
        verificationMethod?: string;
    };
}
export interface A2AIssueParams {
    issuer_did: string;
    issuer_name: string;
    issuer_url: string;
    agent_id: string;
    agent_name: string;
    agent_url: string;
    capabilities: string[];
    public_key: string;
    oauth_subject?: string;
    expires_in_days: number;
    ca_private_key_pem: string;
    ca_key_id: string;
}
/**
 * Issue a signed A2A Agent Card.
 */
export declare function issueA2ACard(params: A2AIssueParams): {
    agentCard: A2AAgentCard;
};
export interface A2AVerifyResult {
    valid: boolean;
    issues: string[];
    proof_valid: boolean;
    proof_method: string;
    issuer_did?: string;
    agent_id?: string;
    expires_at?: string;
    expired: boolean;
}
/**
 * Verify a signed A2A Agent Card.
 *
 * Performs:
 *   1. Structure validation (required fields present)
 *   2. Proof block validation (Ed25519Signature2020)
 *   3. Ed25519 signature verification over canonicalize(card_without_proof)
 *   4. Expiry check
 *
 * Returns valid=false if no proof is present (fail-closed).
 */
export declare function verifyA2ACard(card: A2AAgentCard, caPublicKeyPem: string, options?: {
    skipCrypto?: boolean;
    now?: Date;
}): A2AVerifyResult;
export declare class A2AAdapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "stable";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(input: IssueInput, keys: IssuerKeys): Promise<unknown>;
}
