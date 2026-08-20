"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryRevocationStore = exports.CompositeRevocationChecker = exports.BitstringStatusListChecker = exports.OCSPRevocationChecker = exports.CRLRevocationChecker = void 0;
exports.verifyCRL = verifyCRL;
exports.decodeBitstringStatusList = decodeBitstringStatusList;
exports.getStatusBit = getStatusBit;
exports.buildBitstringStatusList = buildBitstringStatusList;
exports.issueCRL = issueCRL;
exports.issueOCSPResponse = issueOCSPResponse;
exports.verifyOCSPResponse = verifyOCSPResponse;
exports.handleOCSPRequest = handleOCSPRequest;
exports.createOCSPServer = createOCSPServer;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("./crypto.js");
/**
 * Verify a CRL signature and return the payload if valid.
 * CRL signatures use the same domain as credentials — UTA-ATC-V3-CREDENTIAL —
 * so a CA key can sign both. (Different domain would be reasonable too, but
 * reusing it avoids requiring a separate keypair just for CRL signing.)
 */
function verifyCRL(crl, caPublicKeyPem) {
    const { signature, ...payload } = crl;
    if (!signature || signature.domain !== crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL)
        return null;
    const ok = (0, crypto_js_1.verify)(payload, signature.value, caPublicKeyPem, crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL);
    if (!ok)
        return null;
    // Check next_update — if past, CRL is stale
    if (new Date(crl.next_update) < new Date())
        return null;
    return payload;
}
class CRLRevocationChecker {
    cache = new Map();
    cacheTtlMs;
    fetcher;
    constructor(opts = {}) {
        this.cacheTtlMs = opts.cacheTtlMs || 5 * 60 * 1000; // 5 min default
        this.fetcher = opts.fetcher || defaultFetcher;
    }
    async check(params) {
        if (!params.revocation_url) {
            return unknown('no revocation_url provided', params);
        }
        if (!params.ca_public_key_pem) {
            return unknown('no CA public key for CRL signature verification', params);
        }
        const crl = await this.fetchCRL(params.revocation_url);
        if (!crl)
            return unknown('failed to fetch CRL', params);
        const payload = verifyCRL(crl, params.ca_public_key_pem);
        if (!payload)
            return unknown('CRL signature invalid or stale', params);
        const revokedEntry = payload.revoked.find(r => r.credential_id === params.credential_id);
        if (revokedEntry) {
            return {
                status: 'revoked',
                method: 'CRL',
                checked_at: new Date().toISOString(),
                reason: revokedEntry.reason,
                revoked_at: revokedEntry.revoked_at,
                source_url: params.revocation_url,
                fail_closed_unknown: false,
            };
        }
        return {
            status: 'good',
            method: 'CRL',
            checked_at: new Date().toISOString(),
            source_url: params.revocation_url,
            fail_closed_unknown: false,
        };
    }
    async fetchCRL(url) {
        const cached = this.cache.get(url);
        if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
            return cached.crl;
        }
        try {
            const crl = await this.fetcher(url);
            this.cache.set(url, { crl, fetchedAt: Date.now() });
            return crl;
        }
        catch {
            return null;
        }
    }
}
exports.CRLRevocationChecker = CRLRevocationChecker;
class OCSPRevocationChecker {
    responderUrl;
    responderKeyPem;
    cache = new Map();
    cacheTtlMs;
    constructor(opts) {
        this.responderUrl = opts.responderUrl;
        this.responderKeyPem = opts.responderKeyPem;
        this.cacheTtlMs = opts.cacheTtlMs || 60 * 1000; // 1 min default
    }
    async check(params) {
        const req = {
            credential_id: params.credential_id,
            issuer_did: params.issuer_did,
            nonce: node_crypto_1.default.randomBytes(32).toString('hex'),
        };
        let resp = null;
        try {
            resp = await this.callResponder(req);
        }
        catch {
            return unknown('OCSP responder unreachable', params);
        }
        if (!resp)
            return unknown('OCSP responder returned no response', params);
        // Verify nonce (replay protection)
        if (resp.nonce !== req.nonce) {
            return unknown('OCSP nonce mismatch (possible replay)', params);
        }
        // Verify signature (if responder key provided)
        if (this.responderKeyPem && resp.signature) {
            const { signature, ...payload } = resp;
            const ok = (0, crypto_js_1.verify)(payload, signature.value, this.responderKeyPem, crypto_js_1.DOMAINS.TRUST_DECISION);
            if (!ok)
                return unknown('OCSP response signature invalid', params);
        }
        return {
            status: resp.status,
            method: 'OCSP',
            checked_at: new Date().toISOString(),
            reason: resp.reason,
            revoked_at: resp.revoked_at,
            source_url: this.responderUrl,
            fail_closed_unknown: true, // OCSP "unknown" is fail-closed
        };
    }
    async callResponder(req) {
        // Cache only successful responses keyed by credential_id (not by nonce, which is unique per request)
        const cached = this.cache.get(req.credential_id);
        if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
            // For cached responses, the nonce was generated by an earlier request.
            // Real OCSP responders echo the nonce back, so for the cache hit we
            // simulate this by re-issuing the cached response with the current
            // nonce. NOTE: this is for non-repudiation-free cache hits only — if
            // responderKeyPem is set, we don't use the cache (signature would not
            // match the new nonce).
            if (!this.responderKeyPem) {
                return { ...cached.response, nonce: req.nonce };
            }
        }
        const res = await fetch(this.responderUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(req),
        });
        if (!res.ok)
            throw new Error(`OCSP responder returned ${res.status}`);
        const resp = (await res.json());
        if (resp.status === 'good') {
            this.cache.set(req.credential_id, { response: resp, fetchedAt: Date.now() });
        }
        return resp;
    }
}
exports.OCSPRevocationChecker = OCSPRevocationChecker;
/**
 * Decode a Bitstring Status List's encodedList field.
 * Format (per W3C Status List 2021): base64url(gzip(bitstring))
 *
 * The bitstring length is rounded up to the nearest multiple of 16384 bits
 * (the spec's minimum block size).
 */
function decodeBitstringStatusList(encodedList) {
    const compressed = Buffer.from(encodedList, 'base64url');
    // gzip magic: 0x1f 0x8b
    if (compressed.length >= 2 && compressed[0] === 0x1f && compressed[1] === 0x8b) {
        return require('node:zlib').gunzipSync(compressed);
    }
    // not gzipped — use as-is
    return new Uint8Array(compressed);
}
/**
 * Get the status of a credential at the given index in a Bitstring Status List.
 * bit value 0 = good, 1 = revoked.
 */
function getStatusBit(list, index) {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    if (byteIndex >= list.length)
        return 0; // out-of-range = good (fail-open by spec; we keep spec behavior)
    const byte = list[byteIndex];
    return ((byte >> (7 - bitIndex)) & 1);
}
/**
 * Construct a Bitstring Status List from an array of {index, status} entries.
 * Returns the base64url(gzip(bitstring)) string.
 */
function buildBitstringStatusList(entries, opts = {}) {
    const maxIndex = entries.reduce((m, e) => Math.max(m, e.index), 0);
    const minLength = opts.minLength || 16384; // bits
    const bitLength = Math.max(maxIndex + 1, minLength);
    const byteLength = Math.ceil(bitLength / 8);
    const buffer = Buffer.alloc(byteLength, 0);
    for (const e of entries) {
        if (e.revoked) {
            const byteIndex = Math.floor(e.index / 8);
            const bitIndex = e.index % 8;
            buffer[byteIndex] |= (1 << (7 - bitIndex));
        }
    }
    const gzipped = require('node:zlib').gzipSync(buffer);
    return gzipped.toString('base64url');
}
class BitstringStatusListChecker {
    cache = new Map();
    fetcher;
    constructor(opts = {}) {
        this.fetcher = opts.fetcher || defaultFetcher;
    }
    async check(params) {
        if (!params.status_list_credential_url) {
            return unknown('no status_list_credential_url provided', params);
        }
        if (params.status_list_index === undefined || params.status_list_index === null) {
            return unknown('no status_list_index provided', params);
        }
        const list = await this.fetchList(params.status_list_credential_url, params.ca_public_key_pem);
        if (!list)
            return unknown('failed to fetch or verify status list', params);
        const bit = getStatusBit(list, params.status_list_index);
        if (bit === 1) {
            return {
                status: 'revoked',
                method: 'BITSTRING_STATUS_LIST',
                checked_at: new Date().toISOString(),
                reason: 'bit set in status list',
                source_url: params.status_list_credential_url,
                fail_closed_unknown: false,
            };
        }
        return {
            status: 'good',
            method: 'BITSTRING_STATUS_LIST',
            checked_at: new Date().toISOString(),
            source_url: params.status_list_credential_url,
            fail_closed_unknown: false,
        };
    }
    async fetchList(url, caPublicKeyPem) {
        const cached = this.cache.get(url);
        if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
            return cached.list;
        }
        try {
            const credential = await this.fetcher(url);
            // Verify signature if CA key is provided
            if (caPublicKeyPem && credential.proof) {
                const { proof, ...rest } = credential;
                if (proof.type !== 'Ed25519Signature2020')
                    return null;
                const signingInput = Buffer.from('W3C-VC-DATA-INTEGRITY:' + (0, crypto_js_1.canonicalize)(rest), 'utf-8');
                const publicKey = node_crypto_1.default.createPublicKey(caPublicKeyPem);
                const signature = Buffer.from(proof.proofValue, 'base64url');
                const ok = node_crypto_1.default.verify(null, signingInput, publicKey, signature);
                if (!ok)
                    return null;
            }
            const list = decodeBitstringStatusList(credential.credentialSubject.encodedList);
            const ttlMs = (credential.credentialSubject.ttl || 300) * 1000;
            this.cache.set(url, { list, fetchedAt: Date.now(), ttlMs });
            return list;
        }
        catch {
            return null;
        }
    }
}
exports.BitstringStatusListChecker = BitstringStatusListChecker;
// ============================================================================
// 4. Composite checker — tries each method in order based on credential fields
// ============================================================================
class CompositeRevocationChecker {
    crl;
    ocsp;
    bitstring;
    constructor(opts = {}) {
        this.crl = opts.crl || new CRLRevocationChecker();
        this.ocsp = opts.ocsp || null;
        this.bitstring = opts.bitstring || new BitstringStatusListChecker();
    }
    async check(params) {
        const method = params.revocation_method || 'AUTO';
        if (method === 'CRL' || (method === 'AUTO' && params.revocation_url && params.status_list_index === undefined)) {
            return this.crl.check(params);
        }
        if (method === 'OCSP' || (method === 'AUTO' && this.ocsp && params.revocation_url && params.status_list_index === undefined && params.revocation_url.includes('/ocsp'))) {
            return this.ocsp.check(params);
        }
        if (method === 'BITSTRING_STATUS_LIST' || (method === 'AUTO' && params.status_list_credential_url && params.status_list_index !== undefined)) {
            return this.bitstring.check(params);
        }
        // No method detected — fall back to NONE (verifier will check inline boolean)
        return {
            status: 'unknown',
            method: 'NONE',
            checked_at: new Date().toISOString(),
            reason: 'no revocation method declared by credential',
            fail_closed_unknown: false, // inline boolean is checked separately by pipeline
        };
    }
}
exports.CompositeRevocationChecker = CompositeRevocationChecker;
// ============================================================================
// Helpers
// ============================================================================
function unknown(reason, params) {
    return {
        status: 'unknown',
        method: 'NONE',
        checked_at: new Date().toISOString(),
        reason,
        source_url: params.revocation_url,
        fail_closed_unknown: true,
    };
}
async function defaultFetcher(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`fetch ${url} → ${res.status}`);
    return res.json();
}
// ============================================================================
// Convenience: build a CRL document (for testing / CA tools)
// ============================================================================
function issueCRL(payload, caPrivateKeyPem, caKeyId) {
    const signatureValue = (() => {
        const canonical = (0, crypto_js_1.canonicalize)(payload);
        const signingBytes = Buffer.from(crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL + ':' + canonical, 'utf-8');
        const privateKey = node_crypto_1.default.createPrivateKey(caPrivateKeyPem);
        return node_crypto_1.default.sign(null, signingBytes, privateKey).toString('hex');
    })();
    return {
        ...payload,
        signature: {
            algorithm: 'Ed25519 (RFC 8032)',
            value: signatureValue,
            domain: crypto_js_1.DOMAINS.ATC_V3_CREDENTIAL,
            key_id: caKeyId,
            signed_at: new Date().toISOString(),
        },
    };
}
/**
 * In-memory RevocationStore — for testing and small deployments.
 */
class InMemoryRevocationStore {
    statuses = new Map();
    setStatus(credential_id, status, reason) {
        this.statuses.set(credential_id, {
            status,
            revoked_at: status === 'revoked' ? new Date().toISOString() : undefined,
            reason,
        });
    }
    async getStatus(credential_id) {
        return this.statuses.get(credential_id) || { status: 'unknown' };
    }
}
exports.InMemoryRevocationStore = InMemoryRevocationStore;
/**
 * Build a signed OCSP response for a credential.
 * Used by the OCSPResponder (server-side) AND by test fixtures (client-side).
 */
function issueOCSPResponse(params) {
    const now = new Date();
    const nextUpdate = new Date(now.getTime() + (params.next_update_hours ?? 24) * 60 * 60 * 1000);
    const payload = {
        credential_id: params.credential_id,
        status: params.status,
        this_update: now.toISOString(),
        next_update: nextUpdate.toISOString(),
        revoked_at: params.revoked_at,
        reason: params.reason,
        responder: params.responder_did,
        nonce: params.nonce,
    };
    // Sign with domain UTA-TRUST-DECISION (same as ActionReceipts — audit trail)
    const canonical = (0, crypto_js_1.canonicalize)(payload);
    const signingBytes = Buffer.from(crypto_js_1.DOMAINS.TRUST_DECISION + ':' + canonical, 'utf-8');
    const privateKey = node_crypto_1.default.createPrivateKey(params.responder_private_key_pem);
    const signature = node_crypto_1.default.sign(null, signingBytes, privateKey).toString('hex');
    return {
        ...payload,
        signature: {
            algorithm: 'Ed25519 (RFC 8032)',
            value: signature,
            domain: crypto_js_1.DOMAINS.TRUST_DECISION,
            key_id: params.responder_key_id,
        },
    };
}
/**
 * Verify an OCSP response signature (used by the client-side checker when
 * responderKeyPem is provided, and by other verifiers that need to check
 * a cached response).
 */
function verifyOCSPResponse(response, responderPublicKeyPem) {
    if (!response.signature)
        return false;
    const { signature, ...payload } = response;
    if (signature.domain !== crypto_js_1.DOMAINS.TRUST_DECISION)
        return false;
    const canonical = (0, crypto_js_1.canonicalize)(payload);
    const signingBytes = Buffer.from(crypto_js_1.DOMAINS.TRUST_DECISION + ':' + canonical, 'utf-8');
    const sigBytes = Buffer.from(signature.value, 'hex');
    if (sigBytes.length !== 64)
        return false;
    try {
        const publicKey = node_crypto_1.default.createPublicKey(responderPublicKeyPem);
        return node_crypto_1.default.verify(null, signingBytes, publicKey, sigBytes);
    }
    catch {
        return false;
    }
}
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
async function handleOCSPRequest(requestBody, store, responderKeys) {
    // 1. Parse
    if (!requestBody || typeof requestBody !== 'object') {
        return { status: 400, body: { error: 'request body must be a JSON object' } };
    }
    const req = requestBody;
    if (!req.credential_id || typeof req.credential_id !== 'string') {
        return { status: 400, body: { error: 'missing or invalid credential_id' } };
    }
    if (!req.nonce || typeof req.nonce !== 'string' || req.nonce.length < 64 || !/^[0-9a-f]+$/i.test(req.nonce)) {
        return { status: 400, body: { error: 'missing or malformed nonce (expected 32+ bytes hex)' } };
    }
    // 2. Lookup
    let statusInfo;
    try {
        statusInfo = await store.getStatus(req.credential_id);
    }
    catch (e) {
        return { status: 500, body: { error: `store error: ${e instanceof Error ? e.message : String(e)}` } };
    }
    // 3. Build signed response
    const response = issueOCSPResponse({
        credential_id: req.credential_id,
        status: statusInfo.status,
        issuer_did: req.issuer_did || 'unknown',
        responder_did: responderKeys.did,
        responder_private_key_pem: responderKeys.private_key_pem,
        responder_key_id: responderKeys.key_id,
        nonce: req.nonce,
        revoked_at: statusInfo.revoked_at,
        reason: statusInfo.reason,
    });
    return { status: 200, body: response };
}
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
function createOCSPServer(opts) {
    const { store, responderKeys } = opts;
    async function handler(req, res) {
        const url = req.url;
        const method = req.method;
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        if (method === 'GET' && url === '/health') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true, responder: responderKeys.did, key_id: responderKeys.key_id }));
            return;
        }
        if (method === 'GET' && url === '/responder-key') {
            res.writeHead(200, { 'content-type': 'application/x-pem-file' });
            res.end(responderKeys.public_key_pem);
            return;
        }
        if (method === 'POST' && url === '/ocsp') {
            const chunks = [];
            for await (const chunk of req)
                chunks.push(chunk);
            let requestBody;
            try {
                requestBody = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            }
            catch {
                res.writeHead(400, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid JSON body' }));
                return;
            }
            const result = await handleOCSPRequest(requestBody, store, responderKeys);
            res.writeHead(result.status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(result.body));
            return;
        }
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    }
    return {
        handler,
        listen: async (port, host = '0.0.0.0') => {
            const http = await import('node:http');
            const server = http.createServer(handler);
            return new Promise((resolve) => server.listen(port, host, resolve));
        },
    };
}
