// MarketNow — Universal Trust Engine (Core) — Plain JS
import { UTS_VERSION } from './schema.mjs';

export class TrustEngine {
  constructor(adapters) {
    this.adapters = new Map();
    if (adapters) {
      for (const adapter of adapters) {
        this.registerAdapter(adapter);
      }
    }
  }

  registerAdapter(adapter) {
    this.adapters.set(adapter.formatId, adapter);
  }

  listFormats() {
    return Array.from(this.adapters.values()).map(a => ({
      id: a.formatId,
      name: a.formatName,
      version: a.formatVersion,
      status: a.status,
    }));
  }

  detectFormat(payload) {
    let bestMatch = { format: null, confidence: 0 };
    for (const adapter of this.adapters.values()) {
      const result = adapter.detect(payload);
      if (result.match && result.confidence > bestMatch.confidence) {
        bestMatch = { format: adapter.formatId, confidence: result.confidence };
      }
    }
    return bestMatch;
  }

  translate(payload, options) {
    const sourceFormat = options.from || this.detectFormat(payload).format;
    if (!sourceFormat) throw new Error('Could not detect source format');
    
    const sourceAdapter = this.adapters.get(sourceFormat);
    if (!sourceAdapter) throw new Error(`No adapter for format: ${sourceFormat}`);
    
    const targetAdapter = this.adapters.get(options.to);
    if (!targetAdapter) throw new Error(`No adapter for format: ${options.to}`);

    const uts = sourceAdapter.fromNative(payload);
    const translated = targetAdapter.toNative(uts);
    const warnings = [...(uts.warnings || [])];

    // Lossy translation detection
    if (uts.identity?.attestation?.type && uts.identity.attestation.type !== 'None') {
      if (options.to === 'zta' || options.to === 'mcp-card') {
        warnings.push(`TEE attestation omitted in ${options.to}`);
      }
    }

    return { payload: translated, uts, warnings };
  }

  async verify(payload, caPublicKey) {
    const detected = this.detectFormat(payload);
    if (!detected.format) {
      return { valid: false, format: null, issues: ['Could not detect format'], warnings: [] };
    }
    const adapter = this.adapters.get(detected.format);
    if (!adapter) {
      return { valid: false, format: detected.format, issues: [`No adapter for ${detected.format}`], warnings: [] };
    }
    return adapter.verify(payload, caPublicKey);
  }

  issue(params) {
    const uts = {
      uts_version: UTS_VERSION,
      subject: params.subject,
      identity: params.identity,
      trust: {
        score: params.trust.score,
        confidence: params.trust.confidence || 'medium',
        evidence: params.trust.evidence || [],
        assessor: params.trust.assessor || 'MarketNow',
        assessed_at: params.trust.assessed_at || new Date().toISOString(),
        expires_at: params.trust.expires_at,
      },
      capabilities: params.capabilities || { provides: [], requires: [], protocols: [] },
      policy: params.policy,
      provenance: {
        source: params.provenance?.source || 'marketnow',
        original_signature_hash: params.provenance?.original_signature_hash,
        original_format: params.provenance?.original_format,
        bridged_at: params.provenance?.bridged_at,
        bridged_by: params.provenance?.bridged_by,
      },
      lifecycle: {
        issued_at: new Date().toISOString(),
        expires_at: params.trust.expires_at,
        revoked: false,
        version: '1.0.0',
      },
      format: { type: 'atc-v3', version: '3.0.0', raw: null },
      warnings: [],
    };

    const credentials = {};
    for (const formatId of params.formats) {
      const adapter = this.adapters.get(formatId);
      if (!adapter) {
        credentials[formatId] = { error: `No adapter for ${formatId}` };
        continue;
      }
      uts.format.type = formatId;
      credentials[formatId] = adapter.toNative(uts);
    }
    return credentials;
  }

  async bridge(payload, options) {
    const verifyResult = await this.verify(payload, options.caPublicKey);
    
    if (!verifyResult.valid || !verifyResult.uts) {
      return { verified: false, original: verifyResult, issued: null, bridge_log: 'Verification failed', warnings: verifyResult.warnings };
    }

    if (options.policy?.min_trust_score !== undefined && verifyResult.uts.trust.score < options.policy.min_trust_score) {
      return { verified: false, original: verifyResult, issued: null, bridge_log: `Score ${verifyResult.uts.trust.score} < min ${options.policy.min_trust_score}`, warnings: [] };
    }

    const crypto = require('crypto');
    const originalSigHash = `sha256:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;

    const issued = this.issue({
      subject: verifyResult.uts.subject,
      identity: verifyResult.uts.identity,
      trust: {
        score: verifyResult.uts.trust.score,
        confidence: verifyResult.uts.trust.confidence,
        evidence: verifyResult.uts.trust.evidence,
        assessor: `${verifyResult.uts.trust.assessor} (bridged via MarketNow UTA)`,
        assessed_at: verifyResult.uts.trust.assessed_at,
        expires_at: verifyResult.uts.trust.expires_at,
      },
      capabilities: verifyResult.uts.capabilities,
      policy: verifyResult.uts.policy,
      provenance: {
        source: 'marketnow-bridge',
        original_signature_hash: originalSigHash,
        original_format: options.verifyIn,
        bridged_at: new Date().toISOString(),
        bridged_by: 'MarketNow UTA v1.0',
      },
      formats: [options.issueAs],
    });

    return {
      verified: true,
      original: verifyResult,
      issued: issued[options.issueAs],
      bridge_log: `${verifyResult.uts.trust.assessor} score ${verifyResult.uts.trust.score} → ${options.issueAs} (chain: ${originalSigHash.slice(0, 20)}...)`,
      warnings: verifyResult.warnings,
    };
  }
}
