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
import type { Ed25519KeyPair } from '../../core/crypto.js';
import type { RevocationStore } from '../../core/revocation.js';
export interface RPCServerConfig {
    caKeyPair: Ed25519KeyPair;
    gatewayKeyPair: Ed25519KeyPair;
    adminApiKey: string;
    revocationStore?: RevocationStore;
}
export declare function createRPCServer(config: RPCServerConfig): {
    listen: (port: number, host?: string) => Promise<void>;
    close: () => void;
};
export declare class TrustServiceClient {
    private baseUrl;
    constructor(baseUrl: string);
    call(method: string, body: any): Promise<any>;
    verifyCredential(credentialJson: string, opts?: {
        skipExpiry?: boolean;
    }): Promise<any>;
    issueATCv3(params: any, adminApiKey: string): Promise<any>;
    checkTrust(credentialJson: string, toolName: string, args: any, opts?: any): Promise<any>;
    checkRevocation(credentialId: string): Promise<any>;
    revokeCredential(credentialId: string, reason: string, adminApiKey: string): Promise<any>;
    getCAKey(): Promise<any>;
    health(): Promise<any>;
}
