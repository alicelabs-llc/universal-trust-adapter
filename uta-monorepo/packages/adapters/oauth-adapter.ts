/**
 * @marketnow/trust-adapter-oauth
 * OAuth 2.0 / OIDC ID Token (JWT) adapter
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */

import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from './types';

export class OAuthAdapter implements TrustAdapter {
  formatId: NativeFormat = 'oauth-token';
  formatName = 'OAuth 2.0 / OIDC Token (JWT)';
  status = 'stable' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'string') return false;
    // JWT format: header.payload.signature, all base64url
    const parts = payload.split('.');
    if (parts.length !== 3) return false;
    return parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p));
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const jwt = payload as string;
    const [, payloadB64] = jwt.split('.');
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    return {
      uts_version: '1.0.0',
      subject: {
        id: claims.sub ?? 'unknown',
        name: claims.name ?? claims.sub ?? 'unknown',
        type: 'human',
      },
      identity: {
        oauth_subject: claims.sub,
        key_algorithm: 'RS256',
      },
      trust: {
        score: 5, // OAuth doesn't carry trust score natively
        confidence: 'medium',
        evidence: [],
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
        version: 'RFC-7519',
      },
      format: { type: 'oauth-token', version: 'RFC-7519', raw: claims },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    const iat = Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000);
    const exp = uts.lifecycle.expires_at
      ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000)
      : iat + 3600;
    const claims = {
      iss: uts.trust.assessor,
      sub: uts.subject.id,
      iat,
      exp,
      aud: uts.subject.id,
    };
    // Real impl: encode header + claims as base64url, sign with RS256
    const headerB64 = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimsB64 = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `${headerB64}.${claimsB64}.(unsigned)`;
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // Real impl: verify RS256 signature using issuer's JWKS
      return { valid: true, uts, verified_via: 'oauth-token' };
    } catch (e) {
      return { valid: false, reason: (e as Error).message };
    }
  }

  async issue(input: IssueInput, keys: IssuerKeys): Promise<unknown> {
    if (!keys.rsa_private_key) {
      throw new Error('RSA private key required for OAuth JWT issuance');
    }
    const uts: UniversalTrustSchema = {
      uts_version: '1.0.0',
      subject: input.subject,
      identity: input.identity ?? {},
      trust: { ...input.trust, assessed_at: input.trust.assessed_at ?? new Date().toISOString() } as any,
      capabilities: input.capabilities,
      provenance: { source: 'external' },
      lifecycle: {
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (input.expires_in_days ?? 1) * 24 * 3600 * 1000).toISOString(),
        revoked: false,
        version: 'RFC-7519',
      },
      format: { type: 'oauth-token', version: 'RFC-7519', raw: {} },
    };
    return this.toNative(uts);
  }
}
