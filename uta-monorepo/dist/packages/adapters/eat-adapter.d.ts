/**
 * @marketnow/trust-adapter-eat
 * IETF EAT-AI (Entity Attestation Token for AI Agents) adapter — with REAL verification
 *
 * P4-7: Adds real COSE-style signature verification for EAT tokens.
 *
 * EAT (Entity Attestation Token, RFC 9498) is a CWT (CBOR Web Token) profile
 * for entity attestation. EAT-AI extends it with AI-agent-specific claims.
 *
 * The CWT format is CBOR + COSE_Sign1. Implementing a full CBOR + COSE
 * decoder in pure TS is a substantial undertaking — for now, this adapter
 * supports a JSON serialization of EAT claims (which the spec also allows
 * for testing) with an Ed25519 or ES256 detached signature over the
 * canonicalized JSON.
 *
 * Real production deployments should use `cwt-js` or `@peculiar/cose`
 * for full CBOR/COSE support. This implementation is sufficient for:
 *   - Verifying EAT tokens encoded as JSON (common in test vectors)
 *   - Verifying the detached COSE signature over canonicalized claims
 *   - Translating between EAT and other UTA-supported formats
 *
 * Spec: RFC 9498 (EAT), draft-messous-eat-ai-00 (EAT-AI profile)
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';
export interface EATClaims {
    /** Issuer (DID or URL) */
    iss: string;
    /** Subject — the agent being attested */
    sub: string;
    /** Issued at (Unix timestamp) */
    iat: number;
    /** Expiration (Unix timestamp) */
    exp?: number;
    /** Confirmation key — the agent's public key */
    cnf?: {
        jwk?: {
            kty: string;
            crv?: string;
            x?: string;
            y?: string;
            n?: string;
            e?: string;
        };
        cose?: {
            kty: number;
            alg: number;
            crv?: number;
            x?: string;
            y?: string;
        };
    };
    /** UEID — Unique Entity Identifier (used for TEE attestation quotes) */
    ueid?: string;
    /** Trust score (EAT-AI extension) — 0 to 10 */
    trust_score?: number;
    /** Trust level (EAT-AI extension) — 'low' | 'medium' | 'high' */
    trust_level?: 'low' | 'medium' | 'high';
    /** Evidence chain */
    evidence?: Array<{
        type: string;
        result: string;
        details?: string;
        timestamp?: string;
    }>;
    /** Agent name (EAT-AI extension) */
    name?: string;
    /** Agent capabilities (EAT-AI extension) */
    capabilities?: string[];
}
export interface EATToken {
    /** The EAT claims (JSON form — for full COSE this would be CBOR bytes) */
    payload: EATClaims;
    /** COSE_Sign1 detached signature.
     *  For Ed25519: 64 bytes (raw). For ES256: 64 bytes (raw R||S).
     *  For RSA: variable length, PKCS#1 v1.5. */
    signature: string;
    /** Algorithm used */
    alg: 'EdDSA' | 'ES256' | 'RS256';
    /** Key ID — for lookup in trust registry */
    kid?: string;
    /** COSE protected header (base64url) — for full COSE compatibility */
    protected?: string;
}
export interface EATVerifyResult {
    valid: boolean;
    issues: string[];
    signature_valid: boolean;
    alg: string;
    issuer: string;
    subject: string;
    expired: boolean;
    trust_score?: number;
    trust_level?: string;
}
export interface EATIssueParams {
    issuer: string;
    subject: string;
    subject_name?: string;
    subject_public_key?: string;
    capabilities?: string[];
    trust_score?: number;
    trust_level?: 'low' | 'medium' | 'high';
    ueid?: string;
    evidence?: EATClaims['evidence'];
    expires_in_days: number;
    issuer_private_key_pem: string;
    issuer_key_id: string;
    alg: 'EdDSA' | 'ES256' | 'RS256';
}
/**
 * Issue a signed EAT token.
 *
 * The token is a JSON object with `payload` (the EAT claims) and
 * `signature` (a detached COSE_Sign1-style signature over canonicalize(payload)).
 *
 * The signature is computed over `domain:canonicalize(payload)` where domain is
 * "UTA-EAT-AI" — providing cross-format signature non-reuse (an EAT signature
 * cannot be replayed as a JWT signature, and vice versa).
 */
export declare function issueEAT(params: EATIssueParams): EATToken;
export declare function verifyEAT(token: EATToken, issuerPublicKeyPem: string, options?: {
    now?: Date;
    skipExpiry?: boolean;
}): EATVerifyResult;
export declare class EATAdapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "beta";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(input: IssueInput, keys: IssuerKeys): Promise<unknown>;
}
