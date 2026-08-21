"use strict";
/**
 * @marketnow/trust-mcp-middleware
 * P6-2: Real MCP middleware for Anthropic Model Context Protocol.
 *
 * Wraps any MCP server's `tools/call` handler with the UTA TrustGateway.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPServerWrapper = exports.MCPTrustMiddleware = void 0;
exports.withUTATrust = withUTATrust;
exports.attachCredential = attachCredential;
const index_js_1 = require("../../gateway/index.js");
const receipts_js_1 = require("../../gateway/receipts.js");
const crypto_js_1 = require("../../core/crypto.js");
class MCPTrustMiddleware {
    gateway;
    receiptGen;
    receiptStore;
    config;
    constructor(config) {
        this.config = config;
        this.gateway = new index_js_1.TrustGateway(config);
        this.receiptStore = new receipts_js_1.ReceiptStore();
        const keyPair = config.gatewayKeyPair || (0, crypto_js_1.generateEd25519KeyPair)();
        this.receiptGen = new receipts_js_1.ReceiptGenerator(this.receiptStore, keyPair);
    }
    async intercept(method, request, handler) {
        if (method !== 'tools/call') {
            return handler(request);
        }
        const meta = request.params?._meta || {};
        const credential = meta.utta_credential;
        const popResponse = meta.utta_pop_response;
        const toolName = request.params?.name || 'unknown';
        const args = (request.params?.arguments || {});
        if (!credential) {
            return this.denyResponse('No credential provided in _meta.utta_credential');
        }
        const decision = await this.gateway.check(credential, toolName, args, popResponse);
        if (!decision.allowed) {
            return this.denyResponse(decision.reason || 'Trust gateway denied the request');
        }
        let receiptId;
        if (this.config.generateReceipts !== false) {
            const cred = credential;
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
        if (!result._meta)
            result._meta = {};
        result._meta.uta_decision = decision;
        if (receiptId)
            result._meta.uta_receipt_id = receiptId;
        return result;
    }
    denyResponse(reason) {
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'TRUST_GATEWAY_DENY', reason }) }],
            isError: true,
        };
    }
    getReceipt(receiptId) {
        return this.receiptStore.retrieve(receiptId);
    }
    listReceipts(filter) {
        return this.receiptStore.list(filter);
    }
}
exports.MCPTrustMiddleware = MCPTrustMiddleware;
// ============================================================================
// withUTATrust — wraps a tools/call handler
// ============================================================================
function withUTATrust(handler, config) {
    const middleware = new MCPTrustMiddleware(config);
    return async (request) => {
        return middleware.intercept('tools/call', request, handler);
    };
}
// ============================================================================
// attachCredential — client-side helper
// ============================================================================
function attachCredential(request, credential, popResponse) {
    if (!request.params)
        request.params = {};
    if (!request.params._meta)
        request.params._meta = {};
    request.params._meta.utta_credential = credential;
    if (popResponse)
        request.params._meta.utta_pop_response = popResponse;
    return request;
}
// ============================================================================
// MCPServerWrapper — convenience for full integration
// ============================================================================
class MCPServerWrapper {
    middleware;
    tools = new Map();
    constructor(options) {
        this.middleware = new MCPTrustMiddleware(options);
    }
    registerTool(name, handler) {
        this.tools.set(name, handler);
    }
    async handleCall(request) {
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
    getMiddleware() {
        return this.middleware;
    }
}
exports.MCPServerWrapper = MCPServerWrapper;
