/**
 * @marketnow/trust-adapters
 * BLOQUE E: ATC v3 — Real Issuance with Artifact Binding + Official Vectors
 *
 * Implements:
 *   - ATC v3 credential structure (multi-signature)
 *   - Real Ed25519 signing via BLOQUE B crypto
 *   - Artifact Binding (Git SHA + npm tarball + OCI digest)
 *   - Official test vectors (positive + negative + mutation)
 *   - Round-trip: issue → verify → mutate → verify breaks
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 */

import crypto from 'node:crypto';
import {
  canonicalize,
  canonicalHash,
  sign as ed25519Sign,
  verify as ed25519Verify,
  computeArtifactBinding,
  DOMAINS,
  type Ed25519KeyPair,
} from '../core/crypto.js';
import type { UTSv2 } from '../uts/index.js';

// ============================================================================
// ATC v3 Credential Structure
// ============================================================================

export interface ATCv3Credential {
  atc_version: '3.0.0';
  credential_id: string;
  issuer: ATCIssuer;
  subject: ATCSubject;
  artifact_binding?: ATCArtifactBinding;
  attestations: ATCAttestation[];
  capabilities: ATCCapabilities;
  lifecycle: ATCLifecycle;
  assessment: ATCAssessment;
  signatures: ATCSignature[];
}

export interface ATCIssuer {
  did: string;
  name: string;
  url: string;
  ca_key_id: string;
}

export interface ATCSubject {
  agent_did?: string;
  agent_id: string;
  agent_name: string;
  public_key: string;
  key_algorithm: 'Ed25519' | 'ECDSA-P256' | 'RSA-2048';
  subject_type: 'agent' | 'tool' | 'service';
}

export interface ATCArtifactBinding {
  git: { repository: string; commit_sha: string };
  npm?: { package: string; version: string; tarball_sha256: string };
  oci?: { image: string; digest: string };
  binding_hash: string;
}

export interface ATCAttestation {
  type: string;
  issuer: string;
  evidence: ATCEvidence[];
  signed_at: string;
  signature_hash: string;
}

export interface ATCEvidence {
  layer: string;
  result: 'pass' | 'fail' | 'warn';
  details: string;
  evidence_hash: string;
}

export interface ATCCapabilities {
  provides: string[];
  requires: string[];
  protocols: string[];
  rate_limits?: { requests: number; window: string };
}

export interface ATCLifecycle {
  issued_at: string;
  expires_at: string;
  revoked: boolean;
  revocation_url: string;
  version: string;
}

export interface ATCAssessment {
  methodology: string;
  methodology_version: string;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  risk_level: 'low' | 'medium' | 'high' | 'critical' | 'not_audited';
  computed_at: string;
  computed_by: string;
}

export interface ATCSignature {
  algorithm: 'Ed25519 (RFC 8032)';
  value: string; // 128 hex chars = 64 bytes
  signed_by: string;
  signed_at: string;
  domain: string; // domain separation string
  key_id: string;
  canonicalization: 'RFC_8785_JCS';
  evidence_hash: string; // SHA-256 of canonical + signature
}

// ============================================================================
// Issuance — Create a real ATC v3 credential
// ============================================================================

export interface IssueParams {
  issuer: {
    did: string;
    name: string;
    url: string;
    ca_key_id: string;
  };
  subject: {
    agent_id: string;
    agent_name: string;
    public_key: string;
    key_algorithm: 'Ed25519' | 'ECDSA-P256' | 'RSA-2048';
    agent_did?: string;
    subject_type: 'agent' | 'tool' | 'service';
  };
  artifact_binding?: {
    git_repository: string;
    git_commit_sha: string;
    npm_tarball_sha256?: string;
    docker_digest?: string;
  };
  attestations?: Array<{
    type: string;
    evidence: Array<{ layer: string; result: 'pass' | 'fail' | 'warn'; details: string }>;
  }>;
  capabilities: {
    provides: string[];
    requires?: string[];
    protocols?: string[];
  };
  assessment: {
    methodology: string;
    methodology_version: string;
    score: number;
    confidence: 'low' | 'medium' | 'high';
    risk_level: 'low' | 'medium' | 'high' | 'critical' | 'not_audited';
  };
  expires_in_days: number;
  ca_key_pair: Ed25519KeyPair;
}

/**
 * Issue a real ATC v3 credential with Ed25519 signature.
 *
 * Flow:
 *   1. Build the credential payload (everything except signatures[])
 *   2. Compute artifact binding hash
 *   3. Compute evidence hashes for each attestation
 *   4. Canonicalize the payload using RFC 8785 JCS
 *   5. Sign with Ed25519 using domain "UTA-ATC-V3-CREDENTIAL"
 *   6. Compute evidence_hash = SHA-256(canonical + signature)
 *   7. Return the complete credential with signatures[]
 */
export function issueATCv3(params: IssueParams): ATCv3Credential {
  const now = new Date();
  const expires = new Date(now.getTime() + params.expires_in_days * 24 * 60 * 60 * 1000);
  const credential_id = `ATC-${now.getFullYear()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 7).toUpperCase()}`;

  // 1. Build attestations with evidence hashes
  const attestations: ATCAttestation[] = (params.attestations || []).map(att => {
    const evidence: ATCEvidence[] = att.evidence.map(e => {
      const evidenceHash = canonicalHash({ layer: e.layer, result: e.result, details: e.details });
      return {
        layer: e.layer,
        result: e.result,
        details: e.details,
        evidence_hash: evidenceHash,
      };
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

  // 2. Build artifact binding
  let artifact_binding: ATCArtifactBinding | undefined;
  if (params.artifact_binding) {
    const bindingHash = computeArtifactBinding(
      params.artifact_binding.git_commit_sha,
      params.artifact_binding.npm_tarball_sha256,
      params.artifact_binding.docker_digest
    );
    artifact_binding = {
      git: {
        repository: params.artifact_binding.git_repository,
        commit_sha: params.artifact_binding.git_commit_sha,
      },
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

  // 3. Build the credential (WITHOUT signatures — signatures come after)
  const credential: Omit<ATCv3Credential, 'signatures'> = {
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

  // 4. Canonicalize the payload using RFC 8785 JCS
  const canonical = canonicalize(credential);

  // 5. Sign with Ed25519 using domain separation
  const signatureValue = ed25519Sign(credential, params.ca_key_pair.privateKeyPem, DOMAINS.ATC_V3_CREDENTIAL);

  // 6. Compute evidence_hash = SHA-256(canonical_bytes + signature_hex_bytes)
  // NOT canonicalHash() — that would re-canonicalize the concatenated string
  // (wrapping it in quotes), producing a different hash.
  const evidenceHash = `sha256:${crypto.createHash('sha256').update(canonical + signatureValue, 'utf-8').digest('hex')}`;

  // 7. Build the complete signature block
  const signature: ATCSignature = {
    algorithm: 'Ed25519 (RFC 8032)',
    value: signatureValue,
    signed_by: params.issuer.name,
    signed_at: now.toISOString(),
    domain: DOMAINS.ATC_V3_CREDENTIAL,
    key_id: params.ca_key_pair.keyId,
    canonicalization: 'RFC_8785_JCS',
    evidence_hash: evidenceHash,
  };

  // 8. Return the complete credential
  return {
    ...credential,
    signatures: [signature],
  };
}

// ============================================================================
// Verification — Verify an ATC v3 credential's signature
// ============================================================================

export interface ATCVerifyResult {
  valid: boolean;
  credential_id: string;
  issues: string[];
  signature_valid: boolean;
  evidence_hash_valid: boolean;
  canonical_bytes: string;
  canonical_sha256: string;
}

/**
 * Verify an ATC v3 credential's Ed25519 signature.
 *
 * Flow:
 *   1. Extract the payload (everything except signatures[])
 *   2. Extract the signature
 *   3. Canonicalize the payload using RFC 8785 JCS
 *   4. Verify Ed25519 signature with domain "UTA-ATC-V3-CREDENTIAL"
 *   5. Verify evidence_hash = SHA-256(canonical + signature)
 *   6. Check expiry, revocation
 */
export function verifyATCv3(
  credential: ATCv3Credential,
  caPublicKeyPem: string
): ATCVerifyResult {
  const issues: string[] = [];

  // 1. Check structure
  if (!credential.atc_version || !credential.atc_version.startsWith('3.')) {
    issues.push(`wrong atc_version: ${credential.atc_version}`);
    return { valid: false, credential_id: credential.credential_id || 'unknown', issues, signature_valid: false, evidence_hash_valid: false, canonical_bytes: '', canonical_sha256: '' };
  }

  if (!credential.signatures || credential.signatures.length === 0) {
    issues.push('no signatures found');
    return { valid: false, credential_id: credential.credential_id, issues, signature_valid: false, evidence_hash_valid: false, canonical_bytes: '', canonical_sha256: '' };
  }

  const sig = credential.signatures[0];

  // 2. Check signature format (Ed25519 = 64 bytes = 128 hex chars)
  if (!sig.value || sig.value.length !== 128 || !/^[0-9a-f]+$/i.test(sig.value)) {
    issues.push(`malformed signature: ${sig.value?.length || 0} chars (expected 128 hex)`);
    return { valid: false, credential_id: credential.credential_id, issues, signature_valid: false, evidence_hash_valid: false, canonical_bytes: '', canonical_sha256: '' };
  }

  // 3. Check domain separation
  if (sig.domain !== DOMAINS.ATC_V3_CREDENTIAL) {
    issues.push(`wrong domain: ${sig.domain} (expected ${DOMAINS.ATC_V3_CREDENTIAL})`);
  }

  // 4. Build the payload for verification (everything except signatures[])
  const { signatures, ...payload } = credential;

  // 5. Canonicalize
  const canonical = canonicalize(payload);
  const canonicalHashHex = canonicalHash(payload);

  // 6. Verify Ed25519 signature
  let signatureValid = false;
  try {
    signatureValid = ed25519Verify(payload, sig.value, caPublicKeyPem, DOMAINS.ATC_V3_CREDENTIAL);
    if (!signatureValid) {
      issues.push('Ed25519 signature verification failed');
    }
  } catch (e) {
    issues.push(`verification error: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 7. Verify evidence_hash = SHA-256(canonical_bytes + signature_hex_bytes)
  const expectedEvidenceHash = `sha256:${crypto.createHash('sha256').update(canonical + sig.value, 'utf-8').digest('hex')}`;
  const evidenceHashValid = sig.evidence_hash === expectedEvidenceHash;
  if (!evidenceHashValid) {
    issues.push(`evidence_hash mismatch: expected ${expectedEvidenceHash.slice(0, 30)}, got ${sig.evidence_hash?.slice(0, 30) || 'missing'}`);
  }

  // 8. Check expiry
  if (credential.lifecycle.expires_at) {
    if (new Date(credential.lifecycle.expires_at) < new Date()) {
      issues.push(`expired: ${credential.lifecycle.expires_at}`);
    }
  }

  // 9. Check revocation
  if (credential.lifecycle.revoked) {
    issues.push('credential is revoked');
  }

  return {
    valid: issues.length === 0,
    credential_id: credential.credential_id,
    issues,
    signature_valid: signatureValid,
    evidence_hash_valid: evidenceHashValid,
    canonical_bytes: canonical,
    canonical_sha256: canonicalHashHex,
  };
}

// ============================================================================
// UTS Translation — ATC v3 ↔ UTS v2
// ============================================================================

/**
 * Convert ATC v3 credential to UTS v2.
 */
export function atcV3ToUTS(credential: ATCv3Credential): UTSv2 {
  return {
    uts_version: '2.0.0',
    subject: {
      id: credential.subject.agent_id,
      name: credential.subject.agent_name,
      type: credential.subject.subject_type,
    },
    identity: {
      public_keys: [{
        key: credential.subject.public_key,
        algorithm: credential.subject.key_algorithm,
        key_id: credential.signatures[0]?.key_id || 'unknown',
        status: 'active',
      }],
      dids: credential.subject.agent_did ? [credential.subject.agent_did] : undefined,
    },
    attestations: credential.attestations.map(a => ({
      type: a.type as any,
      issuer: a.issuer,
      evidence: a.evidence.map(e => ({
        type: e.layer,
        source: a.issuer,
        result: e.result,
        details: e.details,
        timestamp: a.signed_at,
        evidence_hash: e.evidence_hash,
      })),
      signature: {
        algorithm: credential.signatures[0]?.algorithm || 'Ed25519',
        value: a.signature_hash,
        domain: DOMAINS.ATC_V3_CREDENTIAL,
        key_id: credential.signatures[0]?.key_id || 'unknown',
      },
      issued_at: a.signed_at,
    })),
    capabilities: {
      provides: credential.capabilities.provides,
      requires: credential.capabilities.requires,
      protocols: credential.capabilities.protocols as any[],
    },
    policies: [],
    provenance: {
      source: credential.issuer.name,
      source_url: credential.issuer.url,
      artifact_binding: credential.artifact_binding ? {
        git: credential.artifact_binding.git,
        npm: credential.artifact_binding.npm,
        oci: credential.artifact_binding.oci,
        binding_hash: credential.artifact_binding.binding_hash,
      } : undefined,
    },
    lifecycle: {
      issued_at: credential.lifecycle.issued_at,
      expires_at: credential.lifecycle.expires_at,
      revoked: credential.lifecycle.revoked,
      revocation_url: credential.lifecycle.revocation_url,
      version: credential.lifecycle.version,
    },
    assessment: {
      methodology: credential.assessment.methodology,
      methodology_version: credential.assessment.methodology_version,
      inputs: credential.attestations.flatMap(a => a.evidence.map(e => ({
        name: e.layer,
        value: e.result,
        hash: e.evidence_hash,
      }))),
      result: {
        score: credential.assessment.score,
        confidence: credential.assessment.confidence,
        risk_level: credential.assessment.risk_level,
      },
      computed_at: credential.assessment.computed_at,
      computed_by: credential.assessment.computed_by,
      reproducible: true,
    },
    format: {
      type: 'atc-v3',
      version: credential.atc_version,
      raw: credential,
    },
    warnings: [],
  };
}

// ============================================================================
// Official Test Vectors — Positive, Negative, Mutation
// ============================================================================

/**
 * Generate official test vectors for ATC v3.
 * These vectors verify that:
 *   1. A valid credential verifies correctly
 *   2. A tampered credential fails verification
 *   3. A mutated field (1 byte change) breaks the signature
 *   4. An expired credential is rejected
 *   5. A revoked credential is rejected
 *   6. A wrong-domain signature is rejected
 */
export function generateTestVectors(caKeyPair: Ed25519KeyPair): {
  positive: ATCv3Credential[];
  negative: ATCv3Credential[];
  mutations: Array<{ field: string; credential: ATCv3Credential; expected_valid: boolean }>;
} {
  // Generate a valid credential
  const valid = issueATCv3({
    issuer: {
      did: 'did:marketnow:ca',
      name: 'MarketNow Sentinel CA',
      url: 'https://marketnow.site',
      ca_key_id: caKeyPair.keyId,
    },
    subject: {
      agent_id: 'test-agent-001',
      agent_name: 'Test Agent',
      public_key: 'MCowBQYDK2VwAyEA' + 'T'.repeat(32),
      key_algorithm: 'Ed25519',
      subject_type: 'agent',
    },
    artifact_binding: {
      git_repository: 'https://github.com/test/mcp-server',
      git_commit_sha: 'abc123def4567890abcdef1234567890abcdef12',
    },
    attestations: [{
      type: 'sentinel-audit',
      evidence: [
        { layer: 'L1.5', result: 'pass', details: 'Metadata valid' },
        { layer: 'L1.6', result: 'pass', details: 'No secrets found' },
        { layer: 'L1.9', result: 'pass', details: 'No prompt injection' },
        { layer: 'L2.5', result: 'pass', details: 'Sandbox passed' },
      ],
    }],
    capabilities: {
      provides: ['search', 'read', 'verify'],
      protocols: ['mcp'],
    },
    assessment: {
      methodology: 'Sentinel',
      methodology_version: 'v2.5',
      score: 8,
      confidence: 'high',
      risk_level: 'low',
    },
    expires_in_days: 365,
    ca_key_pair: caKeyPair,
  });

  // ── Positive vectors ──
  const positive = [valid];

  // ── Negative vectors ──
  const negative: ATCv3Credential[] = [];

  // Expired credential
  const expired = JSON.parse(JSON.stringify(valid));
  expired.lifecycle.expires_at = '2020-01-01T00:00:00Z';
  negative.push(expired);

  // Revoked credential
  const revoked = JSON.parse(JSON.stringify(valid));
  revoked.lifecycle.revoked = true;
  negative.push(revoked);

  // Wrong domain signature
  const wrongDomain = JSON.parse(JSON.stringify(valid));
  wrongDomain.signatures[0].domain = 'WRONG-DOMAIN';
  negative.push(wrongDomain);

  // Tampered signature (1 byte change)
  const tamperedSig = JSON.parse(JSON.stringify(valid));
  tamperedSig.signatures[0].value = '00' + tamperedSig.signatures[0].value.slice(2);
  negative.push(tamperedSig);

  // ── Mutation vectors (change 1 field, expect signature to break) ──
  const mutations: Array<{ field: string; credential: ATCv3Credential; expected_valid: boolean }> = [];

  const mutationFields: Array<{ path: Array<string | number>; change: (v: any) => any }> = [
    { path: ['subject', 'agent_id'], change: (v: string) => v + '_mutated' },
    { path: ['subject', 'agent_name'], change: (v: string) => v + ' MUTATED' },
    { path: ['subject', 'public_key'], change: (v: string) => v.slice(0, -4) + 'XXXX' },
    { path: ['assessment', 'score'], change: (v: number) => v + 1 },
    { path: ['assessment', 'risk_level'], change: () => 'critical' },
    { path: ['capabilities', 'provides'], change: (v: string[]) => [...v, 'admin'] },
    { path: ['lifecycle', 'expires_at'], change: () => '2099-12-31T23:59:59Z' },
    { path: ['issuer', 'name'], change: () => 'FAKE_ISSUER' },
    { path: ['signatures', 0, 'key_id'], change: () => 'FAKE_KEY_ID' },
    { path: ['signatures', 0, 'domain'], change: () => 'FAKE_DOMAIN' },
  ];

  for (const mutation of mutationFields) {
    const mutated = JSON.parse(JSON.stringify(valid));
    let obj: any = mutated;
    for (let i = 0; i < mutation.path.length - 1; i++) {
      obj = obj[mutation.path[i]];
    }
    const key = mutation.path[mutation.path.length - 1];
    obj[key] = mutation.change(obj[key]);

    mutations.push({
      field: mutation.path.join('.'),
      credential: mutated,
      expected_valid: false, // signature should break
    });
  }

  return { positive, negative, mutations };
}
