/**
 * @marketnow/trust-adapters
 * P1-2: OAuth/OIDC — Real JWT verification (RS256/ES256/Ed25519)
 * P1-3: W3C VC — Real Ed25519Signature2020 verification
 *
 * Uses Node.js crypto.verify() for real signature verification.
 * No stubs. Real cryptographic verification only.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export interface JWTHeader {
    alg: 'RS256' | 'ES256' | 'EdDSA' | 'HS256' | 'none';
    typ: string;
    kid?: string;
}
export interface JWTClaims {
    iss: string;
    sub: string;
    aud?: string | string[];
    exp?: number;
    iat?: number;
    nbf?: number;
    scope?: string;
    [key: string]: unknown;
}
export interface JWTVerifyResult {
    valid: boolean;
    header: JWTHeader;
    claims: JWTClaims | null;
    issues: string[];
    issuer: string;
    subject: string;
}
/**
 * Verify a JWT (JSON Web Token) with real cryptographic verification.
 *
 * Supports:
 *   - RS256 (RSA PKCS#1 v1.5 with SHA-256)
 *   - ES256 (ECDSA P-256 with SHA-256)
 *   - EdDSA (Ed25519)
 *
 * Does NOT support:
 *   - HS256 (symmetric — requires shared secret, not applicable for trust)
 *   - 'none' (explicitly rejected — fail-closed)
 *
 * @param jwt - The JWT string (header.payload.signature)
 * @param publicKeyPem - The issuer's public key in PEM format
 * @returns JWTVerifyResult
 */
export declare function verifyJWT(jwt: string, publicKeyPem: string): JWTVerifyResult;
export interface VCVerifyResult {
    valid: boolean;
    issuer: string;
    subject: string;
    issues: string[];
    proof_valid: boolean;
    proof_method: string;
}
/**
 * Verify a W3C Verifiable Credential with Ed25519Signature2020 proof.
 *
 * W3C VC Data Integrity spec:
 *   1. Extract the proof block (type, proofValue, verificationMethod, created)
 *   2. Create the verification input (canonicalized credential without proof)
 *   3. Verify Ed25519 signature
 *
 * @param vc - The Verifiable Credential object
 * @param publicKeyPem - The issuer's public key in PEM format
 * @returns VCVerifyResult
 */
export declare function verifyW3CVC(vc: Record<string, unknown>, publicKeyPem: string): VCVerifyResult;
/**
 * Issue a W3C VC with real Ed25519Signature2020 proof.
 *
 * @param credential - The credential WITHOUT proof
 * @param privateKeyPem - Ed25519 private key
 * @returns The credential with proof added
 */
export declare function issueW3CVC(credential: Record<string, unknown>, privateKeyPem: string): Record<string, unknown>;
