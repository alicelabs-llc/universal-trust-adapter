// MarketNow — EAT-AI Adapter (IETF Entity Attestation Token)
// Translates between EAT-AI (CWT/CBOR) claims and UTS
export class EATAdapter {
  constructor() {
    this.formatId = 'eat-ai';
    this.formatName = 'IETF EAT-AI (CWT/CBOR)';
    this.formatVersion = 'draft-00';
    this.status = 'beta';
  }
  detect(payload) {
    if (payload instanceof Uint8Array || (payload.cwt && payload.cwt.length > 0)) return { match: true, confidence: 0.80 };
    if (payload.iss && payload.sub && (payload.iat || payload.trust_score !== undefined)) return { match: true, confidence: 0.75 };
    return { match: false, confidence: 0 };
  }
  fromNative(payload) {
    const claims = typeof payload === 'string' ? JSON.parse(payload) : payload;
    const warnings = [];
    if (claims.ueid) warnings.push('EAT UEID present — TEE attestation may not translate to all formats');
    if (claims.ote) warnings.push('EAT OTE (Trusted Environment) present — hardware attestation');
    return {
      uts_version: '1.0.0',
      subject: { id: claims.sub || 'unknown', name: claims.name || claims.sub || 'EAT Entity', type: 'agent' },
      identity: { public_key: claims.cnf?.jwk, key_algorithm: 'ES256', key_id: claims.kid },
      trust: {
        score: claims.trust_score || 0,
        confidence: claims.trust_level === 'high' ? 'high' : claims.trust_level === 'medium' ? 'medium' : 'low',
        evidence: claims.evidence || [],
        assessor: claims.iss || 'IETF EAT Issuer',
        assessed_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : undefined,
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
      },
      capabilities: { provides: claims.capabilities || [], requires: [], protocols: ['cwt'] },
      provenance: { source: 'ietf-eat', original_format: 'eat-ai' },
      lifecycle: {
        issued_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : undefined,
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
        revoked: false, version: 'draft-00',
      },
      format: { type: 'eat-ai', version: 'draft-00', raw: claims },
      warnings,
    };
  }
  toNative(uts) {
    return {
      iss: uts.trust.assessor,
      sub: uts.subject.id,
      name: uts.subject.name,
      iat: Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000),
      exp: uts.lifecycle.expires_at ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000) : undefined,
      trust_score: uts.trust.score,
      trust_level: uts.trust.confidence,
      evidence: uts.trust.evidence,
      capabilities: uts.capabilities.provides,
      cnf: uts.identity.public_key ? { jwk: uts.identity.public_key } : undefined,
      ueid: uts.identity.attestation?.quote,
      note: 'JSON representation of CWT claims — encode to CBOR for wire format',
    };
  }
  async verify(payload, caKey) {
    const uts = this.fromNative(payload);
    const issues = [];
    if (!uts.subject.id) issues.push('EAT: missing sub claim');
    if (!uts.trust.assessor) issues.push('EAT: missing iss claim');
    return { valid: issues.length === 0, format: 'eat-ai', uts, issues, warnings: uts.warnings || [] };
  }
}
