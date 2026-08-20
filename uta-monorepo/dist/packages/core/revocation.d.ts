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
/**
 * Backend storage for OCSP responses.
 * Implementations: in-memory (testing), Supabase (production), Redis (cache).
 */
export interface RevocationStore {
    getStatus(credential_id: string): Promise<{
        status: RevocationStatus;
        revoked_at?: string;
        reason?: string;
    }>;
}
/**
 * In-memory RevocationStore — for testing and small deployments.
 */
export declare class InMemoryRevocationStore implements RevocationStore {
    private statuses;
    setStatus(credential_id: string, status: RevocationStatus, reason?: string): void;
    getStatus(credential_id: string): Promise<{
        status: RevocationStatus;
        revoked_at?: string;
        reason?: string;
    }>;
}
/**
 * Build a signed OCSP response for a credential.
 * Used by the OCSPResponder (server-side) AND by test fixtures (client-side).
 */
export declare function issueOCSPResponse(params: {
    credential_id: string;
    status: RevocationStatus;
    issuer_did: string;
    responder_did: string;
    responder_private_key_pem: string;
    responder_key_id: string;
    nonce: string;
    revoked_at?: string;
    reason?: string;
    next_update_hours?: number;
}): OCSPResponse;
/**
 * Verify an OCSP response signature (used by the client-side checker when
 * responderKeyPem is provided, and by other verifiers that need to check
 * a cached response).
 */
export declare function verifyOCSPResponse(response: OCSPResponse, responderPublicKeyPem: string): boolean;
/**
 * Handle an OCSP request — the server-side entry point.
 *
 * Flow:
 *   1. Parse request body ({ credential_id, issuer_did, nonce })
 *   2. Validate nonce (32+ bytes hex) — reject if missing or malformed
 *   3. Look up status in RevocationStore
 *   4. Build signed OCSPResponse with the responder's private key
 *   5. Return response (200 OK + JSON body)
 *
 * Errors return 400 (bad request) or 500 (internal error).
 */
export declare function handleOCSPRequest(requestBody: unknown, store: RevocationStore, responderKeys: {
    did: string;
    private_key_pem: string;
    public_key_pem: string;
    key_id: string;
}): Promise<{
    status: number;
    body: OCSPResponse | {
        error: string;
    };
}>;
/**
 * Create a Node.js http.Server that handles OCSP requests at POST /ocsp.
 *
 * Usage:
 *   const server = createOCSPServer({ store, responderKeys, port: 8080 });
 *   server.listen(8080);
 *
 * The server responds to:
 *   POST /ocsp        — handle OCSP request (body: OCSPRequest JSON)
 *   GET  /health      — health check
 *   GET  /responder-key — return responder's public key PEM (for clients to pin)
 */
export declare function createOCSPServer(opts: {
    store: RevocationStore;
    responderKeys: {
        did: string;
        private_key_pem: string;
        public_key_pem: string;
        key_id: string;
    };
}): {
    handler: (req: any, res: any) => Promise<void>;
    listen: (port: number, host?: string) => Promise<void>;
};
