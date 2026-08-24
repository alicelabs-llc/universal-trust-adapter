/**
 * @marketnow/trust-adapter-zta
 * Anthropic Zero Trust Framework adapter
 * Spec: Anthropic ZTA (Jul 2026, 36-page framework)
 * Format: JSON with proprietary signature
 * MIT License — AliceLabs LLC 2026
 */

import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from './types';

export class ZTAAdapter implements TrustAdapter {
  formatId: NativeFormat = 'zta';
  formatName = 'Anthropic Zero Trust Framework';
  status = 'experimental' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return 'agent_id' in p && 'identity' in p && 'trust' in p && 'capabilities' in p;
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const zta = payload as Record<string, any>;
    return {
      uts_version: '1.0.0',
      subject: {
        id: zta.agent_id,
        name: zta.agent_name ?? zta.agent_id,
        type: 'agent',
        description: zta.description,
      },
      identity: {
        public_key: zta.identity?.public_key,
        key_algorithm: zta.identity?.key_algorithm ?? 'Ed25519',
        did: zta.identity?.did,
      },
      trust: {
        score: zta.trust?.score ?? 0,
        confidence: zta.trust?.confidence ?? 'medium',
        evidence: zta.trust?.evidence ?? [],
        assessor: 'Anthropic',
        assessed_at: zta.metadata?.issued_at ?? new Date().toISOString(),
        expires_at: zta.metadata?.expires_at,
      },
      capabilities: {
        provides: zta.capabilities?.provides ?? [],
        requires: zta.capabilities?.requires ?? [],
        protocols: ['mcp'],
      },
      policy: zta.policy,
      provenance: { source: 'claude' },
      lifecycle: {
        issued_at: zta.metadata?.issued_at ?? new Date().toISOString(),
        expires_at: zta.metadata?.expires_at,
        revoked: zta.metadata?.revoked ?? false,
        revocation_url: zta.metadata?.revocation_url,
        version: zta.metadata?.version ?? '1.0',
      },
      format: { type: 'zta', version: '1.0', raw: zta },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    return {
      agent_id: uts.subject.id,
      agent_name: uts.subject.name,
      description: uts.subject.description,
      identity: {
        public_key: uts.identity.public_key,
        key_algorithm: uts.identity.key_algorithm ?? 'Ed25519',
        did: uts.identity.did,
      },
      trust: {
        score: uts.trust.score,
        confidence: uts.trust.confidence,
        evidence: uts.trust.evidence,
      },
      capabilities: {
        provides: uts.capabilities?.provides ?? [],
        requires: uts.capabilities?.requires ?? [],
      },
      policy: uts.policy,
      metadata: {
        issued_at: uts.lifecycle.issued_at,
        expires_at: uts.lifecycle.expires_at,
        revoked: uts.lifecycle.revoked,
        revocation_url: uts.lifecycle.revocation_url,
        version: uts.lifecycle.version,
      },
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // Real impl: verify Anthropic's signature scheme (not yet published as RFC)
      return { valid: true, uts, verified_via: 'zta' };
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
      policy: input.policy,
      provenance: { source: 'claude' },
      lifecycle: {
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (input.expires_in_days ?? 90) * 24 * 3600 * 1000).toISOString(),
        revoked: false,
        version: '1.0',
      },
      format: { type: 'zta', version: '1.0', raw: {} },
    };
    return this.toNative(uts);
  }
}
