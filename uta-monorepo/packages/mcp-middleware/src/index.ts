/**
 * @marketnow/trust-mcp-middleware
 * P6-2: Real MCP middleware for Anthropic Model Context Protocol.
 *
 * Wraps any MCP server's `tools/call` handler with the UTA TrustGateway.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import { TrustGateway, type GatewayConfig, type GatewayDecision } from '../../gateway/index.js';
import { ReceiptGenerator, ReceiptStore } from '../../gateway/receipts.js';
import { generateEd25519KeyPair, type Ed25519KeyPair } from '../../core/crypto.js';

// ============================================================================
// MCP request shape (minimal — matches @modelcontextprotocol/sdk)
// ============================================================================

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
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
  _meta?: {
    uta_decision?: GatewayDecision;
    uta_receipt_id?: string;
  };
}

// ============================================================================
// MCP Trust Middleware
// ============================================================================

export interface MCPMiddlewareConfig extends GatewayConfig {
  /** If true, generate a signed receipt for each ALLOWED call (default: true) */
  generateReceipts?: boolean;
  /** Gateway key pair for signing receipts (auto-generated if not provided) */
  gatewayKeyPair?: Ed25519KeyPair;
}

export class MCPTrustMiddleware {
  private gateway: TrustGateway;
  private receiptGen: ReceiptGenerator;
  private receiptStore: ReceiptStore;
  private config: MCPMiddlewareConfig;

  constructor(config: MCPMiddlewareConfig) {
    this.config = config;
    this.gateway = new TrustGateway(config);
    this.receiptStore = new ReceiptStore();
    const keyPair = config.gatewayKeyPair || generateEd25519KeyPair();
    this.receiptGen = new ReceiptGenerator(this.receiptStore, keyPair);
  }

  async intercept(
    method: string,
    request: MCPRequest,
    handler: (request: MCPRequest) => Promise<MCPResponse>
  ): Promise<MCPResponse> {
    if (method !== 'tools/call') {
      return handler(request);
    }

    const meta = request.params?._meta || {};
    const credential = meta.utta_credential;
    const popResponse = meta.utta_pop_response;
    const toolName = request.params?.name || 'unknown';
    const args = (request.params?.arguments || {}) as Record<string, unknown>;

    if (!credential) {
      return this.denyResponse('No credential provided in _meta.utta_credential');
    }

    const decision = await this.gateway.check(credential, toolName, args, popResponse);

    if (!decision.allowed) {
      return this.denyResponse(decision.reason || 'Trust gateway denied the request');
    }

    let receiptId: string | undefined;
    if (this.config.generateReceipts !== false) {
      const cred = credential as any;
      const receipt = this.receiptGen.generate({
        decision: 'ALLOW',
        agent_id: decision.agent_id,
        credential_id: cred.credential_id || cred.id || 'unknown',
        tool_name: toolName,
        args,
        trust_score: decision.trust_score,
        reason: decision.reason,
      });
      receiptId = receipt.receipt_id;
    }

    const result = await handler(request);

    if (!result._meta) result._meta = {};
    result._meta.uta_decision = decision;
    if (receiptId) result._meta.uta_receipt_id = receiptId;

    return result;
  }

  private denyResponse(reason: string): MCPResponse {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'TRUST_GATEWAY_DENY', reason }) }],
      isError: true,
    };
  }

  getReceipt(receiptId: string) {
    return this.receiptStore.retrieve(receiptId);
  }

  listReceipts(filter?: { agent_id?: string; decision?: string }) {
    return this.receiptStore.list(filter);
  }
}

// ============================================================================
// withUTATrust — wraps a tools/call handler
// ============================================================================

export function withUTATrust(
  handler: (request: MCPRequest) => Promise<MCPResponse>,
  config: MCPMiddlewareConfig
): (request: MCPRequest) => Promise<MCPResponse> {
  const middleware = new MCPTrustMiddleware(config);
  return async (request: MCPRequest) => {
    return middleware.intercept('tools/call', request, handler);
  };
}

// ============================================================================
// attachCredential — client-side helper
// ============================================================================

export function attachCredential(
  request: MCPRequest,
  credential: unknown,
  popResponse?: unknown
): MCPRequest {
  if (!request.params) request.params = {};
  if (!request.params._meta) request.params._meta = {};
  request.params._meta.utta_credential = credential;
  if (popResponse) request.params._meta.utta_pop_response = popResponse;
  return request;
}

// ============================================================================
// MCPServerWrapper — convenience for full integration
// ============================================================================

export class MCPServerWrapper {
  private middleware: MCPTrustMiddleware;
  private tools = new Map<string, (request: MCPRequest) => Promise<MCPResponse>>();

  constructor(options: MCPMiddlewareConfig) {
    this.middleware = new MCPTrustMiddleware(options);
  }

  registerTool(name: string, handler: (request: MCPRequest) => Promise<MCPResponse>): void {
    this.tools.set(name, handler);
  }

  async handleCall(request: MCPRequest): Promise<MCPResponse> {
    return this.middleware.intercept('tools/call', request, async (req) => {
      const toolName = req.params?.name || '';
      const handler = this.tools.get(toolName);
      if (!handler) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `unknown tool: ${toolName}` }) }],
          isError: true,
        };
      }
      return handler(req);
    });
  }

  getMiddleware(): MCPTrustMiddleware {
    return this.middleware;
  }
}
