/**
 * @marketnow/trust-mcp-middleware
 * P6-2: Real MCP middleware for Anthropic Model Context Protocol.
 *
 * Wraps any MCP server's `tools/call` handler with the UTA TrustGateway.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
import { type GatewayConfig, type GatewayDecision } from '../../gateway/index.js';
import { type Ed25519KeyPair } from '../../core/crypto.js';
export interface MCPRequest {
    method: string;
    params?: {
        name?: string;
        arguments?: Record<string, unknown>;
        _meta?: {
            utta_credential?: unknown;
            utta_pop_response?: unknown;
            utta_agent_id?: string;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    id?: string | number;
}
export interface MCPResponse {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
    _meta?: {
        uta_decision?: GatewayDecision;
        uta_receipt_id?: string;
    };
}
export interface MCPMiddlewareConfig extends GatewayConfig {
    /** If true, generate a signed receipt for each ALLOWED call (default: true) */
    generateReceipts?: boolean;
    /** Gateway key pair for signing receipts (auto-generated if not provided) */
    gatewayKeyPair?: Ed25519KeyPair;
}
export declare class MCPTrustMiddleware {
    private gateway;
    private receiptGen;
    private receiptStore;
    private config;
    constructor(config: MCPMiddlewareConfig);
    intercept(method: string, request: MCPRequest, handler: (request: MCPRequest) => Promise<MCPResponse>): Promise<MCPResponse>;
    private denyResponse;
    getReceipt(receiptId: string): import("../../gateway/receipts.js").ActionReceipt | null;
    listReceipts(filter?: {
        agent_id?: string;
        decision?: string;
    }): import("../../gateway/receipts.js").ActionReceipt[];
}
export declare function withUTATrust(handler: (request: MCPRequest) => Promise<MCPResponse>, config: MCPMiddlewareConfig): (request: MCPRequest) => Promise<MCPResponse>;
export declare function attachCredential(request: MCPRequest, credential: unknown, popResponse?: unknown): MCPRequest;
export declare class MCPServerWrapper {
    private middleware;
    private tools;
    constructor(options: MCPMiddlewareConfig);
    registerTool(name: string, handler: (request: MCPRequest) => Promise<MCPResponse>): void;
    handleCall(request: MCPRequest): Promise<MCPResponse>;
    getMiddleware(): MCPTrustMiddleware;
}
