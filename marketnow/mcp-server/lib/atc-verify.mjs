/**
 * ATC/1.0 Spec Verifier — self-contained, no external crypto deps
 * =================================================================
 *
 * This is the canonical ATC/1.0 conformance verifier. It accepts ANY
 * Agent Trust Card (regardless of issuer — MarketNow Sentinel CA, a
 * third-party CA, or a self-signed test CA) and verifies:
 *
 *   - ATC-001 Identity          (structural)
 *   - ATC-002 Attestation        (structural + crypto)
 *   - ATC-003 Capabilities       (structural + enum validation)
 *   - ATC-004 Evidence           (structural)
 *   - ATC-005 Risk               (structural + range)
 *   - ATC-006 Signature          (Ed25519 + RFC 8785 JCS + SHA-256)
 *   - ATC-007 Revocation         (structural — revocation LIST fetch is optional)
 *   - ATC-008 Expiration         (date window)
 *
 * Optional controls ATC-009 (Delegation) and ATC-010 (Runtime Trust)
 * are parsed if present but do not affect the verdict.
 *
 * The verifier returns a structured result:
 *   {
 *     valid: boolean,
 *     spec_version: string,
 *     controls_passed: string[],   // e.g. ['ATC-001', 'ATC-002', ...]
 *     controls_failed: string[],
 *     errors: string[],
 *     warnings: string[],
 *     card_id: string,
 *     issuer_ca_id: string,
 *     trust_score: integer | null,
 *     risk_level: string | null,
 *     expires_at: string | null,
 *   }
 *
 * License: MNNC-1.0 (AliceLabs LLC Proprietary)
 * Spec: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/SPEC.md
 */

import {
  createPublicKey,
  createHash,
  verify as edVerify,
} from 'node:crypto';
import canonicalize from 'canonicalize';

// ─── Constants ────────────────────────────────────────────────────────────────
const ATC_SPEC_VERSION = 'ATC/1.0';
const ATC_ALGORITHM = 'Ed25519';

const CARD_ID_PATTERN = /^ATC-\d{4}-\d{6,}$/;
// Ed25519 public keys can be:
//   - Raw 32 bytes (43 base64 chars + 1 padding = 44 chars)
//   - SPKI-wrapped (44 DER bytes → 60 base64 chars incl. padding, no '=' at end if length is divisible by 3)
// Accept any base64 string of length 43-90 chars (covers both formats + future algos)
const BASE64_ED25519_PUBLIC_KEY = /^[A-Za-z0-9+/]{43,90}={0,2}$/;
// Ed25519 signatures are always 64 raw bytes → 86 base64 chars + 2 padding '='
// But other algos (ML-DSA in v1.1) will produce longer signatures; accept up to 200 chars
const BASE64_SIGNATURE = /^[A-Za-z0-9+/]{86,400}={0,3}$/;
const HEX_SHA256 = /^[a-f0-9]{64}$/;

const CAPABILITY_ENUMS = {
  filesystem: {
    read: ['none', 'own_dir', 'temp_dir', 'home_dir', 'system', 'all'],
    write: ['none', 'own_dir', 'temp_dir', 'home_dir', 'system', 'all'],
  },
  network: {
    egress: ['none', 'allowlist', 'all'],
    ingress: ['none', 'bound_ports', 'all'],
  },
  shell: {
    exec: ['none', 'sandboxed', 'unrestricted'],
    spawn: ['none', 'sandboxed', 'unrestricted'],
  },
  credentials: {
    read_env: ['none', 'allowlist', 'all'],
    read_files: ['none', 'allowlist', 'all'],
  },
  process: {
    subprocess: ['none', 'sandboxed', 'unrestricted'],
    signals: ['none', 'own', 'all'],
  },
};

const REQUIRED_CONTROLS = [
  'ATC-001', 'ATC-002', 'ATC-003', 'ATC-004',
  'ATC-005', 'ATC-006', 'ATC-007', 'ATC-008',
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasFields(obj, fields) {
  return fields.every(f => obj && Object.prototype.hasOwnProperty.call(obj, f));
}

// ─── Compute the signature payload (RFC 8785 JCS) ────────────────────────────
// Per ATC-006:
//   1. Take the full ATC JSON document
//   2. Set `attestation.signature = ""` AND `attestation.signed_payload_hash = ""`
//      (both are part of the envelope, not the signed payload)
//   3. Apply RFC 8785 JCS
//   4. Compute SHA-256 → hex
function computeSignaturePayload(atc) {
  const payload = JSON.parse(JSON.stringify(atc));
  if (!payload.attestation) payload.attestation = {};
  payload.attestation.signature = '';
  payload.attestation.signed_payload_hash = '';
  return canonicalize(payload);
}

function computePayloadHash(atc) {
  return createHash('sha256').update(computeSignaturePayload(atc)).digest('hex');
}

// ─── Per-control checks ────────────────────────────────────────────────────

function check_ATC_001_identity(atc) {
  const errors = [];
  const warnings = [];
  const id = atc.identity || {};

  if (!isObject(atc.identity)) {
    errors.push('ATC-001: identity must be an object');
    return { errors, warnings };
  }
  if (!hasFields(id, ['agent_id', 'agent_name', 'agent_owner'])) {
    errors.push('ATC-001: identity must include agent_id, agent_name, agent_owner');
  }
  if (typeof id.agent_id !== 'string' || id.agent_id.length < 3 || id.agent_id.length > 128) {
    errors.push('ATC-001: identity.agent_id must be 3-128 chars');
  } else if (!/^[a-zA-Z0-9_-]+$/.test(id.agent_id)) {
    errors.push('ATC-001: identity.agent_id must be alphanumeric + hyphens/underscores only');
  }
  if (typeof id.agent_name !== 'string' || id.agent_name.length < 1 || id.agent_name.length > 100) {
    errors.push('ATC-001: identity.agent_name must be 1-100 chars');
  }
  if (typeof id.agent_owner !== 'string' || id.agent_owner.length < 1 || id.agent_owner.length > 100) {
    errors.push('ATC-001: identity.agent_owner must be 1-100 chars');
  }
  if (id.owner_contact !== undefined) {
    if (typeof id.owner_contact !== 'string' || (!id.owner_contact.startsWith('mailto:') && !id.owner_contact.startsWith('https:'))) {
      warnings.push('ATC-001: identity.owner_contact should be a mailto: or https: URL');
    }
  }
  return { errors, warnings };
}

function check_ATC_002_attestation(atc) {
  const errors = [];
  const warnings = [];
  const att = atc.attestation || {};

  if (!isObject(atc.attestation)) {
    errors.push('ATC-002: attestation must be an object');
    return { errors, warnings };
  }
  if (!hasFields(att, ['subject_public_key', 'subject_algorithm', 'signature', 'signed_payload_hash'])) {
    errors.push('ATC-002: attestation must include subject_public_key, subject_algorithm, signature, signed_payload_hash');
  }
  if (att.subject_algorithm !== ATC_ALGORITHM) {
    errors.push(`ATC-002: subject_algorithm must be '${ATC_ALGORITHM}' (got ${att.subject_algorithm})`);
  }
  if (att.ca_algorithm && att.ca_algorithm !== ATC_ALGORITHM) {
    errors.push(`ATC-002: ca_algorithm must be '${ATC_ALGORITHM}' (got ${att.ca_algorithm})`);
  }
  if (typeof att.subject_public_key === 'string' && !BASE64_ED25519_PUBLIC_KEY.test(att.subject_public_key)) {
    errors.push('ATC-002: attestation.subject_public_key is not a valid base64 Ed25519 SPKI key');
  }
  if (typeof att.signature === 'string' && !BASE64_SIGNATURE.test(att.signature)) {
    errors.push('ATC-002: attestation.signature is not a valid base64 Ed25519 signature');
  }
  if (typeof att.signed_payload_hash === 'string' && !HEX_SHA256.test(att.signed_payload_hash)) {
    errors.push('ATC-002: attestation.signed_payload_hash is not a valid hex SHA-256');
  }
  return { errors, warnings };
}

function check_ATC_003_capabilities(atc) {
  const errors = [];
  const warnings = [];
  const caps = atc.capabilities || {};

  if (!isObject(atc.capabilities)) {
    errors.push('ATC-003: capabilities must be an object');
    return { errors, warnings };
  }

  for (const [category, subFields] of Object.entries(CAPABILITY_ENUMS)) {
    if (!isObject(caps[category])) {
      errors.push(`ATC-003: capabilities.${category} must be an object`);
      continue;
    }
    for (const [field, allowedValues] of Object.entries(subFields)) {
      const v = caps[category][field];
      if (v === undefined) {
        errors.push(`ATC-003: capabilities.${category}.${field} is missing`);
      } else if (typeof v !== 'string' || !allowedValues.includes(v)) {
        errors.push(`ATC-003: capabilities.${category}.${field} must be one of: ${allowedValues.join(', ')} (got ${JSON.stringify(v)})`);
      }
    }
  }
  return { errors, warnings };
}

function check_ATC_004_evidence(atc) {
  const errors = [];
  const warnings = [];
  const ev = atc.evidence || {};

  if (!isObject(atc.evidence)) {
    errors.push('ATC-004: evidence must be an object');
    return { errors, warnings };
  }
  if (!hasFields(ev, ['audit_pipeline', 'audit_completed_at', 'static_checks', 'dynamic_checks', 'runtime_checks', 'findings'])) {
    errors.push('ATC-004: evidence must include audit_pipeline, audit_completed_at, static_checks, dynamic_checks, runtime_checks, findings');
  }
  if (ev.audit_completed_at !== undefined) {
    const dt = Date.parse(ev.audit_completed_at);
    if (isNaN(dt)) errors.push('ATC-004: evidence.audit_completed_at is not a valid ISO 8601 timestamp');
  }
  if (Array.isArray(ev.findings)) {
    for (let i = 0; i < ev.findings.length; i++) {
      const f = ev.findings[i];
      if (!isObject(f)) {
        errors.push(`ATC-004: evidence.findings[${i}] must be an object`);
        continue;
      }
      if (!hasFields(f, ['layer', 'rule_id', 'severity', 'description'])) {
        errors.push(`ATC-004: evidence.findings[${i}] must include layer, rule_id, severity, description`);
      }
      if (f.severity && !['info', 'low', 'medium', 'high', 'critical'].includes(f.severity)) {
        errors.push(`ATC-004: evidence.findings[${i}].severity must be info/low/medium/high/critical (got ${f.severity})`);
      }
    }
  }
  return { errors, warnings };
}

function check_ATC_005_risk(atc) {
  const errors = [];
  const warnings = [];
  const r = atc.risk || {};

  if (!isObject(atc.risk)) {
    errors.push('ATC-005: risk must be an object');
    return { errors, warnings };
  }
  if (!hasFields(r, ['trust_score', 'risk_level', 'decision_authority', 'score_explanation', 'scored_at'])) {
    errors.push('ATC-005: risk must include trust_score, risk_level, decision_authority, score_explanation, scored_at');
  }
  if (typeof r.trust_score !== 'number' || !Number.isInteger(r.trust_score) || r.trust_score < 0 || r.trust_score > 10) {
    errors.push('ATC-005: risk.trust_score must be an integer 0-10');
  } else {
    // Verify risk_level matches trust_score
    const expected = r.trust_score >= 8 ? 'low' : r.trust_score >= 5 ? 'medium' : r.trust_score >= 2 ? 'high' : 'critical';
    if (r.risk_level && r.risk_level !== expected) {
      warnings.push(`ATC-005: risk.risk_level='${r.risk_level}' but trust_score=${r.trust_score} implies '${expected}'`);
    }
  }
  if (r.risk_level && !['low', 'medium', 'high', 'critical'].includes(r.risk_level)) {
    errors.push(`ATC-005: risk.risk_level must be low/medium/high/critical (got ${r.risk_level})`);
  }
  // ATC/1.0 mandates decision_authority = 'consumer'
  if (r.decision_authority && r.decision_authority !== 'consumer') {
    errors.push(`ATC-005: risk.decision_authority must be 'consumer' in ATC/1.0 (got ${r.decision_authority})`);
  }
  return { errors, warnings };
}

function check_ATC_006_signature(atc, caPublicKeyBase64) {
  const errors = [];
  const warnings = [];

  // 1. Compute the canonical payload
  let canonical;
  try {
    canonical = computeSignaturePayload(atc);
  } catch (err) {
    errors.push(`ATC-006: canonicalization failed: ${err.message}`);
    return { errors, warnings };
  }

  // 2. Verify the payload hash matches what's stored
  const computedHash = createHash('sha256').update(canonical).digest('hex');
  if (computedHash !== atc.attestation?.signed_payload_hash) {
    errors.push(`ATC-006: signed_payload_hash mismatch — expected ${computedHash.slice(0, 16)}..., got ${(atc.attestation?.signed_payload_hash || '').slice(0, 16)}...`);
  }

  // 3. Determine the CA public key to use
  //    Priority: explicit argument > atc.issuer.ca_public_key
  const caKey = caPublicKeyBase64 || atc.issuer?.ca_public_key;
  if (!caKey) {
    errors.push('ATC-006: no CA public key provided (neither in argument nor in atc.issuer.ca_public_key)');
    return { errors, warnings };
  }

  // 4. Verify the Ed25519 signature
  let signatureValid = false;
  try {
    const caPublicKeyObj = createPublicKey({
      key: Buffer.from(caKey, 'base64'),
      format: 'der',
      type: 'spki',
    });
    signatureValid = edVerify(
      null,
      Buffer.from(canonical, 'utf8'),
      caPublicKeyObj,
      Buffer.from(atc.attestation.signature, 'base64')
    );
  } catch (err) {
    errors.push(`ATC-006: signature verification threw: ${err.message}`);
  }

  if (!signatureValid) {
    errors.push('ATC-006: Ed25519 signature verification failed');
  }
  return { errors, warnings };
}

function check_ATC_007_revocation(atc) {
  const errors = [];
  const warnings = [];
  const rev = atc.revocation || {};

  if (!isObject(atc.revocation)) {
    errors.push('ATC-007: revocation must be an object');
    return { errors, warnings };
  }
  if (!hasFields(rev, ['revocation_check_url', 'revocation_check_method', 'revocation_check_required'])) {
    errors.push('ATC-007: revocation must include revocation_check_url, revocation_check_method, revocation_check_required');
  }
  if (rev.revocation_check_method && !['ocsp', 'crl', 'simple_json'].includes(rev.revocation_check_method)) {
    errors.push(`ATC-007: revocation_check_method must be ocsp/crl/simple_json (got ${rev.revocation_check_method})`);
  }
  // Note: this verifier does NOT fetch the revocation list by default —
  // that would require network access in the MCP server runtime.
  // Callers can opt in to fetching by passing { fetch_revocation: true }.
  if (rev.revocation_check_required === true) {
    warnings.push('ATC-007: revocation_check_required=true but this verifier does not fetch the list by default. Caller must check separately.');
  }
  return { errors, warnings };
}

function check_ATC_008_expiration(atc) {
  const errors = [];
  const warnings = [];
  const v = atc.validity || {};

  if (!isObject(atc.validity)) {
    errors.push('ATC-008: validity must be an object');
    return { errors, warnings };
  }
  if (!hasFields(v, ['issued_at', 'expires_at', 'max_ttl_days'])) {
    errors.push('ATC-008: validity must include issued_at, expires_at, max_ttl_days');
  }

  const now = Date.now();
  const issued = Date.parse(v.issued_at);
  const expires = Date.parse(v.expires_at);

  if (isNaN(issued)) {
    errors.push('ATC-008: validity.issued_at is not a valid ISO 8601 timestamp');
  }
  if (isNaN(expires)) {
    errors.push('ATC-008: validity.expires_at is not a valid ISO 8601 timestamp');
  }
  if (typeof v.max_ttl_days !== 'number' || v.max_ttl_days < 1 || v.max_ttl_days > 365) {
    errors.push('ATC-008: validity.max_ttl_days must be 1-365');
  }

  if (!isNaN(issued) && !isNaN(expires)) {
    const ttlDays = (expires - issued) / 86400000;
    if (ttlDays > v.max_ttl_days) {
      errors.push(`ATC-008: actual TTL (${ttlDays.toFixed(1)} days) exceeds max_ttl_days (${v.max_ttl_days})`);
    }
    // Allow ±5 minutes of clock skew
    if (now < issued - 5 * 60 * 1000) {
      errors.push('ATC-008: ATC issued in the future (clock skew > 5min)');
    }
    if (now > expires + 5 * 60 * 1000) {
      errors.push('ATC-008: ATC expired (clock skew > 5min)');
    }
    if (now > expires - 7 * 86400000 && now < expires) {
      warnings.push(`ATC-008: ATC expires in less than 7 days (${Math.ceil((expires - now) / 86400000)} days)`);
    }
  }
  return { errors, warnings };
}

// ─── Top-level verifier ─────────────────────────────────────────────────────

/**
 * Verifies an ATC/1.0 card.
 *
 * @param {object} atc - The ATC JSON document to verify.
 * @param {object} [options]
 * @param {string} [options.ca_public_key] - Override the CA public key (base64 SPKI).
 *                                           If omitted, uses atc.issuer.ca_public_key.
 * @param {boolean} [options.fetch_revocation] - If true, fetches the revocation list
 *                                                (not yet implemented — emits warning).
 * @returns {object} Verification result.
 */
export function verifyATC(atc, options = {}) {
  const errors = [];
  const warnings = [];
  const controlsPassed = [];
  const controlsFailed = [];

  if (!isObject(atc)) {
    return {
      valid: false,
      spec_version: null,
      controls_passed: [],
      controls_failed: REQUIRED_CONTROLS,
      errors: ['ATC must be an object'],
      warnings: [],
      card_id: null,
      issuer_ca_id: null,
      trust_score: null,
      risk_level: null,
      expires_at: null,
    };
  }

  // Check spec_version
  if (atc.spec_version !== ATC_SPEC_VERSION) {
    errors.push(`Invalid spec_version: expected '${ATC_SPEC_VERSION}', got '${atc.spec_version}'`);
    return {
      valid: false,
      spec_version: atc.spec_version || null,
      controls_passed: [],
      controls_failed: REQUIRED_CONTROLS,
      errors,
      warnings,
      card_id: atc.card_id || null,
      issuer_ca_id: atc.issuer?.ca_id || null,
      trust_score: atc.risk?.trust_score ?? null,
      risk_level: atc.risk?.risk_level || null,
      expires_at: atc.validity?.expires_at || null,
    };
  }

  // Validate card_id format
  if (typeof atc.card_id !== 'string' || !CARD_ID_PATTERN.test(atc.card_id)) {
    errors.push(`card_id must match ${CARD_ID_PATTERN} (e.g. ATC-2026-7777670)`);
  }

  // Run per-control checks
  const checks = [
    ['ATC-001', check_ATC_001_identity(atc)],
    ['ATC-002', check_ATC_002_attestation(atc)],
    ['ATC-003', check_ATC_003_capabilities(atc)],
    ['ATC-004', check_ATC_004_evidence(atc)],
    ['ATC-005', check_ATC_005_risk(atc)],
    ['ATC-007', check_ATC_007_revocation(atc)],
    ['ATC-008', check_ATC_008_expiration(atc)],
  ];

  for (const [id, result] of checks) {
    if (result.errors.length === 0) {
      controlsPassed.push(id);
    } else {
      controlsFailed.push(id);
      errors.push(...result.errors);
    }
    warnings.push(...result.warnings);
  }

  // ATC-006 (signature) is checked last — only if ATC-002 passed (so we have a signature to verify)
  if (controlsPassed.includes('ATC-002')) {
    const sigResult = check_ATC_006_signature(atc, options.ca_public_key);
    if (sigResult.errors.length === 0) {
      controlsPassed.push('ATC-006');
    } else {
      controlsFailed.push('ATC-006');
      errors.push(...sigResult.errors);
    }
    warnings.push(...sigResult.warnings);
  } else {
    controlsFailed.push('ATC-006');
    errors.push('ATC-006: skipped because ATC-002 (attestation structure) failed');
  }

  // Optional controls — parse but don't fail
  if (atc.delegation) {
    warnings.push('ATC-009 (delegation) is present but not validated by this verifier');
  }
  if (atc.runtime_trust) {
    warnings.push('ATC-010 (runtime_trust) is present but not validated by this verifier');
  }
  if (options.fetch_revocation) {
    warnings.push('fetch_revocation=true is not yet implemented — caller must check the revocation list separately');
  }

  // Sort controls arrays for stable output
  controlsPassed.sort();
  controlsFailed.sort();

  return {
    valid: errors.length === 0,
    spec_version: atc.spec_version,
    controls_passed: controlsPassed,
    controls_failed: controlsFailed,
    errors,
    warnings,
    card_id: atc.card_id || null,
    issuer_ca_id: atc.issuer?.ca_id || null,
    issuer_ca_url: atc.issuer?.ca_url || null,
    trust_score: atc.risk?.trust_score ?? null,
    risk_level: atc.risk?.risk_level || null,
    expires_at: atc.validity?.expires_at || null,
    agent_id: atc.identity?.agent_id || null,
    agent_name: atc.identity?.agent_name || null,
  };
}
