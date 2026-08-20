#!/usr/bin/env node
/**
 * P2-1 through P2-4: Generate real test vectors for UTA conformance.
 *
 * Outputs:
 *   vectors/positive/*.json     — should verify as VALID
 *   vectors/negative/*.json     — should verify as INVALID
 *   vectors/mutation/*.json     — single-byte mutations, should fail
 *   vectors/cross-lang/*.json   — canonical bytes + SHA-256 reference hashes
 *
 * Each vector is a self-contained JSON file with:
 *   - vector_id, description, expected_result
 *   - input object (credential/JWT/VC/PoP/receipt)
 *   - verification_input (canonical JCS bytes, utf-8)
 *   - canonical_sha256 (SHA-256 hex of canonical bytes)
 *   - public_key_ref (name in vectors/keys/manifest.json)
 *   - signature_value, domain
 *   - expected_failure_reason (for negative/mutation vectors)
 *
 * Vectors are REPRODUCIBLE because they all use the fixed test keypairs
 * committed to vectors/keys/.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'uta-monorepo');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

// ============================================================================
// Replicate the JCS canonicalization (RFC 8785) from packages/core/crypto.ts
// so we don't need ts-node. This is a faithful port.
// ============================================================================

function canonicalize(value) {
  if (value === null) return 'null';
  if (value === undefined) throw new Error('JCS: undefined is not valid JSON');
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') return serializeNumber(value);
  if (t === 'string') return serializeString(value);
  if (t === 'bigint') return value.toString();
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (t === 'object') return serializeObject(value);
  return serializeString(String(value));
}

function serializeNumber(num) {
  if (!Number.isFinite(num)) throw new Error(`JCS: ${num} is not a valid JSON number`);
  if (Number.isInteger(num)) {
    if (Math.abs(num) > Number.MAX_SAFE_INTEGER) return num.toString();
    return num.toString();
  }
  let str = num.toString();
  if (str.includes('e') || str.includes('E')) {
    str = str.replace(/E/g, 'e').replace(/e\+/, 'e').replace(/e0*(\d)/, 'e$1');
  }
  if (str.includes('.') && !str.includes('e')) str = str.replace(/\.?0+$/, '');
  if (str === '-0') str = '0';
  return str;
}

function serializeString(str) {
  let out = '"';
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch === 0x22) out += '\\"';
    else if (ch === 0x5c) out += '\\\\';
    else if (ch === 0x08) out += '\\b';
    else if (ch === 0x09) out += '\\t';
    else if (ch === 0x0a) out += '\\n';
    else if (ch === 0x0c) out += '\\f';
    else if (ch === 0x0d) out += '\\r';
    else if (ch < 0x20) out += '\\u' + ch.toString(16).padStart(4, '0');
    else out += str[i];
  }
  return out + '"';
}

function serializeObject(obj) {
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort(compareUTF16);
  if (keys.length === 0) return '{}';
  let out = '{';
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) out += ',';
    out += serializeString(keys[i]) + ':' + canonicalize(obj[keys[i]]);
  }
  return out + '}';
}

function compareUTF16(a, b) {
  const aC = toUTF16Codes(a);
  const bC = toUTF16Codes(b);
  const len = Math.min(aC.length, bC.length);
  for (let i = 0; i < len; i++) {
    if (aC[i] < bC[i]) return -1;
    if (aC[i] > bC[i]) return 1;
  }
  return aC.length - bC.length;
}

function toUTF16Codes(str) {
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp > 0xffff) {
      const off = cp - 0x10000;
      out.push(0xd800 + (off >> 10));
      out.push(0xdc00 + (off & 0x3ff));
      i++;
    } else {
      out.push(cp);
    }
  }
  return out;
}

function canonicalHash(value) {
  return crypto.createHash('sha256').update(canonicalize(value), 'utf-8').digest('hex');
}

// ============================================================================
// Crypto helpers (mirror of packages/core/crypto.ts + crypto-adapters.ts)
// ============================================================================

const DOMAINS = {
  ATC_V3_CREDENTIAL: 'UTA-ATC-V3-CREDENTIAL',
  ATC_V3_POP: 'UTA-ATC-V3-POP',
  TRUST_DECISION: 'UTA-TRUST-DECISION',
  LICENSE_TOKEN: 'UTA-LICENSE-TOKEN',
};

function ed25519Sign(payload, privateKeyPem, domain) {
  const canonical = canonicalize(payload);
  const signingBytes = Buffer.from(domain + ':' + canonical, 'utf-8');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  return crypto.sign(null, signingBytes, privateKey).toString('hex');
}

function ed25519Verify(payload, signatureHex, publicKeyPem, domain) {
  try {
    const canonical = canonicalize(payload);
    const signingBytes = Buffer.from(domain + ':' + canonical, 'utf-8');
    const signature = Buffer.from(signatureHex, 'hex');
    if (signature.length !== 64) return false;
    const publicKey = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(null, signingBytes, publicKey, signature);
  } catch { return false; }
}

function computeArtifactBinding(gitSha, npmSha, dockerDigest) {
  const canonical = canonicalize({
    git_commit_sha: gitSha,
    npm_tarball_sha256: npmSha,
    docker_digest: dockerDigest,
  });
  return 'sha256:' + crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
}

// JWT — RS256 / ES256 / EdDSA
function signJWT(header, claims, privateKeyPem, alg) {
  const headerB64 = Buffer.from(JSON.stringify(header), 'utf-8').toString('base64url');
  const claimsB64 = Buffer.from(JSON.stringify(claims), 'utf-8').toString('base64url');
  const signingInput = Buffer.from(`${headerB64}.${claimsB64}`, 'utf-8');
  let sig;
  if (alg === 'RS256') sig = crypto.sign('RSA-SHA256', signingInput, privateKeyPem);
  else if (alg === 'EdDSA') sig = crypto.sign(null, signingInput, privateKeyPem);
  else if (alg === 'ES256') {
    // ES256 wire format = raw R||S (IEEE P1363), 64 bytes. Node supports it directly.
    sig = crypto.sign('SHA256', signingInput, { key: privateKeyPem, dsaEncoding: 'ieee-p1363' });
  } else throw new Error('unsupported alg: ' + alg);
  const sigB64 = sig.toString('base64url');
  return `${headerB64}.${claimsB64}.${sigB64}`;
}

// W3C VC — Ed25519Signature2020
function issueW3CVC(credential, privateKeyPem) {
  const { proof: _drop, ...cred } = credential;
  const canonical = canonicalize(cred);
  const signingInput = Buffer.from('W3C-VC-DATA-INTEGRITY:' + canonical, 'utf-8');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const signature = crypto.sign(null, signingInput, privateKey);
  return {
    ...cred,
    proof: {
      type: 'Ed25519Signature2020',
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      proofValue: signature.toString('base64url'),
      domain: 'W3C-VC-DATA-INTEGRITY',
    },
  };
}

// PoP
function generatePoPChallenge(credentialId, audience, opts = {}) {
  const ttlMs = opts.ttlMs || (365 * 24 * 60 * 60 * 1000); // 1 year for test vectors (default 5min in production)
  const nonce = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMs);
  return {
    nonce,
    credential_id: credentialId,
    audience,
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };
}

function createPoPResponse(challenge, privateKeyPem) {
  const msg = {
    credential_id: challenge.credential_id,
    nonce: challenge.nonce,
    audience: challenge.audience,
    timestamp: challenge.issued_at,
  };
  const signature = ed25519Sign(msg, privateKeyPem, DOMAINS.ATC_V3_POP);
  return {
    nonce: challenge.nonce,
    credential_id: challenge.credential_id,
    audience: challenge.audience,
    timestamp: challenge.issued_at,
    signature,
  };
}

// ATC v3 issuance (faithful port of atc-v3.ts)
function issueATCv3(params) {
  const now = new Date();
  const expires = new Date(now.getTime() + params.expires_in_days * 24 * 60 * 60 * 1000);
  const credential_id = `ATC-${now.getFullYear()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase()}`;

  const attestations = (params.attestations || []).map(att => {
    const evidence = att.evidence.map(e => {
      const evidenceHash = canonicalHash({ layer: e.layer, result: e.result, details: e.details });
      return { layer: e.layer, result: e.result, details: e.details, evidence_hash: evidenceHash };
    });
    const signatureHash = canonicalHash({ type: att.type, evidence });
    return {
      type: att.type,
      issuer: params.issuer.name,
      evidence,
      signed_at: now.toISOString(),
      signature_hash: signatureHash,
    };
  });

  let artifact_binding;
  if (params.artifact_binding) {
    const bindingHash = computeArtifactBinding(
      params.artifact_binding.git_commit_sha,
      params.artifact_binding.npm_tarball_sha256,
      params.artifact_binding.docker_digest
    );
    artifact_binding = {
      git: { repository: params.artifact_binding.git_repository, commit_sha: params.artifact_binding.git_commit_sha },
      npm: params.artifact_binding.npm_tarball_sha256 ? {
        package: 'universal-trust-adapter',
        version: '1.0.0',
        tarball_sha256: params.artifact_binding.npm_tarball_sha256,
      } : undefined,
      oci: params.artifact_binding.docker_digest ? {
        image: 'marketnow/trust-adapter',
        digest: params.artifact_binding.docker_digest,
      } : undefined,
      binding_hash: bindingHash,
    };
  }

  const credential = {
    atc_version: '3.0.0',
    credential_id,
    issuer: {
      did: params.issuer.did,
      name: params.issuer.name,
      url: params.issuer.url,
      ca_key_id: params.issuer.ca_key_id,
    },
    subject: {
      agent_did: params.subject.agent_did,
      agent_id: params.subject.agent_id,
      agent_name: params.subject.agent_name,
      public_key: params.subject.public_key,
      key_algorithm: params.subject.key_algorithm,
      subject_type: params.subject.subject_type,
    },
    artifact_binding,
    attestations,
    capabilities: {
      provides: params.capabilities.provides,
      requires: params.capabilities.requires || [],
      protocols: params.capabilities.protocols || ['mcp'],
    },
    lifecycle: {
      issued_at: now.toISOString(),
      expires_at: expires.toISOString(),
      revoked: false,
      revocation_url: `https://marketnow.site/api/atc?action=verify&card_id=${credential_id}`,
      version: '3.0.0',
    },
    assessment: {
      methodology: params.assessment.methodology,
      methodology_version: params.assessment.methodology_version,
      score: params.assessment.score,
      confidence: params.assessment.confidence,
      risk_level: params.assessment.risk_level,
      computed_at: now.toISOString(),
      computed_by: params.issuer.name,
    },
  };

  const canonical = canonicalize(credential);
  const signatureValue = ed25519Sign(credential, params.ca_key_pair.private_key_pem, DOMAINS.ATC_V3_CREDENTIAL);
  const evidenceHash = 'sha256:' + crypto.createHash('sha256').update(canonical + signatureValue, 'utf-8').digest('hex');

  const signature = {
    algorithm: 'Ed25519 (RFC 8032)',
    value: signatureValue,
    signed_by: params.issuer.name,
    signed_at: now.toISOString(),
    domain: DOMAINS.ATC_V3_CREDENTIAL,
    key_id: params.ca_key_pair.key_id,
    canonicalization: 'RFC_8785_JCS',
    evidence_hash: evidenceHash,
  };

  return { ...credential, signatures: [signature] };
}

// Action receipt (mirror of receipts.ts)
function generateReceipt(params, gatewayKey) {
  const timestamp = new Date().toISOString();
  const argsHash = 'sha256:' + canonicalHash(params.args);  // canonicalHash canonicalizes internally
  const receiptId = 'rcpt_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const receipt = {
    receipt_id: receiptId,
    decision: params.decision,
    agent_id: params.agent_id,
    credential_id: params.credential_id,
    tool_name: params.tool_name,
    args_hash: argsHash,
    trust_score: params.trust_score,
    reason: params.reason,
    verification_stages: params.verification_stages,
    timestamp,
    gateway_version: '1.0.0',
    evidence_hash: '',
  };
  const forHash = { ...receipt, evidence_hash: '' };
  // canonicalHash() already canonicalizes internally — pass the OBJECT, not a pre-canonicalized string
  receipt.evidence_hash = 'sha256:' + canonicalHash(forHash);
  const sigValue = ed25519Sign(receipt, gatewayKey.private_key_pem, DOMAINS.TRUST_DECISION);
  const signed = {
    ...receipt,
    signature: {
      algorithm: 'Ed25519 (RFC 8032)',
      value: sigValue,
      domain: DOMAINS.TRUST_DECISION,
      key_id: gatewayKey.key_id,
      signed_at: timestamp,
    },
  };
  return signed;
}

// ============================================================================
// Vector builders
// ============================================================================

function vectorBase(vectorId, description, expected, pubKeyRef) {
  return {
    vector_id: vectorId,
    description,
    expected_result: expected,
    public_key_ref: pubKeyRef,
    domain: null,
    signature_value: null,
    verification_input: null,
    canonical_sha256: null,
    generated_at: new Date().toISOString(),
    spec: 'UTA-P2-VECTORS/1.0',
  };
}

function attachCanonical(vec, payload) {
  const canonical = canonicalize(payload);
  vec.verification_input = canonical;
  vec.canonical_sha256 = crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
  return vec;
}

/**
 * Issue the canonical ATC v3 credential used as the base for many vectors.
 * Extracted as a standalone function so multiple vector builders can call it
 * without triggering infinite recursion (e.g. pos-008 needs the pos-001 base
 * but lives inside buildPositive).
 */
function makePos001Cred() {
  const caEd = KEYS.ca_ed25519;
  const agEd = KEYS.agent_ed25519;
  return issueATCv3({
    issuer: { did: 'did:marketnow:ca', name: 'MarketNow Sentinel CA', url: 'https://marketnow.site', ca_key_id: caEd.key_id },
    subject: { agent_id: 'test-agent-001', agent_name: 'Test Agent', public_key: agEd.public_key_raw_b64url, key_algorithm: 'Ed25519', subject_type: 'agent' },
    artifact_binding: { git_repository: 'https://github.com/test/mcp-server', git_commit_sha: 'abc123def4567890abcdef1234567890abcdef12', npm_tarball_sha256: 'a'.repeat(64), docker_digest: 'sha256:' + 'b'.repeat(64) },
    attestations: [{ type: 'sentinel-audit', evidence: [
      { layer: 'L1.5', result: 'pass', details: 'Metadata valid' },
      { layer: 'L1.6', result: 'pass', details: 'No secrets found' },
      { layer: 'L1.9', result: 'pass', details: 'No prompt injection' },
      { layer: 'L2.5', result: 'pass', details: 'Sandbox passed' },
    ]}],
    capabilities: { provides: ['search', 'read', 'verify'], protocols: ['mcp'] },
    assessment: { methodology: 'Sentinel', methodology_version: 'v2.5', score: 8, confidence: 'high', risk_level: 'low' },
    expires_in_days: 365,
    ca_key_pair: caEd,
  });
}

function buildPositive() {
  const out = [];
  const caEd = KEYS.ca_ed25519;
  const agEd = KEYS.agent_ed25519;
  const gwEd = KEYS.gateway_ed25519;
  const caRsa = KEYS.ca_rsa;
  const caEc = KEYS.ca_ecdsa;

  // P1: ATC v3 valid
  {
    const cred = makePos001Cred();
    const vec = vectorBase('pos-001-atc-v3-valid', 'ATC v3 credential signed with Ed25519, valid signature, not expired', 'VALID', 'ca_ed25519');
    attachCanonical(vec, (() => { const { signatures, ...rest } = cred; return rest; })());
    vec.input = cred;
    vec.signature_value = cred.signatures[0].value;
    vec.domain = cred.signatures[0].domain;
    out.push(vec);
  }

  // P2: JWT RS256
  {
    const header = { alg: 'RS256', typ: 'JWT', kid: caRsa.key_id };
    const claims = { iss: 'https://auth.marketnow.site', sub: 'agent-001', aud: 'marketnow-gateway', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, scope: 'tools:call' };
    const jwt = signJWT(header, claims, caRsa.private_key_pem, 'RS256');
    const vec = vectorBase('pos-002-jwt-rs256-valid', 'OAuth JWT signed with RS256 (RSA PKCS#1 v1.5 + SHA-256)', 'VALID', 'ca_rsa');
    const [h, p] = jwt.split('.');
    vec.input = { jwt };
    vec.verification_input = `${h}.${p}`;
    vec.canonical_sha256 = crypto.createHash('sha256').update(vec.verification_input, 'utf-8').digest('hex');
    vec.signature_value = jwt.split('.')[2];
    vec.domain = 'JWT';
    out.push(vec);
  }

  // P3: JWT ES256
  {
    const header = { alg: 'ES256', typ: 'JWT', kid: caEc.key_id };
    const claims = { iss: 'https://auth.marketnow.site', sub: 'agent-002', aud: 'marketnow-gateway', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, scope: 'tools:read' };
    const jwt = signJWT(header, claims, caEc.private_key_pem, 'ES256');
    const vec = vectorBase('pos-003-jwt-es256-valid', 'OAuth JWT signed with ES256 (ECDSA P-256 + SHA-256, raw R||S)', 'VALID', 'ca_ecdsa');
    const [h, p] = jwt.split('.');
    vec.input = { jwt };
    vec.verification_input = `${h}.${p}`;
    vec.canonical_sha256 = crypto.createHash('sha256').update(vec.verification_input, 'utf-8').digest('hex');
    vec.signature_value = jwt.split('.')[2];
    vec.domain = 'JWT';
    out.push(vec);
  }

  // P4: JWT EdDSA
  {
    const header = { alg: 'EdDSA', typ: 'JWT', kid: caEd.key_id };
    const claims = { iss: 'https://auth.marketnow.site', sub: 'agent-003', aud: 'marketnow-gateway', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, scope: 'tools:call' };
    const jwt = signJWT(header, claims, caEd.private_key_pem, 'EdDSA');
    const vec = vectorBase('pos-004-jwt-eddsa-valid', 'OAuth JWT signed with EdDSA (Ed25519)', 'VALID', 'ca_ed25519');
    const [h, p] = jwt.split('.');
    vec.input = { jwt };
    vec.verification_input = `${h}.${p}`;
    vec.canonical_sha256 = crypto.createHash('sha256').update(vec.verification_input, 'utf-8').digest('hex');
    vec.signature_value = jwt.split('.')[2];
    vec.domain = 'JWT';
    out.push(vec);
  }

  // P5: W3C VC Ed25519Signature2020
  {
    const cred = {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
      id: 'urn:uuid:' + crypto.randomUUID(),
      type: ['VerifiableCredential', 'AgentTrustCredential'],
      issuer: 'did:marketnow:ca',
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      credentialSubject: { id: 'did:marketnow:agent:001', agent_id: 'test-agent-001', trust_score: 8 },
    };
    const signed = issueW3CVC(cred, caEd.private_key_pem);
    const vec = vectorBase('pos-005-vc-ed25519-valid', 'W3C VC with Ed25519Signature2020 proof', 'VALID', 'ca_ed25519');
    const { proof, ...withoutProof } = signed;
    attachCanonical(vec, withoutProof);
    vec.input = signed;
    vec.signature_value = proof.proofValue;
    vec.domain = 'W3C-VC-DATA-INTEGRITY';
    out.push(vec);
  }

  // P6: PoP challenge + response (both included so verifier can replay-check)
  {
    const challenge = generatePoPChallenge('ATC-2026-ABCD123', 'marketnow-gateway');
    const response = createPoPResponse(challenge, agEd.private_key_pem);
    const vec = vectorBase('pos-006-pop-valid', 'Proof-of-Possession: valid Ed25519 signature over nonce challenge', 'VALID', 'agent_ed25519');
    const popMessage = { credential_id: response.credential_id, nonce: response.nonce, audience: response.audience, timestamp: response.timestamp };
    attachCanonical(vec, popMessage);
    vec.input = { challenge, response };
    vec.signature_value = response.signature;
    vec.domain = DOMAINS.ATC_V3_POP;
    out.push(vec);
  }

  // P7: Action receipt (signed)
  {
    const receipt = generateReceipt({
      decision: 'ALLOW',
      agent_id: 'test-agent-001',
      credential_id: 'ATC-2026-ABCD123',
      tool_name: 'mcp.tools.search',
      args: { query: 'hello world', limit: 10 },
      trust_score: 8,
      reason: 'All stages passed',
      verification_stages: [
        { name: 'PARSE', result: 'pass' },
        { name: 'DETECT', result: 'pass' },
        { name: 'SCHEMA', result: 'pass' },
        { name: 'CRYPTO', result: 'pass' },
        { name: 'ISSUER', result: 'pass' },
        { name: 'KEY_BINDING', result: 'pass' },
        { name: 'POP', result: 'pass' },
        { name: 'DECISION', result: 'ALLOW' },
      ],
    }, gwEd);
    const vec = vectorBase('pos-007-receipt-valid', 'Action receipt signed with Ed25519 (gateway audit trail)', 'VALID', 'gateway_ed25519');
    // For verification: canonicalize the receipt WITHOUT signature AND with evidence_hash=""
    // (this is what the signature is computed over)
    const { signature: _sig, ...receiptNoSig } = receipt;
    const receiptForCanonical = { ...receiptNoSig, evidence_hash: '' };
    attachCanonical(vec, receiptForCanonical);
    vec.input = receipt;
    vec.signature_value = receipt.signature.value;
    vec.domain = DOMAINS.TRUST_DECISION;
    out.push(vec);
  }

  // P8: ATC v3 NOT revoked via CRL (positive — sanity check that an empty CRL
  //     doesn't false-positive a credential as revoked)
  {
    // Use makePos001Cred directly to avoid buildPositive() recursion.
    const cred = makePos001Cred();
    cred.lifecycle.revocation_url = 'uta-fixture://crl/test-crl-2-empty.json';
    cred.lifecycle.revocation_method = 'CRL';
    // Re-sign because lifecycle changed
    const { signatures, ...payload } = cred;
    const sig = ed25519Sign(payload, caEd.private_key_pem, DOMAINS.ATC_V3_CREDENTIAL);
    const canonical = canonicalize(payload);
    cred.signatures = [{
      ...signatures[0],
      value: sig,
      evidence_hash: 'sha256:' + crypto.createHash('sha256').update(canonical + sig, 'utf-8').digest('hex'),
    }];
    // Empty CRL (no revoked credentials)
    const crlPayload = {
      issuer: cred.issuer.did,
      revoked: [],
      this_update: new Date().toISOString(),
      next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      crl_number: 2,
    };
    const crlSignature = ed25519Sign(crlPayload, caEd.private_key_pem, DOMAINS.ATC_V3_CREDENTIAL);
    const crl = {
      ...crlPayload,
      signature: {
        algorithm: 'Ed25519 (RFC 8032)',
        value: crlSignature,
        domain: DOMAINS.ATC_V3_CREDENTIAL,
        key_id: caEd.key_id,
        signed_at: new Date().toISOString(),
      },
    };
    const vec = vectorBase('pos-008-atc-not-revoked-via-crl', 'ATC v3 declaring CRL revocation, with empty CRL (must verify as VALID)', 'VALID', 'ca_ed25519');
    const { signatures: _s, ...rest } = cred;
    attachCanonical(vec, rest);
    vec.input = cred;
    vec.signature_value = sig;
    vec.domain = DOMAINS.ATC_V3_CREDENTIAL;
    vec.revocation_fixture = { kind: 'CRL', url: 'uta-fixture://crl/test-crl-2-empty.json', crl };
    out.push(vec);
  }

  return out;
}

function buildNegative() {
  const out = [];
  const caEd = KEYS.ca_ed25519;
  const agEd = KEYS.agent_ed25519;
  const gwEd = KEYS.gateway_ed25519;

  // N1: Tampered ATC signature (flip first byte)
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-001-atc-v3-valid');
    const cred = JSON.parse(JSON.stringify(pos.input));
    cred.signatures[0].value = 'ff' + cred.signatures[0].value.slice(2);
    const vec = vectorBase('neg-001-atc-tampered-sig', 'ATC v3 with first signature byte flipped to 0xff', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = cred.signatures[0].value;
    vec.domain = cred.signatures[0].domain;
    vec.expected_failure_reason = 'signature verification failed';
    out.push(vec);
  }

  // N2: Tampered ATC payload (subject.agent_id changed — sig should no longer match)
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-001-atc-v3-valid');
    const cred = JSON.parse(JSON.stringify(pos.input));
    cred.subject.agent_id = 'attacker-agent-999';
    const vec = vectorBase('neg-002-atc-tampered-payload', 'ATC v3 with subject.agent_id replaced (signature unchanged)', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = cred.signatures[0].value;
    vec.domain = cred.signatures[0].domain;
    vec.expected_failure_reason = 'signature verification failed';
    out.push(vec);
  }

  // N3: Expired ATC
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-001-atc-v3-valid');
    const cred = JSON.parse(JSON.stringify(pos.input));
    cred.lifecycle.expires_at = '2020-01-01T00:00:00.000Z';
    // Re-sign so the signature matches the modified payload — expiry is enforced by verifier, not signature
    const { signatures, ...payload } = cred;
    const sig = ed25519Sign(payload, caEd.private_key_pem, DOMAINS.ATC_V3_CREDENTIAL);
    const canonical = canonicalize(payload);
    cred.signatures = [{
      ...signatures[0],
      value: sig,
      evidence_hash: 'sha256:' + crypto.createHash('sha256').update(canonical + sig, 'utf-8').digest('hex'),
    }];
    const vec = vectorBase('neg-003-atc-expired', 'ATC v3 properly signed but lifecycle.expires_at is in the past', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = sig;
    vec.domain = DOMAINS.ATC_V3_CREDENTIAL;
    vec.expected_failure_reason = 'expired';
    out.push(vec);
  }

  // N4: Revoked ATC
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-001-atc-v3-valid');
    const cred = JSON.parse(JSON.stringify(pos.input));
    cred.lifecycle.revoked = true;
    // Re-sign
    const { signatures, ...payload } = cred;
    const sig = ed25519Sign(payload, caEd.private_key_pem, DOMAINS.ATC_V3_CREDENTIAL);
    const canonical = canonicalize(payload);
    cred.signatures = [{ ...signatures[0], value: sig, evidence_hash: 'sha256:' + crypto.createHash('sha256').update(canonical + sig, 'utf-8').digest('hex') }];
    const vec = vectorBase('neg-004-atc-revoked', 'ATC v3 properly signed but lifecycle.revoked is true', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = sig;
    vec.domain = DOMAINS.ATC_V3_CREDENTIAL;
    vec.expected_failure_reason = 'revoked';
    out.push(vec);
  }

  // N5: Wrong-domain signature
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-001-atc-v3-valid');
    const cred = JSON.parse(JSON.stringify(pos.input));
    cred.signatures[0].domain = 'UTA-WRONG-DOMAIN';
    const vec = vectorBase('neg-005-atc-wrong-domain', 'ATC v3 with signature domain swapped to UTA-WRONG-DOMAIN', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = cred.signatures[0].value;
    vec.domain = cred.signatures[0].domain;
    vec.expected_failure_reason = 'wrong domain';
    out.push(vec);
  }

  // N6: JWT alg=none (must be rejected)
  {
    const header = { alg: 'none', typ: 'JWT' };
    const claims = { iss: 'https://auth.marketnow.site', sub: 'attacker', aud: 'marketnow-gateway', exp: Math.floor(Date.now() / 1000) + 3600 };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const jwt = `${h}.${p}.`; // empty signature
    const vec = vectorBase('neg-006-jwt-alg-none', 'JWT with alg=none and empty signature — must be rejected', 'INVALID', 'ca_ed25519');
    vec.input = { jwt };
    vec.verification_input = `${h}.${p}`;
    vec.signature_value = '';
    vec.domain = 'JWT';
    vec.expected_failure_reason = 'algorithm "none" is forbidden';
    out.push(vec);
  }

  // N7: JWT HS256 (must be rejected — symmetric)
  {
    const header = { alg: 'HS256', typ: 'JWT' };
    const claims = { iss: 'https://auth.marketnow.site', sub: 'attacker', exp: Math.floor(Date.now() / 1000) + 3600 };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const sig = crypto.createHmac('sha256', 'shared-secret').update(`${h}.${p}`).digest('base64url');
    const jwt = `${h}.${p}.${sig}`;
    const vec = vectorBase('neg-007-jwt-hs256', 'JWT with alg=HS256 — symmetric, must be rejected', 'INVALID', 'ca_ed25519');
    vec.input = { jwt };
    vec.verification_input = `${h}.${p}`;
    vec.signature_value = sig;
    vec.domain = 'JWT';
    vec.expected_failure_reason = 'HS256" is not supported';
    out.push(vec);
  }

  // N8: JWT tampered signature
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-004-jwt-eddsa-valid');
    const parts = pos.input.jwt.split('.');
    const sigBytes = Buffer.from(parts[2], 'base64url');
    sigBytes[0] = sigBytes[0] ^ 0xff;
    const tamperedJwt = `${parts[0]}.${parts[1]}.${sigBytes.toString('base64url')}`;
    const vec = vectorBase('neg-008-jwt-tampered-sig', 'EdDSA JWT with first signature byte flipped', 'INVALID', 'ca_ed25519');
    vec.input = { jwt: tamperedJwt };
    vec.verification_input = `${parts[0]}.${parts[1]}`;
    vec.signature_value = parts[2];
    vec.domain = 'JWT';
    vec.expected_failure_reason = 'signature verification failed';
    out.push(vec);
  }

  // N9: VC with wrong key (signed with agent key, presented as CA-signed)
  {
    const cred = {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
      id: 'urn:uuid:' + crypto.randomUUID(),
      type: ['VerifiableCredential', 'AgentTrustCredential'],
      issuer: 'did:marketnow:ca',
      issuanceDate: new Date().toISOString(),
      credentialSubject: { id: 'did:marketnow:agent:001', agent_id: 'test-agent-001', trust_score: 8 },
    };
    // Sign with AGENT key, but verifier will use CA key — must fail
    const signed = issueW3CVC(cred, agEd.private_key_pem);
    const vec = vectorBase('neg-009-vc-wrong-key', 'W3C VC signed with a different key than the verifier expects', 'INVALID', 'ca_ed25519');
    vec.input = signed;
    vec.signature_value = signed.proof.proofValue;
    vec.domain = 'W3C-VC-DATA-INTEGRITY';
    vec.expected_failure_reason = 'verification failed';
    out.push(vec);
  }

  // N10: VC with wrong proof type
  {
    const cred = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: 'urn:uuid:' + crypto.randomUUID(),
      type: ['VerifiableCredential'],
      issuer: 'did:marketnow:ca',
      issuanceDate: new Date().toISOString(),
      credentialSubject: { id: 'did:marketnow:agent:001' },
      proof: { type: 'JsonWebSignature2020', proofValue: 'AAA', proofPurpose: 'assertionMethod', created: new Date().toISOString() },
    };
    const vec = vectorBase('neg-010-vc-wrong-proof-type', 'W3C VC with proof.type=JsonWebSignature2020 (only Ed25519Signature2020 supported)', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.expected_failure_reason = 'unsupported proof type';
    out.push(vec);
  }

  // N11: PoP wrong nonce
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-006-pop-valid');
    const response = JSON.parse(JSON.stringify(pos.input.response));
    response.nonce = '0'.repeat(64); // wrong nonce
    const vec = vectorBase('neg-011-pop-wrong-nonce', 'PoP response with nonce replaced (does not match challenge)', 'INVALID', 'agent_ed25519');
    vec.input = { challenge: pos.input.challenge, response };
    vec.signature_value = response.signature;
    vec.domain = DOMAINS.ATC_V3_POP;
    vec.expected_failure_reason = 'nonce';
    out.push(vec);
  }

  // N12: PoP expired challenge
  {
    const challenge = generatePoPChallenge('ATC-2026-ABCD123', 'marketnow-gateway', { ttlMs: 5 * 60 * 1000 });
    // Force past expiry
    challenge.issued_at = '2020-01-01T00:00:00.000Z';
    challenge.expires_at = '2020-01-01T00:05:00.000Z';
    const response = createPoPResponse(challenge, agEd.private_key_pem);
    const vec = vectorBase('neg-012-pop-expired', 'PoP with expired challenge (expires_at in 2020)', 'INVALID', 'agent_ed25519');
    vec.input = { challenge, response };
    vec.signature_value = response.signature;
    vec.domain = DOMAINS.ATC_V3_POP;
    vec.expected_failure_reason = 'expired';
    out.push(vec);
  }

  // N13: Receipt tampered evidence_hash
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-007-receipt-valid');
    const receipt = JSON.parse(JSON.stringify(pos.input));
    receipt.evidence_hash = 'sha256:' + '0'.repeat(64);
    const vec = vectorBase('neg-013-receipt-tampered-evidence-hash', 'Action receipt with evidence_hash replaced', 'INVALID', 'gateway_ed25519');
    vec.input = receipt;
    vec.signature_value = receipt.signature.value;
    vec.domain = DOMAINS.TRUST_DECISION;
    vec.expected_failure_reason = 'evidence_hash mismatch';
    out.push(vec);
  }

  // N14: ATC with malformed signature (wrong length)
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-001-atc-v3-valid');
    const cred = JSON.parse(JSON.stringify(pos.input));
    cred.signatures[0].value = 'abc'; // too short
    const vec = vectorBase('neg-014-atc-malformed-sig', 'ATC v3 with malformed signature (3 chars instead of 128 hex)', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = cred.signatures[0].value;
    vec.domain = cred.signatures[0].domain;
    vec.expected_failure_reason = 'malformed signature';
    out.push(vec);
  }

  // N15: ATC wrong version
  {
    const pos = buildPositive().find(v => v.vector_id === 'pos-001-atc-v3-valid');
    const cred = JSON.parse(JSON.stringify(pos.input));
    cred.atc_version = '2.0.0';
    const vec = vectorBase('neg-015-atc-wrong-version', 'ATC with atc_version=2.0.0 (must start with 3.)', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = cred.signatures[0].value;
    vec.domain = cred.signatures[0].domain;
    vec.expected_failure_reason = 'wrong atc_version';
    out.push(vec);
  }

  // ── P2-6: Revocation vectors ──
  // These exercise the new RevocationChecker abstraction (CRL + Bitstring Status List).
  // The conformance runner provides a custom RevocationChecker that serves
  // the CRL/StatusList from in-memory fixtures.

  // N16: ATC v3 revoked via CRL (credential is NOT marked revoked inline,
  //      but appears in the CRL — strong check must catch it)
  {
    const cred = makePos001Cred();
    // Set up revocation via CRL — credential declares revocation_url pointing at a CRL
    cred.lifecycle.revocation_url = 'uta-fixture://crl/test-crl-1.json';
    cred.lifecycle.revocation_method = 'CRL';
    // Re-sign the credential because lifecycle changed
    const { signatures, ...payload } = cred;
    const sig = ed25519Sign(payload, caEd.private_key_pem, DOMAINS.ATC_V3_CREDENTIAL);
    const canonical = canonicalize(payload);
    cred.signatures = [{
      ...signatures[0],
      value: sig,
      evidence_hash: 'sha256:' + crypto.createHash('sha256').update(canonical + sig, 'utf-8').digest('hex'),
    }];
    // Mark this credential_id as revoked in the CRL
    const cred_id = cred.credential_id;
    const crlPayload = {
      issuer: cred.issuer.did,
      revoked: [{
        credential_id: cred_id,
        revoked_at: '2026-08-21T00:00:00Z',
        reason: 'key compromise',
      }],
      this_update: new Date().toISOString(),
      next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      crl_number: 1,
    };
    const crlSignature = ed25519Sign(crlPayload, caEd.private_key_pem, DOMAINS.ATC_V3_CREDENTIAL);
    const crl = {
      ...crlPayload,
      signature: {
        algorithm: 'Ed25519 (RFC 8032)',
        value: crlSignature,
        domain: DOMAINS.ATC_V3_CREDENTIAL,
        key_id: caEd.key_id,
        signed_at: new Date().toISOString(),
      },
    };
    const vec = vectorBase('neg-016-atc-revoked-via-crl', 'ATC v3 with valid signature but listed as revoked in CRL (no inline revoked flag)', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = sig;
    vec.domain = DOMAINS.ATC_V3_CREDENTIAL;
    vec.revocation_fixture = { kind: 'CRL', url: 'uta-fixture://crl/test-crl-1.json', crl };
    vec.expected_failure_reason = 'revoked via CRL';
    out.push(vec);
  }

  // N17: ATC v3 revoked via Bitstring Status List
  {
    const cred = makePos001Cred();
    cred.lifecycle.status_list_credential_url = 'uta-fixture://statuslist/test-list-1.json';
    cred.lifecycle.status_list_index = 42;
    cred.lifecycle.revocation_method = 'BITSTRING_STATUS_LIST';
    // Re-sign because lifecycle changed
    const { signatures, ...payload } = cred;
    const sig = ed25519Sign(payload, caEd.private_key_pem, DOMAINS.ATC_V3_CREDENTIAL);
    const canonical = canonicalize(payload);
    cred.signatures = [{
      ...signatures[0],
      value: sig,
      evidence_hash: 'sha256:' + crypto.createHash('sha256').update(canonical + sig, 'utf-8').digest('hex'),
    }];
    // Build a status list with bit 42 set (revoked)
    const zlib = require('node:zlib');
    const buf = Buffer.alloc(8192, 0); // 65536 bits
    buf[5] |= (1 << (7 - 2)); // byte 5 (bits 40-47), bit position 2 = index 42
    const encoded = zlib.gzipSync(buf).toString('base64url');
    const statusListCredential = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: 'uta-fixture://statuslist/test-list-1.json',
      type: ['VerifiableCredential', 'BitstringStatusListCredential'],
      issuer: cred.issuer.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: 'uta-fixture://statuslist/test-list-1.json#list',
        type: 'BitstringStatusList',
        statusPurpose: 'revocation',
        encodedList: encoded,
        ttl: 300,
      },
      proof: {
        type: 'Ed25519Signature2020',
        proofValue: '',  // filled after signing
        proofPurpose: 'assertionMethod',
        created: new Date().toISOString(),
      },
    };
    // Sign the status list credential (without proof.proofValue field)
    const { proof: _p, ...slWithoutProof } = statusListCredential;
    const slCanonical = canonicalize(slWithoutProof);
    const slSigningInput = Buffer.from('W3C-VC-DATA-INTEGRITY:' + slCanonical, 'utf-8');
    const slSignature = crypto.sign(null, slSigningInput, crypto.createPrivateKey(caEd.private_key_pem)).toString('base64url');
    statusListCredential.proof.proofValue = slSignature;

    const vec = vectorBase('neg-017-atc-revoked-via-bitstring', 'ATC v3 with valid signature but revoked via Bitstring Status List (bit 42 set)', 'INVALID', 'ca_ed25519');
    vec.input = cred;
    vec.signature_value = sig;
    vec.domain = DOMAINS.ATC_V3_CREDENTIAL;
    vec.revocation_fixture = { kind: 'BITSTRING_STATUS_LIST', url: 'uta-fixture://statuslist/test-list-1.json', statusListCredential };
    vec.expected_failure_reason = 'revoked via BITSTRING_STATUS_LIST';
    out.push(vec);
  }

  return out;
}

function buildMutations() {
  const out = [];
  const caEd = KEYS.ca_ed25519;

  // For the ATC v3 positive vector, produce 3 single-byte mutations of the canonical bytes.
  // Each mutation flips one byte in the canonical JCS string — the verifier should reject.
  const pos = buildPositive().find(v => v.vector_id === 'pos-001-atc-v3-valid');
  const { signatures, ...payload } = pos.input;
  const canonical = canonicalize(payload);

  const positions = [
    { name: 'byte-0', idx: 0 },
    { name: 'byte-middle', idx: Math.floor(canonical.length / 2) },
    { name: 'byte-last', idx: canonical.length - 1 },
  ];

  for (const { name, idx } of positions) {
    const mutated = Buffer.from(canonical, 'utf-8');
    mutated[idx] = mutated[idx] ^ 0x20; // flip case-like bit (ascii-safe)
    const mutatedCanonical = mutated.toString('utf-8');
    // Try to parse back to object (it may not be valid JSON if we hit a structural char)
    let mutatedPayload;
    try { mutatedPayload = JSON.parse(mutatedCanonical); } catch { mutatedPayload = null; }

    const vec = {
      vector_id: `mut-001-${name}`,
      description: `ATC v3 canonical bytes mutated at ${name} (bit-flip) — signature should no longer match`,
      expected_result: 'INVALID',
      public_key_ref: 'ca_ed25519',
      domain: DOMAINS.ATC_V3_CREDENTIAL,
      signature_value: signatures[0].value,
      verification_input: mutatedCanonical,
      canonical_sha256: crypto.createHash('sha256').update(mutatedCanonical, 'utf-8').digest('hex'),
      generated_at: new Date().toISOString(),
      spec: 'UTA-P2-VECTORS/1.0',
      mutation: { original_canonical_length: canonical.length, byte_index: idx, original_byte: canonical.charCodeAt(idx), mutated_byte: mutated[idx] },
      expected_failure_reason: 'signature verification failed',
    };
    if (mutatedPayload) vec.input = { ...mutatedPayload, signatures };
    else vec.input = { _unparseable: true, raw_canonical: mutatedCanonical, signatures };
    out.push(vec);
  }

  // Same for JWT EdDSA — flip a byte in the header.payload segment
  const posJwt = buildPositive().find(v => v.vector_id === 'pos-004-jwt-eddsa-valid');
  const [h, p, s] = posJwt.input.jwt.split('.');
  const signingInput = `${h}.${p}`;
  const buf = Buffer.from(signingInput, 'utf-8');
  const idx = Math.floor(buf.length / 2);
  buf[idx] = buf[idx] ^ 0x20;
  const tamperedInput = buf.toString('utf-8');
  const [th, tp] = tamperedInput.split('.');
  const vec = {
    vector_id: 'mut-002-jwt-eddsa-middle-byte',
    description: 'EdDSA JWT signing input with middle byte flipped',
    expected_result: 'INVALID',
    public_key_ref: 'ca_ed25519',
    domain: 'JWT',
    signature_value: s,
    verification_input: tamperedInput,
    canonical_sha256: crypto.createHash('sha256').update(tamperedInput, 'utf-8').digest('hex'),
    generated_at: new Date().toISOString(),
    spec: 'UTA-P2-VECTORS/1.0',
    input: { jwt: `${th}.${tp}.${s}` },
    expected_failure_reason: 'signature verification failed',
  };
  out.push(vec);

  // VC mutation — flip byte in canonical credential (without proof)
  const posVc = buildPositive().find(v => v.vector_id === 'pos-005-vc-ed25519-valid');
  const { proof, ...vcPayload } = posVc.input;
  const vcCanonical = canonicalize(vcPayload);
  const vcBuf = Buffer.from(vcCanonical, 'utf-8');
  const vcIdx = Math.floor(vcBuf.length / 2);
  vcBuf[vcIdx] = vcBuf[vcIdx] ^ 0x20;
  const tamperedVcCanonical = vcBuf.toString('utf-8');
  let tamperedVcPayload;
  try { tamperedVcPayload = JSON.parse(tamperedVcCanonical); } catch { tamperedVcPayload = null; }
  const vcVec = {
    vector_id: 'mut-003-vc-ed25519-middle-byte',
    description: 'W3C VC canonical bytes (without proof) mutated at middle byte',
    expected_result: 'INVALID',
    public_key_ref: 'ca_ed25519',
    domain: 'W3C-VC-DATA-INTEGRITY',
    signature_value: proof.proofValue,
    verification_input: tamperedVcCanonical,
    canonical_sha256: crypto.createHash('sha256').update(tamperedVcCanonical, 'utf-8').digest('hex'),
    generated_at: new Date().toISOString(),
    spec: 'UTA-P2-VECTORS/1.0',
    expected_failure_reason: 'signature verification failed',
  };
  if (tamperedVcPayload) vcVec.input = { ...tamperedVcPayload, proof };
  else vcVec.input = { _unparseable: true, raw_canonical: tamperedVcCanonical, proof };
  out.push(vcVec);

  return out;
}

function buildCrossLang() {
  // Cross-language vectors: for each "interesting" payload, output the canonical JCS string
  // and the SHA-256 hex. A non-Node implementation reads these, computes canonicalize(payload)
  // using its own JCS implementation, and checks that it matches the recorded canonical bytes
  // AND the SHA-256.
  const cases = [
    {
      id: 'xlang-001-flat-object',
      description: 'Flat object with string, number, boolean, null — UTF-8 sorted keys',
      payload: { z: 'last', a: 'first', m: 42, b: true, q: null, 'forward/slash': 'must not be escaped' },
    },
    {
      id: 'xlang-002-nested-array',
      description: 'Nested arrays + objects with mixed types',
      payload: { items: [{ id: 1, name: 'alpha' }, { id: 2, name: 'beta' }], count: 2, valid: true },
    },
    {
      id: 'xlang-003-unicode-keys',
      description: 'Unicode keys (CJK + emoji surrogate pair) — UTF-16 code unit sort',
      payload: { '中': 1, '文': 2, '🎨': 3, 'A': 4, 'a': 5 },
    },
    {
      id: 'xlang-004-number-edge-cases',
      description: 'Number edge cases: 0, -0, 0.1, 1e10, 1E-10, MAX_SAFE_INTEGER',
      payload: { zero: 0, minus_zero: -0, float: 0.1, big: 1e10, small: 1e-10, max_safe: 9007199254740991 },
    },
    {
      id: 'xlang-005-empty-collections',
      description: 'Empty object, empty array, string with control chars',
      payload: { empty_obj: {}, empty_arr: [], control: 'tab\there\nnewline\rreturn' },
    },
    {
      id: 'xlang-006-special-escapes',
      description: 'Strings requiring JSON escape: backslash, quote, forward slash (must NOT escape /)',
      payload: { backslash: 'a\\b', quote: 'say "hi"', slash: 'a/b/c' },
    },
  ];
  return cases.map(c => {
    const canonical = canonicalize(c.payload);
    const hash = crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
    return {
      vector_id: c.id,
      description: c.description,
      expected_result: 'CANONICAL_MATCH',
      payload: c.payload,
      verification_input: canonical,
      canonical_sha256: hash,
      canonical_length_bytes: Buffer.byteLength(canonical, 'utf-8'),
      generated_at: new Date().toISOString(),
      spec: 'UTA-P2-VECTORS/1.0',
      cross_language_check: `Compute canonicalize(payload) using your local JCS (RFC 8785) implementation. The result MUST byte-for-byte match verification_input. The SHA-256 of those bytes MUST equal canonical_sha256.`,
    };
  });
}

// ============================================================================
// Write all vectors
// ============================================================================

function writeVecs(dir, vecs) {
  fs.mkdirSync(dir, { recursive: true });
  // Clean previous vectors
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f));
  }
  for (const v of vecs) {
    const fname = `${v.vector_id}.json`;
    fs.writeFileSync(path.join(dir, fname), JSON.stringify(v, null, 2) + '\n', 'utf-8');
  }
}

const positive = buildPositive();
const negative = buildNegative();
const mutation = buildMutations();
const crossLang = buildCrossLang();

writeVecs(path.join(ROOT, 'vectors', 'positive'), positive);
writeVecs(path.join(ROOT, 'vectors', 'negative'), negative);
writeVecs(path.join(ROOT, 'vectors', 'mutation'), mutation);
writeVecs(path.join(ROOT, 'vectors', 'cross-lang'), crossLang);

// Manifest
const manifest = {
  generated_at: new Date().toISOString(),
  spec: 'UTA-P2-VECTORS/1.0',
  keys_manifest: 'vectors/keys/manifest.json',
  counts: {
    positive: positive.length,
    negative: negative.length,
    mutation: mutation.length,
    cross_lang: crossLang.length,
    total: positive.length + negative.length + mutation.length + crossLang.length,
  },
  vector_ids: {
    positive: positive.map(v => v.vector_id),
    negative: negative.map(v => v.vector_id),
    mutation: mutation.map(v => v.vector_id),
    cross_lang: crossLang.map(v => v.vector_id),
  },
  manifest_sha256: null, // filled below
};

const manifestPath = path.join(ROOT, 'vectors', 'MANIFEST.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

// Compute sha256 of the manifest (without the manifest_sha256 field)
const manifestHash = crypto.createHash('sha256').update(JSON.stringify(manifest, null, 2) + '\n', 'utf-8').digest('hex');
manifest.manifest_sha256 = manifestHash;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

console.log(`✅ Generated ${manifest.counts.total} vectors:`);
console.log(`   positive:   ${manifest.counts.positive}`);
console.log(`   negative:   ${manifest.counts.negative}`);
console.log(`   mutation:   ${manifest.counts.mutation}`);
console.log(`   cross-lang: ${manifest.counts.cross_lang}`);
console.log(`   manifest_sha256: ${manifestHash}`);
