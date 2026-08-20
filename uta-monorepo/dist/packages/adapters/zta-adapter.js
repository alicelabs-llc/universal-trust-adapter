"use strict";
/**
 * @marketnow/trust-adapter-zta
 * Anthropic Zero Trust Framework adapter — with REAL signature verification
 *
 * P5-2: Adds real Ed25519 signature verification.
 *
 * ZTA (Zero-Trust Agent) cards carry an optional `signature` block with an
 * Ed25519 signature over canonicalize(zta_without_signature). The signature
 * is computed with domain "UTA-ZTA-CARD" — preventing cross-format reuse
 * (a ZTA sig cannot be replayed as an ATC v3 sig).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZTA_DOMAIN = exports.ZTAAdapter = void 0;
exports.issueZTACard = issueZTACard;
exports.verifyZTACard = verifyZTACard;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("../core/crypto.js");
function issueZTACard(params) {
    const now = new Date();
    const expires = new Date(now.getTime() + params.expires_in_days * 24 * 60 * 60 * 1000);
    const card = {
        agent_id: params.agent_id,
        agent_name: params.agent_name,
        description: params.description,
        identity: {
            public_key: params.public_key,
            key_algorithm: 'Ed25519',
            did: params.did,
        },
        trust: {
            score: params.trust_score,
            confidence: params.confidence,
            evidence: params.evidence || [],
        },
        capabilities: {
            provides: params.provides || [],
            requires: params.requires || [],
        },
        policy: params.policy,
        metadata: {
            issued_at: now.toISOString(),
            expires_at: expires.toISOString(),
            revoked: false,
            version: '1.0',
        },
    };
    // Sign the card WITHOUT signature, using ZTA-specific domain
    const { signature: _drop, ...payload } = card;
    const canonical = (0, crypto_js_1.canonicalize)(payload);
    const signingBytes = Buffer.from('UTA-ZTA-CARD:' + canonical, 'utf-8');
    const privateKey = node_crypto_1.default.createPrivateKey(params.issuer_private_key_pem);
    const signatureValue = node_crypto_1.default.sign(null, signingBytes, privateKey).toString('hex');
    card.signature = {
        algorithm: 'Ed25519 (RFC 8032)',
        value: signatureValue,
        domain: 'UTA-ZTA-CARD',
        key_id: params.issuer_key_id,
        signed_by: params.issuer_name,
        signed_at: now.toISOString(),
    };
    return card;
}
function verifyZTACard(card, issuerPublicKeyPem, options = {}) {
    const issues = [];
    const now = options.now || new Date();
    // 1. Structure validation
    if (!card.agent_id)
        issues.push('missing agent_id');
    if (!card.metadata?.issued_at)
        issues.push('missing metadata.issued_at');
    // 2. Expiry check
    let expired = false;
    if (!options.skipExpiry && card.metadata?.expires_at) {
        if (new Date(card.metadata.expires_at) < now) {
            expired = true;
            issues.push(`expired: ${card.metadata.expires_at}`);
        }
    }
    // 3. Revocation check (inline — strong check uses RevocationChecker abstraction)
    if (card.metadata?.revoked) {
        issues.push('card is revoked (inline)');
    }
    // 4. Signature verification
    let signatureValid = false;
    if (!card.signature) {
        issues.push('missing signature (fail-closed: cannot verify ZTA without signature)');
    }
    else if (card.signature.algorithm !== 'Ed25519 (RFC 8032)') {
        issues.push(`unsupported algorithm: ${card.signature.algorithm}`);
    }
    else if (card.signature.domain !== 'UTA-ZTA-CARD') {
        issues.push(`wrong domain: ${card.signature.domain} (expected UTA-ZTA-CARD)`);
    }
    else {
        const sigValue = card.signature.value;
        if (!sigValue || sigValue.length !== 128 || !/^[0-9a-f]+$/i.test(sigValue)) {
            issues.push(`malformed signature: ${sigValue?.length || 0} chars (expected 128 hex)`);
        }
        else {
            const { signature, ...payload } = card;
            try {
                signatureValid = (0, crypto_js_1.verify)(payload, sigValue, issuerPublicKeyPem, 'UTA-ZTA-CARD');
                if (!signatureValid)
                    issues.push('Ed25519 signature verification failed');
            }
            catch (e) {
                issues.push(`verification error: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
    return {
        valid: issues.length === 0 && signatureValid,
        issues,
        signature_valid: signatureValid,
        issuer_did: card.identity?.did,
        agent_id: card.agent_id,
        expired,
        trust_score: card.trust?.score,
    };
}
// ============================================================================
// Adapter interface implementation
// ============================================================================
class ZTAAdapter {
    formatId = 'zta';
    formatName = 'Anthropic Zero Trust Framework';
    status = 'beta'; // P5-2: promoted from experimental
    detect(payload) {
        if (typeof payload !== 'object' || payload === null)
            return false;
        const p = payload;
        return 'agent_id' in p && 'identity' in p && 'trust' in p && 'capabilities' in p;
    }
    fromNative(payload) {
        const zta = payload;
        return {
            uts_version: '1.0.0',
            subject: {
                id: zta.agent_id,
                name: zta.agent_name ?? zta.agent_id,
                type: 'agent',
                description: zta.description,
            },
            identity: {
                public_key: zta.identity?.public_key,
                key_algorithm: zta.identity?.key_algorithm ?? 'Ed25519',
                did: zta.identity?.did,
            },
            trust: {
                score: zta.trust?.score ?? 0,
                confidence: zta.trust?.confidence ?? 'medium',
                evidence: zta.trust?.evidence ?? [],
                assessor: zta.signature?.signed_by || 'Anthropic',
                assessed_at: zta.metadata?.issued_at ?? new Date().toISOString(),
                expires_at: zta.metadata?.expires_at,
            },
            capabilities: {
                provides: zta.capabilities?.provides ?? [],
                requires: zta.capabilities?.requires ?? [],
                protocols: ['mcp'],
            },
            policy: zta.policy,
            provenance: { source: 'claude' },
            lifecycle: {
                issued_at: zta.metadata?.issued_at ?? new Date().toISOString(),
                expires_at: zta.metadata?.expires_at,
                revoked: zta.metadata?.revoked ?? false,
                revocation_url: zta.metadata?.revocation_url,
                version: zta.metadata?.version ?? '1.0',
            },
            format: { type: 'zta', version: '1.0', raw: zta },
        };
    }
    toNative(uts) {
        return {
            agent_id: uts.subject.id,
            agent_name: uts.subject.name,
            description: uts.subject.description,
            identity: {
                public_key: uts.identity.public_key,
                key_algorithm: uts.identity.key_algorithm ?? 'Ed25519',
                did: uts.identity.did,
            },
            trust: {
                score: uts.trust.score,
                confidence: uts.trust.confidence,
                evidence: uts.trust.evidence,
            },
            capabilities: {
                provides: uts.capabilities?.provides ?? [],
                requires: uts.capabilities?.requires ?? [],
            },
            policy: uts.policy,
            metadata: {
                issued_at: uts.lifecycle.issued_at,
                expires_at: uts.lifecycle.expires_at,
                revoked: uts.lifecycle.revoked,
                revocation_url: uts.lifecycle.revocation_url,
                version: uts.lifecycle.version,
            },
        };
    }
    async verify(payload, options) {
        try {
            const card = payload;
            const caPublicKey = options?.ca_public_key;
            if (!card.signature) {
                return { valid: false, reason: 'no signature (fail-closed: cannot verify ZTA without signature)', uts: this.fromNative(payload) };
            }
            if (!caPublicKey) {
                return { valid: false, reason: 'no ca_public_key provided (cannot verify ZTA signature)', uts: this.fromNative(payload) };
            }
            const result = verifyZTACard(card, caPublicKey, { skipExpiry: options?.skip_ocsp });
            const uts = this.fromNative(payload);
            return {
                valid: result.valid,
                reason: result.issues.length > 0 ? result.issues.join('; ') : undefined,
                uts,
                warnings: result.expired ? ['card expired'] : undefined,
                verified_via: 'zta',
            };
        }
        catch (e) {
            return { valid: false, reason: e.message };
        }
    }
    async issue(input, keys) {
        if (!keys.ed25519_private_key) {
            throw new Error('Ed25519 key required for ZTA issuance');
        }
        const privateKey = node_crypto_1.default.createPrivateKey({
            key: Buffer.from(keys.ed25519_private_key),
            format: 'der',
            type: 'pkcs8',
        });
        const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
        return issueZTACard({
            agent_id: input.subject.id,
            agent_name: input.subject.name,
            description: input.subject.description,
            public_key: input.identity?.public_key,
            did: input.identity?.did,
            trust_score: input.trust.score,
            confidence: input.trust.confidence,
            evidence: (input.trust.evidence || []).map(e => ({
                type: e.type,
                source: e.source,
                result: e.result,
                details: e.details,
                timestamp: e.timestamp,
            })),
            provides: input.capabilities?.provides,
            requires: input.capabilities?.requires,
            policy: input.policy,
            expires_in_days: input.expires_in_days ?? 90,
            issuer_did: keys.did || 'did:marketnow:ca',
            issuer_name: 'UTA Issuer',
            issuer_private_key_pem: privateKeyPem,
            issuer_key_id: 'zta-issuer-1',
        });
    }
}
exports.ZTAAdapter = ZTAAdapter;
// Add the ZTA domain to the DOMAINS map (would normally be added in crypto.ts,
// but we declare it locally to avoid modifying the core module).
// The verifyZTACard function uses 'UTA-ZTA-CARD' directly (string literal) so
// this constant is only for callers that want to import it.
exports.ZTA_DOMAIN = 'UTA-ZTA-CARD';
