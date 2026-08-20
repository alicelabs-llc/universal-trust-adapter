/**
 * @marketnow/trust-adapter-mcp
 * MCP (Model Context Protocol) Server Card adapter — with optional signature verification
 *
 * P5-3: MCP Server Cards don't natively carry signatures (they're tool manifests).
 * However, an MCP registry (like the Anthropic registry) can SIGN an MCP card
 * to attest to its reviewed status. This adapter verifies those signatures.
 *
 * The signature is over canonicalize(card_without_signature) with domain
 * "UTA-MCP-CARD" — preventing cross-format reuse.
 *
 * Cards WITHOUT a signature are still considered valid structurally, but get
 * trust_score=0 and a warning. Cards WITH a signature get trust_score
 * promoted to at least 5 (the registry vouches for the card).
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 */

import crypto from 'node:crypto';
import { canonicalize, verify as ed25519Verify } from '../core/crypto.js';
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';

// ============================================================================
// MCP Card types
// ============================================================================

export interface MCPCard {
  name: string;
  description?: string;
  url?: string;
  version?: string;
  transport?: 'stdio' | 'http' | 'sse' | 'ws';
  tools?: Array<{ name: string; description?: string }>;
  created_at?: string;
  /** P5-3: optional registry signature (Ed25519) */
  signature?: {
    algorithm: 'Ed25519 (RFC 8032)';
    value: string;              // 128 hex chars (64 bytes)
    domain: string;             // 'UTA-MCP-CARD'
    key_id: string;
    signed_by: string;          // e.g., "Anthropic MCP Registry"
    signed_at: string;
  };
}

// ============================================================================
// Issuance
// ============================================================================

export interface MCPIssueParams {
  name: string;
  description?: string;
  url?: string;
  version?: string;
  transport?: 'stdio' | 'http' | 'sse' | 'ws';
  tools?: Array<{ name: string; description?: string }>;
  /** Number of days until the signature expires */
  expires_in_days: number;
  /** Registry DID */
  registry_did: string;
  registry_name: string;
  registry_private_key_pem: string;
  registry_key_id: string;
}

export function issueMCPCard(params: MCPIssueParams): MCPCard {
  const now = new Date();

  const card: MCPCard = {
    name: params.name,
    description: params.description,
    url: params.url,
    version: params.version || '1.0',
    transport: params.transport || 'stdio',
    tools: params.tools || [],
    created_at: now.toISOString(),
  };

  // Sign the card WITHOUT signature
  const { signature: _drop, ...payload } = card;
  const canonical = canonicalize(payload);
  const signingBytes = Buffer.from('UTA-MCP-CARD:' + canonical, 'utf-8');
  const privateKey = crypto.createPrivateKey(params.registry_private_key_pem);
  const signatureValue = crypto.sign(null, signingBytes, privateKey).toString('hex');

  card.signature = {
    algorithm: 'Ed25519 (RFC 8032)',
    value: signatureValue,
    domain: 'UTA-MCP-CARD',
    key_id: params.registry_key_id,
    signed_by: params.registry_name,
    signed_at: now.toISOString(),
  };

  return card;
}

// ============================================================================
// Verification
// ============================================================================

export interface MCPVerifyResult {
  valid: boolean;
  issues: string[];
  signature_valid: boolean;
  signed_by?: string;
  signed_at?: string;
  trust_score: number;        // 0 if unsigned, 5+ if signed
  tools_count: number;
}

export function verifyMCPCard(
  card: MCPCard,
  registryPublicKeyPem?: string
): MCPVerifyResult {
  const issues: string[] = [];

  // 1. Structure validation
  if (!card.name) issues.push('missing name');
  if (!card.tools) issues.push('missing tools array');
  if (!card.transport) issues.push('missing transport');

  // 2. Signature verification
  let signatureValid = false;
  let trustScore = 0;
  let signedBy: string | undefined;
  let signedAt: string | undefined;

  if (!card.signature) {
    // Unsigned MCP cards are still valid structurally, but trust_score=0
    // (warnings only — not a hard fail)
    return {
      valid: issues.length === 0,
      issues,
      signature_valid: false,
      trust_score: 0,
      tools_count: card.tools?.length || 0,
    };
  }

  if (card.signature.algorithm !== 'Ed25519 (RFC 8032)') {
    issues.push(`unsupported algorithm: ${card.signature.algorithm}`);
  } else if (card.signature.domain !== 'UTA-MCP-CARD') {
    issues.push(`wrong domain: ${card.signature.domain} (expected UTA-MCP-CARD)`);
  } else if (!registryPublicKeyPem) {
    issues.push('signature present but no registry public key provided');
  } else {
    const sigValue = card.signature.value;
    if (!sigValue || sigValue.length !== 128 || !/^[0-9a-f]+$/i.test(sigValue)) {
      issues.push(`malformed signature: ${sigValue?.length || 0} chars (expected 128 hex)`);
    } else {
      const { signature, ...payload } = card;
      try {
        signatureValid = ed25519Verify(payload, sigValue, registryPublicKeyPem, 'UTA-MCP-CARD');
        if (signatureValid) {
          trustScore = 5;  // Registry vouches for the card
          signedBy = card.signature.signed_by;
          signedAt = card.signature.signed_at;
        } else {
          issues.push('Ed25519 signature verification failed');
        }
      } catch (e) {
        issues.push(`verification error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return {
    valid: issues.length === 0 && (signatureValid || !card.signature),
    issues,
    signature_valid: signatureValid,
    signed_by: signedBy,
    signed_at: signedAt,
    trust_score: trustScore,
    tools_count: card.tools?.length || 0,
  };
}

// ============================================================================
// Adapter interface implementation
// ============================================================================

export class MCPAdapter implements TrustAdapter {
  formatId: NativeFormat = 'mcp-card';
  formatName = 'MCP Server Card';
  status = 'stable' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return 'name' in p && 'tools' in p && ('transport' in p || 'url' in p);
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const mcp = payload as Record<string, any>;
    const signed = !!mcp.signature;
    return {
      uts_version: '1.0.0',
      subject: {
        id: mcp.url ?? mcp.name,
        name: mcp.name,
        type: 'tool',
        description: mcp.description,
      },
      identity: {
        key_algorithm: 'Ed25519',
      },
      trust: {
        score: signed ? 5 : 0,
        confidence: signed ? 'medium' : 'low',
        evidence: signed ? [{
          type: 'on-chain-verification' as any,
          source: mcp.signature.signed_by,
          result: 'pass' as any,
          details: 'Registry signature verified',
          timestamp: mcp.signature.signed_at,
        }] : [],
        assessor: signed ? mcp.signature.signed_by : 'self',
        assessed_at: mcp.created_at ?? new Date().toISOString(),
      },
      capabilities: {
        provides: (mcp.tools ?? []).map((t: any) => t.name ?? t),
        protocols: ['mcp'],
      },
      provenance: { source: 'mcp-registry' },
      lifecycle: {
        issued_at: mcp.created_at ?? new Date().toISOString(),
        revoked: false,
        version: mcp.version ?? '1.0',
      },
      format: { type: 'mcp-card', version: '2026-07-28', raw: mcp },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    return {
      name: uts.subject.name,
      description: uts.subject.description,
      url: uts.subject.id,
      version: uts.lifecycle.version,
      transport: 'stdio',
      tools: uts.capabilities?.provides?.map((name) => ({ name })) ?? [],
      created_at: uts.lifecycle.issued_at,
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const card = payload as MCPCard;
      const registryKey = (options as any)?.registry_public_key;

      const result = verifyMCPCard(card, registryKey);
      const uts = this.fromNative(payload);

      const warnings: string[] = [];
      if (!card.signature) {
        warnings.push('MCP Server Card has no registry signature — trust score 0');
      } else if (!result.signature_valid) {
        warnings.push('MCP Server Card signature invalid');
      }

      return {
        valid: result.valid,
        reason: result.issues.length > 0 ? result.issues.join('; ') : undefined,
        uts,
        warnings: warnings.length > 0 ? warnings : undefined,
        verified_via: 'mcp-card',
      };
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
      provenance: { source: 'mcp-registry' },
      lifecycle: {
        issued_at: new Date().toISOString(),
        revoked: false,
        version: '2026-07-28',
      },
      format: { type: 'mcp-card', version: '2026-07-28', raw: {} },
    };
    return this.toNative(uts);
  }
}

export const MCP_DOMAIN = 'UTA-MCP-CARD';
