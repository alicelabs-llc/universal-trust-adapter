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
import http from 'node:http';
import { type Ed25519KeyPair } from '../../core/crypto.js';
import { RevocationStore } from '../../core/revocation.js';
import { TrustRegistry } from '../../core/trust-registry.js';
import { type NonceStore } from '../../core/nonce-store.js';
import { ReceiptStore } from '../../gateway/receipts.js';
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
export declare function loadServerConfigFromEnv(): ServerConfig;
export declare function createServer(config: ServerConfig): http.Server;
export declare function startServer(config?: ServerConfig): http.Server;
