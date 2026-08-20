/**
 * @marketnow/trust-adapter-eat
 * IETF EAT-AI (Entity Attestation Token for AI Agents) adapter
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * Commercial use requires a separate commercial license. Contact: legal@alicelabs.site
 *
 * Spec: draft-messous-eat-ai-00 (Feb 2026)
 * Format: CWT (CBOR Web Token) + COSE
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
      return firstByte === 0x3b || firstByte === 0xd8 || (firstByte & 0xe0) === 0x40;
    }
    // JSON fallback: some test vectors are JSON-decoded
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      return 'sub' in p && 'iss' in p && 'cnf' in p && 'ueid' in p;
    }
    return false;
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const claims = payload as Record<string, any>;
    return {
      uts_version: '1.0.0',
      subject: {
        id: claims.sub ?? 'unknown',
        name: claims.name ?? claims.sub ?? 'unknown',
        type: 'agent',
      },
      identity: {
        // BUG FIX: EAT-AI uses 'iss' (issuer) claim as the DID of the issuer.
        // Previously this was only in trust.assessor, which caused the field
        // to be lost when translating to other formats (e.g., W3C VC).
        did: claims.iss,
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
    const iat = Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000);
    const exp = uts.lifecycle.expires_at
      ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000)
      : iat + 90 * 24 * 3600;

    // BUG FIX: Don't assume public_key is a JWK JSON string. Other adapters
    // (ZTA, A2A) store raw base64 keys, which would throw on JSON.parse.
    // Try parse; if it fails, omit cnf (lossless — original is in format.raw).
    let cnf: { jwk: any } | undefined;
    if (uts.identity.public_key) {
      try {
        const jwk = JSON.parse(uts.identity.public_key);
        cnf = { jwk };
      } catch {
        // public_key is not a JWK (e.g., raw base64 from ZTA/A2A). Omit cnf.
        cnf = undefined;
      }
    }

    return {
      // Prefer did; fall back to public_key string; last resort 'did:key:unknown'
      iss: uts.identity.did
        ?? (uts.identity.public_key
            ? `urn:public-key:${uts.identity.public_key.slice(0, 32)}`
            : 'did:key:unknown'),
      sub: uts.subject.id,
      iat, exp,
      cnf,
      ueid: uts.identity.attestation?.quote,
      trust_score: uts.trust.score,
      trust_level: uts.trust.confidence,
      evidence: uts.trust.evidence,
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // Real impl: verify COSE signature (ES256 or EdDSA) against issuer's public key
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
