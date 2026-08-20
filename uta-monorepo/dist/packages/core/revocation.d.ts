/**
 * @marketnow/trust-core
 * P2-6: Revocation abstraction — CRL + OCSP + Bitstring Status List
 *
 * Three real revocation checking mechanisms, behind one common interface:
 *
 *   - CRL (Certificate Revocation List): a signed list of revoked credential
 *     IDs, fetched from a URL, cached, and verified with the issuer's public
 *     key.
 *
 *   - OCSP (Online Certificate Status Protocol, RFC 6960): per-credential
 *     HTTP query to a responder URL. Returns "good", "revoked", or "unknown".
 *     Supports responder signature verification for non-repudiation.
 *
 *   - Bitstring Status List (W3C "Status List 2021"): a compressed
 *     (gzip + base64url) bitstring where each bit (or two-bit code) represents
 *     the status of one credential indexed by `statusListIndex`. Cheapest
 *     option for large issuers — one small file scales to millions of
 *     credentials.
 *
 * The Trust Gateway's stage 09 (LIFECYCLE) calls `RevocationChecker.check()`
 * which dispatches to whichever mechanism the credential declares
 * (lifecycle.revocation_method). If none is declared, falls back to the
 * legacy `lifecycle.revoked` boolean.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export type RevocationStatus = 'good' | 'revoked' | 'unknown';
export interface RevocationResult {
    status: RevocationStatus;
    method: 'CRL' | 'OCSP' | 'BITSTRING_STATUS_LIST' | 'INLINE_BOOLEAN' | 'NONE';
    checked_at: string;
    reason?: string;
    revoked_at?: string;
    source_url?: string;
    /** if status === 'unknown', the verifier should treat this as 'revoked' (fail-closed) */
    fail_closed_unknown: boolean;
}
export interface RevocationChecker {
    check(params: {
        credential_id: string;
        issuer_did?: string;
        revocation_url?: string;
        status_list_index?: number;
        status_list_credential_url?: string;
        ca_public_key_pem?: string;
        revocation_method?: 'CRL' | 'OCSP' | 'BITSTRING_STATUS_LIST' | 'AUTO';
    }): Promise<RevocationResult>;
}
export interface CRLPayload {
    issuer: string;
    revoked: Array<{
        credential_id: string;
        revoked_at: string;
        reason?: string;
    }>;
    this_update: string;
    next_update: string;
    crl_number: number;
}
export interface CRLDocument extends CRLPayload {
    signature: {
        algorithm: 'Ed25519 (RFC 8032)';
        value: string;
        domain: string;
        key_id: string;
        signed_at: string;
    };
}
/**
 * Verify a CRL signature and return the payload if valid.
 * CRL signatures use the same domain as credentials — UTA-ATC-V3-CREDENTIAL —
 * so a CA key can sign both. (Different domain would be reasonable too, but
 * reusing it avoids requiring a separate keypair just for CRL signing.)
 */
export declare function verifyCRL(crl: CRLDocument, caPublicKeyPem: string): CRLPayload | null;
export declare class CRLRevocationChecker implements RevocationChecker {
    private cache;
    private cacheTtlMs;
    private fetcher;
    constructor(opts?: {
        cacheTtlMs?: number;
        fetcher?: (url: string) => Promise<CRLDocument>;
    });
    check(params: {
        credential_id: string;
        revocation_url?: string;
        ca_public_key_pem?: string;
    }): Promise<RevocationResult>;
    private fetchCRL;
}
export interface OCSPRequest {
    credential_id: string;
    issuer_did?: string;
    nonce: string;
}
export interface OCSPResponse {
    credential_id: string;
    status: RevocationStatus;
    this_update: string;
    next_update: string;
    revoked_at?: string;
    reason?: string;
    responder: string;
    signature?: {
        algorithm: 'Ed25519 (RFC 8032)';
        value: string;
        domain: string;
        key_id: string;
    };
    nonce: string;
}
export declare class OCSPRevocationChecker implements RevocationChecker {
    private responderUrl;
    private responderKeyPem?;
    private cache;
    private cacheTtlMs;
    constructor(opts: {
        responderUrl: string;
        responderKeyPem?: string;
        cacheTtlMs?: number;
    });
    check(params: {
        credential_id: string;
        issuer_did?: string;
    }): Promise<RevocationResult>;
    private callResponder;
}
export interface BitstringStatusListCredential {
    '@context': string[];
    id: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    credentialSubject: {
        id: string;
        type: 'BitstringStatusList';
        statusPurpose: 'revocation' | 'suspension';
        encodedList: string;
        ttl?: number;
    };
    proof?: {
        type: 'Ed25519Signature2020';
        proofValue: string;
        proofPurpose: 'assertionMethod';
        created: string;
    };
}
export interface BitstringStatusEntry {
    status_list_credential_url: string;
    status_list_index: number;
}
/**
 * Decode a Bitstring Status List's encodedList field.
 * Format (per W3C Status List 2021): base64url(gzip(bitstring))
 *
 * The bitstring length is rounded up to the nearest multiple of 16384 bits
 * (the spec's minimum block size).
 */
export declare function decodeBitstringStatusList(encodedList: string): Uint8Array;
/**
 * Get the status of a credential at the given index in a Bitstring Status List.
 * bit value 0 = good, 1 = revoked.
 */
export declare function getStatusBit(list: Uint8Array, index: number): 0 | 1;
/**
 * Construct a Bitstring Status List from an array of {index, status} entries.
 * Returns the base64url(gzip(bitstring)) string.
 */
export declare function buildBitstringStatusList(entries: Array<{
    index: number;
    revoked: boolean;
}>, opts?: {
    minLength?: number;
}): string;
export declare class BitstringStatusListChecker implements RevocationChecker {
    private cache;
    private fetcher;
    constructor(opts?: {
        fetcher?: (url: string) => Promise<BitstringStatusListCredential>;
    });
    check(params: {
        credential_id: string;
        status_list_credential_url?: string;
        status_list_index?: number;
        ca_public_key_pem?: string;
    }): Promise<RevocationResult>;
    private fetchList;
}
export declare class CompositeRevocationChecker implements RevocationChecker {
    private crl;
    private ocsp;
    private bitstring;
    constructor(opts?: {
        crl?: CRLRevocationChecker;
        ocsp?: OCSPRevocationChecker;
        bitstring?: BitstringStatusListChecker;
    });
    check(params: {
        credential_id: string;
        issuer_did?: string;
        revocation_url?: string;
        status_list_index?: number;
        status_list_credential_url?: string;
        ca_public_key_pem?: string;
        revocation_method?: 'CRL' | 'OCSP' | 'BITSTRING_STATUS_LIST' | 'AUTO';
    }): Promise<RevocationResult>;
}
export declare function issueCRL(payload: CRLPayload, caPrivateKeyPem: string, caKeyId: string): CRLDocument;
