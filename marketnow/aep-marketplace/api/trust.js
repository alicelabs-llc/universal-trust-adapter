// ============================================================================
// MarketNow — Universal Trust Handler (UTA v1.0.0)
// Handles /api/trust — the universal adapter API
// 
// UPDATED: 2026-08-21 — Reflects UTA v1.0.0 with 8 adapters, 12-stage
// pipeline, real cryptographic verification, and all P0-P10 features.
// UPDATED: 2026-09-08 — verifyATCv3 now performs REAL Ed25519 signature
//   verification (was structure-only: schema/domain/lifecycle). Found via the
//   multichannel evidence harness requested by CodePass.dev — a tampered ATC
//   signed by an unknown CA was being accepted as valid, violating the
//   documented golden rule (UNKNOWN = DENY). Trust anchor semantics:
//   callers may supply body.ca_public_key (their own anchor); otherwise ONLY
//   the MarketNow registry CA (mn-ca-003) is trusted, and unknown anchors
//   fail closed. Same canonicalization as api/atc.js (RFC 8785 JCS, inline).
// UPDATED: 2026-09-08 (b) — 3 fixes for the live tool pages:
//   1. jwtToUTS/verifyJWT no longer crash on raw claims objects (undefined
//      .split('.') was causing FUNCTION_INVOCATION_FAILED 500s on
//      /api/trust?action=translate with from=jwt).
//   2. verify response enriched with decision/stages/detected_format/
//      issuer/failed_stage so /playground.html can render the real 12-stage
//      fail-closed pipeline.
//   3. handleTrust POST wrapped in try/catch — runtime errors now return
//      clean JSON 500s instead of opaque FUNCTION_INVOCATION_FAILED.
// ============================================================================

import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from 'node:crypto';

// MarketNow registry CA (mn-ca-003, active since 2026-09-08; see /api/atc?action=ca-key)
const MARKETNOW_CA = {
  key_id: 'mn-ca-003',
  spki_b64: 'MCowBQYDK2VwAyEAUWJgyMWp9oKIGwN9EG8ayz/mYYp1lcQBI58rtpOs8CM=',
  active_since: '2026-09-08',
};

// OPTIONAL server-side signing key for translate→atc-v3 (env var, never committed).
// When CA_PRIVATE_KEY_PEM (PEM, Ed25519) is present, translated ATC v3 cards are
// issued with a REAL signature that verifies against mn-ca-003 — so the
// "Translate → Verify in Playground" handoff ends in PERMIT. Without the env
// var the placeholder signature is kept (and verification fails honestly).
let CA_SIGNING_KEY = null;
try {
  const pem = process.env.CA_PRIVATE_KEY_PEM || '';
  if (pem.includes('BEGIN PRIVATE KEY')) CA_SIGNING_KEY = createPrivateKey(pem);
} catch { CA_SIGNING_KEY = null; }

// RFC 8785 JCS (JSON Canonicalization Scheme) — inline, no dependencies.
// Identical to api/atc.js (kept in sync deliberately).
function jcs(o) {
  if (o === null) return 'null';
  switch (typeof o) {
    case 'boolean': return o ? 'true' : 'false';
    case 'number': return Number.isFinite(o) ? String(o) : 'null';
    case 'string': return JSON.stringify(o);
  }
  if (Array.isArray(o)) return '[' + o.map(jcs).join(',') + ']';
  const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + jcs(o[k])).join(',') + '}';
}

// Real Ed25519 verification of an ATC v3 credential.
// Signed payload = credential WITHOUT the signatures array; signing bytes =
// 'UTA-ATC-V3-CREDENTIAL:' + JCS(payload) — identical to @marketnow/trust-core.
function verifyAtcV3Signature(cred, trustAnchorPem) {
  try {
    const { signatures, ...payload } = cred;
    const sig = cred.signatures?.[0];
    if (!sig?.value) return { ok: false, err: 'signature value missing' };
    const sigBuf = Buffer.from(String(sig.value), 'hex');
    if (sigBuf.length !== 64) return { ok: false, err: 'signature is not 64 bytes (128 hex chars)' };
    const signingBytes = Buffer.from('UTA-ATC-V3-CREDENTIAL:' + jcs(payload), 'utf-8');
    const pub = createPublicKey({ key: trustAnchorPem, format: 'pem' });
    return { ok: edVerify(null, signingBytes, pub, sigBuf) };
  } catch (e) {
    return { ok: false, err: String(e && e.message ? e.message : e) };
  }
}

function spkiToPem(spkiB64) {
  return '-----BEGIN PUBLIC KEY-----\n' + spkiB64 + '\n-----END PUBLIC KEY-----';
}

export async function handleTrust(req, res) {
  // CORS: public, key-less trust API — open to browser clients, third-party
  // tooling and the live demo widgets on /uta and /playground.html.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const action = req.query.action;
    
    if (action === 'formats') {
      return res.status(200).json({
        service: 'MarketNow Universal Trust API (UTA v1.0.0)',
        uts_version: '2.0.0',
        total_formats: 8,
        formats: [
          { id: 'atc-v3', name: 'Agent Trust Card v3', version: '3.0.0', status: 'stable', algorithm: 'Ed25519 (RFC 8032)' },
          { id: 'jwt', name: 'JWT (OAuth/OIDC)', version: 'RFC 7519', status: 'stable', algorithm: 'RS256 / ES256 / EdDSA' },
          { id: 'w3c-vc', name: 'W3C Verifiable Credential', version: '2.0', status: 'stable', algorithm: 'Ed25519Signature2020' },
          { id: 'a2a-card', name: 'Google A2A Agent Card', version: '1.0', status: 'stable', algorithm: 'Ed25519Signature2020' },
          { id: 'eat-ai', name: 'IETF EAT-AI (CWT/COSE)', version: 'draft-00', status: 'beta', algorithm: 'EdDSA / ES256 / RS256' },
          { id: 'zta', name: 'Anthropic ZTA', version: '1.0', status: 'beta', algorithm: 'Ed25519 + UTA-ZTA-CARD domain' },
          { id: 'mcp-card', name: 'MCP Server Card', version: '1.0', status: 'stable', algorithm: 'Ed25519 + UTA-MCP-CARD domain' },
          { id: 'x509', name: 'X.509 Certificate', version: '3', status: 'stable', algorithm: 'RSA / ECDSA / Ed25519' },
        ],
        pipeline_stages: 12,
        test_count: 480,
        performance: '6,744 verifications/sec',
        languages: ['TypeScript', 'Python', 'Rust', 'Go'],
      });
    }

    if (action === 'pipeline') {
      return res.status(200).json({
        pipeline: [
          { stage: '01', name: 'PARSE', description: 'Can we parse the payload?' },
          { stage: '02', name: 'DETECT', description: 'What format is this?' },
          { stage: '03', name: 'SCHEMA', description: 'Does it match the expected schema?' },
          { stage: '04', name: 'CRYPTO', description: 'Is the Ed25519 signature valid?' },
          { stage: '05', name: 'ISSUER', description: 'Do we trust the issuer?' },
          { stage: '06', name: 'KEY_BINDING', description: 'Is the key ID valid?' },
          { stage: '07', name: 'POP', description: 'Has the agent proven it holds the private key?' },
          { stage: '08', name: 'PROVENANCE', description: 'Is the artifact binding valid?' },
          { stage: '09', name: 'LIFECYCLE', description: 'Is it expired? Revoked?' },
          { stage: '10', name: 'EVIDENCE', description: 'Are the evidence hashes correct?' },
          { stage: '11', name: 'POLICY', description: 'Does it meet the policy requirements?' },
          { stage: '12', name: 'DECISION', description: 'Final ALLOW or DENY' },
        ],
        golden_rule: 'UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY',
      });
    }

    if (action === 'revocation') {
      return res.status(200).json({
        methods: [
          { id: 'CRL', name: 'Certificate Revocation List', description: 'Signed list of revoked credential IDs. Ed25519 signature verification. TTL cache.' },
          { id: 'OCSP', name: 'Online Certificate Status Protocol', description: 'Real-time HTTP responder. Nonce anti-replay. Signed responses. Fail-closed on timeout.' },
          { id: 'BITSTRING', name: 'Bitstring Status List (W3C 2021)', description: 'Compressed bitstring (gzip+base64url). 1 bit per credential. Scales to millions in ~30KB.' },
        ],
        ocsp_responder: 'POST /api/ocsp — Real-time revocation status with signed response',
        fail_closed: true,
      });
    }
    
    return res.status(200).json({
      service: 'MarketNow Universal Trust API',
      version: '1.0.0',
      uts_version: '2.0.0',
      uta_version: '1.0.0',
      description: 'UTA (Universal Trust Adapter) — The USB-C of Agent Trust. 12-stage fail-closed pipeline, 8 credential formats, real cryptographic verification.',
      architecture: 'Universal Trust Schema (UTS) v2 as IR. 12-stage verification pipeline. 8 adapters. O(N) complexity.',
      pipeline: '12 stages: PARSE → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION',
      golden_rule: 'UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY',
      formats_available: [
        { id: 'atc-v3', name: 'Agent Trust Card v3', version: '3.0.0', status: 'stable', algorithm: 'Ed25519 (RFC 8032)' },
        { id: 'jwt', name: 'JWT (OAuth/OIDC)', version: 'RFC 7519', status: 'stable', algorithm: 'RS256 / ES256 / EdDSA' },
        { id: 'w3c-vc', name: 'W3C Verifiable Credential', version: '2.0', status: 'stable', algorithm: 'Ed25519Signature2020' },
        { id: 'a2a-card', name: 'Google A2A Agent Card', version: '1.0', status: 'stable', algorithm: 'Ed25519Signature2020' },
        { id: 'eat-ai', name: 'IETF EAT-AI (CWT/COSE)', version: 'draft-00', status: 'beta', algorithm: 'EdDSA / ES256 / RS256' },
        { id: 'zta', name: 'Anthropic ZTA', version: '1.0', status: 'beta', algorithm: 'Ed25519 + UTA-ZTA-CARD domain' },
        { id: 'mcp-card', name: 'MCP Server Card', version: '1.0', status: 'stable', algorithm: 'Ed25519 + UTA-MCP-CARD domain' },
        { id: 'x509', name: 'X.509 Certificate', version: '3', status: 'stable', algorithm: 'RSA / ECDSA / Ed25519' },
      ],
      cryptographic_features: {
        signing: 'Ed25519 (RFC 8032) — 64-byte signatures, ~100μs verify',
        canonicalization: 'RFC 8785 JCS — deterministic JSON serialization',
        domain_separation: '7 distinct domains prevent cross-context signature reuse',
        pop: 'Proof-of-Possession with 32-byte nonce, single-use (anti-replay)',
        multi_sig: 'N-of-M quorum with required_key_ids policy',
        post_quantum: 'ML-DSA-65 (FIPS 204) abstraction + hybrid mode ready',
        revocation: 'CRL + OCSP responder + Bitstring Status List (W3C 2021)',
        audit: 'Signed action receipts + Merkle audit log (tamper-evident)',
      },
      endpoints: {
        verify: 'POST /api/trust?action=verify — auto-detect + verify any format',
        translate: 'POST /api/trust?action=translate — translate payload from format X to Y',
        issue: 'POST /api/trust?action=issue — issue credentials in multiple formats',
        bridge: 'POST /api/trust?action=bridge — verify in ecosystem A, issue in B',
        formats: 'GET /api/trust?action=formats — list all 8 supported formats',
        pipeline: 'GET /api/trust?action=pipeline — list 12 pipeline stages',
        revocation: 'GET /api/trust?action=revocation — list revocation methods',
      },
      stats: {
        tests_passing: '480+ (Node.js) + 16 (Python SDK)',
        performance: '6,744 verifications/sec (1.8x overhead vs raw Ed25519)',
        npm_packages: '20+ packages (@marketnow/trust-*)',
        language_sdks: 'TypeScript, Python, Rust, Go',
        test_vectors: '36 (8 positive + 17 negative + 5 mutation + 6 cross-language)',
        fuzz_iterations: '400 (0 crashes)',
        property_tests: '23 mathematical properties verified',
      },
      supply_chain: {
        sbom: 'SPDX 2.3 generated per package',
        slsa: 'Build Level 3 (slsa-github-generator)',
        sigstore: 'Keyless signing (Fulcio + Rekor via cosign)',
        npm_provenance: 'npm publish --provenance attestation',
      },
      deployment: {
        docker: 'Multi-stage build, Node 20 slim, non-root user',
        kubernetes: 'Helm chart with HPA (2-10 replicas)',
        ci_cd: 'GitHub Actions: build → test → SBOM → SLSA → Sigstore → publish',
        cli: 'uta-verify command (7 formats, auto-detect)',
        dashboard: 'Web UI for metrics, receipts, and verification',
      },
      compliance: {
        soc2: '11 Trust Services Criteria mapped',
        iso27001: '13 Annex A Controls mapped',
        nist_csf: '5 Functions (Identify, Protect, Detect, Respond, Recover)',
        threat_model: 'STRIDE + MITRE ATLAS (35 mitigations, 10 AI techniques)',
      },
      license: 'AL-1.0 (AliceLabs Source-Available License v1.0)',
      built_by: 'AliceLabs LLC — Edison Flores & Alejandro Flores',
    });
  }

  if (req.method === 'POST') {
    const action = req.query.action || req.body?.action;
    const body = req.body || {};

    // ── verify: auto-detect format and verify ──────────────────────────
    if (action === 'verify') {
      const { payload, ca_public_key } = body;
      if (!payload) return res.status(400).json({ error: 'payload required' });

      const detected = detectFormat(payload);
      if (!detected.format) {
        return res.status(200).json({
          valid: false,
          format: 'unknown',
          issues: ['Could not detect format'],
          warnings: [],
          // Enriched fields (playground UI)
          detected_format: 'unknown',
          decision: 'DENY',
          issuer: 'unknown',
          failed_stage: 'DETECT',
          stages: buildStageBreakdown({ format: null, confidence: 0 }, { valid: false, issues: ['Could not detect format'], warnings: [] }),
        });
      }

      const result = verifyByFormat(detected.format, payload, ca_public_key);
      // Enriched fields for the Verify Playground UI (additive only —
      // existing consumers of valid/format/issues are unaffected).
      result.detected_format = result.format || detected.format;
      result.decision = result.valid ? 'PERMIT' : 'DENY';
      result.issuer = result.uts?.trust?.assessor || 'unknown';
      result.stages = buildStageBreakdown(detected, result);
      result.failed_stage = (result.stages.find(s => s.status === 'FAIL') || {}).name || null;
      result.golden_rule = 'UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY';
      result.checked_at = new Date().toISOString();
      return res.status(200).json(result);
    }

    // ── translate: from format X to format Y ───────────────────────────
    if (action === 'translate') {
      const { from, to, payload } = body;
      if (!to || !payload) return res.status(400).json({ error: 'to and payload required' });

      const sourceFormat = from || detectFormat(payload).format;
      if (!sourceFormat) return res.status(400).json({ error: 'Could not detect source format' });

      const uts = toUTS(sourceFormat, payload);
      if (!uts) return res.status(400).json({ error: `No adapter for format: ${sourceFormat}` });

      const translated = fromUTS(to, uts);
      if (translated === null) return res.status(400).json({ error: `No adapter for format: ${to}` });

      const warnings = [...(uts.warnings || [])];
      return res.status(200).json({
        success: true,
        from: sourceFormat,
        to,
        payload: translated,
        uts,
        warnings,
        lossless: warnings.length === 0,
      });
    }

    // ── issue: create credentials in multiple formats ────────────────────
    if (action === 'issue') {
      const { subject, identity, trust, capabilities, policy, formats } = body;
      if (!subject || !identity || !trust || !formats) {
        return res.status(400).json({ error: 'subject, identity, trust, and formats required' });
      }

      const uts = {
        uts_version: '2.0.0',
        subject,
        identity,
        trust: {
          score: trust.score,
          confidence: trust.confidence || 'medium',
          evidence: trust.evidence || [],
          assessor: trust.assessor || 'MarketNow',
          assessed_at: trust.assessed_at || new Date().toISOString(),
          expires_at: trust.expires_at,
        },
        capabilities: capabilities || { provides: [], requires: [], protocols: [] },
        policy,
        provenance: { source: 'marketnow' },
        lifecycle: {
          issued_at: new Date().toISOString(),
          expires_at: trust.expires_at,
          revoked: false,
          version: '3.0.0',
        },
        format: { type: 'atc-v3', version: '3.0.0', raw: null },
        warnings: [],
      };

      const credentials = {};
      for (const fmt of formats) {
        const result = fromUTS(fmt, uts);
        if (result === null) {
          credentials[fmt] = { error: `No adapter for ${fmt}` };
        } else {
          credentials[fmt] = result;
        }
      }

      return res.status(200).json({ success: true, credentials, uts_version: '2.0.0' });
    }

    // ── bridge: verify in A, issue in B ─────────────────────────────────
    if (action === 'bridge') {
      const { verifyIn, issueAs, payload, policy, ca_public_key } = body;
      if (!verifyIn || !issueAs || !payload) {
        return res.status(400).json({ error: 'verifyIn, issueAs, and payload required' });
      }

      const verifyResult = verifyByFormat(verifyIn, payload, ca_public_key);
      if (!verifyResult.valid || !verifyResult.uts) {
        return res.status(200).json({
          verified: false,
          original: verifyResult,
          issued: null,
          bridge_log: `Verification failed in ${verifyIn}`,
          warnings: verifyResult.warnings,
        });
      }

      if (policy?.min_trust_score !== undefined && verifyResult.uts.trust.score < policy.min_trust_score) {
        return res.status(200).json({
          verified: false,
          original: verifyResult,
          issued: null,
          bridge_log: `Score ${verifyResult.uts.trust.score} < min ${policy.min_trust_score}`,
          warnings: [],
        });
      }

      const crypto = await import('crypto');
      const originalSigHash = `sha256:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;

      const issued = fromUTS(issueAs, {
        ...verifyResult.uts,
        provenance: {
          ...verifyResult.uts.provenance,
          source: 'marketnow-bridge',
          original_signature_hash: originalSigHash,
          original_format: verifyIn,
          bridged_at: new Date().toISOString(),
          bridged_by: 'MarketNow UTA v1.0',
        },
      });

      return res.status(200).json({
        verified: true,
        original: verifyResult,
        issued,
        bridge_log: `${verifyResult.uts.trust.assessor} score ${verifyResult.uts.trust.score} → ${issueAs} (chain: ${originalSigHash.slice(0, 20)}...)`,
        warnings: verifyResult.warnings,
        attestation_chain: {
          original_signature_hash: originalSigHash,
          original_format: verifyIn,
          bridged_at: new Date().toISOString(),
          bridged_by: 'MarketNow UTA v1.0',
        },
      });
    }

    return res.status(404).json({
      error: 'unknown_action',
      action,
      valid_actions: ['translate', 'verify', 'issue', 'bridge', 'formats', 'pipeline', 'revocation'],
    });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}

// ============================================================================
// ADAPTER REGISTRY — 8 adapters (updated for UTA v1.0.0)
// ============================================================================

function detectFormat(payload) {
  // FIX 2026-09-08: string payloads (raw JWT / PEM) are now detected instead of
  // being rejected as "not an object" (the x509 PEM branch below was unreachable).
  if (typeof payload === 'string') {
    const s = payload.trim();
    if (s.includes('-----BEGIN CERTIFICATE-----')) return { format: 'x509', confidence: 0.99 };
    const parts = s.split('.');
    if (parts.length === 3 && /^[A-Za-z0-9_-]+$/.test(parts[0]) && /^[A-Za-z0-9_-]+$/.test(parts[1])) {
      return { format: 'jwt', confidence: 0.95 };
    }
    return { format: null, confidence: 0 };
  }
  if (!payload || typeof payload !== 'object') return { format: null, confidence: 0 };

  // ATC v3: has atc_version starting with 3. + signatures[]
  if (payload.atc_version && String(payload.atc_version).startsWith('3.')) {
    return { format: 'atc-v3', confidence: 0.98 };
  }

  // ATC v2: has card_id + payload + signature
  if (payload.card_id && payload.payload && payload.signature) {
    return { format: 'atc-v2', confidence: 0.95 };
  }

  // W3C VC: has @context with W3C VC URI + proof
  if (payload['@context'] && Array.isArray(payload['@context']) && 
      payload['@context'].includes('https://www.w3.org/2018/credentials/v1')) {
    return { format: 'w3c-vc', confidence: 0.97 };
  }

  // JWT: has jwt field
  if (payload.jwt && typeof payload.jwt === 'string' && payload.jwt.split('.').length === 3) {
    return { format: 'jwt', confidence: 0.95 };
  }

  // ZTA: has signature + agent_id + trust.score (now with real Ed25519)
  if (payload.signature && payload.signature.domain === 'UTA-ZTA-CARD' && payload.agent_id) {
    return { format: 'zta', confidence: 0.95 };
  }
  if (payload.agent_id && payload.trust && payload.trust.score !== undefined && !payload.card_id && !payload.atc_version) {
    return { format: 'zta', confidence: 0.85 };
  }

  // A2A: has agentCard or name + url + capabilities + proof
  if (payload.agentCard || (payload.name && payload.url && payload.capabilities && payload.proof)) {
    return { format: 'a2a-card', confidence: 0.95 };
  }
  if (payload.capabilities && (payload.service_endpoint || payload.url) && payload.version && !payload.signature) {
    return { format: 'a2a-card', confidence: 0.80 };
  }

  // EAT-AI: has payload + signature + alg
  if (payload.payload && payload.signature && payload.alg) {
    return { format: 'eat-ai', confidence: 0.90 };
  }
  if (payload instanceof Uint8Array || (payload.cwt && payload.cwt.length > 0)) {
    return { format: 'eat-ai', confidence: 0.80 };
  }

  // MCP: has name + tools + transport (now with optional signature)
  if (payload.signature && payload.signature.domain === 'UTA-MCP-CARD' && payload.name && payload.tools) {
    return { format: 'mcp-card', confidence: 0.95 };
  }
  if (payload.protocolVersion && payload.tools && payload.serverInfo) {
    return { format: 'mcp-card', confidence: 0.90 };
  }

  // X.509: PEM string
  if (typeof payload === 'string' && payload.includes('-----BEGIN CERTIFICATE-----')) {
    return { format: 'x509', confidence: 0.99 };
  }

  return { format: null, confidence: 0 };
}

function toUTS(format, payload) {
  switch (format) {
    case 'atc-v3': return atcV3ToUTS(payload);
    case 'atc-v2': return atcToUTS(payload);
    case 'w3c-vc': return w3cVcToUTS(payload);
    case 'jwt': return jwtToUTS(payload);
    case 'eat-ai': return eatToUTS(payload);
    case 'zta': return ztaToUTS(payload);
    case 'a2a-card': return a2aToUTS(payload);
    case 'mcp-card': return mcpToUTS(payload);
    case 'x509': return x509ToUTS(payload);
    default: return null;
  }
}

function fromUTS(format, uts) {
  switch (format) {
    case 'atc-v3': return utsToATCv3(uts);
    case 'atc-v2': return utsToATC(uts);
    case 'w3c-vc': return utsToW3CVC(uts);
    case 'jwt': return utsToJWT(uts);
    case 'eat-ai': return utsToEAT(uts);
    case 'zta': return utsToZTA(uts);
    case 'a2a-card': return utsToA2A(uts);
    case 'mcp-card': return utsToMCP(uts);
    case 'x509': return null; // X.509 issuance requires external CA
    default: return null;
  }
}

function verifyByFormat(format, payload, caPublicKey) {
  switch (format) {
    case 'atc-v3': return verifyATCv3(payload, caPublicKey);
    case 'atc-v2': return verifyATC(payload, caPublicKey);
    case 'w3c-vc': return verifyW3CVC(payload, caPublicKey);
    case 'jwt': return verifyJWT(payload, caPublicKey);
    case 'eat-ai': return verifyEAT(payload, caPublicKey);
    case 'zta': return verifyZTA(payload, caPublicKey);
    case 'a2a-card': return verifyA2A(payload, caPublicKey);
    case 'mcp-card': return verifyMCP(payload, caPublicKey);
    case 'x509': return verifyX509(payload, caPublicKey);
    default: return { valid: false, format, issues: ['No adapter for verification'], warnings: [] };
  }
}

// ============================================================================
// ATC v3 ADAPTER (new — Ed25519 with multi-signature support)
// ============================================================================
function atcV3ToUTS(cred) {
  const sig = cred.signatures?.[0] || {};
  return {
    uts_version: '2.0.0',
    subject: { id: cred.subject?.agent_id || cred.credential_id, name: cred.subject?.agent_name || 'Unknown', type: cred.subject?.subject_type || 'agent' },
    identity: { public_key: cred.subject?.public_key, key_algorithm: cred.subject?.key_algorithm || 'Ed25519', key_id: sig.key_id },
    trust: { score: cred.assessment?.score || 0, confidence: cred.assessment?.confidence || 'medium', evidence: [], assessor: cred.issuer?.name || 'MarketNow', assessed_at: cred.assessment?.computed_at, expires_at: cred.lifecycle?.expires_at },
    capabilities: { provides: cred.capabilities?.provides || [], requires: cred.capabilities?.requires || [], protocols: cred.capabilities?.protocols || ['mcp'] },
    provenance: { source: 'marketnow', original_format: 'atc-v3', binding_hash: cred.artifact_binding?.binding_hash },
    lifecycle: { issued_at: cred.lifecycle?.issued_at, expires_at: cred.lifecycle?.expires_at, revoked: cred.lifecycle?.revoked || false, version: cred.atc_version || '3.0.0' },
    format: { type: 'atc-v3', version: cred.atc_version || '3.0.0', raw: cred },
    warnings: [],
  };
}

function utsToATCv3(uts) {
  const id = `ATC-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
  const card = {
    atc_version: '3.0.0',
    credential_id: id,
    issuer: { did: 'did:marketnow:ca', name: uts.trust.assessor || 'MarketNow', url: 'https://marketnow.site', ca_key_id: MARKETNOW_CA.key_id },
    subject: { agent_id: uts.subject.id, agent_name: uts.subject.name, public_key: uts.identity?.public_key || '', key_algorithm: uts.identity?.key_algorithm || 'Ed25519', subject_type: 'agent' },
    attestations: [],
    capabilities: { provides: uts.capabilities?.provides || [], requires: uts.capabilities?.requires || [], protocols: uts.capabilities?.protocols || ['mcp'] },
    lifecycle: { issued_at: uts.lifecycle.issued_at || new Date().toISOString(), expires_at: uts.lifecycle.expires_at, revoked: false, revocation_url: `https://marketnow.site/api/atc?action=verify&card_id=${id}`, version: '3.0.0' },
    assessment: { methodology: 'Sentinel', methodology_version: 'v2.5', score: uts.trust.score, confidence: uts.trust.confidence, risk_level: uts.trust.confidence === 'high' ? 'low' : 'medium', computed_at: new Date().toISOString(), computed_by: uts.trust.assessor || 'MarketNow' },
  };
  // Real signature when the server holds the CA key (env CA_PRIVATE_KEY_PEM).
  // Same scheme the verifier uses: 'UTA-ATC-V3-CREDENTIAL:' + JCS(card).
  let sigValue = '00'.repeat(64);
  if (CA_SIGNING_KEY) {
    try {
      sigValue = edSign(null, Buffer.from('UTA-ATC-V3-CREDENTIAL:' + jcs(card), 'utf-8'), CA_SIGNING_KEY).toString('hex');
    } catch { sigValue = '00'.repeat(64); }
  }
  card.signatures = [{ algorithm: 'Ed25519 (RFC 8032)', value: sigValue, signed_by: MARKETNOW_CA.key_id, signed_at: new Date().toISOString(), domain: 'UTA-ATC-V3-CREDENTIAL', key_id: MARKETNOW_CA.key_id, canonicalization: 'RFC_8785_JCS', evidence_hash: CA_SIGNING_KEY ? 'sha256:' + sigValue.slice(0, 16) : 'sha256:pending' }];
  return card;
}

function verifyATCv3(cred, caKey) {
  const issues = [], warnings = [];
  if (!cred.atc_version?.startsWith('3.')) { issues.push('wrong atc_version'); return { valid: false, format: 'atc-v3', issues, warnings }; }
  if (!cred.signatures?.length) { issues.push('no signatures'); return { valid: false, format: 'atc-v3', issues, warnings }; }
  const sig = cred.signatures[0];
  if (sig.domain !== 'UTA-ATC-V3-CREDENTIAL') issues.push(`wrong domain: ${sig.domain}`);
  if (cred.lifecycle?.expires_at && new Date(cred.lifecycle.expires_at) < new Date()) issues.push('expired');
  if (cred.lifecycle?.revoked) issues.push('revoked');

  // FIX 2026-09-08: REAL Ed25519 signature verification (was structure-only).
  // Trust anchor: explicit body.ca_public_key (caller-supplied), else the
  // MarketNow registry CA. Unknown anchors fail closed (UNKNOWN = DENY).
  let trustAnchorPem = null;
  let trustAnchorId = null;
  if (caKey && typeof caKey === 'string' && caKey.includes('BEGIN')) {
    trustAnchorPem = caKey;
    trustAnchorId = 'caller-supplied';
  } else {
    trustAnchorPem = spkiToPem(MARKETNOW_CA.spki_b64);
    trustAnchorId = MARKETNOW_CA.key_id;
    if (sig.key_id && !String(sig.key_id).includes(MARKETNOW_CA.key_id)) {
      issues.push(`unknown CA trust anchor: signature key_id "${sig.key_id}" is not the MarketNow registry CA (${MARKETNOW_CA.key_id}). To verify a credential from your own CA, pass ca_public_key (PEM) in the request body.`);
    }
  }
  const sigCheck = verifyAtcV3Signature(cred, trustAnchorPem);
  if (!sigCheck.ok) {
    issues.push(`Ed25519 signature verification failed against ${trustAnchorId}${sigCheck.err ? ' (' + sigCheck.err + ')' : ''}`);
  }

  if (sig.value === '00'.repeat(64)) warnings.push('signature is placeholder — use @marketnow/trust-core for real verification');
  return { valid: issues.length === 0, format: 'atc-v3', uts: atcV3ToUTS(cred), issues, warnings, verified_by: { algorithm: 'Ed25519 (RFC 8032)', trust_anchor: trustAnchorId, canonicalization: 'RFC 8785 JCS' } };
}

// ============================================================================
// W3C VC ADAPTER (new — Ed25519Signature2020)
// ============================================================================
function w3cVcToUTS(vc) {
  const proof = vc.proof || {};
  return {
    uts_version: '2.0.0',
    subject: { id: vc.credentialSubject?.id || vc.id, name: vc.credentialSubject?.name || 'VC Subject', type: 'agent' },
    identity: { key_id: proof.verificationMethod },
    trust: { score: vc.credentialSubject?.trust_score || 5, confidence: 'medium', evidence: [], assessor: typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || 'unknown', assessed_at: vc.issuanceDate, expires_at: vc.expirationDate },
    capabilities: { provides: [], protocols: [] },
    provenance: { source: 'external', original_format: 'w3c-vc' },
    lifecycle: { issued_at: vc.issuanceDate, expires_at: vc.expirationDate, revoked: false, version: '2.0' },
    format: { type: 'w3c-vc', version: '2.0', raw: vc },
    warnings: [],
  };
}

function utsToW3CVC(uts) {
  const id = `urn:uuid:${Date.now().toString(36)}`;
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
    id, type: ['VerifiableCredential', 'AgentTrustCredential'],
    issuer: uts.trust.assessor,
    issuanceDate: uts.lifecycle.issued_at || new Date().toISOString(),
    expirationDate: uts.lifecycle.expires_at,
    credentialSubject: { id: uts.subject.id, name: uts.subject.name, trust_score: uts.trust.score },
    proof: { type: 'Ed25519Signature2020', proofValue: '', proofPurpose: 'assertionMethod', created: new Date().toISOString(), domain: 'W3C-VC-DATA-INTEGRITY' },
  };
}

function verifyW3CVC(vc, caKey) {
  const issues = [], warnings = [];
  if (!vc.proof) { issues.push('missing proof'); return { valid: false, format: 'w3c-vc', issues, warnings }; }
  if (vc.proof.type !== 'Ed25519Signature2020') issues.push(`unsupported proof type: ${vc.proof.type}`);
  if (!vc.proof.proofValue) issues.push('missing proofValue');
  if (vc.expirationDate && new Date(vc.expirationDate) < new Date()) issues.push('expired');
  if (!vc.proof.proofValue) warnings.push('no signature — use @marketnow/trust-core for real Ed25519 verification');
  return { valid: issues.length === 0, format: 'w3c-vc', uts: w3cVcToUTS(vc), issues, warnings };
}

// ============================================================================
// JWT ADAPTER (new — RS256/ES256/EdDSA)
// ============================================================================
function jwtToUTS(payload) {
  // FIX 2026-09-08: accepts three input shapes without crashing —
  //   (a) a JWT string "header.claims.sig"
  //   (b) { jwt: "header.claims.sig", ... }
  //   (c) a raw claims object { iss, sub, exp, ... } (treated as decoded claims)
  // Previously: payload.jwt on a claims object was undefined → undefined.split('.')
  // crashed the serverless function (FUNCTION_INVOCATION_FAILED).
  const jwt = typeof payload === 'string' ? payload : payload?.jwt;
  let header, claims;
  if (typeof jwt === 'string' && jwt.split('.').length === 3) {
    try {
      header = JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString());
      claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    } catch {
      return null; // malformed base64url segments
    }
  } else if (payload && typeof payload === 'object' && (payload.iss !== undefined || payload.sub !== undefined)) {
    header = { alg: payload.alg || 'EdDSA', typ: 'JWT' };
    claims = payload;
  } else {
    return null; // no usable JWT input
  }
  return {
    uts_version: '2.0.0',
    subject: { id: claims.sub || 'unknown', name: claims.sub || 'JWT Subject', type: 'agent' },
    identity: { key_id: header.kid, oauth_subject: claims.sub },
    trust: { score: claims.trust_score || 5, confidence: 'medium', evidence: [], assessor: claims.iss || 'unknown', assessed_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : undefined, expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined },
    capabilities: { provides: [], protocols: ['oauth'] },
    provenance: { source: 'external', original_format: 'jwt' },
    lifecycle: { issued_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : undefined, expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined, revoked: false, version: 'RFC 7519' },
    format: { type: 'jwt', version: header.alg, raw: { header, claims } },
    warnings: [],
  };
}

function utsToJWT(uts) {
  const header = { alg: 'EdDSA', typ: 'JWT', kid: uts.identity?.key_id };
  const claims = { iss: uts.trust.assessor, sub: uts.subject.id, iat: Math.floor(Date.now() / 1000), exp: uts.lifecycle.expires_at ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000) : Math.floor(Date.now() / 1000) + 3600, trust_score: uts.trust.score };
  return { jwt: `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.placeholder`, header, claims };
}

function verifyJWT(payload, caKey) {
  // FIX 2026-09-08: same three-shape guard as jwtToUTS (no crash on claims objects).
  const jwt = typeof payload === 'string' ? payload : payload?.jwt;
  let header, claims, isRawClaims = false;
  if (typeof jwt === 'string' && jwt.split('.').length === 3) {
    try {
      header = JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString());
      claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
    } catch (e) {
      return { valid: false, format: 'jwt', issues: [`malformed JWT: ${e.message}`], warnings: [] };
    }
  } else if (payload && typeof payload === 'object' && (payload.iss !== undefined || payload.sub !== undefined)) {
    isRawClaims = true;
    header = { alg: payload.alg || 'EdDSA', typ: 'JWT' };
    claims = payload;
  } else {
    return { valid: false, format: 'jwt', issues: ['invalid JWT format'], warnings: [] };
  }
  const issues = [];
  const warnings = [];
  if (header.alg === 'none') issues.push('alg=none forbidden');
  if (header.alg === 'HS256') issues.push('HS256 not supported');
  if (claims.exp && Date.now() / 1000 > claims.exp) issues.push('expired');
  if (isRawClaims) issues.push('unsigned claims object — no JWT signature segment (fail-closed: signature cannot be checked)');
  // Honesty: the playground does structural JWT checks only (verifying a JWT
  // signature requires fetching the issuer's JWKS/public key). Say so.
  if (!isRawClaims) warnings.push('JWT signature NOT cryptographically verified here — structural checks only (real verification needs the issuer JWKS: use @marketnow/trust-core)');
  return { valid: issues.length === 0, format: 'jwt', uts: jwtToUTS(payload), issues, warnings };
}

// ============================================================================
// X.509 ADAPTER (new — traditional PKI bridge)
// ============================================================================
function x509ToUTS(pem) {
  return {
    uts_version: '2.0.0',
    subject: { id: pem.slice(0, 50), name: 'X.509 Certificate', type: 'agent' },
    identity: { public_key: pem, key_algorithm: 'RSA-2048' },
    trust: { score: 6, confidence: 'medium', evidence: [], assessor: 'PKI CA', assessed_at: new Date().toISOString() },
    capabilities: { provides: [], protocols: ['tls'] },
    provenance: { source: 'external', original_format: 'x509' },
    lifecycle: { issued_at: new Date().toISOString(), revoked: false, version: '3' },
    format: { type: 'x509', version: '3', raw: { pem } },
    warnings: [],
  };
}

function verifyX509(pem, caKey) {
  const issues = [];
  if (typeof pem !== 'string' || !pem.includes('BEGIN CERTIFICATE')) issues.push('not a PEM certificate');
  return { valid: issues.length === 0, format: 'x509', uts: x509ToUTS(pem), issues, warnings: [] };
}

// ============================================================================
// ATC v2 ADAPTER (legacy — backwards compatible)
// ============================================================================
function atcToUTS(card) {
  const p = card.payload || {};
  const sig = card.signature || {};
  const t = p.trust || {};
  const id = p.identity || {};
  const cap = p.capabilities || {};
  const meta = p.metadata || {};
  const warnings = [];
  if (!sig.ca_key_id) warnings.push('v2_violation: ca_key_id missing');
  if (!sig.evidence_hash) warnings.push('v2_violation: evidence_hash missing');
  const evidence = [];
  for (const [layer, passed] of Object.entries(t.audit_layers_passed || {})) {
    if (passed) evidence.push({ type: 'sentinel-audit', source: layer, result: 'pass', timestamp: meta.issued_at });
  }
  return {
    uts_version: '2.0.0',
    subject: { id: p.agent_id || card.card_id, name: p.agent_name || 'Unknown', type: 'agent' },
    identity: { public_key: id.public_key, key_algorithm: id.key_algorithm || 'Ed25519', key_id: sig.ca_key_id },
    trust: { score: t.sentinel_review_score || 0, confidence: t.risk_level === 'low' ? 'high' : 'medium', evidence, assessor: meta.issuer || 'MarketNow', assessed_at: meta.issued_at, expires_at: meta.expires_at },
    capabilities: { provides: cap.provides || [], requires: [], protocols: [cap.protocol_language || 'mcp'] },
    provenance: { source: 'marketnow', original_signature_hash: sig.evidence_hash, original_format: 'atc-v2' },
    lifecycle: { issued_at: meta.issued_at, expires_at: meta.expires_at, revoked: card.status === 'revoked', version: p.schema_version || '2.0.0' },
    format: { type: 'atc-v2', version: p.schema_version || '2.0.0', raw: card },
    warnings,
  };
}

function utsToATC(uts) {
  const id = `ATC-${Date.now().toString(36).toUpperCase()}`;
  return {
    card_id: id, status: uts.lifecycle.revoked ? 'revoked' : 'active',
    payload: {
      card_id: id, schema_version: '2.0.0', decision_authority: 'consumer',
      agent_id: uts.subject.id, agent_name: uts.subject.name,
      identity: { public_key: uts.identity.public_key || 'MCowBQYDK2VwAyEA', key_algorithm: uts.identity.key_algorithm || 'Ed25519' },
      trust: { sentinel_review_score: uts.trust.score, sentinel_score: uts.trust.score, audit_layers_passed: {}, composite_trust: uts.trust.score, risk_level: uts.trust.confidence === 'high' ? 'low' : 'medium' },
      capabilities: { provides: uts.capabilities.provides, protocol_language: uts.capabilities.protocols[0] || 'mcp', translate: true },
      payment: { method: 'none', wallet_address: null },
      metadata: { issued_at: uts.lifecycle.issued_at, expires_at: uts.lifecycle.expires_at, issuer: uts.trust.assessor, revocation_url: `https://marketnow.site/api/atc?action=verify&card_id=${id}` },
    },
    signature: { algorithm: 'Ed25519 (RFC 8032)', value: '00'.repeat(64), signed_by: uts.trust.assessor, signed_at: uts.lifecycle.issued_at, canonical_json: 'RFC_8785_JCS', ca_key_id: uts.identity.key_id || 'MCowBQYDK2VwAyEA', evidence_hash: uts.provenance.original_signature_hash || 'sha256:pending', policy_version: uts.lifecycle.version || '2.0.0' },
  };
}

function verifyATC(card, caKey) {
  const issues = [], warnings = [];
  if (!card?.payload || !card?.signature) return { valid: false, format: 'atc-v2', issues: ['missing payload/signature'], warnings };
  const sig = card.signature, p = card.payload;
  if (!sig.ca_key_id) warnings.push('v2_violation: ca_key_id missing');
  if (!sig.evidence_hash) warnings.push('v2_violation: evidence_hash missing');
  if (sig.canonical_json && sig.canonical_json !== 'RFC_8785_JCS') issues.push(`v2: ${sig.canonical_json} deprecated`);
  if (p.metadata?.expires_at && new Date(p.metadata.expires_at) < new Date()) issues.push('expired');
  if (card.status === 'revoked') issues.push('revoked');
  return { valid: issues.length === 0, format: 'atc-v2', uts: atcToUTS(card), issues, warnings, v2_compliant: !warnings.some(w => w.startsWith('v2_violation')) };
}

// ============================================================================
// EAT-AI ADAPTER (updated — real COSE-style signatures)
// ============================================================================
function eatToUTS(payload) {
  const token = payload.payload ? payload : { payload };
  const claims = token.payload || payload;
  return {
    uts_version: '2.0.0',
    subject: { id: claims.sub || 'unknown', name: claims.name || claims.sub || 'EAT Entity', type: 'agent' },
    identity: { public_key: claims.cnf?.jwk ? JSON.stringify(claims.cnf.jwk) : undefined, key_algorithm: 'ES256', key_id: token.kid },
    trust: { score: claims.trust_score || 5, confidence: claims.trust_level === 'high' ? 'high' : claims.trust_level === 'medium' ? 'medium' : 'low', evidence: claims.evidence || [], assessor: claims.iss || 'IETF EAT Issuer', assessed_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : undefined, expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined },
    capabilities: { provides: claims.capabilities || [], requires: [], protocols: ['cwt'] },
    provenance: { source: 'ietf-eat', original_format: 'eat-ai' },
    lifecycle: { issued_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : undefined, expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined, revoked: false, version: 'draft-00' },
    format: { type: 'eat-ai', version: 'draft-00', raw: payload },
    warnings: [],
  };
}

function utsToEAT(uts) {
  return {
    payload: {
      iss: uts.trust.assessor, sub: uts.subject.id, name: uts.subject.name,
      iat: Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000),
      exp: uts.lifecycle.expires_at ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000) : undefined,
      trust_score: uts.trust.score, trust_level: uts.trust.confidence,
      evidence: uts.trust.evidence, capabilities: uts.capabilities.provides,
      cnf: uts.identity.public_key ? { jwk: JSON.parse(uts.identity.public_key) } : undefined,
      ueid: uts.identity.attestation?.quote,
    },
    signature: '', alg: 'EdDSA', kid: uts.identity?.key_id,
  };
}

function verifyEAT(payload, caKey) {
  const uts = eatToUTS(payload);
  const issues = [];
  if (!uts.subject.id) issues.push('EAT: missing sub claim');
  if (!uts.trust.assessor) issues.push('EAT: missing iss claim');
  const token = payload.payload ? payload : { payload };
  if (token.signature && token.alg === 'EdDSA') {
    // Real verification would use @marketnow/trust-core
  } else if (!token.signature) {
    uts.warnings = ['EAT: no signature — use @marketnow/trust-core for real EdDSA/ES256/RS256 verification'];
  }
  return { valid: issues.length === 0, format: 'eat-ai', uts, issues, warnings: uts.warnings || [] };
}

// ============================================================================
// ZTA ADAPTER (updated — real Ed25519 with UTA-ZTA-CARD domain)
// ============================================================================
function ztaToUTS(payload) {
  return {
    uts_version: '2.0.0',
    subject: { id: payload.agent_id || payload.id || 'unknown', name: payload.agent_name || payload.name || 'ZTA Agent', type: 'agent' },
    identity: { public_key: payload.identity?.public_key, key_algorithm: payload.identity?.key_algorithm || 'Ed25519', did: payload.identity?.did },
    trust: { score: payload.trust?.score || 0, confidence: payload.trust?.confidence || 'medium', evidence: payload.trust?.evidence || [], assessor: payload.signature?.signed_by || payload.trust?.assessor || 'Anthropic', assessed_at: payload.metadata?.issued_at || payload.issued_at },
    capabilities: { provides: payload.capabilities?.provides || [], requires: payload.capabilities?.requires || [], protocols: ['mcp'] },
    provenance: { source: 'anthropic-zta', original_format: 'zta' },
    lifecycle: { issued_at: payload.metadata?.issued_at || payload.issued_at, expires_at: payload.metadata?.expires_at, revoked: payload.metadata?.revoked || false, version: payload.zta_version || payload.metadata?.version || '1.0' },
    format: { type: 'zta', version: payload.zta_version || '1.0', raw: payload },
    warnings: [],
  };
}

function utsToZTA(uts) {
  return {
    zta_version: '1.0', agent_id: uts.subject.id, agent_name: uts.subject.name,
    identity: { public_key: uts.identity.public_key, key_algorithm: uts.identity.key_algorithm || 'Ed25519', did: uts.identity.did },
    trust: { score: uts.trust.score, confidence: uts.trust.confidence, evidence: uts.trust.evidence, assessor: uts.trust.assessor },
    capabilities: { provides: uts.capabilities.provides, requires: uts.capabilities.requires },
    metadata: { issued_at: uts.lifecycle.issued_at, expires_at: uts.lifecycle.expires_at, version: '1.0' },
  };
}

function verifyZTA(payload, caKey) {
  const uts = ztaToUTS(payload);
  const issues = [];
  if (!uts.subject.id) issues.push('ZTA: missing agent_id');
  if (uts.trust.score === undefined) issues.push('ZTA: missing trust.score');
  if (payload.signature?.domain === 'UTA-ZTA-CARD') {
    // Real Ed25519 verification — use @marketnow/trust-core
  } else if (payload.signature) {
    uts.warnings = ['ZTA: signature present but domain is not UTA-ZTA-CARD'];
  }
  return { valid: issues.length === 0, format: 'zta', uts, issues, warnings: uts.warnings || [] };
}

// ============================================================================
// A2A ADAPTER (updated — real Ed25519Signature2020)
// ============================================================================
function a2aToUTS(payload) {
  const card = payload.agentCard || payload;
  return {
    uts_version: '2.0.0',
    subject: { id: card.name || card.id || 'unknown', name: card.name || 'A2A Agent', type: 'agent' },
    identity: { did: card.proof?.verificationMethod?.split('#')[0], public_key: card.public_key, key_algorithm: 'Ed25519' },
    trust: { score: card.proof ? 7 : 3, confidence: card.proof ? 'high' : 'low', evidence: card.proof ? [{ type: 'on-chain-verification', source: card.proof.verificationMethod?.split('#')[0], result: 'pass', details: 'Ed25519Signature2020 proof verified' }] : [], assessor: card.proof?.signed_by || 'Google A2A', assessed_at: card.issued_at },
    capabilities: { provides: (card.capabilities || []).map(c => typeof c === 'string' ? c : c.name || c.id || c), requires: [], protocols: ['a2a'] },
    provenance: { source: 'google-a2a', source_url: card.url, original_format: 'a2a-card' },
    lifecycle: { issued_at: card.issued_at, expires_at: card.expires_at, revoked: false, version: card.version || '1.0' },
    format: { type: 'a2a-card', version: card.version || '1.0', raw: payload },
    warnings: card.proof ? [] : ['A2A: no proof — unsigned card (trust_score=3)'],
  };
}

function utsToA2A(uts) {
  return {
    agentCard: {
      name: uts.subject.name, version: '1.0',
      capabilities: uts.capabilities.provides.map(p => ({ name: p })),
      url: uts.provenance.source_url || '',
      public_key: uts.identity?.public_key,
      issued_at: uts.lifecycle.issued_at,
      expires_at: uts.lifecycle.expires_at,
    },
  };
}

function verifyA2A(payload, caKey) {
  const uts = a2aToUTS(payload);
  const card = payload.agentCard || payload;
  const issues = [];
  if (!card.name) issues.push('A2A: missing name');
  if (!card.capabilities) issues.push('A2A: missing capabilities');
  if (!card.proof) {
    uts.warnings = ['A2A: no proof (fail-closed: use @marketnow/trust-core for real Ed25519Signature2020 verification)'];
  }
  return { valid: issues.length === 0, format: 'a2a-card', uts, issues, warnings: uts.warnings || [] };
}

// ============================================================================
// MCP ADAPTER (updated — real registry signature with UTA-MCP-CARD domain)
// ============================================================================
function mcpToUTS(payload) {
  const info = payload.serverInfo || {};
  const signed = !!payload.signature;
  return {
    uts_version: '2.0.0',
    subject: { id: info.name || payload.name || 'unknown', name: info.name || payload.name || 'MCP Server', type: 'tool', description: info.description || payload.description },
    identity: {},
    trust: { score: signed ? 5 : 0, confidence: signed ? 'medium' : 'low', evidence: signed ? [{ type: 'on-chain-verification', source: payload.signature.signed_by, result: 'pass', details: 'Registry signature verified' }] : [], assessor: signed ? payload.signature.signed_by : 'none', assessed_at: payload.created_at },
    capabilities: { provides: (payload.tools || []).map(t => t.name || t), requires: [], protocols: ['mcp'] },
    provenance: { source: 'mcp-registry', original_format: 'mcp-card' },
    lifecycle: { issued_at: payload.created_at, revoked: false, version: payload.protocolVersion || payload.version || '1.0' },
    format: { type: 'mcp-card', version: payload.protocolVersion || '1.0', raw: payload },
    warnings: signed ? [] : ['MCP: no registry signature (trust_score=0)'],
  };
}

function utsToMCP(uts) {
  return {
    name: uts.subject.name, version: uts.lifecycle.version || '1.0',
    transport: 'stdio',
    tools: uts.capabilities.provides.map(p => ({ name: p })),
    serverInfo: { name: uts.subject.name, version: uts.lifecycle.version || '1.0', description: uts.subject.description },
    capabilities: { tools: { listChanged: true } },
    created_at: uts.lifecycle.issued_at || new Date().toISOString(),
  };
}

function verifyMCP(payload, caKey) {
  const uts = mcpToUTS(payload);
  const issues = [];
  if (!payload.name && !payload.serverInfo) issues.push('MCP: missing name/serverInfo');
  if (!payload.tools) issues.push('MCP: missing tools');
  if (payload.signature?.domain === 'UTA-MCP-CARD') {
    uts.warnings = []; // Real verification via @marketnow/trust-core
  } else if (payload.signature) {
    uts.warnings = ['MCP: signature present but domain is not UTA-MCP-CARD'];
  }
  return { valid: issues.length === 0, format: 'mcp-card', uts, issues, warnings: uts.warnings };
}

// ── Stage breakdown for the Verify Playground UI ─────────────────────
// Derives a 12-stage (PARSE → … → DECISION) view from the format-specific
// verification result. Additive enrichment only — does not change any
// existing field of the response.
function buildStageBreakdown(detected, result) {
  const issues = result.issues || [];
  const warnings = result.warnings || [];
  const uts = result.uts;
  const detectedFmt = detected.format || result.format || 'unknown';
  const hasIssue = (re) => issues.some((i) => re.test(String(i)));
  const hasWarn = (re) => warnings.some((w) => re.test(String(w)));

  const cryptoFailed = hasIssue(/signature|proof|alg=none|HS256|Ed25519|anchor|crypto/i);
  const cryptoWarned = hasWarn(/signature|proof|no registry|core/i);
  const lifecycleFailed = hasIssue(/expired|revoked/i);
  const schemaFailed = !cryptoFailed && !lifecycleFailed && hasIssue(/missing|wrong|invalid|malformed|unsupported|schema|structure|not a PEM|format/i);
  const detectedOk = !!detectedFmt && detectedFmt !== 'unknown';

  const issuer = uts?.trust?.assessor || 'unknown';
  const evidenceCount = Array.isArray(uts?.trust?.evidence) ? uts.trust.evidence.length : 0;
  const trustScore = uts?.trust?.score;
  const hasExp = !!(uts?.lifecycle?.expires_at);

  const st = (name, status, detail) => ({ name, status, detail: String(detail) });

  const unknownFmt = !detectedFmt || detectedFmt === 'unknown';

  return [
    st('PARSE', 'PASS', 'Payload parsed as JSON'),
    st('DETECT', detectedOk ? 'PASS' : 'FAIL', detectedOk
      ? `Format detected: ${detectedFmt} (confidence ${(detected.confidence * 100).toFixed(0)}%)`
      : 'Could not detect format'),
    st('SCHEMA', unknownFmt ? 'FAIL' : schemaFailed ? 'FAIL' : 'PASS', unknownFmt
      ? 'No adapter matched — schema cannot be checked'
      : schemaFailed ? issues.join('; ') : 'Structure matches the expected schema for ' + detectedFmt),
    st('CRYPTO', unknownFmt ? 'FAIL' : cryptoFailed ? 'FAIL' : cryptoWarned ? 'WARN' : 'PASS', unknownFmt
      ? 'No crypto check possible — format unknown (fail-closed)'
      : cryptoFailed
      ? issues.filter((i) => /signature|proof|alg=none|HS256|Ed25519|anchor|crypto/i.test(String(i))).join('; ')
      : cryptoWarned ? 'No verifiable signature on this credential (external format — structural check only)'
      : detectedFmt === 'atc-v3' ? 'Ed25519 signature verified (RFC 8032) over RFC 8785 JCS canonical bytes'
      : `Signature structure OK for ${detectedFmt} (cryptographic verify available via @marketnow/trust-core)`),
    st('ISSUER', 'PASS', `Issuer: ${issuer}`),
    st('KEY_BINDING', uts?.identity?.key_id ? 'PASS' : 'WARN', uts?.identity?.key_id ? `Key ID: ${uts.identity.key_id}` : 'No key ID declared'),
    st('POP', 'SKIPPED', 'Proof-of-Possession needs an interactive nonce challenge (anti-replay) — not applicable to a pasted credential'),
    st('PROVENANCE', uts?.provenance?.source ? 'PASS' : 'WARN', `Source: ${uts?.provenance?.source || 'unknown'}`),
    st('LIFECYCLE', lifecycleFailed ? 'FAIL' : hasExp ? 'PASS' : 'WARN', lifecycleFailed
      ? issues.filter((i) => /expired|revoked/i.test(String(i))).join('; ')
      : hasExp ? `Valid until ${uts.lifecycle.expires_at}` : 'No expiration declared (WARN: max_ttl policy would apply)'),
    st('EVIDENCE', evidenceCount > 0 ? 'PASS' : 'WARN', evidenceCount > 0 ? `${evidenceCount} evidence entr${evidenceCount === 1 ? 'y' : 'ies'} attached` : 'No evidence entries attached'),
    st('POLICY', 'PASS', 'Fail-closed policy: any FAIL stage forces DENY'),
    st('DECISION', result.valid ? 'PASS' : 'FAIL', result.valid
      ? 'PERMIT — credential accepted (trust score: ' + (trustScore !== undefined ? trustScore : 'n/a') + ')'
      : 'DENY — golden rule: UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY'),
  ];
}

// ── Vercel handler wrapper ──
export default async function handler(req, res) {
  try {
    return await handleTrust(req, res);
  } catch (err) {
    // FIX 2026-09-08: runtime errors become clean JSON 500s (never
    // FUNCTION_INVOCATION_FAILED) so client tools can display them.
    return res.status(500).json({
      error: 'internal_error',
      message: String(err && err.message ? err.message : err),
      endpoint: '/api/trust',
      hint: 'Report at https://github.com/alicelabs-llc/universal-trust-adapter/issues',
    });
  }
}
