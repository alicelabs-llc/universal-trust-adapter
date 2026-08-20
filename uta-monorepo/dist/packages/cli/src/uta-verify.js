#!/usr/bin/env node
"use strict";
/**
 * UTA Verify CLI — command-line credential verifier.
 *
 * Usage:
 *   uta-verify <credential-file> --ca-key <ca-public-key.pem>
 *   uta-verify --jwt <token> --ca-key <ca-public-key.pem>
 *   uta-verify --atc-v3 <credential.json> --ca-key <ca-public-key.pem>
 *   uta-verify --vc <verifiable-credential.json> --ca-key <ca-public-key.pem>
 *   uta-verify --a2a <agent-card.json> --ca-key <ca-public-key.pem>
 *   uta-verify --eat <eat-token.json> --ca-key <ca-public-key.pem>
 *   uta-verify --zta <zta-card.json> --ca-key <ca-public-key.pem>
 *   uta-verify --mcp <mcp-card.json> --registry-key <registry-public-key.pem>
 *
 * Options:
 *   --ca-key <path>           Path to CA public key PEM
 *   --registry-key <path>     Path to MCP registry public key PEM
 *   --json                    Output JSON instead of human-readable text
 *   --verbose                 Show all stages (including passes)
 *   --allow-expired           Don't fail on expiry (testing only)
 *   --version                 Show version
 *
 * Exit codes:
 *   0 = credential is VALID
 *   1 = credential is INVALID (signature failed, expired, revoked, etc.)
 *   2 = error (file not found, malformed input, etc.)
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
function parseArgs(argv) {
    const args = {};
    const positional = [];
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--ca-key') {
            args.caKeyPath = argv[++i];
            continue;
        }
        if (a === '--registry-key') {
            args.registryKeyPath = argv[++i];
            continue;
        }
        if (a === '--jwt') {
            args.jwt = argv[++i];
            continue;
        }
        if (a === '--atc-v3') {
            args.format = 'atc-v3';
            continue;
        }
        if (a === '--vc') {
            args.format = 'vc';
            continue;
        }
        if (a === '--a2a') {
            args.format = 'a2a';
            continue;
        }
        if (a === '--eat') {
            args.format = 'eat';
            continue;
        }
        if (a === '--zta') {
            args.format = 'zta';
            continue;
        }
        if (a === '--mcp') {
            args.format = 'mcp';
            continue;
        }
        if (a === '--json') {
            args.json = true;
            continue;
        }
        if (a === '--verbose' || a === '-v') {
            args.verbose = true;
            continue;
        }
        if (a === '--allow-expired') {
            args.allowExpired = true;
            continue;
        }
        if (a === '--version' || a === '-V') {
            args.showVersion = true;
            continue;
        }
        if (a === '--help' || a === '-h') {
            printHelp();
            process.exit(0);
        }
        if (a.startsWith('--')) {
            console.error(`Unknown option: ${a}`);
            process.exit(2);
        }
        positional.push(a);
    }
    if (positional.length > 0)
        args.credentialFile = positional[0];
    return args;
}
function printHelp() {
    console.log(`
uta-verify — Universal Trust Adapter credential verifier

Usage:
  uta-verify <credential.json> --ca-key <ca.pem>
  uta-verify --jwt <token> --ca-key <ca.pem>
  uta-verify --atc-v3 <cred.json> --ca-key <ca.pem>
  uta-verify --vc <vc.json> --ca-key <ca.pem>
  uta-verify --a2a <card.json> --ca-key <ca.pem>
  uta-verify --eat <token.json> --ca-key <ca.pem>
  uta-verify --zta <card.json> --ca-key <ca.pem>
  uta-verify --mcp <card.json> --registry-key <registry.pem>

Options:
  --ca-key <path>           CA public key PEM
  --registry-key <path>     MCP registry public key PEM
  --json                     Output JSON
  --verbose, -v              Show all stages
  --allow-expired            Don't fail on expiry
  --version, -V              Show version
  --help, -h                 This help

Exit codes:
  0 = valid
  1 = invalid (signature/expiry/revocation)
  2 = error (file not found, malformed, etc.)
`);
}
async function main() {
    const args = parseArgs(process.argv);
    if (args.showVersion) {
        console.log('uta-verify 1.0.0');
        process.exit(0);
    }
    if (!args.credentialFile && !args.jwt) {
        console.error('Error: no credential file or JWT provided');
        printHelp();
        process.exit(2);
    }
    if (!args.caKeyPath && !args.registryKeyPath) {
        console.error('Error: --ca-key (or --registry-key) is required');
        process.exit(2);
    }
    // Load credential
    let credential;
    if (args.jwt) {
        credential = { jwt: args.jwt };
    }
    else if (args.credentialFile) {
        try {
            const content = node_fs_1.default.readFileSync(args.credentialFile, 'utf-8');
            credential = JSON.parse(content);
        }
        catch (e) {
            console.error(`Error reading ${args.credentialFile}: ${e.message}`);
            process.exit(2);
        }
    }
    // Load CA key
    let caPublicKeyPem;
    if (args.caKeyPath) {
        try {
            caPublicKeyPem = node_fs_1.default.readFileSync(args.caKeyPath, 'utf-8');
        }
        catch (e) {
            console.error(`Error reading CA key ${args.caKeyPath}: ${e.message}`);
            process.exit(2);
        }
    }
    let registryPublicKeyPem;
    if (args.registryKeyPath) {
        try {
            registryPublicKeyPem = node_fs_1.default.readFileSync(args.registryKeyPath, 'utf-8');
        }
        catch (e) {
            console.error(`Error reading registry key ${args.registryKeyPath}: ${e.message}`);
            process.exit(2);
        }
    }
    // Determine format (auto-detect if not specified)
    let format = args.format;
    if (!format) {
        format = autoDetectFormat(credential);
        if (!format) {
            console.error('Error: cannot auto-detect format. Specify with --atc-v3, --vc, --a2a, --eat, --zta, or --mcp');
            process.exit(2);
        }
    }
    // Verify
    let result;
    try {
        result = await verifyCredential(credential, format, caPublicKeyPem, registryPublicKeyPem, args.allowExpired || false);
    }
    catch (e) {
        console.error(`Verification error: ${e.message}`);
        process.exit(2);
    }
    if (args.json) {
        console.log(JSON.stringify(result, null, 2));
    }
    else {
        printHumanReadable(result, args.verbose || false);
    }
    process.exit(result.valid ? 0 : 1);
}
function autoDetectFormat(cred) {
    if (cred.jwt)
        return 'jwt';
    if (cred.atc_version?.startsWith('3.'))
        return 'atc-v3';
    if (cred['@context']?.includes?.('https://www.w3.org/2018/credentials/v1'))
        return 'vc';
    if (cred.agentCard || (cred.name && cred.url && cred.capabilities))
        return 'a2a';
    if (cred.payload && cred.signature && cred.alg)
        return 'eat';
    if (cred.agent_id && cred.identity && cred.trust && cred.signature)
        return 'zta';
    if (cred.name && cred.tools && cred.transport)
        return 'mcp';
    return undefined;
}
async function verifyCredential(cred, format, caKey, registryKey, skipExpiry = false) {
    // Use dynamic imports so the CLI works even if some optional packages aren't installed
    let crypto;
    try {
        crypto = await import('node:crypto');
    }
    catch {
        throw new Error('node:crypto is required');
    }
    // Mirror the verification logic from run-vectors.js / run-integration.js
    // For brevity we use direct crypto calls rather than importing the dist modules.
    function canonicalize(value) {
        if (value === null)
            return 'null';
        if (value === undefined)
            throw new Error('JCS: undefined');
        const t = typeof value;
        if (t === 'boolean')
            return value ? 'true' : 'false';
        if (t === 'number') {
            if (!Number.isFinite(value))
                throw new Error(`JCS: ${value}`);
            if (Number.isInteger(value))
                return value.toString();
            let s = value.toString();
            if (s.includes('e') || s.includes('E'))
                s = s.replace(/E/g, 'e').replace(/e\+/, 'e').replace(/e0*(\d)/, 'e$1');
            if (s.includes('.') && !s.includes('e'))
                s = s.replace(/\.?0+$/, '');
            if (s === '-0')
                s = '0';
            return s;
        }
        if (t === 'string') {
            let out = '"';
            for (let i = 0; i < value.length; i++) {
                const ch = value.charCodeAt(i);
                if (ch === 0x22)
                    out += '\\"';
                else if (ch === 0x5c)
                    out += '\\\\';
                else if (ch === 0x08)
                    out += '\\b';
                else if (ch === 0x09)
                    out += '\\t';
                else if (ch === 0x0a)
                    out += '\\n';
                else if (ch === 0x0c)
                    out += '\\f';
                else if (ch === 0x0d)
                    out += '\\r';
                else if (ch < 0x20)
                    out += '\\u' + ch.toString(16).padStart(4, '0');
                else
                    out += value[i];
            }
            return out + '"';
        }
        if (Array.isArray(value))
            return '[' + value.map(canonicalize).join(',') + ']';
        if (t === 'object') {
            const keys = Object.keys(value).filter(k => value[k] !== undefined).sort((a, b) => {
                const aC = [], bC = [];
                for (let i = 0; i < a.length; i++)
                    aC.push(a.codePointAt(i));
                for (let i = 0; i < b.length; i++)
                    bC.push(b.codePointAt(i));
                const len = Math.min(aC.length, bC.length);
                for (let i = 0; i < len; i++) {
                    if (aC[i] < bC[i])
                        return -1;
                    if (aC[i] > bC[i])
                        return 1;
                }
                return aC.length - bC.length;
            });
            let out = '{';
            for (let i = 0; i < keys.length; i++) {
                if (i > 0)
                    out += ',';
                out += canonicalize(keys[i]) + ':' + canonicalize(value[keys[i]]);
            }
            return out + '}';
        }
        return canonicalize(String(value));
    }
    const DOMAINS = {
        ATC_V3_CREDENTIAL: 'UTA-ATC-V3-CREDENTIAL',
        ATC_V3_POP: 'UTA-ATC-V3-POP',
        TRUST_DECISION: 'UTA-TRUST-DECISION',
    };
    function ed25519Verify(payload, signatureHex, publicKeyPem, domain) {
        try {
            const canonical = canonicalize(payload);
            const signingBytes = Buffer.from(domain + ':' + canonical, 'utf-8');
            const signature = Buffer.from(signatureHex, 'hex');
            if (signature.length !== 64)
                return false;
            const publicKey = crypto.createPublicKey(publicKeyPem);
            return crypto.verify(null, signingBytes, publicKey, signature);
        }
        catch {
            return false;
        }
    }
    const result = { format, valid: false, issues: [] };
    if (format === 'atc-v3') {
        if (!cred.atc_version?.startsWith?.('3.')) {
            result.issues.push(`wrong atc_version: ${cred.atc_version}`);
            return result;
        }
        if (!cred.signatures?.length) {
            result.issues.push('no signatures');
            return result;
        }
        const sig = cred.signatures[0];
        const { signatures, ...payload } = cred;
        const sigValid = ed25519Verify(payload, sig.value, caKey, DOMAINS.ATC_V3_CREDENTIAL);
        if (!sigValid)
            result.issues.push('Ed25519 signature verification failed');
        const canonical = canonicalize(payload);
        const expectedEvidenceHash = 'sha256:' + crypto.createHash('sha256').update(canonical + sig.value, 'utf-8').digest('hex');
        if (sig.evidence_hash !== expectedEvidenceHash)
            result.issues.push('evidence_hash mismatch');
        if (!skipExpiry && cred.lifecycle?.expires_at && new Date(cred.lifecycle.expires_at) < new Date()) {
            result.issues.push(`expired: ${cred.lifecycle.expires_at}`);
        }
        if (cred.lifecycle?.revoked)
            result.issues.push('revoked (inline)');
        result.credential_id = cred.credential_id;
        result.issuer = cred.issuer?.did;
        result.expires_at = cred.lifecycle?.expires_at;
        result.valid = result.issues.length === 0;
    }
    else if (format === 'vc') {
        if (!cred.proof || cred.proof.type !== 'Ed25519Signature2020') {
            result.issues.push('missing or wrong proof type');
            return result;
        }
        const signature = Buffer.from(cred.proof.proofValue, 'base64url');
        if (signature.length !== 64) {
            result.issues.push(`signature wrong length: ${signature.length}`);
            return result;
        }
        const { proof, ...payload } = cred;
        const canonical = canonicalize(payload);
        const signingInput = Buffer.from('W3C-VC-DATA-INTEGRITY:' + canonical, 'utf-8');
        const publicKey = crypto.createPublicKey(caKey);
        let sigValid = false;
        try {
            sigValid = crypto.verify(null, signingInput, publicKey, signature);
        }
        catch {
            sigValid = false;
        }
        if (!sigValid)
            result.issues.push('Ed25519Signature2020 verification failed');
        if (!skipExpiry && cred.expirationDate && new Date(cred.expirationDate) < new Date()) {
            result.issues.push(`expired: ${cred.expirationDate}`);
        }
        result.credential_id = cred.id;
        result.issuer = cred.issuer;
        result.expires_at = cred.expirationDate;
        result.valid = result.issues.length === 0;
    }
    else if (format === 'jwt') {
        const jwt = cred.jwt;
        const parts = jwt.split('.');
        if (parts.length !== 3) {
            result.issues.push('invalid JWT format (expected 3 parts)');
            return result;
        }
        const [h, p, s] = parts;
        const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf-8'));
        if (header.alg === 'none') {
            result.issues.push('alg=none forbidden');
            return result;
        }
        if (header.alg === 'HS256') {
            result.issues.push('HS256 not supported');
            return result;
        }
        const claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf-8'));
        if (!skipExpiry && claims.exp && Date.now() / 1000 > claims.exp) {
            result.issues.push(`expired: ${new Date(claims.exp * 1000).toISOString()}`);
        }
        const signingInput = Buffer.from(`${h}.${p}`, 'utf-8');
        const signature = Buffer.from(s, 'base64url');
        let sigValid = false;
        try {
            const publicKey = crypto.createPublicKey(caKey);
            if (header.alg === 'RS256')
                sigValid = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
            else if (header.alg === 'EdDSA')
                sigValid = crypto.verify(null, signingInput, publicKey, signature);
            else if (header.alg === 'ES256')
                sigValid = crypto.verify('SHA256', signingInput, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
            else {
                result.issues.push(`unsupported alg: ${header.alg}`);
                return result;
            }
        }
        catch (e) {
            result.issues.push(`verify error: ${e.message}`);
        }
        if (!sigValid)
            result.issues.push(`${header.alg} signature verification failed`);
        result.issuer = claims.iss;
        result.subject = claims.sub;
        result.expires_at = claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined;
        result.valid = result.issues.length === 0;
    }
    else if (format === 'a2a') {
        const card = cred.agentCard || cred;
        if (!card.proof) {
            result.issues.push('missing proof');
            return result;
        }
        if (card.proof.type !== 'Ed25519Signature2020') {
            result.issues.push(`unsupported proof type: ${card.proof.type}`);
            return result;
        }
        const signature = Buffer.from(card.proof.proofValue, 'base64url');
        if (signature.length !== 64) {
            result.issues.push(`signature wrong length: ${signature.length}`);
            return result;
        }
        const { proof, ...payload } = card;
        const canonical = canonicalize(payload);
        const signingInput = Buffer.from('W3C-VC-DATA-INTEGRITY:' + canonical, 'utf-8');
        const publicKey = crypto.createPublicKey(caKey);
        let sigValid = false;
        try {
            sigValid = crypto.verify(null, signingInput, publicKey, signature);
        }
        catch {
            sigValid = false;
        }
        if (!sigValid)
            result.issues.push('A2A signature verification failed');
        if (!skipExpiry && card.expires_at && new Date(card.expires_at) < new Date()) {
            result.issues.push(`expired: ${card.expires_at}`);
        }
        result.credential_id = card.url;
        result.issuer = card.proof.verificationMethod?.split('#')[0];
        result.valid = result.issues.length === 0;
    }
    else if (format === 'eat') {
        if (!cred.signature) {
            result.issues.push('missing signature');
            return result;
        }
        const { signature, ...payload } = cred;
        const claims = cred.payload || cred;
        const canonical = canonicalize(claims);
        const signingInput = Buffer.from('UTA-EAT-AI:' + canonical, 'utf-8');
        const sigBytes = Buffer.from(cred.signature, 'base64url');
        const publicKey = crypto.createPublicKey(caKey);
        let sigValid = false;
        try {
            if (cred.alg === 'EdDSA')
                sigValid = crypto.verify(null, signingInput, publicKey, sigBytes);
            else if (cred.alg === 'ES256')
                sigValid = crypto.verify('SHA256', signingInput, { key: publicKey, dsaEncoding: 'ieee-p1363' }, sigBytes);
            else if (cred.alg === 'RS256')
                sigValid = crypto.verify('RSA-SHA256', signingInput, publicKey, sigBytes);
            else {
                result.issues.push(`unsupported alg: ${cred.alg}`);
                return result;
            }
        }
        catch (e) {
            result.issues.push(`verify error: ${e.message}`);
        }
        if (!sigValid)
            result.issues.push(`${cred.alg} signature verification failed`);
        if (!skipExpiry && claims.exp && new Date(claims.exp * 1000) < new Date()) {
            result.issues.push(`expired: ${new Date(claims.exp * 1000).toISOString()}`);
        }
        result.issuer = claims.iss;
        result.subject = claims.sub;
        result.valid = result.issues.length === 0;
    }
    else if (format === 'zta') {
        if (!cred.signature) {
            result.issues.push('missing signature');
            return result;
        }
        if (cred.signature.domain !== 'UTA-ZTA-CARD') {
            result.issues.push(`wrong domain: ${cred.signature.domain}`);
            return result;
        }
        const { signature, ...payload } = cred;
        const sigValid = ed25519Verify(payload, cred.signature.value, caKey, 'UTA-ZTA-CARD');
        if (!sigValid)
            result.issues.push('ZTA signature verification failed');
        if (!skipExpiry && cred.metadata?.expires_at && new Date(cred.metadata.expires_at) < new Date()) {
            result.issues.push(`expired: ${cred.metadata.expires_at}`);
        }
        result.credential_id = cred.agent_id;
        result.issuer = cred.signature.signed_by;
        result.valid = result.issues.length === 0;
    }
    else if (format === 'mcp') {
        if (!cred.signature) {
            // Unsigned MCP card — valid structurally but trust_score=0
            result.valid = true;
            result.issues.push('unsigned MCP card (trust_score=0)');
            result.trust_score = 0;
            return result;
        }
        if (cred.signature.domain !== 'UTA-MCP-CARD') {
            result.issues.push(`wrong domain: ${cred.signature.domain}`);
            return result;
        }
        const { signature, ...payload } = cred;
        const sigValid = ed25519Verify(payload, cred.signature.value, registryKey, 'UTA-MCP-CARD');
        if (!sigValid)
            result.issues.push('MCP signature verification failed');
        else
            result.trust_score = 5;
        result.credential_id = cred.name;
        result.issuer = cred.signature?.signed_by;
        result.valid = result.issues.length === 0;
    }
    else {
        result.issues.push(`unknown format: ${format}`);
    }
    return result;
}
function printHumanReadable(result, verbose) {
    const status = result.valid ? '✅ VALID' : '❌ INVALID';
    console.log(`${status}  [format=${result.format}]`);
    if (result.credential_id)
        console.log(`  credential_id: ${result.credential_id}`);
    if (result.issuer)
        console.log(`  issuer:       ${result.issuer}`);
    if (result.subject)
        console.log(`  subject:      ${result.subject}`);
    if (result.expires_at)
        console.log(`  expires_at:   ${result.expires_at}`);
    if (result.trust_score !== undefined)
        console.log(`  trust_score:  ${result.trust_score}`);
    if (result.issues && result.issues.length > 0) {
        console.log(`  issues (${result.issues.length}):`);
        for (const issue of result.issues)
            console.log(`    - ${issue}`);
    }
    else if (verbose) {
        console.log('  No issues found.');
    }
}
main().catch(e => {
    console.error(`Fatal error: ${e.message}`);
    process.exit(2);
});
