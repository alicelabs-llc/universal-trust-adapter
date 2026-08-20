/**
 * @marketnow/trust-adapters
 * BLOQUE F: EAT-AI Adapter — IETF Entity Attestation Token (CWT/CBOR)
 * BLOQUE G: W3C VC Adapter — Verifiable Credentials with Ed25519Signature2020
 * BLOQUE H: OAuth/OIDC Adapter — JWT with RS256 + JWKS
 * BLOQUE I: SPIFFE SVID Adapter — X.509 + JWT-SVID
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import { canonicalize, canonicalHash, sign, verify, DOMAINS, type Ed25519KeyPair } from '../core/crypto.js';
import type { UTSv2 } from '../uts/index.js';

// ============================================================================
// BLOQUE F: EAT-AI Adapter
// ============================================================================
// EAT-AI uses CWT (CBOR Web Token) — we accept JSON-decoded CWT claims
// and produce JSON representations (CBOR encoding is a separate step).
// ============================================================================

export class EATAIAdapter {
  formatId = 'eat-ai' as const;
  formatName = 'IETF EAT-AI (CWT/CBOR)';
  formatVersion = 'draft-00';
  status = 'beta' as const;

  detect(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as Record<string, unknown>;
    // EAT-AI claims have: iss, sub, iat (standard CWT claims)
    // Plus EAT-specific: ueid, ote, trust_score
    return !!(p.iss && p.sub && (p.iat || p.trust_score !== undefined));
  }

  fromNative(payload: unknown): Partial<UTSv2> {
    const claims = payload as Record<string, any>;
    return {
      uts_version: '2.0.0',
      subject: {
        id: claims.sub,
        name: claims.name || claims.sub,
        type: 'agent',
      },
      identity: {
        public_keys: claims.cnf?.jwk ? [{
          key: claims.cnf.jwk,
          algorithm: 'ES256',
          key_id: claims.kid || 'unknown',
          status: 'active',
        }] : [],
        tee_attestations: claims.ueid ? [{
          type: 'SGX',
          quote: claims.ueid,
          verified: false,
        }] : undefined,
      },
      attestations: [{
        type: 'tee-attestation',
        issuer: claims.iss,
        evidence: claims.evidence || [],
        issued_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : new Date().toISOString(),
      }],
      assessment: {
        methodology: 'EAT-AI',
        methodology_version: 'draft-00',
        inputs: [],
        result: {
          score: claims.trust_score || 0,
          confidence: claims.trust_level === 'high' ? 'high' : 'medium',
          risk_level: 'low',
        },
        computed_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : new Date().toISOString(),
        computed_by: claims.iss || 'unknown',
        reproducible: false,
      },
      lifecycle: {
        issued_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : new Date().toISOString(),
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
        revoked: false,
        version: 'draft-00',
      },
      format: { type: 'eat-ai', version: 'draft-00', raw: payload },
    };
  }

  toNative(uts: Partial<UTSv2>): Record<string, unknown> {
    return {
      iss: uts.assessment?.computed_by,
      sub: uts.subject?.id,
      name: uts.subject?.name,
      iat: uts.lifecycle?.issued_at ? Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000) : undefined,
      exp: uts.lifecycle?.expires_at ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000) : undefined,
      trust_score: uts.assessment?.result.score,
      trust_level: uts.assessment?.result.confidence,
      evidence: uts.attestations?.flatMap(a => a.evidence) || [],
      capabilities: uts.capabilities?.provides || [],
      cnf: uts.identity?.public_keys?.[0] ? { jwk: uts.identity.public_keys[0].key } : undefined,
      ueid: uts.identity?.tee_attestations?.[0]?.quote,
      note: 'JSON representation of CWT claims — encode to CBOR for wire format',
    };
  }
}

// ============================================================================
// BLOQUE G: W3C VC Adapter — Verifiable Credentials with Ed25519Signature2020
// ============================================================================

export class W3CVCAdapter {
  formatId = 'w3c-vc' as const;
  formatName = 'W3C Verifiable Credentials 2.0';
  formatVersion = '2.0';
  status = 'beta' as const;

  detect(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as Record<string, unknown>;
    // W3C VC has: @context, type, issuer, credentialSubject, proof
    return !!(p['@context'] && p.type && p.issuer && p.credentialSubject);
  }

  fromNative(payload: unknown): Partial<UTSv2> {
    const vc = payload as Record<string, any>;
    const proof = vc.proof || {};
    const subject = vc.credentialSubject || {};

    return {
      uts_version: '2.0.0',
      subject: {
        id: subject.id || 'unknown',
        name: subject.name || subject.id || 'VC Subject',
        type: 'agent',
      },
      identity: {
        public_keys: proof.verificationMethod ? [{
          key: proof.verificationMethod,
          algorithm: 'Ed25519',
          key_id: proof.verificationMethod,
          status: 'active',
        }] : [],
      },
      attestations: [{
        type: 'human-review',
        issuer: vc.issuer || 'unknown',
        evidence: [],
        issued_at: vc.issuanceDate || new Date().toISOString(),
      }],
      assessment: {
        methodology: 'W3C VC',
        methodology_version: '2.0',
        inputs: [],
        result: { score: 0, confidence: 'low', risk_level: 'not_audited' },
        computed_at: vc.issuanceDate || new Date().toISOString(),
        computed_by: vc.issuer || 'unknown',
        reproducible: false,
      },
      lifecycle: {
        issued_at: vc.issuanceDate || new Date().toISOString(),
        expires_at: vc.expirationDate,
        revoked: false,
        version: '2.0',
      },
      format: { type: 'w3c-vc', version: '2.0', raw: payload },
    };
  }

  toNative(uts: Partial<UTSv2>): Record<string, unknown> {
    return {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiableCredential'],
      issuer: uts.assessment?.computed_by || 'unknown',
      issuanceDate: uts.lifecycle?.issued_at,
      expirationDate: uts.lifecycle?.expires_at,
      credentialSubject: {
        id: uts.subject?.id,
        name: uts.subject?.name,
        capabilities: uts.capabilities?.provides,
      },
      proof: {
        type: 'Ed25519Signature2020',
        created: uts.lifecycle?.issued_at,
        verificationMethod: uts.identity?.public_keys?.[0]?.key_id,
        proofPurpose: 'assertionMethod',
        proofValue: '...', // would be signed with Ed25519Signature2020
      },
    };
  }
}

// ============================================================================
// BLOQUE H: OAuth/OIDC Adapter — JWT with RS256
// ============================================================================

export class OAuthAdapter {
  formatId = 'oauth-token' as const;
  formatName = 'OAuth 2.0 / OIDC Token';
  formatVersion = '2.0';
  status = 'beta' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'string') return false;
    // JWT format: header.payload.signature (3 base64 parts)
    const parts = payload.split('.');
    return parts.length === 3;
  }

  fromNative(payload: unknown): Partial<UTSv2> {
    // Decode JWT (no verification — that requires JWKS fetching)
    const jwt = payload as string;
    const [headerB64, payloadB64] = jwt.split('.');
    const decode = (b64: string) => JSON.parse(Buffer.from(b64, 'base64url').toString());
    const header = decode(headerB64);
    const claims = decode(payloadB64);

    return {
      uts_version: '2.0.0',
      subject: {
        id: claims.sub || 'unknown',
        name: claims.name || claims.sub || 'OAuth Subject',
        type: 'human',
      },
      identity: {
        public_keys: [],
        oauth_subject: claims.sub,
      },
      attestations: [],
      capabilities: {
        provides: claims.scope?.split(' ') || [],
        requires: [],
        protocols: ['rest'],
      },
      policies: claims.scope?.includes('admin') ? [{
        id: 'oauth-scope-admin',
        allowed_actions: ['*'],
      }] : [],
      assessment: {
        methodology: 'OAuth',
        methodology_version: '2.0',
        inputs: [],
        result: { score: 0, confidence: 'low', risk_level: 'not_audited' },
        computed_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : new Date().toISOString(),
        computed_by: claims.iss || 'unknown',
        reproducible: false,
      },
      lifecycle: {
        issued_at: claims.iat ? new Date(claims.iat * 1000).toISOString() : new Date().toISOString(),
        expires_at: claims.exp ? new Date(claims.exp * 1000).toISOString() : undefined,
        revoked: false,
        version: '2.0',
      },
      format: { type: 'oauth-token', version: header.alg, raw: payload },
    };
  }

  toNative(uts: Partial<UTSv2>): string {
    // Producing a JWT requires RS256 signing (not implemented in pure JS without libraries)
    // Return a header.payload structure (unsigned)
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      iss: uts.assessment?.computed_by,
      sub: uts.subject?.id,
      name: uts.subject?.name,
      iat: uts.lifecycle?.issued_at ? Math.floor(new Date(uts.lifecycle.issued_at).getTime() / 1000) : undefined,
      exp: uts.lifecycle?.expires_at ? Math.floor(new Date(uts.lifecycle.expires_at).getTime() / 1000) : undefined,
      scope: uts.capabilities?.provides?.join(' '),
    };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${headerB64}.${payloadB64}.UNSIGNED`;
  }
}

// ============================================================================
// BLOQUE I: SPIFFE SVID Adapter — X.509 + JWT-SVID
// ============================================================================

export class SPIFFEAdapter {
  formatId = 'spiffe-svid' as const;
  formatName = 'SPIFFE SVID';
  formatVersion = '1.0';
  status = 'beta' as const;

  detect(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const p = payload as Record<string, unknown>;
    // SPIFFE SVID has: spiffe_id, or it's a JWT-SVID with spiffe:// in sub
    return !!(p.spiffe_id || (typeof p === 'string' && p.includes('spiffe://')) ||
      (p.sub && typeof p.sub === 'string' && p.sub.startsWith('spiffe://')));
  }

  fromNative(payload: unknown): Partial<UTSv2> {
    const svid = payload as Record<string, any>;
    const spiffeId = svid.spiffe_id || svid.sub || 'spiffe://unknown';

    return {
      uts_version: '2.0.0',
      subject: {
        id: spiffeId,
        name: spiffeId.split('/')[-1] || 'SPIFFE Workload',
        type: 'service',
      },
      identity: {
        public_keys: svid.x509_certificate ? [{
          key: svid.x509_certificate,
          algorithm: 'ES256',
          key_id: spiffeId,
          status: 'active',
        }] : [],
      },
      attestations: [],
      capabilities: {
        provides: [],
        requires: [],
        protocols: ['grpc', 'rest'],
      },
      assessment: {
        methodology: 'SPIFFE',
        methodology_version: '1.0',
        inputs: [],
        result: { score: 5, confidence: 'medium', risk_level: 'low' },
        computed_at: new Date().toISOString(),
        computed_by: spiffeId.split('/')[2] || 'SPIFFE Trust Domain',
        reproducible: false,
      },
      lifecycle: {
        issued_at: svid.iat ? new Date(svid.iat * 1000).toISOString() : new Date().toISOString(),
        expires_at: svid.exp ? new Date(svid.exp * 1000).toISOString() : undefined,
        revoked: false,
        version: '1.0',
      },
      format: { type: 'spiffe-svid', version: '1.0', raw: payload },
    };
  }

  toNative(uts: Partial<UTSv2>): Record<string, unknown> {
    return {
      spiffe_id: uts.subject?.id,
      trust_domain: uts.subject?.id?.split('/')[2] || 'unknown',
      workload_name: uts.subject?.name,
      issued_at: uts.lifecycle?.issued_at,
      expires_at: uts.lifecycle?.expires_at,
    };
  }
}
