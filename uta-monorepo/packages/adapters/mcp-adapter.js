"use strict";
/**
 * @marketnow/trust-adapter-mcp
 * MCP (Model Context Protocol) Server Card adapter — with optional signature verification
 *
 * P5-3: MCP Server Cards don't natively carry signatures (they're tool manifests).
 * However, an MCP registry (like the Anthropic registry) can SIGN an MCP card
 * to attest to its reviewed status. This adapter verifies those signatures.
 *
 * The signature is over canonicalize(card_without_signature) with domain
 * "UTA-MCP-CARD" — preventing cross-format reuse.
 *
 * Cards WITHOUT a signature are still considered valid structurally, but get
 * trust_score=0 and a warning. Cards WITH a signature get trust_score
 * promoted to at least 5 (the registry vouches for the card).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP_DOMAIN = exports.MCPAdapter = void 0;
exports.issueMCPCard = issueMCPCard;
exports.verifyMCPCard = verifyMCPCard;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("../core/crypto.js");
function issueMCPCard(params) {
    const now = new Date();
    const card = {
        name: params.name,
        description: params.description,
        url: params.url,
        version: params.version || '1.0',
        transport: params.transport || 'stdio',
        tools: params.tools || [],
        created_at: now.toISOString(),
    };
    // Sign the card WITHOUT signature
    const { signature: _drop, ...payload } = card;
    const canonical = (0, crypto_js_1.canonicalize)(payload);
    const signingBytes = Buffer.from('UTA-MCP-CARD:' + canonical, 'utf-8');
    const privateKey = node_crypto_1.default.createPrivateKey(params.registry_private_key_pem);
    const signatureValue = node_crypto_1.default.sign(null, signingBytes, privateKey).toString('hex');
    card.signature = {
        algorithm: 'Ed25519 (RFC 8032)',
        value: signatureValue,
        domain: 'UTA-MCP-CARD',
        key_id: params.registry_key_id,
        signed_by: params.registry_name,
        signed_at: now.toISOString(),
    };
    return card;
}
function verifyMCPCard(card, registryPublicKeyPem) {
    const issues = [];
    // 1. Structure validation
    if (!card.name)
        issues.push('missing name');
    if (!card.tools)
        issues.push('missing tools array');
    if (!card.transport)
        issues.push('missing transport');
    // 2. Signature verification
    let signatureValid = false;
    let trustScore = 0;
    let signedBy;
    let signedAt;
    if (!card.signature) {
        // Unsigned MCP cards are still valid structurally, but trust_score=0
        // (warnings only — not a hard fail)
        return {
            valid: issues.length === 0,
            issues,
            signature_valid: false,
            trust_score: 0,
            tools_count: card.tools?.length || 0,
        };
    }
    if (card.signature.algorithm !== 'Ed25519 (RFC 8032)') {
        issues.push(`unsupported algorithm: ${card.signature.algorithm}`);
    }
    else if (card.signature.domain !== 'UTA-MCP-CARD') {
        issues.push(`wrong domain: ${card.signature.domain} (expected UTA-MCP-CARD)`);
    }
    else if (!registryPublicKeyPem) {
        issues.push('signature present but no registry public key provided');
    }
    else {
        const sigValue = card.signature.value;
        if (!sigValue || sigValue.length !== 128 || !/^[0-9a-f]+$/i.test(sigValue)) {
            issues.push(`malformed signature: ${sigValue?.length || 0} chars (expected 128 hex)`);
        }
        else {
            const { signature, ...payload } = card;
            try {
                signatureValid = (0, crypto_js_1.verify)(payload, sigValue, registryPublicKeyPem, 'UTA-MCP-CARD');
                if (signatureValid) {
                    trustScore = 5; // Registry vouches for the card
                    signedBy = card.signature.signed_by;
                    signedAt = card.signature.signed_at;
                }
                else {
                    issues.push('Ed25519 signature verification failed');
                }
            }
            catch (e) {
                issues.push(`verification error: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
    return {
        valid: issues.length === 0 && (signatureValid || !card.signature),
        issues,
        signature_valid: signatureValid,
        signed_by: signedBy,
        signed_at: signedAt,
        trust_score: trustScore,
        tools_count: card.tools?.length || 0,
    };
}
// ============================================================================
// Adapter interface implementation
// ============================================================================
class MCPAdapter {
    formatId = 'mcp-card';
    formatName = 'MCP Server Card';
    status = 'stable';
    detect(payload) {
        if (typeof payload !== 'object' || payload === null)
            return false;
        const p = payload;
        return 'name' in p && 'tools' in p && ('transport' in p || 'url' in p);
    }
    fromNative(payload) {
        const mcp = payload;
        const signed = !!mcp.signature;
        return {
            uts_version: '1.0.0',
            subject: {
                id: mcp.url ?? mcp.name,
                name: mcp.name,
                type: 'tool',
                description: mcp.description,
            },
            identity: {
                key_algorithm: 'Ed25519',
            },
            trust: {
                score: signed ? 5 : 0,
                confidence: signed ? 'medium' : 'low',
                evidence: signed ? [{
                        type: 'on-chain-verification',
                        source: mcp.signature.signed_by,
                        result: 'pass',
                        details: 'Registry signature verified',
                        timestamp: mcp.signature.signed_at,
                    }] : [],
                assessor: signed ? mcp.signature.signed_by : 'self',
                assessed_at: mcp.created_at ?? new Date().toISOString(),
            },
            capabilities: {
                provides: (mcp.tools ?? []).map((t) => t.name ?? t),
                protocols: ['mcp'],
            },
            provenance: { source: 'mcp-registry' },
            lifecycle: {
                issued_at: mcp.created_at ?? new Date().toISOString(),
                revoked: false,
                version: mcp.version ?? '1.0',
            },
            format: { type: 'mcp-card', version: '2026-07-28', raw: mcp },
        };
    }
    toNative(uts) {
        return {
            name: uts.subject.name,
            description: uts.subject.description,
            url: uts.subject.id,
            version: uts.lifecycle.version,
            transport: 'stdio',
            tools: uts.capabilities?.provides?.map((name) => ({ name })) ?? [],
            created_at: uts.lifecycle.issued_at,
        };
    }
    async verify(payload, options) {
        try {
            const card = payload;
            const registryKey = options?.registry_public_key;
            const result = verifyMCPCard(card, registryKey);
            const uts = this.fromNative(payload);
            const warnings = [];
            if (!card.signature) {
                warnings.push('MCP Server Card has no registry signature — trust score 0');
            }
            else if (!result.signature_valid) {
                warnings.push('MCP Server Card signature invalid');
            }
            return {
                valid: result.valid,
                reason: result.issues.length > 0 ? result.issues.join('; ') : undefined,
                uts,
                warnings: warnings.length > 0 ? warnings : undefined,
                verified_via: 'mcp-card',
            };
        }
        catch (e) {
            return { valid: false, reason: e.message };
        }
    }
    async issue(input, _keys) {
        const uts = {
            uts_version: '1.0.0',
            subject: input.subject,
            identity: input.identity ?? {},
            trust: { ...input.trust, assessed_at: input.trust.assessed_at ?? new Date().toISOString() },
            capabilities: input.capabilities,
            provenance: { source: 'mcp-registry' },
            lifecycle: {
                issued_at: new Date().toISOString(),
                revoked: false,
                version: '2026-07-28',
            },
            format: { type: 'mcp-card', version: '2026-07-28', raw: {} },
        };
        return this.toNative(uts);
    }
}
exports.MCPAdapter = MCPAdapter;
exports.MCP_DOMAIN = 'UTA-MCP-CARD';
