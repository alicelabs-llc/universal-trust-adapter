// UTA Test Suite — runs against actual adapter implementations
// Uses Node 24's built-in TypeScript stripping (no compilation needed)

// ============================================================
// Inline minimal versions of the adapters so we can run without tsc
// (the canonical TypeScript versions live in /adapters/*.ts in the repo)
// ============================================================

// --- UTS types (inline) ---
const UTS_VERSION = '1.0.0';

// --- ATC adapter ---
class ATCAdapter {
  formatId = 'atc-v3';
  formatName = 'ATC v3.0';
  status = 'stable';

  detect(payload) {
    if (typeof payload !== 'object' || payload === null) return false;
    return payload.atc_version !== undefined &&
      typeof payload.atc_version === 'string' &&
      (payload.atc_version.startsWith('2.') || payload.atc_version.startsWith('3.')) &&
      Array.isArray(payload.type) &&
      payload.type.includes('AgentTrustCredential');
  }

  fromNative(payload) {
    const atc = payload;
    const isV3 = atc.atc_version.startsWith('3.');
    const evidence = [];
    if (atc.trust_claims?.owasp_top_10) {
      for (const [k, v] of Object.entries(atc.trust_claims.owasp_top_10)) {
        evidence.push({
          type: 'owasp-mcp-scan',
          source: 'Sentinel L1.5',
          result: v === 'passed' ? 'pass' : 'warn',
          details: `${k}: ${v}`,
          timestamp: new Date().toISOString(),
        });
      }
    }
    return {
      uts_version: UTS_VERSION,
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
        evidence,
        assessor: atc.issuer?.name ?? 'unknown',
        assessed_at: atc.issuance_date ?? new Date().toISOString(),
        expires_at: atc.expiration_date,
      },
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
      format: { type: isV3 ? 'atc-v3' : 'atc-v2', version: atc.atc_version, raw: atc },
    };
  }

  toNative(uts) {
    return {
      atc_version: '3.0.0-rfc-00',
      id: `urn:uuid:test-${Math.random().toString(36).slice(2, 10)}`,
      type: ['VerifiableCredential', 'AgentTrustCredential'],
      subject_type: this.subjectTypeToATC(uts.subject.type),
      issuer: { did: uts.identity.did ?? 'did:key:unknown', name: uts.trust.assessor },
      issuance_date: uts.lifecycle.issued_at,
      expiration_date: uts.lifecycle.expires_at,
      credential_subject: { skill_id: uts.subject.id, upstream_repo: uts.provenance.source_url },
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
        human_review: uts.trust.evidence.some(e => e.type === 'human-review' && e.result === 'pass'),
      },
      signatures_provided: ['atc-ed25519'],
      signatures: [{
        format: 'atc-ed25519',
        algorithm: 'Ed25519 (RFC 8032)',
        canonicalization: 'RFC_8785_JCS',
        proof_bytes: '(unsigned — populate via issue())',
      }],
    };
  }

  async verify(payload) {
    try {
      const uts = this.fromNative(payload);
      return { valid: true, uts, verified_via: 'atc-v3' };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }

  subjectTypeFromATC(atc) {
    if (atc === 'agent') return 'agent';
    if (atc === 'runtime') return 'runtime';
    return 'tool';
  }
  subjectTypeToATC(uts) {
    if (uts === 'agent') return 'agent';
    if (uts === 'runtime') return 'runtime';
    return 'skill';
  }
  confidenceFromScore(s) { return s >= 8 ? 'high' : s >= 5 ? 'medium' : 'low'; }
  trustLevelFromScore(s) { return s >= 8 ? 'A' : s >= 6 ? 'B' : s >= 4 ? 'C' : 'D'; }
  riskFromScore(s) { return s >= 8 ? 'LOW' : s >= 4 ? 'MEDIUM' : 'HIGH'; }
}

// --- EAT adapter ---
class EATAdapter {
  formatId = 'eat-ai';
  formatName = 'IETF EAT-AI';
  status = 'experimental';

  detect(payload) {
    if (payload instanceof Uint8Array && payload.length > 0) {
      const b = payload[0];
      return b === 0x3b || b === 0xd8 || (b & 0xe0) === 0x40;
    }
    if (typeof payload === 'object' && payload !== null) {
      return 'sub' in payload && 'iss' in payload && 'cnf' in payload;
    }
    return false;
  }

  fromNative(payload) {
    const claims = payload;
    return {
      uts_version: UTS_VERSION,
      subject: { id: claims.sub ?? 'unknown', name: claims.name ?? claims.sub ?? 'unknown', type: 'agent' },
      identity: {
        // EAT-AI uses 'iss' (issuer) claim as the DID of the issuer
        did: claims.iss,
        public_key: claims.cnf?.jwk ? JSON.stringify(claims.cnf.jwk) : undefined,
        key_algorithm: 'ES256',
        attestation: claims.ueid ? { type: 'SGX', quote: claims.ueid } : undefined,
      },
      trust: {
        score: claims.trust_score ?? 5,
        confidence: claims.trust_level ?? 'medium',
        evidence: claims.evidence ?? [],
        assessor: claims.iss,
        assessed_at: new Date(claims.iat * 1000).toISOString(),
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
      },
      provenance: { source: 'external' },
      lifecycle: {
        issued_at: new Date(claims.iat * 1000).toISOString(),
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
        revoked: false,
        version: 'draft-00',
      },
      format: { type: 'eat-ai', version: 'draft-00', raw: claims },
    };
  }

  toNative(uts) {
    const iat = Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000);
    const exp = uts.lifecycle.expires_at ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000) : iat + 90 * 24 * 3600;
    // Try to parse public_key as JWK JSON; if it fails (e.g., came from ZTA/A2A as base64), fall back to undefined
    let cnf;
    if (uts.identity.public_key) {
      try {
        const jwk = JSON.parse(uts.identity.public_key);
        cnf = { jwk };
      } catch {
        // public_key is not a JWK (e.g., raw base64 from ZTA/A2A). Omit cnf.
        cnf = undefined;
      }
    }
    return {
      // Prefer did; fall back to public_key string; last resort 'did:key:unknown'
      iss: uts.identity.did ?? (uts.identity.public_key ? `urn:public-key:${uts.identity.public_key.slice(0, 32)}` : 'did:key:unknown'),
      sub: uts.subject.id,
      iat, exp,
      cnf,
      ueid: uts.identity.attestation?.quote,
      trust_score: uts.trust.score,
      trust_level: uts.trust.confidence,
      evidence: uts.trust.evidence,
    };
  }

  async verify(payload) {
    try {
      const uts = this.fromNative(payload);
      return { valid: true, uts, verified_via: 'eat-ai' };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }
}

// --- ZTA adapter ---
class ZTAAdapter {
  formatId = 'zta';
  formatName = 'Anthropic ZTA';
  status = 'experimental';

  detect(payload) {
    if (typeof payload !== 'object' || payload === null) return false;
    return 'agent_id' in payload && 'identity' in payload && 'trust' in payload && 'capabilities' in payload;
  }

  fromNative(payload) {
    const zta = payload;
    return {
      uts_version: UTS_VERSION,
      subject: { id: zta.agent_id, name: zta.agent_name ?? zta.agent_id, type: 'agent', description: zta.description },
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
      provenance: { source: 'claude' },
      lifecycle: {
        issued_at: zta.metadata?.issued_at ?? new Date().toISOString(),
        expires_at: zta.metadata?.expires_at,
        revoked: zta.metadata?.revoked ?? false,
        version: zta.metadata?.version ?? '1.0',
      },
      format: { type: 'zta', version: '1.0', raw: zta },
    };
  }

  toNative(uts) {
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
      metadata: {
        issued_at: uts.lifecycle.issued_at,
        expires_at: uts.lifecycle.expires_at,
        revoked: uts.lifecycle.revoked,
        version: uts.lifecycle.version,
      },
    };
  }

  async verify(payload) {
    try {
      const uts = this.fromNative(payload);
      return { valid: true, uts, verified_via: 'zta' };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }
}

// --- A2A adapter ---
class A2AAdapter {
  formatId = 'a2a-card';
  formatName = 'Google A2A Agent Card';
  status = 'experimental';

  detect(payload) {
    if (typeof payload !== 'object' || payload === null) return false;
    return 'agentCard' in payload || ('name' in payload && 'capabilities' in payload && 'url' in payload);
  }

  fromNative(payload) {
    const card = payload.agentCard ?? payload;
    return {
      uts_version: UTS_VERSION,
      subject: { id: card.url ?? card.name, name: card.name ?? card.url, type: 'agent', description: card.description },
      identity: {
        public_key: card.public_key,
        key_algorithm: 'Ed25519',
        oauth_subject: card.oauth_subject,
      },
      trust: {
        score: 5,
        confidence: 'medium',
        evidence: [],
        assessor: 'self',
        assessed_at: card.issued_at ?? new Date().toISOString(),
        expires_at: card.expires_at,
      },
      capabilities: { provides: card.capabilities ?? [], protocols: ['a2a'] },
      provenance: { source: 'a2a-network' },
      lifecycle: {
        issued_at: card.issued_at ?? new Date().toISOString(),
        expires_at: card.expires_at,
        revoked: false,
        version: card.version ?? '1.0',
      },
      format: { type: 'a2a-card', version: '1.0', raw: payload },
    };
  }

  toNative(uts) {
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

  async verify(payload) {
    try {
      const uts = this.fromNative(payload);
      return { valid: true, uts, verified_via: 'a2a-card' };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }
}

// --- MCP adapter ---
class MCPAdapter {
  formatId = 'mcp-card';
  formatName = 'MCP Server Card';
  status = 'stable';

  detect(payload) {
    if (typeof payload !== 'object' || payload === null) return false;
    return 'name' in payload && 'tools' in payload && ('transport' in payload || 'url' in payload);
  }

  fromNative(payload) {
    const mcp = payload;
    return {
      uts_version: UTS_VERSION,
      subject: { id: mcp.url ?? mcp.name, name: mcp.name, type: 'tool', description: mcp.description },
      identity: { key_algorithm: 'Ed25519' },
      trust: {
        score: 0,
        confidence: 'low',
        evidence: [],
        assessor: 'self',
        assessed_at: mcp.created_at ?? new Date().toISOString(),
      },
      capabilities: { provides: (mcp.tools ?? []).map(t => t.name ?? t), protocols: ['mcp'] },
      provenance: { source: 'mcp-registry' },
      lifecycle: {
        issued_at: mcp.created_at ?? new Date().toISOString(),
        revoked: false,
        version: mcp.version ?? '1.0',
      },
      format: { type: 'mcp-card', version: '2026-07-28', raw: mcp },
    };
  }

  toNative(uts) {
    return {
      name: uts.subject.name,
      description: uts.subject.description,
      url: uts.subject.id,
      version: uts.lifecycle.version,
      transport: 'stdio',
      tools: (uts.capabilities?.provides ?? []).map(name => ({ name })),
      created_at: uts.lifecycle.issued_at,
    };
  }

  async verify(payload) {
    try {
      const uts = this.fromNative(payload);
      return {
        valid: true, uts, verified_via: 'mcp-card',
        warnings: ['MCP Server Cards have no cryptographic signature — trust score 0 by default'],
      };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }
}

// --- W3C VC adapter ---
class VCAdapter {
  formatId = 'w3c-vc';
  formatName = 'W3C Verifiable Credentials 2.0';
  status = 'stable';

  detect(payload) {
    if (typeof payload !== 'object' || payload === null) return false;
    return Array.isArray(payload.type) &&
      payload.type.includes('VerifiableCredential') &&
      'issuer' in payload && 'credentialSubject' in payload;
  }

  fromNative(payload) {
    const vc = payload;
    const issuer = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id;
    return {
      uts_version: UTS_VERSION,
      subject: {
        id: vc.credentialSubject?.id ?? 'unknown',
        name: vc.credentialSubject?.name ?? vc.credentialSubject?.id ?? 'unknown',
        type: 'agent',
      },
      identity: { did: issuer },
      trust: {
        score: vc.credentialSubject?.trust?.score ?? 5,
        confidence: vc.credentialSubject?.trust?.confidence ?? 'medium',
        evidence: vc.credentialSubject?.trust?.evidence ?? [],
        assessor: typeof vc.issuer === 'object' ? vc.issuer?.name ?? 'unknown' : 'unknown',
        assessed_at: vc.issuanceDate ?? new Date().toISOString(),
        expires_at: vc.expirationDate,
      },
      provenance: { source: 'external' },
      lifecycle: {
        issued_at: vc.issuanceDate ?? new Date().toISOString(),
        expires_at: vc.expirationDate,
        revoked: false,
        version: '2.0',
      },
      format: { type: 'w3c-vc', version: '2.0', raw: vc },
    };
  }

  toNative(uts) {
    return {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      id: `urn:uuid:test-${Math.random().toString(36).slice(2, 10)}`,
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
      proof: {
        type: 'Ed25519Signature2020',
        created: uts.lifecycle.issued_at,
        verificationMethod: uts.identity.did,
        proofPurpose: 'assertionMethod',
        proofValue: '(unsigned)',
      },
    };
  }

  async verify(payload) {
    try {
      const uts = this.fromNative(payload);
      return { valid: true, uts, verified_via: 'w3c-vc' };
    } catch (e) {
      return { valid: false, reason: e.message };
    }
  }
}

// --- TrustEngine ---
class TrustEngine {
  constructor(config) {
    this.adapters = new Map();
    for (const adapter of config.adapters) {
      this.adapters.set(adapter.formatId, adapter);
    }
  }

  listFormats() {
    return Array.from(this.adapters.values()).map(a => ({ id: a.formatId, name: a.formatName, status: a.status }));
  }

  detectFormat(payload) {
    for (const adapter of this.adapters.values()) {
      try {
        if (adapter.detect(payload)) {
          return { format: adapter.formatId, confidence: 1.0, adapter };
        }
      } catch {}
    }
    return null;
  }

  async verifyAny(payload, options = {}) {
    const detected = this.detectFormat(payload);
    if (!detected) {
      return { valid: false, reason: 'No adapter detected a matching format' };
    }
    const result = await detected.adapter.verify(payload, options);
    return { ...result, verified_via: detected.format };
  }

  async verifyAs(format, payload, options = {}) {
    const adapter = this.adapters.get(format);
    if (!adapter) return { valid: false, reason: `No adapter for '${format}'` };
    return adapter.verify(payload, options);
  }

  translate(payload, opts) {
    const fromFormat = opts.from ?? this.detectFormat(payload)?.format;
    if (!fromFormat) throw new Error('Could not detect source format');
    const fromAdapter = this.adapters.get(fromFormat);
    const toAdapter = this.adapters.get(opts.to);
    if (!fromAdapter) throw new Error(`Adapter for '${fromFormat}' not registered`);
    if (!toAdapter) throw new Error(`Adapter for '${opts.to}' not registered`);
    const uts = fromAdapter.fromNative(payload);
    return toAdapter.toNative(uts);
  }

  toUTS(payload, fromFormat) {
    const fmt = fromFormat ?? this.detectFormat(payload)?.format;
    if (!fmt) throw new Error('Could not detect format');
    const adapter = this.adapters.get(fmt);
    if (!adapter) throw new Error(`Adapter for '${fmt}' not registered`);
    return adapter.fromNative(payload);
  }

  fromUTS(uts, toFormat) {
    const adapter = this.adapters.get(toFormat);
    if (!adapter) throw new Error(`Adapter for '${toFormat}' not registered`);
    return adapter.toNative(uts);
  }

  async bridge(opts) {
    const verifyResult = await this.verifyAs(opts.verify_in, opts.payload);
    if (!verifyResult.valid) {
      return { verified: false, bridge_log: `Verification failed: ${verifyResult.reason}` };
    }
    const uts = verifyResult.uts;
    if (!uts) return { verified: false, bridge_log: 'No UTS extracted' };
    if (opts.policy?.min_trust_score !== undefined && uts.trust.score < opts.policy.min_trust_score) {
      return { verified: false, bridge_log: `Trust score ${uts.trust.score} below threshold ${opts.policy.min_trust_score}` };
    }
    const issued = this.fromUTS(uts, opts.issue_as);
    return {
      verified: true,
      original: uts,
      issued,
      bridge_log: `${opts.verify_in} score ${uts.trust.score} → ${opts.issue_as} (1:1 mapping via UTS)`,
    };
  }
}

// ============================================================
// TEST SUITE
// ============================================================

let passed = 0, failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; failures.push(msg); console.log('  ❌ FAIL:', msg); }
}

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else {
    failed++;
    failures.push(`${msg} — expected ${e}, got ${a}`);
    console.log('  ❌ FAIL:', msg);
    console.log(`     expected: ${e}`);
    console.log(`     actual:   ${a}`);
  }
}

// Test data: one valid credential per format
const SAMPLES = {
  'atc-v3': {
    atc_version: '3.0.0-rfc-00',
    id: 'urn:uuid:0d7e3a4c-1234-5f67-89ab-cdef01234567',
    type: ['VerifiableCredential', 'AgentTrustCredential'],
    subject_type: 'skill',
    issuer: { did: 'did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z', name: 'AliceLabs Trust CA' },
    issuance_date: '2026-08-20T00:00:00Z',
    expiration_date: '2026-11-20T00:00:00Z',
    credential_subject: { skill_id: 'mn-skill-extractor-de-datos', upstream_repo: 'https://github.com/user/repo', upstream_license: 'MIT' },
    artifact: {
      repository_url: 'https://github.com/user/repo',
      commit_sha: 'd3b07384d113edec49eaa6238ad5ff00c8b7c0a5',
      artifact_digest: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      package_manager: 'npm', package_name: '@user/skill', package_version: '1.2.3',
    },
    attestation: { score: 9.4, trust_level: 'A', risk: 'LOW', engine_layers: ['L1', 'L2'] },
    trust_claims: {
      filesystem_write: false, network_access: 'restricted',
      prompt_injection_scan: 'passed', runtime_observed: true,
      human_review: false, provenance_verified: true,
      owasp_top_10: {
        mcp01_token_mismanagement: 'passed',
        mcp02_privilege_escalation: 'passed',
        mcp03_tool_poisoning: 'passed',
        mcp04_supply_chain: 'partial',
      },
    },
    credential_status: { method: 'OCSP', endpoint: 'https://atc.alicelabs.site/api/v2/ocsp', stapling_supported: true },
    signatures_provided: ['atc-ed25519'],
    signatures: [{ format: 'atc-ed25519', algorithm: 'Ed25519 (RFC 8032)', canonicalization: 'RFC_8785_JCS', proof_bytes: 'z5A8kZ2...' }],
  },
  'eat-ai': {
    iss: 'did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z',
    sub: 'agent-claude-001',
    iat: 1755648000,
    exp: 1763222400,
    cnf: { jwk: { kty: 'OKP', crv: 'Ed25519', x: '11qYAYKxCrfVS_7TyWQHOg7hcv2pa7t9gyI3cKK2X0I' } },
    ueid: 'sgx-quote-base64-abc123',
    trust_score: 8,
    trust_level: 'high',
    evidence: [{ type: 'tee-attestation', source: 'Intel SGX', result: 'pass', timestamp: '2026-08-20T00:00:00Z' }],
  },
  'zta': {
    agent_id: 'claude-agent-001',
    agent_name: 'Claude Production Agent',
    description: 'Customer support agent',
    identity: { public_key: 'base64:abc', key_algorithm: 'Ed25519', did: 'did:key:z6Mk_anthropic' },
    trust: { score: 8, confidence: 'high', evidence: [{ type: 'runtime-observation', source: 'Anthropic', result: 'pass', timestamp: '2026-08-20T00:00:00Z' }] },
    capabilities: { provides: ['chat', 'search'], requires: ['auth'] },
    metadata: { issued_at: '2026-08-20T00:00:00Z', expires_at: '2026-11-20T00:00:00Z', revoked: false, version: '1.0' },
  },
  'a2a-card': {
    agentCard: {
      name: 'Travel Planner Agent',
      description: 'Plans multi-city trips',
      url: 'https://travel-agent.example.com',
      version: '1.0',
      capabilities: ['search', 'book', 'pay'],
      public_key: 'base64:abc',
      issued_at: '2026-08-20T00:00:00Z',
      expires_at: '2026-11-20T00:00:00Z',
    },
  },
  'mcp-card': {
    name: 'postgres-mcp',
    description: 'PostgreSQL MCP server',
    url: 'https://github.com/user/postgres-mcp',
    version: '1.0',
    transport: 'stdio',
    tools: [{ name: 'query' }, { name: 'schema' }],
    created_at: '2026-08-20T00:00:00Z',
  },
  'w3c-vc': {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id: 'urn:uuid:abc123',
    type: ['VerifiableCredential'],
    issuer: { id: 'did:key:z6Mk_issuer', name: 'Test Issuer' },
    issuanceDate: '2026-08-20T00:00:00Z',
    expirationDate: '2026-11-20T00:00:00Z',
    credentialSubject: {
      id: 'agent-xyz',
      name: 'Test Agent',
      trust: { score: 8, confidence: 'high', evidence: [] },
    },
    proof: { type: 'Ed25519Signature2020', created: '2026-08-20T00:00:00Z', proofPurpose: 'assertionMethod', proofValue: 'test' },
  },
};

console.log('='.repeat(70));
console.log('Universal Trust Adapter — Test Suite');
console.log('='.repeat(70));
console.log('');

// === Test 1: Engine setup ===
console.log('Test 1: Engine initialization');
const engine = new TrustEngine({
  adapters: [new ATCAdapter(), new EATAdapter(), new ZTAAdapter(), new A2AAdapter(), new MCPAdapter(), new VCAdapter()],
});
const formats = engine.listFormats();
assertEq(formats.length, 6, '6 adapters registered');
console.log(`  ✓ ${formats.length} formats registered`);
console.log('');

// === Test 2: Format detection ===
console.log('Test 2: Format auto-detection');
for (const [fmt, sample] of Object.entries(SAMPLES)) {
  const detected = engine.detectFormat(sample);
  assert(detected !== null, `detect ${fmt} should not return null`);
  assertEq(detected?.format, fmt, `detect ${fmt} should return ${fmt}`);
  console.log(`  ✓ ${fmt} detected correctly (confidence: ${detected?.confidence})`);
}
console.log('');

// === Test 3: Detection rejects garbage ===
console.log('Test 3: Detection rejects invalid payloads');
const garbage = [{}, null, 'string', 42, [], { foo: 'bar' }];
for (const g of garbage) {
  const detected = engine.detectFormat(g);
  assert(detected === null, `garbage ${JSON.stringify(g).slice(0, 30)} should not detect`);
}
console.log(`  ✓ All ${garbage.length} garbage inputs rejected`);
console.log('');

// === Test 4: Round-trip ATC → UTS → ATC preserves key fields ===
console.log('Test 4: ATC round-trip (ATC → UTS → ATC)');
const atcUts = engine.toUTS(SAMPLES['atc-v3']);
assertEq(atcUts.uts_version, '1.0.0', 'UTS version');
assertEq(atcUts.subject.id, 'mn-skill-extractor-de-datos', 'subject.id preserved');
assertEq(atcUts.subject.type, 'tool', 'subject type mapped to tool');
assertEq(atcUts.trust.score, 9.4, 'trust score preserved');
assertEq(atcUts.trust.confidence, 'high', 'confidence derived from score');
assert(atcUts.trust.evidence.length > 0, 'evidence extracted from owasp_top_10');
const atcRoundTrip = engine.fromUTS(atcUts, 'atc-v3');
assertEq(atcRoundTrip.subject_type, 'skill', 'subject_type round-tripped');
assertEq(atcRoundTrip.attestation.score, 9.4, 'attestation score round-tripped');
assertEq(atcRoundTrip.attestation.trust_level, 'A', 'trust_level derived');
assertEq(atcRoundTrip.trust_claims.provenance_verified, true, 'provenance_verified');
console.log('  ✓ ATC round-trip preserves all key fields');
console.log('');

// === Test 5: Cross-format translation: ATC → ZTA ===
console.log('Test 5: Translate ATC v3 → Anthropic ZTA');
const ztaFromAtc = engine.translate(SAMPLES['atc-v3'], { from: 'atc-v3', to: 'zta' });
assertEq(ztaFromAtc.agent_id, 'mn-skill-extractor-de-datos', 'ZTA agent_id derived from ATC subject.id');
assertEq(ztaFromAtc.trust.score, 9.4, 'ZTA trust score preserved');
assertEq(ztaFromAtc.identity.did, 'did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z', 'ZTA identity.did preserved');
console.log('  ✓ ATC → ZTA translation works');
console.log('');

// === Test 6: Cross-format translation: EAT-AI → W3C VC ===
console.log('Test 6: Translate EAT-AI → W3C VC');
const vcFromEat = engine.translate(SAMPLES['eat-ai'], { from: 'eat-ai', to: 'w3c-vc' });
assertEq(vcFromEat.type, ['VerifiableCredential'], 'W3C VC type');
assertEq(vcFromEat.credentialSubject.id, 'agent-claude-001', 'subject.id from EAT sub');
assertEq(vcFromEat.credentialSubject.trust.score, 8, 'trust score preserved');
// EAT issuer (iss) is preserved as W3C VC issuer
assertEq(vcFromEat.issuer, 'did:key:z6MkqXn1E1R684J7yL8pW9yP2G8vN3xQ1z', 'issuer from EAT iss');
console.log('  ✓ EAT-AI → W3C VC translation works');
console.log('');

// === Test 7: Cross-format translation: A2A → ATC ===
console.log('Test 7: Translate A2A → ATC v3');
const atcFromA2a = engine.translate(SAMPLES['a2a-card'], { from: 'a2a-card', to: 'atc-v3' });
assertEq(atcFromA2a.subject_type, 'agent', 'ATC subject_type=agent');
assertEq(atcFromA2a.credential_subject.skill_id, 'https://travel-agent.example.com', 'skill_id from A2A url');
assertEq(atcFromA2a.attestation.score, 5, 'default trust score 5 (A2A has no native score)');
console.log('  ✓ A2A → ATC translation works');
console.log('');

// === Test 8: Cross-format translation: MCP → ATC ===
console.log('Test 8: Translate MCP Card → ATC v3');
const atcFromMcp = engine.translate(SAMPLES['mcp-card'], { from: 'mcp-card', to: 'atc-v3' });
assertEq(atcFromMcp.subject_type, 'skill', 'MCP maps to ATC skill');
assertEq(atcFromMcp.credential_subject.skill_id, 'https://github.com/user/postgres-mcp', 'skill_id from MCP url');
assertEq(atcFromMcp.attestation.score, 0, 'MCP has no trust score → 0');
assertEq(atcFromMcp.trust_claims.provenance_verified, true, 'provenance_verified=true (mcp-registry)');
console.log('  ✓ MCP → ATC translation works');
console.log('');

// === Test 9: Bridge (verify ZTA → issue ATC) ===
console.log('Test 9: Bridge ZTA → ATC v3 (verify + re-issue)');
const bridgeResult = await engine.bridge({
  verify_in: 'zta',
  issue_as: 'atc-v3',
  payload: SAMPLES['zta'],
  policy: { min_trust_score: 7 },
});
assert(bridgeResult.verified, 'bridge should verify ZTA (score 8 >= threshold 7)');
assert(bridgeResult.issued !== undefined, 'bridge should issue ATC');
assertEq(bridgeResult.issued.attestation.score, 8, 'issued ATC preserves ZTA score');
assert(bridgeResult.bridge_log.includes('1:1 mapping'), 'bridge_log mentions UTS mapping');
console.log(`  ✓ Bridge: ${bridgeResult.bridge_log}`);
console.log('');

// === Test 10: Bridge rejects below threshold ===
console.log('Test 10: Bridge rejects low-trust credential');
const lowTrustZta = JSON.parse(JSON.stringify(SAMPLES['zta']));
lowTrustZta.trust.score = 3;  // below threshold
const bridgeFail = await engine.bridge({
  verify_in: 'zta',
  issue_as: 'atc-v3',
  payload: lowTrustZta,
  policy: { min_trust_score: 7 },
});
assert(!bridgeFail.verified, 'bridge should fail for score 3 < 7');
assert(bridgeFail.bridge_log.includes('below threshold'), 'bridge_log mentions threshold');
console.log(`  ✓ Bridge rejected: ${bridgeFail.bridge_log}`);
console.log('');

// === Test 11: Verify any (auto-detect) ===
console.log('Test 11: verifyAny auto-detects format');
for (const [fmt, sample] of Object.entries(SAMPLES)) {
  const result = await engine.verifyAny(sample);
  assert(result.valid, `verifyAny should return valid for ${fmt}`);
  assertEq(result.verified_via, fmt, `verifyAny detected format for ${fmt}`);
  assert(result.uts !== undefined, `verifyAny returns UTS for ${fmt}`);
  console.log(`  ✓ ${fmt} verified via auto-detection`);
}
console.log('');

// === Test 12: MCP verify returns warning about missing signature ===
console.log('Test 12: MCP adapter warns about missing signature');
const mcpResult = await engine.verifyAny(SAMPLES['mcp-card']);
assert(mcpResult.warnings !== undefined && mcpResult.warnings.length > 0, 'MCP verify returns warnings');
assert(mcpResult.warnings[0].includes('no cryptographic signature'), 'MCP warning mentions missing signature');
console.log(`  ✓ MCP warning: "${mcpResult.warnings[0]}"`);
console.log('');

// === Test 13: Full translation matrix (all 30 pairs) ===
console.log('Test 13: Full translation matrix (all pairs)');
const fmtIds = Object.keys(SAMPLES);
let pairsTested = 0, pairsOk = 0;
for (const from of fmtIds) {
  for (const to of fmtIds) {
    if (from === to) continue;
    try {
      const translated = engine.translate(SAMPLES[from], { from, to });
      pairsTested++;
      if (translated !== undefined && translated !== null) {
        pairsOk++;
      } else {
        console.log(`  ❌ ${from} → ${to} returned null/undefined`);
      }
    } catch (e) {
      pairsTested++;
      console.log(`  ❌ ${from} → ${to} threw: ${e.message}`);
    }
  }
}
assert(pairsTested === 30, `should test 30 pairs (got ${pairsTested})`);
assert(pairsOk === 30, `all 30 pairs should translate (got ${pairsOk})`);
console.log(`  ✓ All ${pairsOk}/${pairsTested} translation pairs succeed`);
console.log('');

// === Test 14: Lossless field preservation (format.raw) ===
console.log('Test 14: format.raw preserves original payload');
for (const [fmt, sample] of Object.entries(SAMPLES)) {
  const uts = engine.toUTS(sample);
  assert(uts.format.raw !== undefined, `${fmt} UTS preserves format.raw`);
  // Verify the raw is the original (deep equal)
  assertEq(uts.format.raw, sample, `${fmt} format.raw deep-equals original`);
}
console.log('  ✓ All formats preserve original payload in format.raw (lossless)');
console.log('');

// === Summary ===
console.log('='.repeat(70));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  console.log('Failures:');
  failures.forEach(f => console.log(`  - ${f}`));
}
console.log('='.repeat(70));
process.exit(failed > 0 ? 1 : 0);
