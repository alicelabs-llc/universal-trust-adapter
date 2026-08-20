// MarketNow — ZTA Adapter (Anthropic Zero-Trust Agent)
export class ZTAAdapter {
  constructor() {
    this.formatId = 'zta';
    this.formatName = 'Anthropic ZTA';
    this.formatVersion = '1.0';
    this.status = 'beta';
  }
  detect(payload) {
    if (payload.zta_version || (payload.agent_id && payload.trust && payload.trust.score !== undefined && !payload.card_id))
      return { match: true, confidence: 0.85 };
    return { match: false, confidence: 0 };
  }
  fromNative(payload) {
    return {
      uts_version: '1.0.0',
      subject: { id: payload.agent_id || payload.id || 'unknown', name: payload.agent_name || payload.name || 'ZTA Agent', type: 'agent' },
      identity: { public_key: payload.identity?.public_key, key_algorithm: payload.identity?.key_algorithm || 'Ed25519' },
      trust: {
        score: payload.trust?.score || 0, confidence: payload.trust?.confidence || 'medium',
        evidence: payload.trust?.evidence || [], assessor: payload.trust?.assessor || 'Anthropic',
        assessed_at: payload.metadata?.issued_at || payload.issued_at,
      },
      capabilities: { provides: payload.capabilities?.provides || [], requires: payload.capabilities?.requires || [], protocols: ['anthropic'] },
      provenance: { source: 'anthropic-zta', original_format: 'zta' },
      lifecycle: { issued_at: payload.metadata?.issued_at || payload.issued_at, expires_at: payload.metadata?.expires_at, revoked: payload.status === 'revoked', version: payload.zta_version || '1.0' },
      format: { type: 'zta', version: payload.zta_version || '1.0', raw: payload },
      warnings: [],
    };
  }
  toNative(uts) {
    return {
      zta_version: '1.0', agent_id: uts.subject.id, agent_name: uts.subject.name,
      identity: { public_key: uts.identity.public_key, key_algorithm: uts.identity.key_algorithm || 'Ed25519' },
      trust: { score: uts.trust.score, confidence: uts.trust.confidence, evidence: uts.trust.evidence, assessor: uts.trust.assessor },
      capabilities: { provides: uts.capabilities.provides, requires: uts.capabilities.requires },
      metadata: { issued_at: uts.lifecycle.issued_at, expires_at: uts.lifecycle.expires_at },
      status: uts.lifecycle.revoked ? 'revoked' : 'active',
    };
  }
  async verify(payload, caKey) {
    const uts = this.fromNative(payload);
    const issues = [];
    if (!uts.subject.id) issues.push('ZTA: missing agent_id');
    if (uts.trust.score === undefined) issues.push('ZTA: missing trust.score');
    return { valid: issues.length === 0, format: 'zta', uts, issues, warnings: [] };
  }
}
