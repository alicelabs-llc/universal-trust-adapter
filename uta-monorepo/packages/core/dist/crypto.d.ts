/**
 * @marketnow/trust-core
 * BLOQUE B: Real Cryptographic Implementation
 *
 * Ed25519 (RFC 8032) — real signing and verification
 * JCS (RFC 8785) — deterministic canonical JSON
 * Domain Separation — prevent cross-context signature reuse
 * Proof-of-Possession — nonce challenge anti-replay
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */
/**
 * Canonicalize a value according to RFC 8785 JCS.
 * This is the EXACT implementation — not a stub.
 */
export declare function canonicalize(value: unknown): string;
/**
 * Compute the SHA-256 digest of the canonical form of a value.
 */
export declare function canonicalHash(value: unknown): string;
export interface Ed25519KeyPair {
    publicKeyPem: string;
    privateKeyPem: string;
    publicKeyRaw: string;
    keyId: string;
}
/**
 * Generate a new Ed25519 key pair.
 */
export declare function generateEd25519KeyPair(): Ed25519KeyPair;
/**
 * Sign a payload using Ed25519 (RFC 8032).
 *
 * @param payload - The object to sign (will be canonicalized using JCS)
 * @param privateKeyPem - Ed25519 private key in PEM format
 * @param domain - Domain separation string (e.g., 'UTA-ATC-V3-CREDENTIAL')
 * @returns The signature as hex string (128 chars = 64 bytes)
 */
export declare function sign(payload: unknown, privateKeyPem: string, domain: string): string;
/**
 * Verify an Ed25519 signature (RFC 8032).
 *
 * @param payload - The object that was signed
 * @param signatureHex - The signature as hex string
 * @param publicKeyPem - Ed25519 public key in PEM format
 * @param domain - Domain separation string (MUST match the one used for signing)
 * @returns true if the signature is valid
 */
export declare function verify(payload: unknown, signatureHex: string, publicKeyPem: string, domain: string): boolean;
export declare const DOMAINS: {
    /** For signing ATC v3 credential payloads */
    readonly ATC_V3_CREDENTIAL: "UTA-ATC-V3-CREDENTIAL";
    /** For Proof-of-Possession challenges */
    readonly ATC_V3_POP: "UTA-ATC-V3-POP";
    /** For bridge attestation records */
    readonly BRIDGE_ATTESTATION: "UTA-BRIDGE-ATTESTATION";
    /** For license tokens */
    readonly LICENSE_TOKEN: "UTA-LICENSE-TOKEN";
    /** For trust decision evidence records */
    readonly TRUST_DECISION: "UTA-TRUST-DECISION";
    /** For quarantine decision records */
    readonly QUARANTINE_DECISION: "UTA-QUARANTINE-DECISION";
};
export type SignatureDomain = (typeof DOMAINS)[keyof typeof DOMAINS];
export interface PoPChallenge {
    nonce: string;
    credential_id: string;
    audience: string;
    issued_at: string;
    expires_at: string;
}
export interface PoPResponse {
    nonce: string;
    credential_id: string;
    audience: string;
    timestamp: string;
    signature: string;
}
/**
 * Generate a PoP challenge nonce.
 * The agent must sign this nonce to prove it holds the private key.
 */
export declare function generatePoPChallenge(credentialId: string, audience: string): PoPChallenge;
/**
 * Create a PoP response by signing the challenge.
 * The agent calls this with its private key.
 */
export declare function createPoPResponse(challenge: PoPChallenge, privateKeyPem: string): PoPResponse;
/**
 * Verify a PoP response.
 * Returns true if the agent proved possession of the private key.
 */
export declare function verifyPoP(response: PoPResponse, publicKeyPem: string, expectedChallenge: PoPChallenge): boolean;
export interface ArtifactBinding {
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
/**
 * Compute the artifact binding hash.
 */
export declare function computeArtifactBinding(gitSha: string, npmTarballSha256?: string, dockerDigest?: string): string;
