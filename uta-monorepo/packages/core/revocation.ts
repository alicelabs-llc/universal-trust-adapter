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

import crypto from 'node:crypto';
import { canonicalize, canonicalHash, verify as ed25519Verify, DOMAINS } from './crypto.js';

// ============================================================================
// Common types
// ============================================================================

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

// ============================================================================
// 1. CRL — Certificate Revocation List
// ============================================================================
// A signed list of revoked credential IDs. Cheap to fetch once, expensive to
// grow — best for issuers with small revocation sets (thousands, not millions).
// ============================================================================

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
    value: string; // 128 hex chars
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
export function verifyCRL(crl: CRLDocument, caPublicKeyPem: string): CRLPayload | null {
  const { signature, ...payload } = crl;
  if (!signature || signature.domain !== DOMAINS.ATC_V3_CREDENTIAL) return null;
  const ok = ed25519Verify(payload, signature.value, caPublicKeyPem, DOMAINS.ATC_V3_CREDENTIAL);
  if (!ok) return null;
  // Check next_update — if past, CRL is stale
  if (new Date(crl.next_update) < new Date()) return null;
  return payload;
}

export class CRLRevocationChecker implements RevocationChecker {
  private cache = new Map<string, { crl: CRLDocument; fetchedAt: number }>();
  private cacheTtlMs: number;
  private fetcher: (url: string) => Promise<CRLDocument>;

  constructor(opts: { cacheTtlMs?: number; fetcher?: (url: string) => Promise<CRLDocument> } = {}) {
    this.cacheTtlMs = opts.cacheTtlMs || 5 * 60 * 1000; // 5 min default
    this.fetcher = opts.fetcher || defaultFetcher;
  }

  async check(params: {
    credential_id: string;
    revocation_url?: string;
    ca_public_key_pem?: string;
  }): Promise<RevocationResult> {
    if (!params.revocation_url) {
      return unknown('no revocation_url provided', params);
    }
    if (!params.ca_public_key_pem) {
      return unknown('no CA public key for CRL signature verification', params);
    }

    const crl = await this.fetchCRL(params.revocation_url);
    if (!crl) return unknown('failed to fetch CRL', params);

    const payload = verifyCRL(crl, params.ca_public_key_pem);
    if (!payload) return unknown('CRL signature invalid or stale', params);

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

  private async fetchCRL(url: string): Promise<CRLDocument | null> {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.crl;
    }
    try {
      const crl = await this.fetcher(url);
      this.cache.set(url, { crl, fetchedAt: Date.now() });
      return crl;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// 2. OCSP — Online Certificate Status Protocol (RFC 6960)
// ============================================================================
// Per-credential HTTP query. More expensive than CRL on a per-credential
// basis, but lower latency for newly-issued credentials (no need to wait for
// the next CRL push). The responder can be the issuer itself or a delegated
// responder.
// ============================================================================

export interface OCSPRequest {
  credential_id: string;
  issuer_did?: string;
  nonce: string; // 32-byte hex — prevents replay of a cached response
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

export class OCSPRevocationChecker implements RevocationChecker {
  private responderUrl: string;
  private responderKeyPem?: string;
  private cache = new Map<string, { response: OCSPResponse; fetchedAt: number }>();
  private cacheTtlMs: number;

  constructor(opts: { responderUrl: string; responderKeyPem?: string; cacheTtlMs?: number }) {
    this.responderUrl = opts.responderUrl;
    this.responderKeyPem = opts.responderKeyPem;
    this.cacheTtlMs = opts.cacheTtlMs || 60 * 1000; // 1 min default
  }

  async check(params: {
    credential_id: string;
    issuer_did?: string;
  }): Promise<RevocationResult> {
    const req: OCSPRequest = {
      credential_id: params.credential_id,
      issuer_did: params.issuer_did,
      nonce: crypto.randomBytes(32).toString('hex'),
    };

    let resp: OCSPResponse | null = null;
    try {
      resp = await this.callResponder(req);
    } catch {
      return unknown('OCSP responder unreachable', params);
    }
    if (!resp) return unknown('OCSP responder returned no response', params);

    // Verify nonce (replay protection)
    if (resp.nonce !== req.nonce) {
      return unknown('OCSP nonce mismatch (possible replay)', params);
    }

    // Verify signature (if responder key provided)
    if (this.responderKeyPem && resp.signature) {
      const { signature, ...payload } = resp;
      const ok = ed25519Verify(payload, signature.value, this.responderKeyPem, DOMAINS.TRUST_DECISION);
      if (!ok) return unknown('OCSP response signature invalid', params);
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

  private async callResponder(req: OCSPRequest): Promise<OCSPResponse | null> {
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
    if (!res.ok) throw new Error(`OCSP responder returned ${res.status}`);
    const resp = (await res.json()) as OCSPResponse;
    if (resp.status === 'good') {
      this.cache.set(req.credential_id, { response: resp, fetchedAt: Date.now() });
    }
    return resp;
  }
}

// ============================================================================
// 3. Bitstring Status List (W3C Status List 2021)
// ============================================================================
// A compressed bitstring where each bit represents one credential's status.
// Scales to millions of credentials per ~100KB file (1M bits → 125KB raw,
// ~30KB gzipped). Each credential references the status list by URL + index.
// ============================================================================

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
    encodedList: string; // base64url(gzip(bitstring))
    ttl?: number; // seconds
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
  status_list_index: number; // bit position
}

/**
 * Decode a Bitstring Status List's encodedList field.
 * Format (per W3C Status List 2021): base64url(gzip(bitstring))
 *
 * The bitstring length is rounded up to the nearest multiple of 16384 bits
 * (the spec's minimum block size).
 */
export function decodeBitstringStatusList(encodedList: string): Uint8Array {
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
export function getStatusBit(list: Uint8Array, index: number): 0 | 1 {
  const byteIndex = Math.floor(index / 8);
  const bitIndex = index % 8;
  if (byteIndex >= list.length) return 0; // out-of-range = good (fail-open by spec; we keep spec behavior)
  const byte = list[byteIndex];
  return ((byte >> (7 - bitIndex)) & 1) as 0 | 1;
}

/**
 * Construct a Bitstring Status List from an array of {index, status} entries.
 * Returns the base64url(gzip(bitstring)) string.
 */
export function buildBitstringStatusList(entries: Array<{ index: number; revoked: boolean }>, opts: { minLength?: number } = {}): string {
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

export class BitstringStatusListChecker implements RevocationChecker {
  private cache = new Map<string, { list: Uint8Array; fetchedAt: number; ttlMs: number }>();
  private fetcher: (url: string) => Promise<BitstringStatusListCredential>;

  constructor(opts: { fetcher?: (url: string) => Promise<BitstringStatusListCredential> } = {}) {
    this.fetcher = opts.fetcher || defaultFetcher;
  }

  async check(params: {
    credential_id: string;
    status_list_credential_url?: string;
    status_list_index?: number;
    ca_public_key_pem?: string;
  }): Promise<RevocationResult> {
    if (!params.status_list_credential_url) {
      return unknown('no status_list_credential_url provided', params);
    }
    if (params.status_list_index === undefined || params.status_list_index === null) {
      return unknown('no status_list_index provided', params);
    }

    const list = await this.fetchList(params.status_list_credential_url, params.ca_public_key_pem);
    if (!list) return unknown('failed to fetch or verify status list', params);

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

  private async fetchList(url: string, caPublicKeyPem?: string): Promise<Uint8Array | null> {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
      return cached.list;
    }
    try {
      const credential = await this.fetcher(url);

      // Verify signature if CA key is provided
      if (caPublicKeyPem && credential.proof) {
        const { proof, ...rest } = credential;
        if (proof.type !== 'Ed25519Signature2020') return null;
        const signingInput = Buffer.from('W3C-VC-DATA-INTEGRITY:' + canonicalize(rest), 'utf-8');
        const publicKey = crypto.createPublicKey(caPublicKeyPem);
        const signature = Buffer.from(proof.proofValue, 'base64url');
        const ok = crypto.verify(null, signingInput, publicKey, signature);
        if (!ok) return null;
      }

      const list = decodeBitstringStatusList(credential.credentialSubject.encodedList);
      const ttlMs = (credential.credentialSubject.ttl || 300) * 1000;
      this.cache.set(url, { list, fetchedAt: Date.now(), ttlMs });
      return list;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// 4. Composite checker — tries each method in order based on credential fields
// ============================================================================

export class CompositeRevocationChecker implements RevocationChecker {
  private crl: CRLRevocationChecker;
  private ocsp: OCSPRevocationChecker | null;
  private bitstring: BitstringStatusListChecker;

  constructor(opts: {
    crl?: CRLRevocationChecker;
    ocsp?: OCSPRevocationChecker;
    bitstring?: BitstringStatusListChecker;
  } = {}) {
    this.crl = opts.crl || new CRLRevocationChecker();
    this.ocsp = opts.ocsp || null;
    this.bitstring = opts.bitstring || new BitstringStatusListChecker();
  }

  async check(params: {
    credential_id: string;
    issuer_did?: string;
    revocation_url?: string;
    status_list_index?: number;
    status_list_credential_url?: string;
    ca_public_key_pem?: string;
    revocation_method?: 'CRL' | 'OCSP' | 'BITSTRING_STATUS_LIST' | 'AUTO';
  }): Promise<RevocationResult> {
    const method = params.revocation_method || 'AUTO';

    if (method === 'CRL' || (method === 'AUTO' && params.revocation_url && params.status_list_index === undefined)) {
      return this.crl.check(params);
    }
    if (method === 'OCSP' || (method === 'AUTO' && this.ocsp && params.revocation_url && params.status_list_index === undefined && params.revocation_url.includes('/ocsp'))) {
      return this.ocsp!.check(params);
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

// ============================================================================
// Helpers
// ============================================================================

function unknown(reason: string, params: { credential_id: string; revocation_url?: string }): RevocationResult {
  return {
    status: 'unknown',
    method: 'NONE',
    checked_at: new Date().toISOString(),
    reason,
    source_url: params.revocation_url,
    fail_closed_unknown: true,
  };
}

async function defaultFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ============================================================================
// Convenience: build a CRL document (for testing / CA tools)
// ============================================================================

export function issueCRL(payload: CRLPayload, caPrivateKeyPem: string, caKeyId: string): CRLDocument {
  const signatureValue = (() => {
    const canonical = canonicalize(payload);
    const signingBytes = Buffer.from(DOMAINS.ATC_V3_CREDENTIAL + ':' + canonical, 'utf-8');
    const privateKey = crypto.createPrivateKey(caPrivateKeyPem);
    return crypto.sign(null, signingBytes, privateKey).toString('hex');
  })();

  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519 (RFC 8032)',
      value: signatureValue,
      domain: DOMAINS.ATC_V3_CREDENTIAL,
      key_id: caKeyId,
      signed_at: new Date().toISOString(),
    },
  };
}

// ============================================================================
// 4. OCSP Responder — server-side implementation (P5-1)
// ============================================================================
// The OCSPRevocationChecker (above) is the CLIENT side — it queries a
// responder URL. This module is the SERVER side: it answers those queries.
//
// Real-world deployment: stand up an HTTP server (Express, Fastify, plain
// http.Server) at the responder URL, route POST /ocsp to handleOCSPRequest().
// The responder signs each response with its private key so that clients
// can verify non-repudiation.
//
// The responder is pluggable: the caller provides a RevocationStore that
// knows the status of each credential. This decouples the responder from
// any particular storage backend (in-memory, Supabase, Redis, etc.).
// ============================================================================

/**
 * Backend storage for OCSP responses.
 * Implementations: in-memory (testing), Supabase (production), Redis (cache).
 */
export interface RevocationStore {
  getStatus(credential_id: string): Promise<{ status: RevocationStatus; revoked_at?: string; reason?: string }>;
}

/**
 * In-memory RevocationStore — for testing and small deployments.
 */
export class InMemoryRevocationStore implements RevocationStore {
  private statuses = new Map<string, { status: RevocationStatus; revoked_at?: string; reason?: string }>();

  setStatus(credential_id: string, status: RevocationStatus, reason?: string): void {
    this.statuses.set(credential_id, {
      status,
      revoked_at: status === 'revoked' ? new Date().toISOString() : undefined,
      reason,
    });
  }

  async getStatus(credential_id: string) {
    return this.statuses.get(credential_id) || { status: 'unknown' as RevocationStatus };
  }
}

/**
 * Build a signed OCSP response for a credential.
 * Used by the OCSPResponder (server-side) AND by test fixtures (client-side).
 */
export function issueOCSPResponse(params: {
  credential_id: string;
  status: RevocationStatus;
  issuer_did: string;
  responder_did: string;
  responder_private_key_pem: string;
  responder_key_id: string;
  nonce: string;
  revoked_at?: string;
  reason?: string;
  next_update_hours?: number;  // default 24
}): OCSPResponse {
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
  const canonical = canonicalize(payload);
  const signingBytes = Buffer.from(DOMAINS.TRUST_DECISION + ':' + canonical, 'utf-8');
  const privateKey = crypto.createPrivateKey(params.responder_private_key_pem);
  const signature = crypto.sign(null, signingBytes, privateKey).toString('hex');

  return {
    ...payload,
    signature: {
      algorithm: 'Ed25519 (RFC 8032)',
      value: signature,
      domain: DOMAINS.TRUST_DECISION,
      key_id: params.responder_key_id,
    },
  };
}

/**
 * Verify an OCSP response signature (used by the client-side checker when
 * responderKeyPem is provided, and by other verifiers that need to check
 * a cached response).
 */
export function verifyOCSPResponse(response: OCSPResponse, responderPublicKeyPem: string): boolean {
  if (!response.signature) return false;
  const { signature, ...payload } = response;
  if (signature.domain !== DOMAINS.TRUST_DECISION) return false;
  const canonical = canonicalize(payload);
  const signingBytes = Buffer.from(DOMAINS.TRUST_DECISION + ':' + canonical, 'utf-8');
  const sigBytes = Buffer.from(signature.value, 'hex');
  if (sigBytes.length !== 64) return false;
  try {
    const publicKey = crypto.createPublicKey(responderPublicKeyPem);
    return crypto.verify(null, signingBytes, publicKey, sigBytes);
  } catch {
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
export async function handleOCSPRequest(
  requestBody: unknown,
  store: RevocationStore,
  responderKeys: {
    did: string;
    private_key_pem: string;
    public_key_pem: string;
    key_id: string;
  }
): Promise<{ status: number; body: OCSPResponse | { error: string } }> {
  // 1. Parse
  if (!requestBody || typeof requestBody !== 'object') {
    return { status: 400, body: { error: 'request body must be a JSON object' } };
  }
  const req = requestBody as Partial<OCSPRequest>;
  if (!req.credential_id || typeof req.credential_id !== 'string') {
    return { status: 400, body: { error: 'missing or invalid credential_id' } };
  }
  if (!req.nonce || typeof req.nonce !== 'string' || req.nonce.length < 64 || !/^[0-9a-f]+$/i.test(req.nonce)) {
    return { status: 400, body: { error: 'missing or malformed nonce (expected 32+ bytes hex)' } };
  }

  // 2. Lookup
  let statusInfo: { status: RevocationStatus; revoked_at?: string; reason?: string };
  try {
    statusInfo = await store.getStatus(req.credential_id);
  } catch (e) {
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
export function createOCSPServer(opts: {
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
} {
  const { store, responderKeys } = opts;

  async function handler(req: any, res: any): Promise<void> {
    const url = req.url as string;
    const method = req.method as string;

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
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      let requestBody: unknown;
      try {
        requestBody = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      } catch {
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
    listen: async (port: number, host: string = '0.0.0.0') => {
      const http = await import('node:http');
      const server = http.createServer(handler);
      return new Promise<void>((resolve) => server.listen(port, host, resolve));
    },
  };
}
