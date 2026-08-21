/**
 * @marketnow/trust-core
 * BLOQUE D: Verification Core — 12-Stage Fail-Closed Pipeline
 *
 * Every credential MUST pass all 12 stages. Any failure = DENY.
 * Unknown = DENY. Error = DENY. Expired = DENY. Revoked = DENY.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 */
import { type PoPResponse } from './crypto.js';
import type { UniversalTrustSchema, NativeFormat } from './types.js';
import type { RevocationChecker } from './revocation.js';
export type StageResult = 'PASS' | 'FAIL' | 'SKIP' | 'NOT_APPLICABLE';
export interface VerificationStage {
    name: string;
    result: StageResult;
    reason?: string;
    evidence?: unknown;
    duration_ms: number;
}
export interface VerificationContext {
    credential: unknown;
    format?: NativeFormat;
    audience?: string;
    nonce?: string;
    pop_response?: PoPResponse;
    ca_public_key?: string;
    /**
     * P2-6: Revocation checker. If provided, stage 09 (LIFECYCLE) calls
     * `revocation_checker.check()` in addition to the inline `lifecycle.revoked`
     * boolean. The checker may use CRL, OCSP, or Bitstring Status List depending
     * on the credential's declarations.
     *
     * If not provided, the pipeline falls back to checking only the inline
     * `lifecycle.revoked` boolean (weaker — an attacker who can tamper with
     * the credential JSON can flip the bit).
     */
    revocation_checker?: RevocationChecker;
    /** Issuer DID — used by some revocation methods (OCSP, CRL signature verification) */
    issuer_did?: string;
    policy?: {
        min_trust_score?: number;
        max_age_days?: number;
        require_pop?: boolean;
        require_artifact_binding?: boolean;
        allowed_issuers?: string[];
        /**
         * If true (default), an "unknown" revocation status (responder unreachable,
         * status list not found, etc.) is treated as DENY (fail-closed).
         * Set to false only in development/test environments where you want to
         * see what the rest of the pipeline does without revocation answers.
         */
        fail_closed_unknown_revocation?: boolean;
    };
}
export interface VerificationResult {
    decision: 'ALLOW' | 'DENY';
    format: NativeFormat | null;
    stages: VerificationStage[];
    uts?: UniversalTrustSchema;
    total_duration_ms: number;
    failure_stage?: string;
    failure_reason?: string;
}
/**
 * Execute the 12-stage verification pipeline.
 *
 * STAGES:
 *  01 PARSE            — Can we parse the payload?
 *  02 DETECT           — What format is this?
 *  03 SCHEMA VALIDATE  — Does it match the expected schema?
 *  04 CRYPTO VERIFY     — Is the Ed25519 signature valid?
 *  05 ISSUER TRUST     — Do we trust the issuer?
 *  06 KEY BINDING      — Is the key ID valid?
 *  07 PROOF OF POSSESSION — Has the agent proven it holds the private key?
 *  08 PROVENANCE       — Is the artifact binding valid?
 *  09 LIFECYCLE        — Is it expired? Revoked?
 *  10 EVIDENCE VALIDATION — Are the evidence hashes correct?
 *  11 POLICY EVALUATION — Does it meet the policy requirements?
 *  12 DECISION         — Final ALLOW or DENY
 */
export declare function verifyCredential(ctx: VerificationContext): Promise<VerificationResult>;
