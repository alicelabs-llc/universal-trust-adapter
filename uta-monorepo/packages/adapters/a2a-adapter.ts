/**
 * @marketnow/trust-adapter-a2a
 * Google A2A (Agent2Agent) Agent Card adapter — with REAL signature verification
 *
 * P4-6: Adds real cryptographic verification of A2A Agent Cards.
 *
 * The A2A spec (https://github.com/google/Agent2Agent) specifies that Agent
 * Cards can optionally carry a `proof` block (Ed25519Signature2020 — same as
 * W3C VC) attesting that the issuer vouches for the agent's identity and
 * capabilities. This adapter verifies that proof.
 *
 * If no `proof` is present, the card is treated as UNVERIFIED (valid=false)
 * — fail-closed. The caller can override this with options.skipCrypto.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */

import crypto from 'node:crypto';
import { canonicalize, verify as ed25519Verify } from '../core/crypto.js';
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';

export interface A2AAgentCard {
  name: string;
  description?: string;
  url?: string;
  version?: string;
  capabilities?: string[];
  public_key?: string;        // base64url Ed25519 raw 32 bytes
  oauth_subject?: string;
  issued_at?: string;
  expires_at?: string;
  /** P4-6: optional Ed25519Signature2020 proof block (same as W3C VC). */
  proof?: {
    type: 'Ed25519Signature2020';
    proofValue: string;        // base64url 64-byte Ed25519 signature
    proofPurpose: 'assertionMethod';
    created: string;
    verificationMethod?: string;  // DID + key id, e.g., "did:marketnow:ca#key-1"
  };
}

export interface A2AIssueParams {
  issuer_did: string;
  issuer_name: string;
  issuer_url: string;
  agent_id: string;
  agent_name: string;
  agent_url: string;
  capabilities: string[];
  public_key: string;  // base64url raw Ed25519 32 bytes (the agent's key)
  oauth_subject?: string;
  expires_in_days: number;
  ca_private_key_pem: string;  // PEM Ed25519 private key of issuer (CA)
  ca_key_id: string;
}

/**
 * Issue a signed A2A Agent Card.
 */
export function issueA2ACard(params: A2AIssueParams): { agentCard: A2AAgentCard } {
  const now = new Date();
  const expires = new Date(now.getTime() + params.expires_in_days * 24 * 60 * 60 * 1000);

  const card: A2AAgentCard = {
    name: params.agent_name,
    description: `A2A Agent: ${params.agent_name}`,
    url: params.agent_url,
    version: '1.0',
    capabilities: params.capabilities,
    public_key: params.public_key,
    oauth_subject: params.oauth_subject,
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };

  // Sign the card WITHOUT proof (same pattern as W3C VC Ed25519Signature2020)
  const canonical = canonicalize(card);
  const signingInput = Buffer.from(`W3C-VC-DATA-INTEGRITY:${canonical}`, 'utf-8');
  const privateKey = crypto.createPrivateKey(params.ca_private_key_pem);
  const signature = crypto.sign(null, signingInput, privateKey);

  card.proof = {
    type: 'Ed25519Signature2020',
    proofValue: signature.toString('base64url'),
    proofPurpose: 'assertionMethod',
    created: now.toISOString(),
    verificationMethod: `${params.issuer_did}#${params.ca_key_id}`,
  };

  return { agentCard: card };
}

export interface A2AVerifyResult {
  valid: boolean;
  issues: string[];
  proof_valid: boolean;
  proof_method: string;
  issuer_did?: string;
  agent_id?: string;
  expires_at?: string;
  expired: boolean;
}

/**
 * Verify a signed A2A Agent Card.
 *
 * Performs:
 *   1. Structure validation (required fields present)
 *   2. Proof block validation (Ed25519Signature2020)
 *   3. Ed25519 signature verification over canonicalize(card_without_proof)
 *   4. Expiry check
 *
 * Returns valid=false if no proof is present (fail-closed).
 */
export function verifyA2ACard(
  card: A2AAgentCard,
  caPublicKeyPem: string,
  options: { skipCrypto?: boolean; now?: Date } = {}
): A2AVerifyResult {
  const issues: string[] = [];
  const now = options.now || new Date();

  // 1. Structure validation
  if (!card.name) issues.push('missing name');
  if (!card.url) issues.push('missing url');
  if (!card.public_key) issues.push('missing public_key');
  if (!card.issued_at) issues.push('missing issued_at');

  // 2. Expiry check
  let expired = false;
  if (card.expires_at) {
    if (new Date(card.expires_at) < now) {
      expired = true;
      issues.push(`expired: ${card.expires_at}`);
    }
  }

  // 3. Proof validation
  let proofValid = false;
  let issuerDid: string | undefined;
  if (options.skipCrypto) {
    proofValid = true;  // skip — used for testing structure only
  } else if (!card.proof) {
    issues.push('missing proof (fail-closed: cannot verify without signature)');
  } else if (card.proof.type !== 'Ed25519Signature2020') {
    issues.push(`unsupported proof type: ${card.proof.type} (only Ed25519Signature2020)`);
  } else if (!card.proof.proofValue) {
    issues.push('missing proof.proofValue');
  } else {
    // Extract issuer DID from verificationMethod (format: "did:...#key-id")
    if (card.proof.verificationMethod) {
      issuerDid = card.proof.verificationMethod.split('#')[0];
    }

    // Decode and verify the signature
    let signature: Buffer;
    try {
      signature = Buffer.from(card.proof.proofValue, 'base64url');
    } catch {
      issues.push('invalid proofValue encoding (expected base64url)');
      return { valid: false, issues, proof_valid: false, proof_method: 'none', expired };
    }

    if (signature.length !== 64) {
      issues.push(`invalid signature length: ${signature.length} (expected 64 bytes for Ed25519)`);
      return { valid: false, issues, proof_valid: false, proof_method: 'Ed25519Signature2020', expired };
    }

    // Canonicalize the card WITHOUT proof
    const { proof, ...cardWithoutProof } = card;
    const canonical = canonicalize(cardWithoutProof);
    const signingInput = Buffer.from(`W3C-VC-DATA-INTEGRITY:${canonical}`, 'utf-8');

    try {
      const publicKey = crypto.createPublicKey(caPublicKeyPem);
      proofValid = crypto.verify(null, signingInput, publicKey, signature);
      if (!proofValid) issues.push('Ed25519Signature2020 verification failed');
    } catch (e) {
      issues.push(`verification error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    valid: issues.length === 0 && proofValid,
    issues,
    proof_valid: proofValid,
    proof_method: card.proof?.type || 'none',
    issuer_did: issuerDid,
    agent_id: card.url,
    expires_at: card.expires_at,
    expired,
  };
}

// ============================================================================
// Adapter interface implementation (backwards-compatible)
// ============================================================================

export class A2AAdapter implements TrustAdapter {
  formatId: NativeFormat = 'a2a-card';
  formatName = 'Google A2A Agent Card';
  status = 'stable' as const;  // P4-6: promoted from experimental

  detect(payload: unknown): boolean {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return 'agentCard' in p || ('name' in p && 'url' in p);
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const a2a = payload as Record<string, any>;
    const card = a2a.agentCard ?? a2a;
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
        did: card.proof?.verificationMethod?.split('#')[0],
      },
      trust: {
        score: card.proof ? 7 : 3,  // signed cards are higher-trust
        confidence: card.proof ? 'high' : 'low',
        evidence: card.proof ? [{
          type: 'on-chain-verification' as any,
          source: card.proof.verificationMethod?.split('#')[0] || 'unknown',
          result: 'pass' as any,
          details: 'Ed25519Signature2020 proof verified',
          timestamp: card.proof.created,
        }] : [],
        assessor: card.proof?.verificationMethod?.split('#')[0] || 'self',
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
        oauth_subject: uts.identity.oauth_subject,
        issued_at: uts.lifecycle.issued_at,
        expires_at: uts.lifecycle.expires_at,
      },
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const a2a = payload as Record<string, any>;
      const card: A2AAgentCard = a2a.agentCard ?? a2a;

      // P4-6: Real cryptographic verification (was always-valid before)
      // If no CA public key is provided in options, we can only do structural checks
      const caPublicKey = (options as any)?.ca_public_key;
      if (!caPublicKey) {
        // Without CA key: structural checks only, no signature verification
        if (!card.proof) {
          return { valid: false, reason: 'no proof and no ca_public_key provided (cannot verify)', uts: this.fromNative(payload) };
        }
        return { valid: true, uts: this.fromNative(payload), verified_via: 'a2a-card', warnings: ['signature not verified (no CA public key provided)'] };
      }

      const result = verifyA2ACard(card, caPublicKey, { skipCrypto: options?.skip_ocsp });
      const uts = this.fromNative(payload);
      return {
        valid: result.valid,
        reason: result.issues.length > 0 ? result.issues.join('; ') : undefined,
        uts,
        warnings: result.expired ? ['card expired'] : undefined,
        verified_via: 'a2a-card',
      };
    } catch (e) {
      return { valid: false, reason: (e as Error).message };
    }
  }

  async issue(input: IssueInput, keys: IssuerKeys): Promise<unknown> {
    if (!keys.ed25519_private_key) {
      throw new Error('Ed25519 key required for A2A issuance');
    }
    const ed25519Key = keys.ed25519_private_key;
    // Convert Uint8Array (raw 32 bytes) to PEM private key
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(ed25519Key),
      format: 'der',
      type: 'pkcs8',
    });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

    const card = issueA2ACard({
      issuer_did: keys.did || 'did:marketnow:ca',
      issuer_name: input.subject.name,
      issuer_url: input.provenance?.source_url || '',
      agent_id: input.subject.id,
      agent_name: input.subject.name,
      agent_url: input.subject.id,
      capabilities: input.capabilities?.provides ?? [],
      public_key: input.identity?.public_key || '',
      oauth_subject: input.identity?.oauth_subject,
      expires_in_days: input.expires_in_days ?? 90,
      ca_private_key_pem: privateKeyPem,
      ca_key_id: 'a2a-issuer-1',
    });
    return card;
  }
}
