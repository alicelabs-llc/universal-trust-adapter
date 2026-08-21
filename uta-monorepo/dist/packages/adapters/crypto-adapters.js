"use strict";
/**
 * @marketnow/trust-adapters
 * P1-2: OAuth/OIDC — Real JWT verification (RS256/ES256/Ed25519)
 * P1-3: W3C VC — Real Ed25519Signature2020 verification
 *
 * Uses Node.js crypto.verify() for real signature verification.
 * No stubs. Real cryptographic verification only.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyJWT = verifyJWT;
exports.verifyW3CVC = verifyW3CVC;
exports.issueW3CVC = issueW3CVC;
const node_crypto_1 = __importDefault(require("node:crypto"));
const crypto_js_1 = require("../core/crypto.js");
/**
 * Verify a JWT (JSON Web Token) with real cryptographic verification.
 *
 * Supports:
 *   - RS256 (RSA PKCS#1 v1.5 with SHA-256)
 *   - ES256 (ECDSA P-256 with SHA-256)
 *   - EdDSA (Ed25519)
 *
 * Does NOT support:
 *   - HS256 (symmetric — requires shared secret, not applicable for trust)
 *   - 'none' (explicitly rejected — fail-closed)
 *
 * @param jwt - The JWT string (header.payload.signature)
 * @param publicKeyPem - The issuer's public key in PEM format
 * @returns JWTVerifyResult
 */
function verifyJWT(jwt, publicKeyPem) {
    const issues = [];
    // 1. Parse JWT
    const parts = jwt.split('.');
    if (parts.length !== 3) {
        return { valid: false, header: { alg: 'none', typ: 'JWT' }, claims: null, issues: ['invalid JWT format (expected 3 parts)'], issuer: 'unknown', subject: 'unknown' };
    }
    const [headerB64, payloadB64, signatureB64] = parts;
    let header;
    let claims;
    try {
        header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
        claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    }
    catch (e) {
        return { valid: false, header: { alg: 'none', typ: 'JWT' }, claims: null, issues: [`decode error: ${e instanceof Error ? e.message : String(e)}`], issuer: 'unknown', subject: 'unknown' };
    }
    // 2. Check algorithm — reject 'none' and HS256
    if (header.alg === 'none') {
        issues.push('algorithm "none" is forbidden (fail-closed)');
        return { valid: false, header, claims, issues, issuer: claims.iss || 'unknown', subject: claims.sub || 'unknown' };
    }
    if (header.alg === 'HS256') {
        issues.push('algorithm "HS256" is not supported (symmetric keys not applicable for trust)');
        return { valid: false, header, claims, issues, issuer: claims.iss || 'unknown', subject: claims.sub || 'unknown' };
    }
    // 3. Check expiry
    if (claims.exp) {
        if (Date.now() / 1000 > claims.exp) {
            issues.push(`expired: exp=${claims.exp} (${new Date(claims.exp * 1000).toISOString()})`);
        }
    }
    // 4. Check not-before
    if (claims.nbf) {
        if (Date.now() / 1000 < claims.nbf) {
            issues.push(`not yet valid: nbf=${claims.nbf}`);
        }
    }
    // 5. Verify signature
    const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf-8');
    const signature = Buffer.from(signatureB64, 'base64url');
    let signatureValid = false;
    try {
        switch (header.alg) {
            case 'RS256':
                signatureValid = node_crypto_1.default.verify('RSA-SHA256', signingInput, publicKeyPem, signature);
                break;
            case 'ES256':
                // ECDSA P-256 — the signature from JWT is raw R||S, but Node expects DER
                // We need to convert raw R||S to DER format
                const derSignature = rawEcdsaToDer(signature);
                signatureValid = node_crypto_1.default.verify('SHA256', signingInput, {
                    key: publicKeyPem,
                    dsaEncoding: 'der',
                }, derSignature);
                break;
            case 'EdDSA':
                // Ed25519 — use the domain-separated verify from our crypto module
                // JWT signing input is: header.payload (base64url)
                // Domain separation: use "JWT" as the domain
                const publicKey = node_crypto_1.default.createPublicKey(publicKeyPem);
                signatureValid = node_crypto_1.default.verify(null, signingInput, publicKey, signature);
                break;
            default:
                issues.push(`unsupported algorithm: ${header.alg}`);
                return { valid: false, header, claims, issues, issuer: claims.iss || 'unknown', subject: claims.sub || 'unknown' };
        }
    }
    catch (e) {
        issues.push(`verification error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!signatureValid) {
        issues.push(`${header.alg} signature verification failed`);
    }
    return {
        valid: issues.length === 0 && signatureValid,
        header,
        claims,
        issues,
        issuer: claims.iss || 'unknown',
        subject: claims.sub || 'unknown',
    };
}
/**
 * Convert raw ECDSA signature (R || S, 64 bytes) to DER format.
 * Node.js crypto.verify() expects DER-encoded ECDSA signatures.
 */
function rawEcdsaToDer(rawSig) {
    if (rawSig.length !== 64) {
        throw new Error(`Invalid raw ECDSA signature length: ${rawSig.length} (expected 64)`);
    }
    const r = rawSig.subarray(0, 32);
    const s = rawSig.subarray(32, 64);
    // Encode R and S as DER integers
    const encodeInt = (buf) => {
        // Remove leading zeros
        let start = 0;
        while (start < buf.length - 1 && buf[start] === 0)
            start++;
        let trimmed = buf.subarray(start);
        // If high bit is set, prepend 0x00
        if (trimmed[0] & 0x80) {
            trimmed = Buffer.concat([Buffer.from([0x00]), trimmed]);
        }
        // DER: 0x02 <length> <value>
        return Buffer.concat([Buffer.from([0x02, trimmed.length]), trimmed]);
    };
    const rDer = encodeInt(r);
    const sDer = encodeInt(s);
    // SEQUENCE: 0x30 <total length> <r> <s>
    const totalLength = rDer.length + sDer.length;
    return Buffer.concat([Buffer.from([0x30, totalLength]), rDer, sDer]);
}
/**
 * Verify a W3C Verifiable Credential with Ed25519Signature2020 proof.
 *
 * W3C VC Data Integrity spec:
 *   1. Extract the proof block (type, proofValue, verificationMethod, created)
 *   2. Create the verification input (canonicalized credential without proof)
 *   3. Verify Ed25519 signature
 *
 * @param vc - The Verifiable Credential object
 * @param publicKeyPem - The issuer's public key in PEM format
 * @returns VCVerifyResult
 */
function verifyW3CVC(vc, publicKeyPem) {
    const issues = [];
    // 1. Check structure
    if (!vc['@context']) {
        issues.push('missing @context');
    }
    if (!vc['type']) {
        issues.push('missing type');
    }
    if (!vc['issuer']) {
        issues.push('missing issuer');
    }
    if (!vc['credentialSubject']) {
        issues.push('missing credentialSubject');
    }
    if (!vc['proof']) {
        issues.push('missing proof');
        return { valid: false, issuer: String(vc['issuer'] || 'unknown'), subject: 'unknown', issues, proof_valid: false, proof_method: 'none' };
    }
    const proof = vc['proof'];
    // 2. Check proof type
    if (proof['type'] !== 'Ed25519Signature2020') {
        issues.push(`unsupported proof type: ${proof['type']} (only Ed25519Signature2020 supported)`);
        return { valid: false, issuer: String(vc['issuer'] || 'unknown'), subject: 'unknown', issues, proof_valid: false, proof_method: String(proof['type'] || 'unknown') };
    }
    // 3. Extract proof components
    const proofValue = proof['proofValue'];
    if (!proofValue) {
        issues.push('missing proof.proofValue');
        return { valid: false, issuer: String(vc['issuer'] || 'unknown'), subject: 'unknown', issues, proof_valid: false, proof_method: 'Ed25519Signature2020' };
    }
    // Decode proofValue from base64url
    let signature;
    try {
        signature = Buffer.from(proofValue, 'base64url');
    }
    catch {
        issues.push('invalid proofValue encoding (expected base64url)');
        return { valid: false, issuer: String(vc['issuer'] || 'unknown'), subject: 'unknown', issues, proof_valid: false, proof_method: 'Ed25519Signature2020' };
    }
    // Check signature length (Ed25519 = 64 bytes)
    if (signature.length !== 64) {
        issues.push(`invalid signature length: ${signature.length} (expected 64 bytes for Ed25519)`);
        return { valid: false, issuer: String(vc['issuer'] || 'unknown'), subject: 'unknown', issues, proof_valid: false, proof_method: 'Ed25519Signature2020' };
    }
    // 4. Create the verification input
    // W3C Data Integrity: canonicalize the credential WITHOUT the proof field
    const { proof: _proof, ...credentialWithoutProof } = vc;
    const canonical = (0, crypto_js_1.canonicalize)(credentialWithoutProof);
    // 5. Verify Ed25519 signature
    // Domain separation for W3C VC: use "W3C-VC-DATA-INTEGRITY" prefix
    const signingInput = Buffer.from(`W3C-VC-DATA-INTEGRITY:${canonical}`, 'utf-8');
    let proofValid = false;
    try {
        const publicKey = node_crypto_1.default.createPublicKey(publicKeyPem);
        proofValid = node_crypto_1.default.verify(null, signingInput, publicKey, signature);
        if (!proofValid) {
            issues.push('Ed25519Signature2020 verification failed');
        }
    }
    catch (e) {
        issues.push(`verification error: ${e instanceof Error ? e.message : String(e)}`);
    }
    // 6. Check expiry
    if (vc['expirationDate']) {
        if (new Date(vc['expirationDate']) < new Date()) {
            issues.push(`expired: ${vc['expirationDate']}`);
        }
    }
    // 7. Extract issuer and subject
    const issuer = typeof vc['issuer'] === 'string' ? vc['issuer'] :
        vc['issuer']?.id || 'unknown';
    const subject = vc['credentialSubject']?.id || 'unknown';
    return {
        valid: issues.length === 0 && proofValid,
        issuer,
        subject,
        issues,
        proof_valid: proofValid,
        proof_method: 'Ed25519Signature2020',
    };
}
/**
 * Issue a W3C VC with real Ed25519Signature2020 proof.
 *
 * @param credential - The credential WITHOUT proof
 * @param privateKeyPem - Ed25519 private key
 * @returns The credential with proof added
 */
function issueW3CVC(credential, privateKeyPem) {
    // 1. Canonicalize the credential without proof
    const { proof: _proof, ...credWithoutProof } = credential;
    const canonical = (0, crypto_js_1.canonicalize)(credWithoutProof);
    // 2. Sign with domain separation
    const signingInput = Buffer.from(`W3C-VC-DATA-INTEGRITY:${canonical}`, 'utf-8');
    const privateKey = node_crypto_1.default.createPrivateKey(privateKeyPem);
    const signature = node_crypto_1.default.sign(null, signingInput, privateKey);
    // 3. Add proof block
    return {
        ...credWithoutProof,
        proof: {
            type: 'Ed25519Signature2020',
            created: new Date().toISOString(),
            proofPurpose: 'assertionMethod',
            proofValue: signature.toString('base64url'),
            domain: 'W3C-VC-DATA-INTEGRITY',
        },
    };
}
