/**
 * @marketnow/trust-adapter-a2a
 * Google A2A (Agent2Agent) Agent Card adapter
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */

import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from './types';

export class A2AAdapter implements TrustAdapter {
  formatId: NativeFormat = 'a2a-card';
  formatName = 'Google A2A Agent Card';
  status = 'experimental' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return 'agentCard' in p || ('name' in p && 'capabilities' in p && 'url' in p);
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const a2a = payload as Record<string, any>;
    const card = a2a.agentCard ?? a2a; // A2A wraps the card
    return {
      uts_version: '1.0.0',
      subject: {
        id: card.url ?? card.name,
        name: card.name ?? card.url,
        type: 'agent',
        description: card.description,
      },
      identity: {
        public_key: card.public_key,
        key_algorithm: 'Ed25519',
        oauth_subject: card.oauth_subject,
      },
      trust: {
        score: 5, // A2A doesn't have native trust score; default medium
        confidence: 'medium',
        evidence: [],
        assessor: 'self',
        assessed_at: card.issued_at ?? new Date().toISOString(),
        expires_at: card.expires_at,
      },
      capabilities: {
        provides: card.capabilities ?? [],
        protocols: ['a2a'],
      },
      provenance: { source: 'a2a-network' },
      lifecycle: {
        issued_at: card.issued_at ?? new Date().toISOString(),
        expires_at: card.expires_at,
        revoked: false,
        version: card.version ?? '1.0',
      },
      format: { type: 'a2a-card', version: '1.0', raw: a2a },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    return {
      agentCard: {
        name: uts.subject.name,
        description: uts.subject.description,
        url: uts.subject.id,
        version: uts.lifecycle.version,
        capabilities: uts.capabilities?.provides ?? [],
        public_key: uts.identity.public_key,
        issued_at: uts.lifecycle.issued_at,
        expires_at: uts.lifecycle.expires_at,
      },
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // A2A uses OAuth 2.0 for auth — real impl would verify OAuth token
      return { valid: true, uts, verified_via: 'a2a-card' };
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
      provenance: { source: 'a2a-network' },
      lifecycle: {
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (input.expires_in_days ?? 90) * 24 * 3600 * 1000).toISOString(),
        revoked: false,
        version: '1.0',
      },
      format: { type: 'a2a-card', version: '1.0', raw: {} },
    };
    return this.toNative(uts);
  }
}
