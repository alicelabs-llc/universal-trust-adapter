/**
 * @marketnow/trust-server
 * P6-1: REST API server for UTA verification, issuance, and management.
 *
 * Endpoints:
 *   POST /api/verify          — Verify any credential format (auto-detect)
 *   POST /api/issue/atc-v3     — Issue an ATC v3 credential
 *   POST /api/issue/jwt        — Issue a JWT (EdDSA/RS256/ES256)
 *   POST /api/issue/vc         — Issue a W3C VC (Ed25519Signature2020)
 *   POST /api/issue/a2a        — Issue an A2A Agent Card
 *   POST /api/issue/eat        — Issue an EAT-AI token
 *   POST /api/issue/zta        — Issue a ZTA card
 *   POST /api/issue/mcp        — Issue an MCP card
 *   POST /api/issue/multisig   — Append additional signatures to a credential
 *   GET  /api/trust/:cred_id   — Get trust decision for a credential
 *   POST /api/gateway/check    — Run the TrustGateway enforcement check
 *   GET  /api/receipts         — List action receipts (with filters)
 *   GET  /api/receipts/:id     — Retrieve a specific receipt
 *   POST /api/revoke/:cred_id  — Revoke a credential (admin only)
 *   GET  /api/ocsp/:cred_id    — OCSP status query
 *   POST /api/ocsp             — OCSP request (per RFC 6960-style)
 *   GET  /api/ca/key           — Get CA public key PEM
 *   GET  /api/ca/key-info      — Get key_id + algorithm info
 *   GET  /api/health           — Health check
 *   GET  /api/metrics          — Prometheus-style metrics
 *
 * Authentication:
 *   - /api/issue/* and /api/revoke/* require an admin API key (X-API-Key header)
 *   - /api/verify, /api/trust, /api/ocsp, /api/receipts (GET) are public
 *   - /api/gateway/check requires the agent's credential + optional PoP
 *
 * Configuration (env vars):
 *   PORT=3000
 *   CA_PRIVATE_KEY_PEM=path/to/ca.pem
 *   CA_PUBLIC_KEY_PEM=path/to/ca.pub.pem
 *   ADMIN_API_KEY=secret-string
 *   GATEWAY_PRIVATE_KEY_PEM=path/to/gateway.pem
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { URL } from 'node:url';
import {
  canonicalize, canonicalHash, sign as ed25519Sign, verify as ed25519Verify,
  generateEd25519KeyPair, computeArtifactBinding, DOMAINS,
  type Ed25519KeyPair,
} from '../../core/crypto.js';
import { verifyCredential, type VerificationContext, type VerificationResult } from '../../core/verification-pipeline.js';
import {
  CRLRevocationChecker, OCSPRevocationChecker, BitstringStatusListChecker,
  CompositeRevocationChecker, InMemoryRevocationStore, RevocationStore,
  issueCRL, issueOCSPResponse, verifyOCSPResponse, handleOCSPRequest,
} from '../../core/revocation.js';
import { generateSBOM, verifySigstoreBundle } from '../../core/supply-chain.js';
import { TrustRegistry } from '../../core/trust-registry.js';
import { MemoryNonceStore, PoPManager, type NonceStore } from '../../core/nonce-store.js';
import { issueATCv3, verifyATCv3, type ATCv3Credential } from '../../adapters/atc-v3.js';
import { verifyJWT, verifyW3CVC, issueW3CVC } from '../../adapters/crypto-adapters.js';
import { appendSignatures, verifyMultiSig, type MultiSigPolicy } from '../../adapters/multisig.js';
import { issueA2ACard, verifyA2ACard } from '../../adapters/a2a-adapter.js';
import { issueEAT, verifyEAT } from '../../adapters/eat-adapter.js';
import { issueZTACard, verifyZTACard } from '../../adapters/zta-adapter.js';
import { issueMCPCard, verifyMCPCard } from '../../adapters/mcp-adapter.js';
import { TrustGateway } from '../../gateway/index.js';
import { ReceiptGenerator, ReceiptStore } from '../../gateway/receipts.js';

// ============================================================================
// Server configuration
// ============================================================================

export interface ServerConfig {
  port: number;
  host: string;
  caKeyPair: Ed25519KeyPair;
  gatewayKeyPair: Ed25519KeyPair;
  adminApiKey: string;
  revocationStore: RevocationStore;
  receiptStore: ReceiptStore;
  nonceStore: NonceStore;
  trustRegistry: TrustRegistry;
  /** Optional: enable CORS for browser-based clients */
  enableCors?: boolean;
  /** Optional: rate limiting (requests per minute per IP). Default: 600. */
  rateLimitPerMinute?: number;
  /** Optional: Supabase persistence bundle (if using Supabase). Falls back to in-memory. */
  persistence?: {
    receipts: ReceiptStore;
    nonces: NonceStore;
    revocations: RevocationStore;
  };
}

export function loadServerConfigFromEnv(): ServerConfig {
  const caPrivateKeyPath = process.env.CA_PRIVATE_KEY_PEM;
  const caPublicKeyPath = process.env.CA_PUBLIC_KEY_PEM;
  const gatewayPrivateKeyPath = process.env.GATEWAY_PRIVATE_KEY_PEM;
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!caPrivateKeyPath || !fs.existsSync(caPrivateKeyPath)) {
    throw new Error('CA_PRIVATE_KEY_PEM env var must point to an existing Ed25519 private key PEM file');
  }
  if (!adminApiKey) {
    throw new Error('ADMIN_API_KEY env var must be set');
  }

  const caPrivateKeyPem = fs.readFileSync(caPrivateKeyPath, 'utf-8');
  const caPublicKeyPem = caPublicKeyPath && fs.existsSync(caPublicKeyPath)
    ? fs.readFileSync(caPublicKeyPath, 'utf-8')
    : crypto.createPrivateKey(caPrivateKeyPem).export({ type: 'spki', format: 'pem' }).toString();

  // Compute key IDs
  const caDer = crypto.createPublicKey(caPublicKeyPem).export({ type: 'spki', format: 'der' }) as Buffer;
  const caKeyId = crypto.createHash('sha256').update(caDer).digest('hex').slice(0, 16);
  const caKeyPair: Ed25519KeyPair = {
    privateKeyPem: caPrivateKeyPem,
    publicKeyPem: caPublicKeyPem,
    publicKeyRaw: caDer.subarray(caDer.length - 32).toString('base64url'),
    keyId: caKeyId,
  };

  // Gateway key pair (for receipt signing) — separate from CA
  let gatewayKeyPair: Ed25519KeyPair;
  if (gatewayPrivateKeyPath && fs.existsSync(gatewayPrivateKeyPath)) {
    const gwPriv = fs.readFileSync(gatewayPrivateKeyPath, 'utf-8');
    const gwPub = crypto.createPrivateKey(gwPriv).export({ type: 'spki', format: 'pem' }).toString();
    const gwDer = crypto.createPublicKey(gwPub).export({ type: 'spki', format: 'der' }) as Buffer;
    gatewayKeyPair = {
      privateKeyPem: gwPriv,
      publicKeyPem: gwPub,
      publicKeyRaw: gwDer.subarray(gwDer.length - 32).toString('base64url'),
      keyId: crypto.createHash('sha256').update(gwDer).digest('hex').slice(0, 16),
    };
  } else {
    // Auto-generate (in-memory only — receipts won't survive restart)
    gatewayKeyPair = generateEd25519KeyPair();
  }

  // Try Supabase persistence, fall back to in-memory
  let persistence: ServerConfig['persistence'] | undefined;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createSupabasePersistence } = require('../../persistence/src/supabase.js');
      persistence = createSupabasePersistence({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
    } catch (e) {
      console.warn('Supabase persistence unavailable, using in-memory:', (e as Error).message);
    }
  }

  const trustRegistry = new TrustRegistry();
  trustRegistry.registerKey({
    key_id: caKeyId,
    public_key_pem: caPublicKeyPem,
    algorithm: 'Ed25519',
    issuer: 'did:marketnow:ca',
    status: 'active',
  });

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    caKeyPair,
    gatewayKeyPair,
    adminApiKey,
    revocationStore: persistence?.revocations || new InMemoryRevocationStore(),
    receiptStore: persistence?.receipts || new (require('../../gateway/receipts.js').ReceiptStore)(),
    nonceStore: persistence?.nonces || new MemoryNonceStore(),
    trustRegistry,
    enableCors: process.env.ENABLE_CORS === 'true',
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT || '600', 10),
    persistence,
  };
}

// ============================================================================
// HTTP server implementation
// ============================================================================

export function createServer(config: ServerConfig): http.Server {
  // Rate limiter
  const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
  const rateLimitWindowMs = 60_000;

  function checkRateLimit(ip: string): boolean {
    const limit = config.rateLimitPerMinute ?? 600;
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > rateLimitWindowMs) {
      rateLimitMap.set(ip, { count: 1, windowStart: now });
      return true;
    }
    entry.count++;
    return entry.count <= limit;
  }

  // Receipt generator (gateway key pair)
  const receiptGen = new ReceiptGenerator(config.receiptStore, config.gatewayKeyPair);

  // PoP manager
  const popManager = new PoPManager(config.nonceStore);

  // Composite revocation checker
  const revocationChecker = new CompositeRevocationChecker({
    crl: new CRLRevocationChecker(),
    bitstring: new BitstringStatusListChecker(),
  });

  // Metrics
  const metrics = {
    requests: 0,
    verifications: 0,
    verifications_allowed: 0,
    verifications_denied: 0,
    issues: 0,
    receipts_generated: 0,
    revocations_set: 0,
    ocsp_queries: 0,
    start_time: Date.now(),
  };

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    metrics.requests++;
    const startTime = Date.now();

    // CORS
    if (config.enableCors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Rate limit
    const clientIp = req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '60' });
      res.end(JSON.stringify({ error: 'rate limit exceeded', retry_after_seconds: 60 }));
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    try {
      // ── Public endpoints ──
      if (method === 'GET' && pathname === '/api/health') {
        return json(res, 200, {
          ok: true,
          version: '1.0.0',
          uptime_seconds: Math.floor((Date.now() - metrics.start_time) / 1000),
          ca_key_id: config.caKeyPair.keyId,
          gateway_key_id: config.gatewayKeyPair.keyId,
        });
      }

      if (method === 'GET' && pathname === '/api/metrics') {
        return json(res, 200, formatPrometheus(metrics, config));
      }

      if (method === 'GET' && pathname === '/api/ca/key') {
        res.writeHead(200, { 'content-type': 'application/x-pem-file' });
        res.end(config.caKeyPair.publicKeyPem);
        return;
      }

      if (method === 'GET' && pathname === '/api/ca/key-info') {
        return json(res, 200, {
          key_id: config.caKeyPair.keyId,
          algorithm: 'Ed25519',
          public_key_raw_b64url: config.caKeyPair.publicKeyRaw,
        });
      }

      // ── Verify endpoint ──
      if (method === 'POST' && pathname === '/api/verify') {
        const body = await readJsonBody(req);
        const credential = body.credential || body.input || body;
        const caPublicKey = body.ca_public_key || config.caKeyPair.publicKeyPem;

        const result = await verifyAnyFormat(credential, caPublicKey, body.options || {});
        metrics.verifications++;
        if (result.valid) metrics.verifications_allowed++;
        else metrics.verifications_denied++;
        return json(res, 200, result);
      }

      // ── Trust decision endpoint ──
      if (method === 'GET' && pathname.startsWith('/api/trust/')) {
        const credId = decodeURIComponent(pathname.slice('/api/trust/'.length));
        const status = await config.revocationStore.getStatus(credId);
        return json(res, 200, { credential_id: credId, ...status });
      }

      // ── Gateway check ──
      if (method === 'POST' && pathname === '/api/gateway/check') {
        const body = await readJsonBody(req);
        const gw = new TrustGateway({
          ca_public_key: config.caKeyPair.publicKeyPem,
          min_trust_score: body.min_trust_score ?? 5,
          block_secret_reads: body.block_secret_reads ?? true,
          block_shell_exec: body.block_shell_exec ?? true,
          allowed_issuers: body.allowed_issuers,
        });
        const decision = await gw.check(body.credential, body.tool_name, body.args || {}, body.pop_response);
        if (decision.decision === 'ALLOW') {
          const receipt = receiptGen.generate({
            decision: 'ALLOW',
            agent_id: decision.agent_id,
            credential_id: body.credential?.credential_id || 'unknown',
            tool_name: body.tool_name,
            args: body.args || {},
            trust_score: decision.trust_score,
            reason: decision.reason,
          });
          metrics.receipts_generated++;
          return json(res, 200, { decision, receipt });
        }
        return json(res, 200, { decision });
      }

      // ── Receipts ──
      if (method === 'GET' && pathname === '/api/receipts') {
        const agent_id = url.searchParams.get('agent_id') || undefined;
        const decision = url.searchParams.get('decision') as 'ALLOW' | 'DENY' | undefined;
        const list = await config.receiptStore.list({ agent_id, decision });
        return json(res, 200, { receipts: list, count: list.length });
      }

      if (method === 'GET' && pathname.startsWith('/api/receipts/')) {
        const id = decodeURIComponent(pathname.slice('/api/receipts/'.length));
        const r = await config.receiptStore.retrieve(id);
        if (!r) return json(res, 404, { error: 'receipt not found' });
        return json(res, 200, r);
      }

      // ── OCSP ──
      if (method === 'POST' && pathname === '/api/ocsp') {
        metrics.ocsp_queries++;
        const body = await readJsonBody(req);
        const result = await handleOCSPRequest(body, config.revocationStore, {
          did: 'did:marketnow:ocsp-responder',
          private_key_pem: config.gatewayKeyPair.privateKeyPem,
          public_key_pem: config.gatewayKeyPair.publicKeyPem,
          key_id: config.gatewayKeyPair.keyId,
        });
        return json(res, result.status, result.body);
      }

      if (method === 'GET' && pathname.startsWith('/api/ocsp/')) {
        metrics.ocsp_queries++;
        const credId = decodeURIComponent(pathname.slice('/api/ocsp/'.length));
        const status = await config.revocationStore.getStatus(credId);
        return json(res, 200, { credential_id: credId, ...status });
      }

      // ── Admin endpoints (require API key) ──
      if (pathname.startsWith('/api/issue/') || pathname.startsWith('/api/revoke/')) {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== config.adminApiKey) {
          return json(res, 401, { error: 'invalid or missing X-API-Key header' });
        }
      }

      // ── Issuance endpoints ──
      if (method === 'POST' && pathname === '/api/issue/atc-v3') {
        const body = await readJsonBody(req);
        const cred = issueATCv3({
          issuer: { did: body.issuer_did || 'did:marketnow:ca', name: body.issuer_name || 'UTA Server', url: body.issuer_url || '', ca_key_id: config.caKeyPair.keyId },
          subject: body.subject,
          capabilities: body.capabilities || { provides: [] },
          assessment: body.assessment,
          expires_in_days: body.expires_in_days ?? 90,
          ca_key_pair: config.caKeyPair,
          artifact_binding: body.artifact_binding,
          attestations: body.attestations,
        });
        metrics.issues++;
        return json(res, 201, { credential: cred, credential_id: cred.credential_id });
      }

      if (method === 'POST' && pathname === '/api/issue/vc') {
        const body = await readJsonBody(req);
        const cred = issueW3CVC(body.credential, config.caKeyPair.privateKeyPem);
        metrics.issues++;
        return json(res, 201, { credential: cred });
      }

      if (method === 'POST' && pathname === '/api/issue/a2a') {
        const body = await readJsonBody(req);
        const result = issueA2ACard({
          issuer_did: body.issuer_did || 'did:marketnow:ca',
          issuer_name: body.issuer_name || 'UTA Server',
          issuer_url: body.issuer_url || '',
          agent_id: body.agent_id,
          agent_name: body.agent_name,
          agent_url: body.agent_url,
          capabilities: body.capabilities || [],
          public_key: body.public_key,
          expires_in_days: body.expires_in_days ?? 90,
          ca_private_key_pem: config.caKeyPair.privateKeyPem,
          ca_key_id: config.caKeyPair.keyId,
        });
        metrics.issues++;
        return json(res, 201, result);
      }

      if (method === 'POST' && pathname === '/api/issue/eat') {
        const body = await readJsonBody(req);
        const token = issueEAT({
          issuer: body.issuer || 'did:marketnow:ca',
          subject: body.subject,
          subject_name: body.subject_name,
          trust_score: body.trust_score ?? 5,
          trust_level: body.trust_level ?? 'medium',
          expires_in_days: body.expires_in_days ?? 90,
          issuer_private_key_pem: config.caKeyPair.privateKeyPem,
          issuer_key_id: config.caKeyPair.keyId,
          alg: body.alg || 'EdDSA',
        });
        metrics.issues++;
        return json(res, 201, { token });
      }

      if (method === 'POST' && pathname === '/api/issue/zta') {
        const body = await readJsonBody(req);
        const card = issueZTACard({
          agent_id: body.agent_id,
          agent_name: body.agent_name,
          trust_score: body.trust_score ?? 5,
          confidence: body.confidence ?? 'medium',
          expires_in_days: body.expires_in_days ?? 90,
          issuer_did: body.issuer_did || 'did:marketnow:ca',
          issuer_name: body.issuer_name || 'UTA Server',
          issuer_private_key_pem: config.caKeyPair.privateKeyPem,
          issuer_key_id: config.caKeyPair.keyId,
        });
        metrics.issues++;
        return json(res, 201, { card });
      }

      if (method === 'POST' && pathname === '/api/issue/mcp') {
        const body = await readJsonBody(req);
        const card = issueMCPCard({
          name: body.name,
          description: body.description,
          url: body.url,
          tools: body.tools || [],
          expires_in_days: body.expires_in_days ?? 90,
          registry_did: body.registry_did || 'did:marketnow:mcp-registry',
          registry_name: body.registry_name || 'UTA MCP Registry',
          registry_private_key_pem: config.gatewayKeyPair.privateKeyPem,
          registry_key_id: config.gatewayKeyPair.keyId,
        });
        metrics.issues++;
        return json(res, 201, { card });
      }

      if (method === 'POST' && pathname === '/api/issue/multisig') {
        const body = await readJsonBody(req);
        const cred = body.credential;
        const additionalSigners = (body.additional_signers || []).map((s: any) => ({
          keyPair: {
            privateKeyPem: s.private_key_pem,
            publicKeyPem: s.public_key_pem,
            publicKeyRaw: s.public_key_raw || '',
            keyId: s.key_id,
          },
          signed_by: s.signed_by || 'additional-signer',
        }));
        const multiCred = appendSignatures(cred, additionalSigners);
        metrics.issues++;
        return json(res, 201, { credential: multiCred });
      }

      // ── Revoke endpoint ──
      if (method === 'POST' && pathname.startsWith('/api/revoke/')) {
        const credId = decodeURIComponent(pathname.slice('/api/revoke/'.length));
        const body = await readJsonBody(req).catch(() => ({}));
        // RevocationStore interface only has getStatus; InMemoryRevocationStore and SupabaseRevocationStore add setStatus
        const store = config.revocationStore as any;
        if (typeof store.setStatus === 'function') {
          await store.setStatus(credId, 'revoked', body.reason || 'no reason given');
        } else {
          return json(res, 500, { error: 'revocation store does not support setStatus (read-only backend)' });
        }
        metrics.revocations_set++;
        return json(res, 200, { credential_id: credId, status: 'revoked', reason: body.reason });
      }

      // ── 404 ──
      return json(res, 404, { error: 'not found', path: pathname });

    } catch (e) {
      const elapsed = Date.now() - startTime;
      return json(res, 500, {
        error: e instanceof Error ? e.message : String(e),
        elapsed_ms: elapsed,
      });
    }
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(e => {
      try {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      } catch {}
    });
  });

  return server;
}

// ============================================================================
// Helpers
// ============================================================================

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

async function verifyAnyFormat(cred: any, caPublicKey: string, options: any = {}): Promise<any> {
  // Auto-detect format
  if (cred.jwt) {
    const r = verifyJWT(cred.jwt, caPublicKey);
    return { format: 'jwt', valid: r.valid, issues: r.issues, issuer: r.issuer, subject: r.subject };
  }
  if (cred.atc_version?.startsWith?.('3.')) {
    // Check for multi-sig
    if (cred.signatures?.length > 1) {
      const keys = new Map<string, string>();
      // Use the CA key for all signatures by default (real deployments would have a registry)
      keys.set(config_placeholder_keyId(caPublicKey), caPublicKey);
      const result = verifyMultiSig(cred, keys, { min_signatures: 1, fail_closed_unknown_keys: false });
      return {
        format: 'atc-v3-multisig',
        valid: result.valid,
        issues: result.issues,
        signature_count: result.signature_count,
        verified_count: result.verified_count,
        credential_id: cred.credential_id,
      };
    }
    const r = verifyATCv3(cred, caPublicKey);
    return { format: 'atc-v3', valid: r.valid, issues: r.issues, credential_id: r.credential_id };
  }
  if (cred['@context']?.includes?.('https://www.w3.org/2018/credentials/v1')) {
    const r = verifyW3CVC(cred, caPublicKey);
    return { format: 'vc', valid: r.valid, issues: r.issues, issuer: r.issuer, subject: r.subject };
  }
  if (cred.agentCard || (cred.name && cred.url && cred.capabilities)) {
    const card = cred.agentCard || cred;
    if (card.proof) {
      const r = verifyA2ACard(card, caPublicKey);
      return { format: 'a2a', valid: r.valid, issues: r.issues, agent_id: r.agent_id };
    }
    return { format: 'a2a', valid: false, issues: ['no proof (cannot verify)'] };
  }
  if (cred.payload && cred.signature && cred.alg) {
    const r = verifyEAT(cred, caPublicKey, { skipExpiry: options.skip_expiry });
    return { format: 'eat', valid: r.valid, issues: r.issues, issuer: r.issuer, subject: r.subject };
  }
  if (cred.agent_id && cred.identity && cred.trust && cred.signature) {
    const r = verifyZTACard(cred, caPublicKey, { skipExpiry: options.skip_expiry });
    return { format: 'zta', valid: r.valid, issues: r.issues, agent_id: r.agent_id };
  }
  if (cred.name && cred.tools && (cred.transport || cred.url)) {
    const r = verifyMCPCard(cred, caPublicKey);
    return { format: 'mcp', valid: r.valid, issues: r.issues, tools_count: r.tools_count };
  }
  return { format: 'unknown', valid: false, issues: ['cannot auto-detect credential format'] };
}

// Workaround: derive keyId from public key for the multi-sig path
function config_placeholder_keyId(publicKeyPem: string): string {
  const der = crypto.createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' }) as Buffer;
  return crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
}

function formatPrometheus(metrics: any, config: ServerConfig): string {
  return [
    `# HELP uta_requests_total Total HTTP requests received`,
    `# TYPE uta_requests_total counter`,
    `uta_requests_total ${metrics.requests}`,
    ``,
    `# HELP uta_verifications_total Total credentials verified`,
    `# TYPE uta_verifications_total counter`,
    `uta_verifications_total ${metrics.verifications}`,
    `uta_verifications_allowed_total ${metrics.verifications_allowed}`,
    `uta_verifications_denied_total ${metrics.verifications_denied}`,
    ``,
    `# HELP uta_issues_total Total credentials issued`,
    `# TYPE uta_issues_total counter`,
    `uta_issues_total ${metrics.issues}`,
    ``,
    `# HELP uta_receipts_generated_total Total action receipts generated`,
    `# TYPE uta_receipts_generated_total counter`,
    `uta_receipts_generated_total ${metrics.receipts_generated}`,
    ``,
    `# HELP uta_revocations_set_total Total revocations set`,
    `# TYPE uta_revocations_set_total counter`,
    `uta_revocations_set_total ${metrics.revocations_set}`,
    ``,
    `# HELP uta_ocsp_queries_total Total OCSP queries`,
    `# TYPE uta_ocsp_queries_total counter`,
    `uta_ocsp_queries_total ${metrics.ocsp_queries}`,
    ``,
    `# HELP uta_uptime_seconds Server uptime in seconds`,
    `# TYPE uta_uptime_seconds gauge`,
    `uta_uptime_seconds ${Math.floor((Date.now() - metrics.start_time) / 1000)}`,
  ].join('\n');
}

// ============================================================================
// Convenience: start the server
// ============================================================================

export function startServer(config?: ServerConfig): http.Server {
  const cfg = config || loadServerConfigFromEnv();
  const server = createServer(cfg);
  server.listen(cfg.port, cfg.host, () => {
    console.log(`UTA Trust Server listening on http://${cfg.host}:${cfg.port}`);
    console.log(`  CA key_id:    ${cfg.caKeyPair.keyId}`);
    console.log(`  Gateway key:  ${cfg.gatewayKeyPair.keyId}`);
    console.log(`  Persistence:  ${cfg.persistence ? 'Supabase' : 'in-memory'}`);
  });
  return server;
}

// Allow running directly: `node dist/server.js`
if (require.main === module) {
  startServer();
}
