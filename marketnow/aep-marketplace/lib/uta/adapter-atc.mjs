// MarketNow — ATC Adapter (Plain JS)
import crypto from 'crypto';

export class ATCAdapter {
  constructor() {
    this.formatId = 'atc-v2';
    this.formatName = 'Agent Trust Card (ATC)';
    this.formatVersion = '2.0.0';
    this.status = 'stable';
  }

  detect(payload) {
    if (!payload || typeof payload !== 'object') return { match: false, confidence: 0 };
    if (payload.card_id && payload.payload && payload.signature) {
      const hasV2 = payload.signature.ca_key_id || payload.signature.evidence_hash;
      return { match: true, confidence: hasV2 ? 0.95 : 0.80 };
    }
    return { match: false, confidence: 0 };
  }

  fromNative(card) {
    const payload = card.payload || {};
    const signature = card.signature || {};
    const trust = payload.trust || {};
    const identity = payload.identity || {};
    const capabilities = payload.capabilities || {};
    const metadata = payload.metadata || {};

    const warnings = [];
    if (!signature.ca_key_id) warnings.push('v1 card: missing ca_key_id');
    if (!signature.evidence_hash) warnings.push('v1 card: missing evidence_hash');
    if (signature.canonical_json && signature.canonical_json !== 'RFC_8785_JCS') {
      warnings.push(`Deprecated canonicalization: ${signature.canonical_json}`);
    }

    const evidence = [];
    const layers = trust.audit_layers_passed || {};
    for (const [layer, passed] of Object.entries(layers)) {
      if (passed) {
        evidence.push({ type: 'sentinel-audit', source: layer, result: 'pass', timestamp: metadata.issued_at || new Date().toISOString() });
      }
    }

    return {
      uts_version: '1.0.0',
      subject: {
        id: payload.agent_id || card.card_id,
        name: payload.agent_name || payload.agent_id || 'Unknown',
        type: 'agent',
      },
      identity: {
        public_key: identity.public_key,
        key_algorithm: identity.key_algorithm || 'Ed25519',
        key_id: signature.ca_key_id,
      },
      trust: {
        score: trust.sentinel_review_score || trust.sentinel_score || 0,
        confidence: trust.risk_level === 'low' ? 'high' : trust.risk_level === 'medium' ? 'medium' : 'low',
        evidence,
        assessor: metadata.issuer || 'MarketNow',
        assessed_at: metadata.issued_at || signature.signed_at,
        expires_at: metadata.expires_at,
      },
      capabilities: {
        provides: capabilities.provides || [],
        requires: [],
        protocols: [capabilities.protocol_language || 'mcp'],
      },
      provenance: {
        source: 'marketnow',
        original_signature_hash: signature.evidence_hash,
        original_format: 'atc-v2',
      },
      lifecycle: {
        issued_at: metadata.issued_at || signature.signed_at,
        expires_at: metadata.expires_at,
        revoked: card.status === 'revoked',
        revocation_url: metadata.revocation_url,
        version: payload.schema_version || '2.0.0',
      },
      format: {
        type: 'atc-v2',
        version: payload.schema_version || '2.0.0',
        raw: card, // LOSSLESS: original preserved
      },
      warnings,
    };
  }

  toNative(uts) {
    const cardId = uts.subject.id.startsWith('ATC-') ? uts.subject.id : `ATC-${Date.now().toString(36).toUpperCase()}`;
    return {
      card_id: cardId,
      status: uts.lifecycle.revoked ? 'revoked' : 'active',
      payload: {
        card_id: cardId,
        schema_version: '2.0.0',
        decision_authority: 'consumer',
        agent_id: uts.subject.id,
        agent_name: uts.subject.name,
        identity: {
          public_key: uts.identity.public_key || 'MCowBQYDK2VwAyEA',
          key_algorithm: uts.identity.key_algorithm || 'Ed25519',
        },
        trust: {
          sentinel_review_score: uts.trust.score,
          sentinel_score: uts.trust.score,
          audit_layers_passed: {},
          composite_trust: uts.trust.score,
          risk_level: uts.trust.confidence === 'high' ? 'low' : 'medium',
        },
        capabilities: {
          provides: uts.capabilities.provides,
          protocol_language: uts.capabilities.protocols[0] || 'mcp',
          translate: true,
        },
        payment: { method: 'none', wallet_address: null },
        metadata: {
          issued_at: uts.lifecycle.issued_at,
          expires_at: uts.lifecycle.expires_at,
          issuer: uts.trust.assessor,
          revocation_url: `https://marketnow.site/api/atc?action=verify&card_id=${cardId}`,
        },
      },
      signature: {
        algorithm: 'Ed25519 (RFC 8032)',
        value: '00'.repeat(64),
        signed_by: uts.trust.assessor,
        signed_at: uts.lifecycle.issued_at,
        canonical_json: 'RFC_8785_JCS',
        ca_key_id: uts.identity.key_id || 'MCowBQYDK2VwAyEA',
        evidence_hash: uts.provenance.original_signature_hash || `sha256:${crypto.createHash('sha256').update(uts.subject.id).digest('hex')}`,
        policy_version: uts.lifecycle.version || '2.0.0',
      },
    };
  }

  async verify(card, caPublicKeyPem) {
    const issues = [];
    const warnings = [];

    if (!card?.payload || !card?.signature) {
      return { valid: false, format: 'atc-v2', issues: ['missing payload/signature'], warnings };
    }

    const sig = card.signature;
    const payload = card.payload;

    if (!sig.ca_key_id) warnings.push('v2_violation: ca_key_id missing');
    if (!sig.evidence_hash) warnings.push('v2_violation: evidence_hash missing');
    if (sig.canonical_json && sig.canonical_json !== 'RFC_8785_JCS') {
      issues.push(`v2_violation: ${sig.canonical_json} deprecated`);
    }
    if (!sig.algorithm?.includes('Ed25519')) {
      return { valid: false, format: 'atc-v2', issues: [`wrong algorithm: ${sig.algorithm}`], warnings };
    }

    const expiresAt = payload.metadata?.expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      issues.push(`expired: ${expiresAt}`);
    }
    if (card.status === 'revoked') {
      issues.push(`revoked: ${card.revocation_reason || 'no reason'}`);
    }

    const uts = this.fromNative(card);
    return {
      valid: issues.length === 0,
      format: 'atc-v2',
      uts,
      issues,
      warnings,
      v2_compliant: !warnings.some(w => w.startsWith('v2_violation')),
    };
  }
}
