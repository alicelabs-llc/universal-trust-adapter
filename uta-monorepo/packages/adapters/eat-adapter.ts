/**
 * @marketnow/trust-adapter-eat
 * IETF EAT-AI (Entity Attestation Token for AI Agents) adapter — with REAL verification
 *
 * P4-7: Adds real COSE-style signature verification for EAT tokens.
 *
 * EAT (Entity Attestation Token, RFC 9498) is a CWT (CBOR Web Token) profile
 * for entity attestation. EAT-AI extends it with AI-agent-specific claims.
 *
 * The CWT format is CBOR + COSE_Sign1. Implementing a full CBOR + COSE
 * decoder in pure TS is a substantial undertaking — for now, this adapter
 * supports a JSON serialization of EAT claims (which the spec also allows
 * for testing) with an Ed25519 or ES256 detached signature over the
 * canonicalized JSON.
 *
 * Real production deployments should use `cwt-js` or `@peculiar/cose`
 * for full CBOR/COSE support. This implementation is sufficient for:
 *   - Verifying EAT tokens encoded as JSON (common in test vectors)
 *   - Verifying the detached COSE signature over canonicalized claims
 *   - Translating between EAT and other UTA-supported formats
 *
 * Spec: RFC 9498 (EAT), draft-messous-eat-ai-00 (EAT-AI profile)
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */

import crypto from 'node:crypto';
import { canonicalize } from '../core/crypto.js';
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';

// ============================================================================
// EAT claim types (JSON form)
// ============================================================================

export interface EATClaims {
  /** Issuer (DID or URL) */
  iss: string;
  /** Subject — the agent being attested */
  sub: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp?: number;
  /** Confirmation key — the agent's public key */
  cnf?: {
    jwk?: { kty: string; crv?: string; x?: string; y?: string; n?: string; e?: string };
    cose?: { kty: number; alg: number; crv?: number; x?: string; y?: string };
  };
  /** UEID — Unique Entity Identifier (used for TEE attestation quotes) */
  ueid?: string;
  /** Trust score (EAT-AI extension) — 0 to 10 */
  trust_score?: number;
  /** Trust level (EAT-AI extension) — 'low' | 'medium' | 'high' */
  trust_level?: 'low' | 'medium' | 'high';
  /** Evidence chain */
  evidence?: Array<{
    type: string;
    result: string;
    details?: string;
    timestamp?: string;
  }>;
  /** Agent name (EAT-AI extension) */
  name?: string;
  /** Agent capabilities (EAT-AI extension) */
  capabilities?: string[];
}

export interface EATToken {
  /** The EAT claims (JSON form — for full COSE this would be CBOR bytes) */
  payload: EATClaims;
  /** COSE_Sign1 detached signature.
   *  For Ed25519: 64 bytes (raw). For ES256: 64 bytes (raw R||S).
   *  For RSA: variable length, PKCS#1 v1.5. */
  signature: string;  // base64url
  /** Algorithm used */
  alg: 'EdDSA' | 'ES256' | 'RS256';
  /** Key ID — for lookup in trust registry */
  kid?: string;
  /** COSE protected header (base64url) — for full COSE compatibility */
  protected?: string;
}

export interface EATVerifyResult {
  valid: boolean;
  issues: string[];
  signature_valid: boolean;
  alg: string;
  issuer: string;
  subject: string;
  expired: boolean;
  trust_score?: number;
  trust_level?: string;
}

// ============================================================================
// Issuance
// ============================================================================

export interface EATIssueParams {
  issuer: string;
  subject: string;
  subject_name?: string;
  subject_public_key?: string;        // base64url raw public key
  capabilities?: string[];
  trust_score?: number;
  trust_level?: 'low' | 'medium' | 'high';
  ueid?: string;
  evidence?: EATClaims['evidence'];
  expires_in_days: number;
  issuer_private_key_pem: string;
  issuer_key_id: string;
  alg: 'EdDSA' | 'ES256' | 'RS256';
}

/**
 * Issue a signed EAT token.
 *
 * The token is a JSON object with `payload` (the EAT claims) and
 * `signature` (a detached COSE_Sign1-style signature over canonicalize(payload)).
 *
 * The signature is computed over `domain:canonicalize(payload)` where domain is
 * "UTA-EAT-AI" — providing cross-format signature non-reuse (an EAT signature
 * cannot be replayed as a JWT signature, and vice versa).
 */
export function issueEAT(params: EATIssueParams): EATToken {
  const now = new Date();
  const iat = Math.floor(now.getTime() / 1000);
  const exp = Math.floor((now.getTime() + params.expires_in_days * 24 * 60 * 60 * 1000) / 1000);

  const payload: EATClaims = {
    iss: params.issuer,
    sub: params.subject,
    iat,
    exp,
    name: params.subject_name,
    capabilities: params.capabilities,
    trust_score: params.trust_score ?? 5,
    trust_level: params.trust_level ?? 'medium',
    ueid: params.ueid,
    evidence: params.evidence,
    ...(params.subject_public_key ? {
      cnf: {
        jwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: params.subject_public_key,
        },
      },
    } : {}),
  };

  // Sign with domain separation
  const canonical = canonicalize(payload);
  const signingInput = Buffer.from(`UTA-EAT-AI:${canonical}`, 'utf-8');
  const privateKey = crypto.createPrivateKey(params.issuer_private_key_pem);
  const keyType = privateKey.asymmetricKeyType;

  let signature: Buffer;
  if (params.alg === 'EdDSA' || keyType === 'ed25519') {
    signature = crypto.sign(null, signingInput, privateKey);
  } else if (params.alg === 'ES256' || keyType === 'ec') {
    signature = crypto.sign('SHA256', signingInput, { key: privateKey, dsaEncoding: 'ieee-p1363' });
  } else if (params.alg === 'RS256' || keyType === 'rsa') {
    signature = crypto.sign('RSA-SHA256', signingInput, privateKey);
  } else {
    throw new Error(`unsupported key type: ${keyType} (alg=${params.alg})`);
  }

  return {
    payload,
    signature: signature.toString('base64url'),
    alg: params.alg,
    kid: params.issuer_key_id,
  };
}

// ============================================================================
// Verification
// ============================================================================

const EAT_DOMAIN = 'UTA-EAT-AI';

export function verifyEAT(
  token: EATToken,
  issuerPublicKeyPem: string,
  options: { now?: Date; skipExpiry?: boolean } = {}
): EATVerifyResult {
  const issues: string[] = [];
  const now = options.now || new Date();

  // 1. Structure validation
  if (!token.payload) {
    return { valid: false, issues: ['missing payload'], signature_valid: false, alg: token.alg || 'unknown', issuer: 'unknown', subject: 'unknown', expired: false };
  }
  const claims = token.payload;
  if (!claims.iss) issues.push('missing iss (issuer)');
  if (!claims.sub) issues.push('missing sub (subject)');
  if (!claims.iat) issues.push('missing iat (issued-at)');

  // 2. Expiry check
  let expired = false;
  if (!options.skipExpiry && claims.exp) {
    const expDate = new Date(claims.exp * 1000);
    if (expDate < now) {
      expired = true;
      issues.push(`expired: exp=${expDate.toISOString()}`);
    }
  }

  // 3. Signature verification
  let signatureValid = false;
  try {
    const canonical = canonicalize(claims);
    const signingInput = Buffer.from(`${EAT_DOMAIN}:${canonical}`, 'utf-8');
    const signature = Buffer.from(token.signature, 'base64url');
    const publicKey = crypto.createPublicKey(issuerPublicKeyPem);
    const keyType = publicKey.asymmetricKeyType;

    if (token.alg === 'EdDSA' || keyType === 'ed25519') {
      signatureValid = crypto.verify(null, signingInput, publicKey, signature);
    } else if (token.alg === 'ES256' || keyType === 'ec') {
      signatureValid = crypto.verify('SHA256', signingInput, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
    } else if (token.alg === 'RS256' || keyType === 'rsa') {
      signatureValid = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
    } else {
      issues.push(`unsupported algorithm: ${token.alg} (key type: ${keyType})`);
    }

    if (!signatureValid) {
      issues.push(`${token.alg} signature verification failed`);
    }
  } catch (e) {
    issues.push(`verification error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    valid: issues.length === 0 && signatureValid,
    issues,
    signature_valid: signatureValid,
    alg: token.alg,
    issuer: claims.iss || 'unknown',
    subject: claims.sub || 'unknown',
    expired,
    trust_score: claims.trust_score,
    trust_level: claims.trust_level,
  };
}

// ============================================================================
// Adapter interface implementation
// ============================================================================

export class EATAdapter implements TrustAdapter {
  formatId: NativeFormat = 'eat-ai';
  formatName = 'IETF EAT-AI (CWT/CBOR)';
  status = 'beta' as const;  // P4-7: promoted from experimental

  detect(payload: unknown): boolean {
    // EAT-AI is CBOR-encoded (binary). If we got a Uint8Array starting with the
    // CBOR tag 0x3B (CWT) or 0xD8 (COSE tag), it's likely EAT.
    if (payload instanceof Uint8Array && payload.length > 0) {
      const firstByte = payload[0];
      return firstByte === 0x3b || firstByte === 0xd8 || (firstByte & 0xe0) === 0x40;
    }
    // JSON form: { payload: { iss, sub, cnf, ... }, signature, alg }
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      // EATToken form
      if ('payload' in p && 'signature' in p && 'alg' in p) return true;
      // Raw claims form (no signature)
      if ('sub' in p && 'iss' in p && ('cnf' in p || 'ueid' in p)) return true;
    }
    return false;
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const token = payload as Record<string, any>;
    // Support both EATToken form and raw claims form
    const claims: EATClaims = token.payload ?? token;
    return {
      uts_version: '1.0.0',
      subject: {
        id: claims.sub ?? 'unknown',
        name: claims.name ?? claims.sub ?? 'unknown',
        type: 'agent',
      },
      identity: {
        did: claims.iss,
        public_key: claims.cnf?.jwk ? JSON.stringify(claims.cnf.jwk) : undefined,
        key_algorithm: 'ES256',
        attestation: claims.ueid ? { type: 'SGX', quote: claims.ueid } : undefined,
      },
      trust: {
        score: claims.trust_score ?? 5,
        confidence: claims.trust_level ?? 'medium',
        evidence: (claims.evidence || []).map((e: any) => ({
          type: e.type,
          source: claims.iss,
          result: e.result,
          details: e.details,
          timestamp: e.timestamp || new Date(claims.iat * 1000).toISOString(),
        })),
        assessor: claims.iss,
        assessed_at: new Date(claims.iat * 1000).toISOString(),
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
      },
      capabilities: claims.capabilities ? { provides: claims.capabilities, protocols: ['a2a'] } : undefined,
      provenance: { source: 'external' },
      lifecycle: {
        issued_at: new Date(claims.iat * 1000).toISOString(),
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
        revoked: false,
        version: 'draft-00',
      },
      format: { type: 'eat-ai', version: 'draft-00', raw: payload },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    const iat = Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000);
    const exp = uts.lifecycle.expires_at
      ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000)
      : iat + 90 * 24 * 3600;

    let cnf: { jwk: any } | undefined;
    if (uts.identity.public_key) {
      try {
        const jwk = JSON.parse(uts.identity.public_key);
        cnf = { jwk };
      } catch {
        cnf = undefined;
      }
    }

    const claims: EATClaims = {
      iss: uts.identity.did
        ?? (uts.identity.public_key
            ? `urn:public-key:${uts.identity.public_key.slice(0, 32)}`
            : 'did:key:unknown'),
      sub: uts.subject.id,
      iat, exp,
      cnf,
      ueid: uts.identity.attestation?.quote,
      trust_score: uts.trust.score,
      trust_level: uts.trust.confidence as any,
      evidence: uts.trust.evidence.map(e => ({
        type: e.type,
        result: e.result,
        details: e.details,
        timestamp: e.timestamp,
      })) as any,
      name: uts.subject.name,
      capabilities: uts.capabilities?.provides,
    };

    return { payload: claims, signature: '', alg: 'ES256' };  // signature filled by issue()
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const token = payload as EATToken;
      const caPublicKey = (options as any)?.ca_public_key;

      // If no signature present, structural check only
      if (!token.signature) {
        return {
          valid: false,
          reason: 'no signature (fail-closed: cannot verify EAT without signature)',
          uts: this.fromNative(payload),
        };
      }

      // If no CA key, only structural checks
      if (!caPublicKey) {
        return {
          valid: false,
          reason: 'no ca_public_key provided (cannot verify EAT signature)',
          uts: this.fromNative(payload),
        };
      }

      const result = verifyEAT(token, caPublicKey, { skipExpiry: options?.skip_ocsp });
      const uts = this.fromNative(payload);
      return {
        valid: result.valid,
        reason: result.issues.length > 0 ? result.issues.join('; ') : undefined,
        uts,
        warnings: result.expired ? ['token expired'] : undefined,
        verified_via: 'eat-ai',
      };
    } catch (e) {
      return { valid: false, reason: (e as Error).message };
    }
  }

  async issue(input: IssueInput, keys: IssuerKeys): Promise<unknown> {
    if (!keys.es256_private_key && !keys.ed25519_private_key) {
      throw new Error('ES256 or Ed25519 key required for EAT issuance');
    }
    const alg = keys.ed25519_private_key ? 'EdDSA' : 'ES256';
    const rawKey = keys.ed25519_private_key || keys.es256_private_key!;
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(rawKey),
      format: 'der',
      type: 'pkcs8',
    });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    return issueEAT({
      issuer: keys.did || 'did:marketnow:ca',
      subject: input.subject.id,
      subject_name: input.subject.name,
      capabilities: input.capabilities?.provides ?? [],
      trust_score: input.trust.score,
      trust_level: input.trust.confidence as any,
      expires_in_days: input.expires_in_days ?? 90,
      issuer_private_key_pem: privateKeyPem,
      issuer_key_id: 'eat-issuer-1',
      alg,
    });
  }
}
