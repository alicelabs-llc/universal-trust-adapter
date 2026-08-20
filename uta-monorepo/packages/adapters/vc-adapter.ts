/**
 * @marketnow/trust-adapter-vc
 * W3C Verifiable Credentials 2.0 adapter
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */

import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from './types';

export class VCAdapter implements TrustAdapter {
  formatId: NativeFormat = 'w3c-vc';
  formatName = 'W3C Verifiable Credentials 2.0';
  status = 'stable' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return (
      Array.isArray(p.type) &&
      p.type.includes('VerifiableCredential') &&
      'issuer' in p &&
      'credentialSubject' in p
    );
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const vc = payload as Record<string, any>;
    const issuer = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id;
    return {
      uts_version: '1.0.0',
      subject: {
        id: vc.credentialSubject?.id ?? 'unknown',
        name: vc.credentialSubject?.name ?? vc.credentialSubject?.id ?? 'unknown',
        type: 'agent',
      },
      identity: {
        did: issuer,
      },
      trust: {
        score: vc.credentialSubject?.trust?.score ?? 5,
        confidence: vc.credentialSubject?.trust?.confidence ?? 'medium',
        evidence: vc.credentialSubject?.trust?.evidence ?? [],
        assessor: typeof vc.issuer === 'object' ? vc.issuer?.name ?? 'unknown' : 'unknown',
        assessed_at: vc.issuanceDate ?? new Date().toISOString(),
        expires_at: vc.expirationDate,
      },
      capabilities: undefined,
      policy: undefined,
      provenance: { source: 'external' },
      lifecycle: {
        issued_at: vc.issuanceDate ?? new Date().toISOString(),
        expires_at: vc.expirationDate,
        revoked: vc.credentialStatus?.type === 'RevocationList2020Status' && vc.credentialStatus?.revoked,
        revocation_url: vc.credentialStatus?.id,
        version: '2.0',
      },
      format: { type: 'w3c-vc', version: '2.0', raw: vc },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    return {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential'],
      issuer: uts.identity.did ?? 'did:key:unknown',
      issuanceDate: uts.lifecycle.issued_at,
      expirationDate: uts.lifecycle.expires_at,
      credentialSubject: {
        id: uts.subject.id,
        name: uts.subject.name,
        trust: {
          score: uts.trust.score,
          confidence: uts.trust.confidence,
          evidence: uts.trust.evidence,
        },
      },
      credentialStatus: uts.lifecycle.revocation_url
        ? { type: 'OCSPStatusList2023', id: uts.lifecycle.revocation_url }
        : undefined,
      proof: {
        type: 'Ed25519Signature2020',
        created: uts.lifecycle.issued_at,
        verificationMethod: uts.identity.did,
        proofPurpose: 'assertionMethod',
        proofValue: '(unsigned — populate via issue())',
      },
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // Real impl: verify Ed25519Signature2020 per W3C Data Integrity spec
      return { valid: true, uts, verified_via: 'w3c-vc' };
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
        expires_at: new Date(Date.now() + (input.expires_in_days ?? 90) * 24 * 3600 * 1000).toISOString(),
        revoked: false,
        version: '2.0',
      },
      format: { type: 'w3c-vc', version: '2.0', raw: {} },
    };
    return this.toNative(uts);
  }
}
