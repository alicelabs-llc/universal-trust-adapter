/**
 * @marketnow/trust-adapter-x509
 * P7-4: X.509 Certificate adapter — traditional PKI integration.
 *
 * Allows UTA to verify standard X.509 certificates (the kind used in TLS,
 * code signing, and enterprise PKI). This bridges the gap between the
 * UTA trust model (Ed25519 + JCS + domain separation) and the traditional
 * X.509 PKI model (RSA/ECDSA + ASN.1 + chain validation).
 *
 * Features:
 *   - Parse X.509 certificates from PEM format
 *   - Verify certificate chain (leaf → intermediate → root)
 *   - Check certificate validity period (notBefore / notAfter)
 *   - Extract subject CN, SAN URIs/DNS names, issuer DN
 *   - Extract public key (RSA/ECDSA/Ed25519)
 *   - Check revocation via CRL or OCSP (using UTA's existing revocation module)
 *   - Translate X.509 cert → UTS for pipeline integration
 *
 * Use cases:
 *   - Allow agents that authenticate with client certificates (mTLS)
 *   - Verify code-signing certificates (e.g., Apple Developer ID)
 *   - Bridge enterprise PKI into the UTA trust framework
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';
export interface X509CertificateInfo {
    /** Subject Distinguished Name (e.g., "CN=agent.example.com,O=Org,C=US") */
    subject: string;
    /** Issuer Distinguished Name */
    issuer: string;
    /** Serial number (hex) */
    serialNumber: string;
    /** Not-valid-before date */
    validFrom: Date;
    /** Not-valid-after date */
    validTo: Date;
    /** Subject Alternative Names (URIs, DNS names, IPs) */
    subjectAltName: string;
    /** Public key algorithm: 'rsa' | 'ec' | 'ed25519' */
    publicKeyAlgorithm: string;
    /** Signature algorithm: 'RSA-SHA256' | 'ECDSA-SHA256' | 'Ed25519' */
    signatureAlgorithm: string;
    /** Whether the certificate is a CA (can sign other certs) */
    isCA: boolean;
    /** Key usage flags (digitalSignature, keyEncipherment, etc.) */
    keyUsage: string[];
    /** Extended key usage (serverAuth, clientAuth, codeSigning, etc.) */
    extKeyUsage: string[];
    /** Raw PEM */
    pem: string;
    /** SHA-256 fingerprint of the DER */
    fingerprint: string;
}
export interface X509VerifyResult {
    valid: boolean;
    issues: string[];
    /** Certificate info from the leaf cert */
    certificate?: X509CertificateInfo;
    /** Chain depth (0 = self-signed, 1 = root → leaf, 2 = root → intermediate → leaf) */
    chainDepth?: number;
    /** Whether the chain was verified back to a trusted root */
    chainVerified: boolean;
    /** Whether the cert is expired */
    expired: boolean;
    /** Whether the cert is revoked (if checked) */
    revoked?: boolean;
    /** Subject identity (CN or first SAN URI) */
    identity?: string;
}
/**
 * Parse an X.509 certificate from PEM format.
 * Returns structured info or throws on error.
 */
export declare function parseX509(pem: string): X509CertificateInfo;
/**
 * Verify an X.509 certificate chain.
 *
 * @param leafPem - The leaf certificate PEM
 * @param intermediatePEMs - Optional array of intermediate CA certificate PEMs
 * @param rootPEMs - Array of trusted root CA certificate PEMs
 * @param opts - Verification options
 * @returns X509VerifyResult
 */
export declare function verifyX509Chain(leafPem: string, intermediatePEMs: string[] | undefined, rootPEMs: string[], opts?: {
    now?: Date;
    checkRevocation?: boolean;
}): X509VerifyResult;
/**
 * Convenience: verify a self-signed certificate (chainDepth = 0).
 */
export declare function verifySelfSigned(pem: string, opts?: {
    now?: Date;
}): X509VerifyResult;
export declare class X509Adapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "stable";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(_input: IssueInput, _keys: IssuerKeys): Promise<unknown>;
}
