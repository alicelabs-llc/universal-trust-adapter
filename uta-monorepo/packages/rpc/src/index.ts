/**
 * @marketnow/trust-rpc
 * P9-1: RPC service for high-performance inter-service verification.
 *
 * Implements the TrustService defined in proto/uta.proto using a
 * ConnectRPC/Twirp-style HTTP transport. No protobuf compilation needed —
 * messages are JSON over HTTP/1.1. This makes it compatible with:
 *   - curl (plain HTTP POST)
 *   - Any HTTP client (fetch, axios, etc.)
 *   - gRPC-Web (with a small adapter)
 *   - Real gRPC (with a protobuf-compiled client)
 *
 * Usage:
 *   const server = createRPCServer({ caKeyPair, adminApiKey, ... });
 *   server.listen(9090);
 *
 * Endpoints (all POST, JSON body):
 *   POST /uta.trust.v1.TrustService/VerifyCredential
 *   POST /uta.trust.v1.TrustService/IssueATCv3
 *   POST /uta.trust.v1.TrustService/IssueW3CVC
 *   POST /uta.trust.v1.TrustService/CheckTrust
 *   POST /uta.trust.v1.TrustService/CheckRevocation
 *   POST /uta.trust.v1.TrustService/RevokeCredential
 *   POST /uta.trust.v1.TrustService/GetCAKey
 *   POST /uta.trust.v1.TrustService/Health
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { canonicalize } from '../../core/crypto.js';
import type { Ed25519KeyPair } from '../../core/crypto.js';
import { verifyCredential } from '../../core/verification-pipeline.js';
import { issueATCv3, verifyATCv3 } from '../../adapters/atc-v3.js';
import { issueW3CVC, verifyW3CVC, verifyJWT } from '../../adapters/crypto-adapters.js';
import { TrustGateway } from '../../gateway/index.js';
import { ReceiptGenerator, ReceiptStore } from '../../gateway/receipts.js';
import type { RevocationStore } from '../../core/revocation.js';
import { InMemoryRevocationStore } from '../../core/revocation.js';

const SERVICE_NAME = 'uta.trust.v1.TrustService';

export interface RPCServerConfig {
  caKeyPair: Ed25519KeyPair;
  gatewayKeyPair: Ed25519KeyPair;
  adminApiKey: string;
  revocationStore?: RevocationStore;
}

export function createRPCServer(config: RPCServerConfig): {
  listen: (port: number, host?: string) => Promise<void>;
  close: () => void;
} {
  const revocationStore = config.revocationStore || new InMemoryRevocationStore();
  const receiptStore = new ReceiptStore();
  const receiptGen = new ReceiptGenerator(receiptStore, config.gatewayKeyPair);
  const gateway = new TrustGateway({
    ca_public_key: config.caKeyPair.publicKeyPem,
    min_trust_score: 5,
    block_secret_reads: true,
    block_shell_exec: true,
  });

  let server: http.Server | null = null;
  const decisionSubscribers: Array<(decision: any) => void> = [];

  async function handleRPC(method: string, body: any): Promise<{ status: number; body: any }> {
    const start = Date.now();

    try {
      // ── VerifyCredential ──
      if (method === 'VerifyCredential') {
        const credStr = typeof body.credential_json === 'string'
          ? body.credential_json
          : JSON.stringify(body.credential_json || body.credential || body);
        const credential = JSON.parse(credStr);
        const caKey = body.ca_public_key_pem || config.caKeyPair.publicKeyPem;

        const result = await verifyAnyFormat(credential, caKey, { skipExpiry: body.skip_expiry });
        return { status: 200, body: { ...result, duration_us: (Date.now() - start) * 1000 } };
      }

      // ── IssueATCv3 ──
      if (method === 'IssueATCv3') {
        if (body.admin_api_key !== config.adminApiKey) {
          return { status: 401, body: { error: 'invalid admin API key' } };
        }
        const cred = issueATCv3({
          issuer: { did: 'did:marketnow:ca', name: 'UTA RPC', url: '', ca_key_id: config.caKeyPair.keyId },
          subject: {
            agent_id: body.agent_id, agent_name: body.agent_name,
            public_key: body.public_key, key_algorithm: body.key_algorithm || 'Ed25519',
            subject_type: 'agent',
          },
          capabilities: { provides: body.provides || [] },
          assessment: {
            methodology: 'RPC', methodology_version: '1.0',
            score: body.trust_score || 5,
            confidence: body.confidence || 'medium',
            risk_level: body.risk_level || 'medium',
          },
          expires_in_days: body.expires_in_days || 30,
          ca_key_pair: config.caKeyPair,
        });
        return { status: 200, body: { credential_json: JSON.stringify(cred), credential_id: cred.credential_id } };
      }

      // ── IssueW3CVC ──
      if (method === 'IssueW3CVC') {
        if (body.admin_api_key !== config.adminApiKey) {
          return { status: 401, body: { error: 'invalid admin API key' } };
        }
        const cred = JSON.parse(typeof body.credential_json === 'string' ? body.credential_json : JSON.stringify(body.credential_json));
        const signed = issueW3CVC(cred, config.caKeyPair.privateKeyPem);
        return { status: 200, body: { credential_json: JSON.stringify(signed) } };
      }

      // ── CheckTrust ──
      if (method === 'CheckTrust') {
        const credential = JSON.parse(typeof body.credential_json === 'string' ? body.credential_json : JSON.stringify(body.credential_json));
        const args = body.arguments_json ? JSON.parse(typeof body.arguments_json === 'string' ? body.arguments_json : JSON.stringify(body.arguments_json)) : {};

        const gw = new TrustGateway({
          ca_public_key: config.caKeyPair.publicKeyPem,
          min_trust_score: body.min_trust_score ?? 5,
          block_secret_reads: body.block_secret_reads ?? true,
          block_shell_exec: body.block_shell_exec ?? true,
          allowed_issuers: body.allowed_issuers,
        });

        const decision = await gw.check(credential, body.tool_name || 'unknown', args);

        let receiptJson = '';
        if (decision.allowed) {
          const receipt = receiptGen.generate({
            decision: 'ALLOW', agent_id: decision.agent_id,
            credential_id: credential.credential_id || credential.id || 'unknown',
            tool_name: body.tool_name || 'unknown', args,
            trust_score: decision.trust_score, reason: decision.reason,
          });
          receiptJson = JSON.stringify(receipt);

          // Notify subscribers
          const dec = {
            timestamp: new Date().toISOString(), decision: 'ALLOW',
            agent_id: decision.agent_id,
            credential_id: credential.credential_id || 'unknown',
            tool_name: body.tool_name, trust_score: decision.trust_score,
            reason: decision.reason,
          };
          decisionSubscribers.forEach(fn => fn(dec));
        }

        return {
          status: 200,
          body: {
            allowed: decision.allowed, decision: decision.decision,
            reason: decision.reason, trust_score: decision.trust_score,
            agent_id: decision.agent_id, args_hash: decision.args_hash,
            receipt_json: receiptJson, duration_us: (Date.now() - start) * 1000,
          },
        };
      }

      // ── CheckRevocation ──
      if (method === 'CheckRevocation') {
        const status = await revocationStore.getStatus(body.credential_id);
        return { status: 200, body: { credential_id: body.credential_id, ...status } };
      }

      // ── RevokeCredential ──
      if (method === 'RevokeCredential') {
        if (body.admin_api_key !== config.adminApiKey) {
          return { status: 401, body: { error: 'invalid admin API key' } };
        }
        const store = revocationStore as any;
        if (typeof store.setStatus === 'function') {
          await store.setStatus(body.credential_id, 'revoked', body.reason);
        }
        return { status: 200, body: { success: true, credential_id: body.credential_id, status: 'revoked' } };
      }

      // ── GetCAKey ──
      if (method === 'GetCAKey') {
        return {
          status: 200,
          body: {
            public_key_pem: config.caKeyPair.publicKeyPem,
            key_id: config.caKeyPair.keyId,
            algorithm: 'Ed25519',
          },
        };
      }

      // ── Health ──
      if (method === 'Health') {
        return {
          status: 200,
          body: {
            ok: true, version: '1.0.0',
            uptime_seconds: Math.floor(process.uptime()),
            ca_key_id: config.caKeyPair.keyId,
          },
        };
      }

      return { status: 404, body: { error: `unknown method: ${method}` } };
    } catch (e) {
      return { status: 500, body: { error: e instanceof Error ? e.message : String(e) } };
    }
  }

  async function verifyAnyFormat(cred: any, caKey: string, opts: { skipExpiry?: boolean }): Promise<any> {
    if (cred.jwt) {
      const r = verifyJWT(cred.jwt, caKey);
      return { valid: r.valid, format: 'jwt', issues: r.issues, issuer: r.issuer, subject: r.subject };
    }
    if (cred.atc_version?.startsWith?.('3.')) {
      const r = verifyATCv3(cred, caKey);
      return { valid: r.valid, format: 'atc-v3', issues: r.issues, credential_id: r.credential_id, issuer: cred.issuer?.did };
    }
    if (cred['@context']?.includes?.('https://www.w3.org/2018/credentials/v1')) {
      const r = verifyW3CVC(cred, caKey);
      return { valid: r.valid, format: 'vc', issues: r.issues, credential_id: cred.id, issuer: cred.issuer };
    }
    return { valid: false, format: 'unknown', issues: ['cannot auto-detect format'] };
  }

  const httpHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = req.url || '';
    if (!url.startsWith(`/${SERVICE_NAME}/`)) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    const method = url.slice(`/${SERVICE_NAME}/`.length);

    // Read body
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const bodyStr = Buffer.concat(chunks).toString('utf-8');
    let body: any = {};
    try { body = bodyStr ? JSON.parse(bodyStr) : {}; } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid JSON' }));
      return;
    }

    const result = await handleRPC(method, body);
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
  };

  return {
    listen: (port: number, host: string = '0.0.0.0') => {
      return new Promise<void>((resolve) => {
        server = http.createServer(httpHandler);
        server.listen(port, host, () => {
          console.log(`UTA RPC Server listening on http://${host}:${port}/${SERVICE_NAME}/`);
          resolve();
        });
      });
    },
    close: () => { server?.close(); },
  };
}

// ============================================================================
// Client helper (for calling the RPC server from other services)
// ============================================================================

export class TrustServiceClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async call(method: string, body: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${SERVICE_NAME}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // Convenience methods
  async verifyCredential(credentialJson: string, opts?: { skipExpiry?: boolean }): Promise<any> {
    return this.call('VerifyCredential', { credential_json: credentialJson, ...opts });
  }

  async issueATCv3(params: any, adminApiKey: string): Promise<any> {
    return this.call('IssueATCv3', { ...params, admin_api_key: adminApiKey });
  }

  async checkTrust(credentialJson: string, toolName: string, args: any, opts?: any): Promise<any> {
    return this.call('CheckTrust', {
      credential_json: credentialJson, tool_name: toolName,
      arguments_json: JSON.stringify(args), ...opts,
    });
  }

  async checkRevocation(credentialId: string): Promise<any> {
    return this.call('CheckRevocation', { credential_id: credentialId });
  }

  async revokeCredential(credentialId: string, reason: string, adminApiKey: string): Promise<any> {
    return this.call('RevokeCredential', { credential_id: credentialId, reason, admin_api_key: adminApiKey });
  }

  async getCAKey(): Promise<any> {
    return this.call('GetCAKey', {});
  }

  async health(): Promise<any> {
    return this.call('Health', {});
  }
}
