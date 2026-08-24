/**
 * @marketnow/trust-adapter-spiffe
 * SPIFFE SVID (Spiffe Verifiable Identity Document) adapter
 * Spec: SPIFFE 1.0 (CNCF)
 * Format: X.509 SVID or JWT-SVID
 * MIT License — AliceLabs LLC 2026
 */

import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from './types';

export class SPIFFEAdapter implements TrustAdapter {
  formatId: NativeFormat = 'spiffe-svid';
  formatName = 'SPIFFE SVID (X.509 / JWT)';
  status = 'experimental' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'string') {
      if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        return 'spiffe_id' in p && ('x509_svid' in p || 'jwt_svid' in p);
      }
      return false;
    }
    // X.509 PEM
    return payload.startsWith('-----BEGIN CERTIFICATE-----');
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const svid = payload as Record<string, any>;
    return {
      uts_version: '1.0.0',
      subject: {
        id: svid.spiffe_id ?? 'spiffe://unknown',
        name: svid.spiffe_id ?? 'unknown',
        type: 'service',
      },
      identity: {
        public_key: svid.x509_svid?.chain?.[0],
        key_algorithm: 'ECDSA-P256',
      },
      trust: {
        score: 7, // SPIFFE workloads are typically high-trust inside their trust domain
        confidence: 'high',
        evidence: [],
        assessor: 'SPIFFE Trust Domain',
        assessed_at: new Date().toISOString(),
      },
      capabilities: {
        protocols: ['grpc', 'https'],
      },
      provenance: { source: 'external' },
      lifecycle: {
        issued_at: new Date().toISOString(),
        expires_at: svid.x509_svid?.expires_at,
        revoked: false,
        version: '1.0',
      },
      format: { type: 'spiffe-svid', version: '1.0', raw: svid },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    return {
      spiffe_id: uts.subject.id,
      x509_svid: {
        chain: uts.identity.public_key ? [uts.identity.public_key] : undefined,
        expires_at: uts.lifecycle.expires_at,
      },
      trust_domain: uts.trust.assessor,
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // Real impl: verify X.509 chain against SPIFFE trust bundle
      return { valid: true, uts, verified_via: 'spiffe-svid' };
    } catch (e) {
      return { valid: false, reason: (e as Error).message };
    }
  }

  async issue(input: IssueInput, _keys: IssuerKeys): Promise<unknown> {
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
        version: '1.0',
      },
      format: { type: 'spiffe-svid', version: '1.0', raw: {} },
    };
    return this.toNative(uts);
  }
}
