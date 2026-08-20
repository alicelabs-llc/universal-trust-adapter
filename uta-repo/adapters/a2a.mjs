// MarketNow — A2A Agent Card Adapter (Google / AAIF)
export class A2AAdapter {
  constructor() {
    this.formatId = 'a2a-card';
    this.formatName = 'Google A2A Agent Card';
    this.formatVersion = '0.1';
    this.status = 'beta';
  }
  detect(payload) {
    if (payload.capabilities && (payload.service_endpoint || payload.url) && payload.version && !payload.signature)
      return { match: true, confidence: 0.80 };
    return { match: false, confidence: 0 };
  }
  fromNative(payload) {
    return {
      uts_version: '1.0.0',
      subject: { id: payload.name || payload.id || 'unknown', name: payload.name || 'A2A Agent', type: 'agent' },
      identity: { did: payload.identity?.did, oauth_subject: payload.identity?.oauth_subject },
      trust: { score: payload.trust?.score || 0, confidence: 'medium', evidence: [], assessor: 'Google A2A', assessed_at: payload.metadata?.created_at },
      capabilities: { provides: (payload.capabilities || []).map(c => typeof c === 'string' ? c : c.name || c.id), requires: [], protocols: ['a2a'] },
      provenance: { source: 'google-a2a', source_url: payload.service_endpoint?.url, original_format: 'a2a-card' },
      lifecycle: { issued_at: payload.metadata?.created_at, revoked: false, version: payload.version || '0.1' },
      format: { type: 'a2a-card', version: payload.version || '0.1', raw: payload },
      warnings: [],
    };
  }
  toNative(uts) {
    return {
      name: uts.subject.name, version: '0.1',
      capabilities: uts.capabilities.provides.map(p => ({ name: p })),
      service_endpoint: { url: uts.provenance.source_url || '', type: 'a2a' },
      identity: { did: uts.identity.did, oauth_subject: uts.identity.oauth_subject },
      trust: { score: uts.trust.score },
      metadata: { created_at: uts.lifecycle.issued_at, updated_at: new Date().toISOString() },
    };
  }
  async verify(payload, caKey) {
    const uts = this.fromNative(payload);
    const issues = [];
    if (!uts.subject.id) issues.push('A2A: missing name/id');
    if (!payload.capabilities) issues.push('A2A: missing capabilities');
    return { valid: issues.length === 0, format: 'a2a-card', uts, issues, warnings: [] };
  }
}
