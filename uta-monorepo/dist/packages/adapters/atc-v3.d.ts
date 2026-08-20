/**
 * @marketnow/trust-adapters
 * BLOQUE E: ATC v3 — Real Issuance with Artifact Binding + Official Vectors
 *
 * Implements:
 *   - ATC v3 credential structure (multi-signature)
 *   - Real Ed25519 signing via BLOQUE B crypto
 *   - Artifact Binding (Git SHA + npm tarball + OCI digest)
 *   - Official test vectors (positive + negative + mutation)
 *   - Round-trip: issue → verify → mutate → verify breaks
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 */
import { type Ed25519KeyPair } from '../core/crypto.js';
import type { UTSv2 } from '../uts/index.js';
export interface ATCv3Credential {
    atc_version: '3.0.0';
    credential_id: string;
    issuer: ATCIssuer;
    subject: ATCSubject;
    artifact_binding?: ATCArtifactBinding;
    attestations: ATCAttestation[];
    capabilities: ATCCapabilities;
    lifecycle: ATCLifecycle;
    assessment: ATCAssessment;
    signatures: ATCSignature[];
}
export interface ATCIssuer {
    did: string;
    name: string;
    url: string;
    ca_key_id: string;
}
export interface ATCSubject {
    agent_did?: string;
    agent_id: string;
    agent_name: string;
    public_key: string;
    key_algorithm: 'Ed25519' | 'ECDSA-P256' | 'RSA-2048';
    subject_type: 'agent' | 'tool' | 'service';
}
export interface ATCArtifactBinding {
    git: {
        repository: string;
        commit_sha: string;
    };
    npm?: {
        package: string;
        version: string;
        tarball_sha256: string;
    };
    oci?: {
        image: string;
        digest: string;
    };
    binding_hash: string;
}
export interface ATCAttestation {
    type: string;
    issuer: string;
    evidence: ATCEvidence[];
    signed_at: string;
    signature_hash: string;
}
export interface ATCEvidence {
    layer: string;
    result: 'pass' | 'fail' | 'warn';
    details: string;
    evidence_hash: string;
}
export interface ATCCapabilities {
    provides: string[];
    requires: string[];
    protocols: string[];
    rate_limits?: {
        requests: number;
        window: string;
    };
}
export interface ATCLifecycle {
    issued_at: string;
    expires_at: string;
    revoked: boolean;
    revocation_url: string;
    version: string;
}
export interface ATCAssessment {
    methodology: string;
    methodology_version: string;
    score: number;
    confidence: 'low' | 'medium' | 'high';
    risk_level: 'low' | 'medium' | 'high' | 'critical' | 'not_audited';
    computed_at: string;
    computed_by: string;
}
export interface ATCSignature {
    algorithm: 'Ed25519 (RFC 8032)';
    value: string;
    signed_by: string;
    signed_at: string;
    domain: string;
    key_id: string;
    canonicalization: 'RFC_8785_JCS';
    evidence_hash: string;
}
export interface IssueParams {
    issuer: {
        did: string;
        name: string;
        url: string;
        ca_key_id: string;
    };
    subject: {
        agent_id: string;
        agent_name: string;
        public_key: string;
        key_algorithm: 'Ed25519' | 'ECDSA-P256' | 'RSA-2048';
        agent_did?: string;
        subject_type: 'agent' | 'tool' | 'service';
    };
    artifact_binding?: {
        git_repository: string;
        git_commit_sha: string;
        npm_tarball_sha256?: string;
        docker_digest?: string;
    };
    attestations?: Array<{
        type: string;
        evidence: Array<{
            layer: string;
            result: 'pass' | 'fail' | 'warn';
            details: string;
        }>;
    }>;
    capabilities: {
        provides: string[];
        requires?: string[];
        protocols?: string[];
    };
    assessment: {
        methodology: string;
        methodology_version: string;
        score: number;
        confidence: 'low' | 'medium' | 'high';
        risk_level: 'low' | 'medium' | 'high' | 'critical' | 'not_audited';
    };
    expires_in_days: number;
    ca_key_pair: Ed25519KeyPair;
}
/**
 * Issue a real ATC v3 credential with Ed25519 signature.
 *
 * Flow:
 *   1. Build the credential payload (everything except signatures[])
 *   2. Compute artifact binding hash
 *   3. Compute evidence hashes for each attestation
 *   4. Canonicalize the payload using RFC 8785 JCS
 *   5. Sign with Ed25519 using domain "UTA-ATC-V3-CREDENTIAL"
 *   6. Compute evidence_hash = SHA-256(canonical + signature)
 *   7. Return the complete credential with signatures[]
 */
export declare function issueATCv3(params: IssueParams): ATCv3Credential;
export interface ATCVerifyResult {
    valid: boolean;
    credential_id: string;
    issues: string[];
    signature_valid: boolean;
    evidence_hash_valid: boolean;
    canonical_bytes: string;
    canonical_sha256: string;
}
/**
 * Verify an ATC v3 credential's Ed25519 signature.
 *
 * Flow:
 *   1. Extract the payload (everything except signatures[])
 *   2. Extract the signature
 *   3. Canonicalize the payload using RFC 8785 JCS
 *   4. Verify Ed25519 signature with domain "UTA-ATC-V3-CREDENTIAL"
 *   5. Verify evidence_hash = SHA-256(canonical + signature)
 *   6. Check expiry, revocation
 */
export declare function verifyATCv3(credential: ATCv3Credential, caPublicKeyPem: string): ATCVerifyResult;
/**
 * Convert ATC v3 credential to UTS v2.
 */
export declare function atcV3ToUTS(credential: ATCv3Credential): UTSv2;
/**
 * Generate official test vectors for ATC v3.
 * These vectors verify that:
 *   1. A valid credential verifies correctly
 *   2. A tampered credential fails verification
 *   3. A mutated field (1 byte change) breaks the signature
 *   4. An expired credential is rejected
 *   5. A revoked credential is rejected
 *   6. A wrong-domain signature is rejected
 */
export declare function generateTestVectors(caKeyPair: Ed25519KeyPair): {
    positive: ATCv3Credential[];
    negative: ATCv3Credential[];
    mutations: Array<{
        field: string;
        credential: ATCv3Credential;
        expected_valid: boolean;
    }>;
};
