"use strict";
/**
 * @marketnow/trust-core
 * BLOQUE B: Real Cryptographic Implementation
 *
 * Ed25519 (RFC 8032) — real signing and verification
 * JCS (RFC 8785) — deterministic canonical JSON
 * Domain Separation — prevent cross-context signature reuse
 * Proof-of-Possession — nonce challenge anti-replay
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMAINS = void 0;
exports.canonicalize = canonicalize;
exports.canonicalHash = canonicalHash;
exports.generateEd25519KeyPair = generateEd25519KeyPair;
exports.sign = sign;
exports.verify = verify;
exports.generatePoPChallenge = generatePoPChallenge;
exports.createPoPResponse = createPoPResponse;
exports.verifyPoP = verifyPoP;
exports.computeArtifactBinding = computeArtifactBinding;
const node_crypto_1 = __importDefault(require("node:crypto"));
// ============================================================================
// 1. JCS — JSON Canonicalization Scheme (RFC 8785)
// ============================================================================
// Deterministic serialization: same JSON → same bytes, every time, every language.
// This is what makes signatures reproducible across Node.js, Python, and Rust.
// ============================================================================
/**
 * Canonicalize a value according to RFC 8785 JCS.
 * This is the EXACT implementation — not a stub.
 */
function canonicalize(value) {
    if (value === null)
        return 'null';
    // undefined is NOT valid JSON — throw instead of coercing to null
    if (value === undefined) {
        throw new Error('JCS: undefined is not valid JSON and cannot be canonicalized');
    }
    const type = typeof value;
    if (type === 'boolean')
        return value ? 'true' : 'false';
    if (type === 'number')
        return serializeNumber(value);
    if (type === 'string')
        return serializeString(value);
    if (type === 'bigint')
        return value.toString();
    if (Array.isArray(value)) {
        return '[' + value.map(canonicalize).join(',') + ']';
    }
    if (type === 'object') {
        return serializeObject(value);
    }
    return serializeString(String(value));
}
/**
 * RFC 8785 §3.2.2.3: Number serialization.
 * Integers: as-is. Floats: shortest round-trip representation.
 */
function serializeNumber(num) {
    if (!Number.isFinite(num)) {
        // NaN and Infinity are NOT valid JSON — throw instead of coercing to null
        throw new Error(`JCS: ${num} is not a valid JSON number (NaN/Infinity)`);
    }
    if (Number.isInteger(num)) {
        // Check safe integer range
        if (Math.abs(num) > Number.MAX_SAFE_INTEGER) {
            // Use string representation for large integers
            return num.toString();
        }
        return num.toString();
    }
    // Float: use shortest representation that round-trips
    let str = num.toString();
    // Normalize exponent format
    if (str.includes('e') || str.includes('E')) {
        str = str.replace(/E/g, 'e').replace(/e\+/, 'e');
        // Remove leading zeros in exponent
        str = str.replace(/e0*(\d)/, 'e$1');
    }
    // Remove trailing zeros after decimal point
    if (str.includes('.') && !str.includes('e')) {
        str = str.replace(/\.?0+$/, '');
    }
    // Handle -0
    if (str === '-0')
        str = '0';
    return str;
}
/**
 * RFC 8785 §3.2.2.2: String serialization.
 * Forward slash (/) MUST NOT be escaped (this was the bug @anp2network found).
 */
function serializeString(str) {
    let result = '"';
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        if (ch === 0x22)
            result += '\\"'; // "
        else if (ch === 0x5c)
            result += '\\\\'; // backslash
        // RFC 8785 §3.2.2.2: forward slash (0x2f) MUST NOT be escaped
        else if (ch === 0x08)
            result += '\\b'; // backspace
        else if (ch === 0x09)
            result += '\\t'; // tab
        else if (ch === 0x0a)
            result += '\\n'; // newline
        else if (ch === 0x0c)
            result += '\\f'; // form feed
        else if (ch === 0x0d)
            result += '\\r'; // carriage return
        else if (ch < 0x20)
            result += '\\u' + ch.toString(16).padStart(4, '0');
        else
            result += str[i];
    }
    return result + '"';
}
/**
 * RFC 8785 §3.2.2.4: Object serialization.
 * Keys MUST be sorted by UTF-16 code unit (not Unicode codepoint).
 */
function serializeObject(obj) {
    // Filter out undefined values (matching JS behavior)
    const keys = Object.keys(obj)
        .filter((k) => obj[k] !== undefined)
        .sort(compareUTF16);
    if (keys.length === 0)
        return '{}';
    let result = '{';
    for (let i = 0; i < keys.length; i++) {
        if (i > 0)
            result += ',';
        result += serializeString(keys[i]) + ':' + canonicalize(obj[keys[i]]);
    }
    return result + '}';
}
/**
 * UTF-16 code unit comparison (RFC 8785 §3.2.2.4).
 * This is NOT the same as Unicode codepoint comparison.
 * Surrogate pairs are compared as their UTF-16 code units.
 */
function compareUTF16(a, b) {
    const aCodes = toUTF16Codes(a);
    const bCodes = toUTF16Codes(b);
    const len = Math.min(aCodes.length, bCodes.length);
    for (let i = 0; i < len; i++) {
        if (aCodes[i] < bCodes[i])
            return -1;
        if (aCodes[i] > bCodes[i])
            return 1;
    }
    return aCodes.length - bCodes.length;
}
function toUTF16Codes(str) {
    const codes = [];
    for (let i = 0; i < str.length; i++) {
        const cp = str.codePointAt(i);
        if (cp > 0xffff) {
            // Surrogate pair
            const offset = cp - 0x10000;
            codes.push(0xd800 + (offset >> 10));
            codes.push(0xdc00 + (offset & 0x3ff));
            i++; // Skip the next code unit (it's part of the pair)
        }
        else {
            codes.push(cp);
        }
    }
    return codes;
}
/**
 * Compute the SHA-256 digest of the canonical form of a value.
 */
function canonicalHash(value) {
    const canonical = canonicalize(value);
    return node_crypto_1.default.createHash('sha256').update(canonical, 'utf-8').digest('hex');
}
/**
 * Generate a new Ed25519 key pair.
 */
function generateEd25519KeyPair() {
    const { publicKey, privateKey } = node_crypto_1.default.generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
    // Ed25519 SPKI DER: 12 bytes header + 32 bytes raw key = 44 bytes total
    // Extract the raw 32-byte key explicitly (not by string slicing)
    const publicKeyRaw = publicKeyDer.subarray(publicKeyDer.length - 32).toString('base64');
    return {
        publicKeyPem,
        privateKeyPem,
        publicKeyRaw,
        keyId: node_crypto_1.default.createHash('sha256').update(publicKeyDer).digest('hex').slice(0, 16),
    };
}
/**
 * Sign a payload using Ed25519 (RFC 8032).
 *
 * @param payload - The object to sign (will be canonicalized using JCS)
 * @param privateKeyPem - Ed25519 private key in PEM format
 * @param domain - Domain separation string (e.g., 'UTA-ATC-V3-CREDENTIAL')
 * @returns The signature as hex string (128 chars = 64 bytes)
 */
function sign(payload, privateKeyPem, domain) {
    // 1. Canonicalize using RFC 8785 JCS
    const canonical = canonicalize(payload);
    // 2. Prepend domain separation string (prevents cross-context reuse)
    //    The domain is prepended to the canonical bytes BEFORE signing.
    //    This means a signature from one domain CANNOT verify in another.
    const signingBytes = Buffer.from(domain + ':' + canonical, 'utf-8');
    // 3. Sign with Ed25519
    const privateKey = node_crypto_1.default.createPrivateKey(privateKeyPem);
    const signature = node_crypto_1.default.sign(null, signingBytes, privateKey);
    return signature.toString('hex');
}
/**
 * Verify an Ed25519 signature (RFC 8032).
 *
 * @param payload - The object that was signed
 * @param signatureHex - The signature as hex string
 * @param publicKeyPem - Ed25519 public key in PEM format
 * @param domain - Domain separation string (MUST match the one used for signing)
 * @returns true if the signature is valid
 */
function verify(payload, signatureHex, publicKeyPem, domain) {
    try {
        // 1. Reconstruct canonical bytes
        const canonical = canonicalize(payload);
        const signingBytes = Buffer.from(domain + ':' + canonical, 'utf-8');
        // 2. Decode signature from hex
        const signature = Buffer.from(signatureHex, 'hex');
        // 3. Verify signature length (Ed25519 = 64 bytes = 128 hex chars)
        if (signature.length !== 64) {
            return false;
        }
        // 4. Verify with Ed25519
        const publicKey = node_crypto_1.default.createPublicKey(publicKeyPem);
        return node_crypto_1.default.verify(null, signingBytes, publicKey, signature);
    }
    catch {
        return false; // Any error = invalid signature (fail-closed)
    }
}
// ============================================================================
// 3. Domain Separation Constants
// ============================================================================
// Each domain produces a unique signing context. A signature from one domain
// CANNOT be replayed in another, even if the payload is identical.
// ============================================================================
exports.DOMAINS = {
    /** For signing ATC v3 credential payloads */
    ATC_V3_CREDENTIAL: 'UTA-ATC-V3-CREDENTIAL',
    /** For Proof-of-Possession challenges */
    ATC_V3_POP: 'UTA-ATC-V3-POP',
    /** For bridge attestation records */
    BRIDGE_ATTESTATION: 'UTA-BRIDGE-ATTESTATION',
    /** For license tokens */
    LICENSE_TOKEN: 'UTA-LICENSE-TOKEN',
    /** For trust decision evidence records */
    TRUST_DECISION: 'UTA-TRUST-DECISION',
    /** For quarantine decision records */
    QUARANTINE_DECISION: 'UTA-QUARANTINE-DECISION',
};
/**
 * Generate a PoP challenge nonce.
 * The agent must sign this nonce to prove it holds the private key.
 */
function generatePoPChallenge(credentialId, audience) {
    const nonce = node_crypto_1.default.randomBytes(32).toString('hex');
    const now = new Date();
    const expires = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
    return {
        nonce,
        credential_id: credentialId,
        audience,
        issued_at: now.toISOString(),
        expires_at: expires.toISOString(),
    };
}
/**
 * Create a PoP response by signing the challenge.
 * The agent calls this with its private key.
 */
function createPoPResponse(challenge, privateKeyPem) {
    // The PoP message is: credential_id + ":" + nonce + ":" + audience + ":" + timestamp
    const popMessage = {
        credential_id: challenge.credential_id,
        nonce: challenge.nonce,
        audience: challenge.audience,
        timestamp: challenge.issued_at,
    };
    const signature = sign(popMessage, privateKeyPem, exports.DOMAINS.ATC_V3_POP);
    return {
        nonce: challenge.nonce,
        credential_id: challenge.credential_id,
        audience: challenge.audience,
        timestamp: challenge.issued_at,
        signature,
    };
}
/**
 * Verify a PoP response.
 * Returns true if the agent proved possession of the private key.
 */
function verifyPoP(response, publicKeyPem, expectedChallenge) {
    // 1. Check nonce matches
    if (response.nonce !== expectedChallenge.nonce) {
        return false;
    }
    // 2. Check credential_id matches
    if (response.credential_id !== expectedChallenge.credential_id) {
        return false;
    }
    // 3. Check audience matches
    if (response.audience !== expectedChallenge.audience) {
        return false;
    }
    // 4. Check challenge hasn't expired
    if (new Date() > new Date(expectedChallenge.expires_at)) {
        return false;
    }
    // 5. Reconstruct the PoP message and verify signature
    const popMessage = {
        credential_id: response.credential_id,
        nonce: response.nonce,
        audience: response.audience,
        timestamp: response.timestamp,
    };
    return verify(popMessage, response.signature, publicKeyPem, exports.DOMAINS.ATC_V3_POP);
}
/**
 * Compute the artifact binding hash.
 */
function computeArtifactBinding(gitSha, npmTarballSha256, dockerDigest) {
    const binding = canonicalize({
        git_commit_sha: gitSha,
        npm_tarball_sha256: npmTarballSha256,
        docker_digest: dockerDigest,
    });
    return `sha256:${node_crypto_1.default.createHash('sha256').update(binding, 'utf-8').digest('hex')}`;
}
// ============================================================================
// ============================================================================
// All functions are already exported above via `export function` / `export const`.
// No re-export block needed — that causes "Cannot redeclare" TypeScript errors.
// ============================================================================
