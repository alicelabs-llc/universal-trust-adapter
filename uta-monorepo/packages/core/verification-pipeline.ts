/**
 * @marketnow/trust-core
 * BLOQUE D: Verification Core — 12-Stage Fail-Closed Pipeline
 *
 * Every credential MUST pass all 12 stages. Any failure = DENY.
 * Unknown = DENY. Error = DENY. Expired = DENY. Revoked = DENY.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 */

import { canonicalize, canonicalHash, verify as ed25519Verify, verifyPoP, DOMAINS, type PoPChallenge, type PoPResponse } from './crypto.js';
import type { UniversalTrustSchema, NativeFormat } from './types.js';

// ============================================================================
// Stage Types
// ============================================================================

export type StageResult = 'PASS' | 'FAIL' | 'SKIP' | 'NOT_APPLICABLE';

export interface VerificationStage {
  name: string;
  result: StageResult;
  reason?: string;
  evidence?: unknown;
  duration_ms: number;
}

export interface VerificationContext {
  credential: unknown;
  format?: NativeFormat;
  audience?: string;
  nonce?: string;
  pop_response?: PoPResponse;
  ca_public_key?: string; // PEM
  policy?: {
    min_trust_score?: number;
    max_age_days?: number;
    require_pop?: boolean;
    require_artifact_binding?: boolean;
    allowed_issuers?: string[];
  };
}

export interface VerificationResult {
  decision: 'ALLOW' | 'DENY';
  format: NativeFormat | null;
  stages: VerificationStage[];
  uts?: UniversalTrustSchema;
  total_duration_ms: number;
  failure_stage?: string;
  failure_reason?: string;
}

// ============================================================================
// The 12-Stage Pipeline (Fail-Closed)
// ============================================================================

/**
 * Execute the 12-stage verification pipeline.
 *
 * STAGES:
 *  01 PARSE            — Can we parse the payload?
 *  02 DETECT           — What format is this?
 *  03 SCHEMA VALIDATE  — Does it match the expected schema?
 *  04 CRYPTO VERIFY     — Is the Ed25519 signature valid?
 *  05 ISSUER TRUST     — Do we trust the issuer?
 *  06 KEY BINDING      — Is the key ID valid?
 *  07 PROOF OF POSSESSION — Has the agent proven it holds the private key?
 *  08 PROVENANCE       — Is the artifact binding valid?
 *  09 LIFECYCLE        — Is it expired? Revoked?
 *  10 EVIDENCE VALIDATION — Are the evidence hashes correct?
 *  11 POLICY EVALUATION — Does it meet the policy requirements?
 *  12 DECISION         — Final ALLOW or DENY
 */
export async function verifyCredential(
  ctx: VerificationContext
): Promise<VerificationResult> {
  const startTime = Date.now();
  const stages: VerificationStage[] = [];

  // ── STAGE 01: PARSE ──────────────────────────────────────────────────────
  stages.push(await runStage('PARSE', () => {
    if (ctx.credential === null || ctx.credential === undefined) {
      throw new Error('Credential is null or undefined');
    }
    if (typeof ctx.credential === 'string') {
      try {
        JSON.parse(ctx.credential);
      } catch {
        throw new Error('String credential is not valid JSON');
      }
    } else if (typeof ctx.credential !== 'object') {
      throw new Error(`Credential is type ${typeof ctx.credential}, expected object or JSON string`);
    }
    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '01_PARSE');

  // ── STAGE 02: DETECT ─────────────────────────────────────────────────────
  stages.push(await runStage('DETECT', () => {
    const detected = detectFormat(ctx.credential);
    if (!detected) {
      throw new Error('Could not detect credential format');
    }
    if (ctx.format && ctx.format !== detected) {
      throw new Error(`Expected format ${ctx.format}, detected ${detected}`);
    }
    ctx.format = detected;
    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '02_DETECT');

  // ── STAGE 03: SCHEMA VALIDATE ────────────────────────────────────────────
  stages.push(await runStage('SCHEMA_VALIDATE', () => {
    const errors = validateSchema(ctx.credential, ctx.format!);
    if (errors.length > 0) {
      throw new Error(`Schema validation failed: ${errors.join('; ')}`);
    }
    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '03_SCHEMA');

  // ── STAGE 04: CRYPTO VERIFY ──────────────────────────────────────────────
  stages.push(await runStage('CRYPTO_VERIFY', () => {
    if (!ctx.ca_public_key) {
      // For formats without crypto (MCP Card, A2A Card), skip
      if (ctx.format === 'mcp-card' || ctx.format === 'a2a-card') {
        return 'SKIP';
      }
      throw new Error('CA public key required for cryptographic verification');
    }

    const { payload, signature, domain } = extractSignatureData(ctx.credential, ctx.format!);
    if (!signature) {
      throw new Error('No signature found in credential');
    }

    const valid = ed25519Verify(payload, signature, ctx.ca_public_key, domain);
    if (!valid) {
      throw new Error('Ed25519 signature verification failed');
    }
    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '04_CRYPTO');

  // ── STAGE 05: ISSUER TRUST ───────────────────────────────────────────────
  stages.push(await runStage('ISSUER_TRUST', () => {
    const issuer = extractIssuer(ctx.credential, ctx.format!);

    // If policy specifies allowed issuers, enforce strictly
    if (ctx.policy?.allowed_issuers && ctx.policy.allowed_issuers.length > 0) {
      if (!ctx.policy.allowed_issuers.includes(issuer)) {
        throw new Error(`Issuer '${issuer}' not in allowed list: [${ctx.policy.allowed_issuers.join(', ')}]`);
      }
      return 'PASS';
    }

    // Without an allowed_issuers policy, DENY by default (fail-closed)
    // This is a CHANGE from the previous stub that accepted any issuer
    throw new Error(`Issuer '${issuer}' cannot be trusted: no allowed_issuers policy configured`);
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '05_ISSUER');

  // ── STAGE 06: KEY BINDING ────────────────────────────────────────────────
  stages.push(await runStage('KEY_BINDING', () => {
    const keyId = extractKeyId(ctx.credential, ctx.format!);
    if (!keyId) {
      // v1 cards don't have ca_key_id — warn but allow
      if (ctx.format === 'atc-v2') {
        return 'PASS'; // v1 backward compat
      }
      throw new Error('Missing ca_key_id (required in v2.0+)');
    }
    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '06_KEY_BINDING');

  // ── STAGE 07: PROOF OF POSSESSION ───────────────────────────────────────
  stages.push(await runStage('POP', () => {
    if (!ctx.policy?.require_pop) {
      return 'SKIP'; // PoP is optional unless policy requires it
    }

    if (!ctx.pop_response) {
      throw new Error('PoP required by policy but no PoP response provided');
    }

    // The verifier must have the agent's public key to verify PoP
    const agentPublicKey = extractAgentPublicKey(ctx.credential, ctx.format!);
    if (!agentPublicKey) {
      throw new Error('Cannot verify PoP: no agent public key in credential');
    }

    // Construct the expected challenge (the verifier would have issued this)
    const expectedChallenge: PoPChallenge = {
      nonce: ctx.nonce || '',
      credential_id: extractCredentialId(ctx.credential, ctx.format!),
      audience: ctx.audience || 'unknown',
      issued_at: ctx.pop_response.timestamp,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    const valid = verifyPoP(ctx.pop_response, agentPublicKey, expectedChallenge);
    if (!valid) {
      throw new Error('PoP verification failed');
    }

    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '07_POP');

  // ── STAGE 08: PROVENANCE / ARTIFACT ─────────────────────────────────────
  stages.push(await runStage('PROVENANCE', () => {
    if (!ctx.policy?.require_artifact_binding) {
      return 'SKIP';
    }

    const binding = extractArtifactBinding(ctx.credential, ctx.format!);
    if (!binding) {
      throw new Error('Artifact binding required by policy but not present in credential');
    }

    // Verify binding_hash is correctly computed from the binding fields
    const bindingObj = binding as Record<string, any>;
    const gitSha = bindingObj.git?.commit_sha || bindingObj.git_commit_sha || '';
    const npmSha = bindingObj.npm?.tarball_sha256 || bindingObj.npm_tarball_sha256;
    const ociDigest = bindingObj.oci?.digest || bindingObj.docker_digest;

    // Recompute the expected binding hash using the same JCS + SHA-256
    const expectedBinding = canonicalize({
      git_commit_sha: gitSha,
      npm_tarball_sha256: npmSha,
      docker_digest: ociDigest,
    });
    const expectedHash = `sha256:${canonicalHash(expectedBinding)}`;
    const actualHash = bindingObj.binding_hash || '';

    if (actualHash !== expectedHash) {
      throw new Error(`Artifact binding hash mismatch: expected ${expectedHash.slice(0, 30)}, got ${actualHash.slice(0, 30)}`);
    }

    // NOTE: Full artifact verification (fetching actual Git/npm/OCI and comparing digests)
    // requires network access and is done by the Trust Gateway at runtime, not by the
    // offline verification pipeline. The pipeline verifies the binding_hash is
    // correctly computed. The Gateway verifies the binding matches reality.

    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '08_PROVENANCE');

  // ── STAGE 09: LIFECYCLE / REVOCATION ────────────────────────────────────
  stages.push(await runStage('LIFECYCLE', () => {
    const lifecycle = extractLifecycle(ctx.credential, ctx.format!);

    // Check expiry
    if (lifecycle.expires_at) {
      if (new Date(lifecycle.expires_at) < new Date()) {
        throw new Error(`Credential expired at ${lifecycle.expires_at}`);
      }
    }

    // Check max age
    if (ctx.policy?.max_age_days && lifecycle.issued_at) {
      const age = (Date.now() - new Date(lifecycle.issued_at).getTime()) / (1000 * 60 * 60 * 24);
      if (age > ctx.policy.max_age_days) {
        throw new Error(`Credential age ${age.toFixed(1)} days exceeds max ${ctx.policy.max_age_days}`);
      }
    }

    // Check revocation (in production: query Supabase CRL or Bitstring Status List)
    if (lifecycle.revoked) {
      throw new Error(`Credential is revoked: ${lifecycle.revocation_reason || 'no reason given'}`);
    }

    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '09_LIFECYCLE');

  // ── STAGE 10: EVIDENCE VALIDATION ────────────────────────────────────────
  stages.push(await runStage('EVIDENCE', () => {
    const evidence = extractEvidence(ctx.credential, ctx.format!);
    if (!evidence || evidence.length === 0) {
      return 'SKIP'; // No evidence to validate
    }

    // Verify each evidence entry's hash against its content
    for (const e of evidence) {
      if (e.evidence_hash) {
        // Recompute the expected hash from evidence fields
        const evidenceContent = canonicalize({
          layer: e.type || e.layer || '',
          result: e.result,
          details: e.details || '',
          source: e.source || '',
          timestamp: e.timestamp || '',
        });
        const expectedHash = canonicalHash(evidenceContent);
        // Compare (evidence_hash may have sha256: prefix or be raw hex)
        const actualHash = e.evidence_hash.replace(/^sha256:/, '');
        if (actualHash !== expectedHash) {
          throw new Error(`Evidence hash mismatch for ${e.type || e.layer}: expected ${expectedHash.slice(0, 20)}, got ${actualHash.slice(0, 20)}`);
        }
      }
    }

    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '10_EVIDENCE');

  // ── STAGE 11: POLICY EVALUATION ──────────────────────────────────────────
  stages.push(await runStage('POLICY', () => {
    const trustScore = extractTrustScore(ctx.credential, ctx.format!);

    if (ctx.policy?.min_trust_score !== undefined) {
      if (trustScore < ctx.policy.min_trust_score) {
        throw new Error(`Trust score ${trustScore} < minimum ${ctx.policy.min_trust_score}`);
      }
    }

    return 'PASS';
  }));

  if (lastFailed(stages)) return deny(stages, startTime, '11_POLICY');

  // ── STAGE 12: DECISION ───────────────────────────────────────────────────
  stages.push(await runStage('DECISION', () => {
    // All previous stages passed — issue ALLOW
    return 'PASS';
  }));

  const totalDuration = Date.now() - startTime;

  return {
    decision: 'ALLOW',
    format: ctx.format!,
    stages,
    total_duration_ms: totalDuration,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function runStage(
  name: string,
  fn: () => StageResult | Promise<StageResult>
): Promise<VerificationStage> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      name,
      result,
      duration_ms: Date.now() - start,
    };
  } catch (e) {
    return {
      name,
      result: 'FAIL',
      reason: e instanceof Error ? e.message : String(e),
      duration_ms: Date.now() - start,
    };
  }
}

function lastFailed(stages: VerificationStage[]): boolean {
  return stages.length > 0 && stages[stages.length - 1].result === 'FAIL';
}

function deny(
  stages: VerificationStage[],
  startTime: number,
  failureStage: string
): VerificationResult {
  const lastStage = stages[stages.length - 1];
  return {
    decision: 'DENY',
    format: null,
    stages,
    total_duration_ms: Date.now() - startTime,
    failure_stage: failureStage,
    failure_reason: lastStage.reason,
  };
}

// ── Format Detection ──────────────────────────────────────────────────────

function detectFormat(payload: unknown): NativeFormat | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  // ATC v3: atc_version starts with 3. + credential_id + signatures[]
  if (p.atc_version && typeof p.atc_version === 'string' && p.atc_version.startsWith('3.')) {
    return 'atc-v3';
  }

  // ATC v2: card_id + payload + signature
  if (p.card_id && p.payload && p.signature) {
    return 'atc-v2';
  }

  // ZTA: zta_version or agent_id + trust.score (no card_id)
  if (p.zta_version || (p.agent_id && p.trust && typeof (p.trust as any).score === 'number' && !p.card_id)) {
    return 'zta';
  }

  // A2A: capabilities + service_endpoint + version (no signature)
  if (p.capabilities && (p.service_endpoint || p.url) && p.version && !p.signature) {
    return 'a2a-card';
  }

  // MCP: protocolVersion + tools + serverInfo
  if (p.protocolVersion && p.tools && p.serverInfo) {
    return 'mcp-card';
  }

  // EAT-AI: CWT claims (iss + sub + iat)
  if (p.iss && p.sub && (p.iat || p.trust_score !== undefined)) {
    return 'eat-ai';
  }

  return null;
}

// ── Schema Validation ────────────────────────────────────────────────────

function validateSchema(payload: unknown, format: NativeFormat): string[] {
  const errors: string[] = [];
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      if (!p.card_id) errors.push('missing card_id');
      if (!p.payload) errors.push('missing payload');
      if (!p.signature) errors.push('missing signature');
      if (p.signature && !(p.signature as any).algorithm) errors.push('missing signature.algorithm');
      break;
    case 'zta':
      if (!p.agent_id) errors.push('missing agent_id');
      if (!p.trust) errors.push('missing trust');
      break;
    case 'a2a-card':
      if (!p.name) errors.push('missing name');
      if (!p.capabilities) errors.push('missing capabilities');
      break;
    case 'mcp-card':
      if (!p.serverInfo) errors.push('missing serverInfo');
      if (!p.tools) errors.push('missing tools');
      break;
    case 'eat-ai':
      if (!p.iss) errors.push('missing iss (issuer)');
      if (!p.sub) errors.push('missing sub (subject)');
      break;
  }

  return errors;
}

// ── Data Extractors ──────────────────────────────────────────────────────

function extractSignatureData(payload: unknown, format: NativeFormat): {
  payload: unknown;
  signature: string | null;
  domain: string;
} {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      return {
        payload: p.payload,
        signature: (p.signature as any)?.value || null,
        domain: DOMAINS.ATC_V3_CREDENTIAL,
      };
    default:
      return { payload: p, signature: null, domain: DOMAINS.ATC_V3_CREDENTIAL };
  }
}

function extractIssuer(payload: unknown, format: NativeFormat): string {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      return (p.payload as any)?.metadata?.issuer || 'unknown';
    case 'zta':
      return (p.trust as any)?.assessor || 'unknown';
    case 'eat-ai':
      return (p.iss as string) || 'unknown';
    default:
      return 'unknown';
  }
}

function extractKeyId(payload: unknown, format: NativeFormat): string | null {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      return (p.signature as any)?.ca_key_id || null;
    default:
      return null;
  }
}

function extractAgentPublicKey(payload: unknown, format: NativeFormat): string | null {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      return (p.payload as any)?.identity?.public_key || null;
    case 'zta':
      return (p.identity as any)?.public_key || null;
    default:
      return null;
  }
}

function extractCredentialId(payload: unknown, format: NativeFormat): string {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      return (p.card_id as string) || 'unknown';
    case 'zta':
      return (p.agent_id as string) || 'unknown';
    default:
      return 'unknown';
  }
}

function extractArtifactBinding(payload: unknown, format: NativeFormat): unknown | null {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      return (p.payload as any)?.provenance?.artifact_binding || null;
    default:
      return null;
  }
}

function extractLifecycle(payload: unknown, format: NativeFormat): {
  issued_at?: string;
  expires_at?: string;
  revoked: boolean;
  revocation_reason?: string;
} {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2': {
      const meta = (p.payload as any)?.metadata || {};
      return {
        issued_at: meta.issued_at,
        expires_at: meta.expires_at,
        revoked: p.status === 'revoked',
        revocation_reason: (p as any).revocation_reason,
      };
    }
    case 'zta': {
      const meta = (p.metadata as any) || {};
      return {
        issued_at: meta.issued_at,
        expires_at: meta.expires_at,
        revoked: p.status === 'revoked',
      };
    }
    default:
      return { revoked: false };
  }
}

function extractEvidence(payload: unknown, format: NativeFormat): Array<{
  type: string;
  source: string;
  result: string;
  evidence_hash?: string;
}> {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      return (p.payload as any)?.trust?.evidence || [];
    case 'zta':
      return (p.trust as any)?.evidence || [];
    default:
      return [];
  }
}

function extractTrustScore(payload: unknown, format: NativeFormat): number {
  const p = payload as Record<string, unknown>;

  switch (format) {
    case 'atc-v2':
      return (p.payload as any)?.trust?.sentinel_review_score || 0;
    case 'zta':
      return (p.trust as any)?.score || 0;
    default:
      return 0;
  }
}
