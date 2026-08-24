/**
 * @marketnow/trust-adapter-eat
 * IETF EAT-AI (Entity Attestation Token for AI Agents) adapter
 * Spec: draft-messous-eat-ai-00 (Feb 2026)
 * Format: CWT (CBOR Web Token) + COSE
 * MIT License — AliceLabs LLC 2026
 */

import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from './types';

export class EATAdapter implements TrustAdapter {
  formatId: NativeFormat = 'eat-ai';
  formatName = 'IETF EAT-AI (CWT/CBOR)';
  status = 'experimental' as const;

  detect(payload: unknown): boolean {
    // EAT-AI is CBOR-encoded (binary). If we got a Uint8Array starting with the
    // CBOR tag 0x3B (CWT) or 0xD8 (COSE tag), it's likely EAT.
    if (payload instanceof Uint8Array && payload.length > 0) {
      const firstByte = payload[0];
      return firstByte === 0x3b || firstByte === 0xd8 || (firstByte & 0xe0) === 0x40; // COSE/CWT prefix
    }
    // JSON fallback: some test vectors are JSON-decoded
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      return 'sub' in p && 'iss' in p && 'cnf' in p && 'ueid' in p;
    }
    return false;
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    // Real impl: decode CWT (CBOR) → extract claims → build UTS
    // For now we accept pre-decoded claims as a JSON object.
    const claims = payload as Record<string, any>;
    return {
      uts_version: '1.0.0',
      subject: {
        id: claims.sub ?? 'unknown',
        name: claims.name ?? claims.sub ?? 'unknown',
        type: 'agent',
      },
      identity: {
        public_key: claims.cnf?.jwk ? JSON.stringify(claims.cnf.jwk) : undefined,
        key_algorithm: 'ES256',
        attestation: claims.ueid ? { type: 'SGX', quote: claims.ueid } : undefined,
      },
      trust: {
        score: claims.trust_score ?? 5,
        confidence: claims.trust_level ?? 'medium',
        evidence: claims.evidence ?? [],
        assessor: claims.iss,
        assessed_at: new Date(claims.iat * 1000).toISOString(),
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
      },
      capabilities: undefined,
      policy: undefined,
      provenance: { source: 'external' },
      lifecycle: {
        issued_at: new Date(claims.iat * 1000).toISOString(),
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
        revoked: false,
        version: 'draft-00',
      },
      format: { type: 'eat-ai', version: 'draft-00', raw: claims },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    // Build CWT claims (to be CBOR-encoded by the real impl)
    const iat = Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000);
    const exp = uts.lifecycle.expires_at
      ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000)
      : iat + 90 * 24 * 3600;
    return {
      iss: uts.identity.did ?? 'did:key:unknown',
      sub: uts.subject.id,
      iat,
      exp,
      cnf: uts.identity.public_key ? { jwk: JSON.parse(uts.identity.public_key) } : undefined,
      ueid: uts.identity.attestation?.quote,
      trust_score: uts.trust.score,
      trust_level: uts.trust.confidence,
      evidence: uts.trust.evidence,
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // Real impl: verify COSE signature (ES256 or EdDSA)
      return { valid: true, uts, verified_via: 'eat-ai' };
    } catch (e) {
      return { valid: false, reason: (e as Error).message };
    }
  }

  async issue(input: IssueInput, keys: IssuerKeys): Promise<unknown> {
    if (!keys.es256_private_key && !keys.ed25519_private_key) {
      throw new Error('ES256 or Ed25519 key required for EAT issuance');
    }
    const uts: UniversalTrustSchema = {
      uts_version: '1.0.0',
      subject: input.subject,
      identity: input.identity ?? {},
      trust: { ...input.trust, assessed_at: input.trust.assessed_at ?? new Date().toISOString() } as any,
      capabilities: input.capabilities,
      policy: input.policy,
      provenance: { source: 'external', ...input.provenance },
      lifecycle: {
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (input.expires_in_days ?? 90) * 24 * 3600 * 1000).toISOString(),
        revoked: false,
        version: 'draft-00',
      },
      format: { type: 'eat-ai', version: 'draft-00', raw: {} },
    };
    return this.toNative(uts);
  }
}
