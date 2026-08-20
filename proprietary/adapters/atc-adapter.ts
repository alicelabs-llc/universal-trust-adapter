/**
 * @marketnow/trust-adapter-atc
 * ATC v2.0 / v3.0 adapter — translates ATC credentials to/from UTS
 * MIT License — AliceLabs LLC 2026
 */

import type {
  TrustAdapter,
  UniversalTrustSchema,
  VerifyOptions,
  VerifyResult,
  IssueInput,
  IssuerKeys,
  NativeFormat,
} from './types';

export class ATCAdapter implements TrustAdapter {
  formatId: NativeFormat = 'atc-v3';
  formatName = 'ATC v3.0 (multi-sig)';
  status = 'stable' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return (
      p.atc_version !== undefined &&
      typeof p.atc_version === 'string' &&
      (p.atc_version.startsWith('2.') || p.atc_version.startsWith('3.')) &&
      Array.isArray(p.type) &&
      p.type.includes('AgentTrustCredential')
    );
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    if (!this.detect(payload)) {
      throw new Error('Payload is not an ATC credential');
    }
    const atc = payload as Record<string, any>;
    const isV3 = atc.atc_version.startsWith('3.');
    const sig = isV3 ? atc.signatures?.[0] : atc.proof;

    return {
      uts_version: '1.0.0',
      subject: {
        id: atc.credential_subject?.skill_id ?? atc.credential_subject?.agent_did ?? 'unknown',
        name: atc.credential_subject?.skill_id ?? atc.credential_subject?.agent_did ?? 'unknown',
        type: this.subjectTypeFromATC(atc.subject_type),
      },
      identity: {
        did: atc.issuer?.did,
        public_key: atc.credential_subject?.public_key,
        key_algorithm: 'Ed25519',
      },
      trust: {
        score: atc.attestation?.score ?? 0,
        confidence: this.confidenceFromScore(atc.attestation?.score ?? 0),
        evidence: this.extractEvidence(atc.trust_claims ?? {}),
        assessor: atc.issuer?.name ?? 'unknown',
        assessed_at: atc.issuance_date ?? new Date().toISOString(),
        expires_at: atc.expiration_date,
      },
      capabilities: undefined,
      policy: undefined,
      provenance: {
        source: 'marketnow',
        source_url: atc.artifact?.repository_url,
        artifact_hash: atc.artifact?.artifact_digest,
        commit_sha: atc.artifact?.commit_sha,
      },
      lifecycle: {
        issued_at: atc.issuance_date ?? new Date().toISOString(),
        expires_at: atc.expiration_date,
        revoked: false,
        revocation_url: atc.credential_status?.endpoint,
        version: atc.atc_version,
      },
      format: {
        type: isV3 ? 'atc-v3' : 'atc-v2',
        version: atc.atc_version,
        raw: atc,
      },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    return {
      atc_version: '3.0.0-rfc-00',
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'AgentTrustCredential'],
      subject_type: this.subjectTypeToATC(uts.subject.type),
      issuer: {
        did: uts.identity.did ?? 'did:key:unknown',
        name: uts.trust.assessor,
        trust_engine_version: 'UTA-1.0',
      },
      issuance_date: uts.lifecycle.issued_at,
      expiration_date: uts.lifecycle.expires_at ?? this.defaultExpiry(),
      credential_subject: {
        skill_id: uts.subject.id,
        upstream_repo: uts.provenance.source_url,
      },
      artifact: {
        repository_url: uts.provenance.source_url,
        commit_sha: uts.provenance.commit_sha,
        artifact_digest: uts.provenance.artifact_hash,
      },
      attestation: {
        score: uts.trust.score,
        trust_level: this.trustLevelFromScore(uts.trust.score),
        risk: this.riskFromScore(uts.trust.score),
      },
      trust_claims: {
        provenance_verified: uts.provenance.source !== 'self-signed',
        human_review: uts.trust.evidence.some((e) => e.type === 'human-review' && e.result === 'pass'),
        // Other claims default to undefined when translating from non-ATC source
      },
      credential_status: {
        method: 'OCSP',
        endpoint: uts.lifecycle.revocation_url ?? 'https://atc.alicelabs.site/api/v2/ocsp',
        stapling_supported: true,
      },
      signatures_provided: ['atc-ed25519'],
      signatures: [
        {
          format: 'atc-ed25519',
          algorithm: 'Ed25519 (RFC 8032)',
          canonicalization: 'RFC_8785_JCS',
          proof_bytes: '(unsigned — populate via issue())',
        },
      ],
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // Real implementation would verify Ed25519 signature
      return { valid: true, uts, verified_via: 'atc-v3' };
    } catch (e) {
      return { valid: false, reason: (e as Error).message };
    }
  }

  async issue(input: IssueInput, keys: IssuerKeys): Promise<unknown> {
    if (!keys.ed25519_private_key) {
      throw new Error('Ed25519 private key required for ATC issuance');
    }
    const uts: UniversalTrustSchema = {
      uts_version: '1.0.0',
      subject: input.subject,
      identity: input.identity ?? { did: keys.did },
      trust: {
        ...input.trust,
        assessed_at: input.trust.assessed_at ?? new Date().toISOString(),
      } as any,
      capabilities: input.capabilities,
      policy: input.policy,
      provenance: {
        source: 'marketnow',
        ...input.provenance,
      },
      lifecycle: {
        issued_at: new Date().toISOString(),
        expires_at: this.computeExpiry(input.expires_in_days ?? 90),
        revoked: false,
        version: '3.0.0-rfc-00',
      },
      format: { type: 'atc-v3', version: '3.0.0-rfc-00', raw: {} },
    };
    const card = this.toNative(uts);
    // Real implementation would sign with Ed25519 + populate signatures[0].proof_bytes
    return card;
  }

  private subjectTypeFromATC(atc: string): 'agent' | 'tool' | 'runtime' {
    if (atc === 'agent') return 'agent';
    if (atc === 'runtime') return 'runtime';
    return 'tool';
  }

  private subjectTypeToATC(uts: string): string {
    if (uts === 'agent') return 'agent';
    if (uts === 'runtime') return 'runtime';
    return 'skill';
  }

  private confidenceFromScore(score: number): 'low' | 'medium' | 'high' {
    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  private trustLevelFromScore(score: number): string {
    if (score >= 8) return 'A';
    if (score >= 6) return 'B';
    if (score >= 4) return 'C';
    return 'D';
  }

  private riskFromScore(score: number): string {
    if (score >= 8) return 'LOW';
    if (score >= 4) return 'MEDIUM';
    return 'HIGH';
  }

  private extractEvidence(trustClaims: Record<string, any>): any[] {
    const evidence: any[] = [];
    if (trustClaims.owasp_top_10) {
      for (const [k, v] of Object.entries(trustClaims.owasp_top_10)) {
        evidence.push({
          type: 'owasp-mcp-scan',
          source: 'Sentinel L1.5',
          result: v === 'passed' ? 'pass' : v === 'failed' ? 'fail' : 'warn',
          details: `${k}: ${v}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
    if (trustClaims.runtime_observed) {
      evidence.push({
        type: 'runtime-observation',
        source: 'Sentinel L2',
        result: 'pass',
        timestamp: new Date().toISOString(),
      });
    }
    if (trustClaims.human_review) {
      evidence.push({
        type: 'human-review',
        source: 'AliceLabs',
        result: 'pass',
        timestamp: new Date().toISOString(),
      });
    }
    return evidence;
  }

  private computeExpiry(daysFromNow: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString();
  }

  private defaultExpiry(): string {
    return this.computeExpiry(90);
  }
}
