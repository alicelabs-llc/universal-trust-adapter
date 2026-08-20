/**
 * @marketnow/trust-adapter-mcp
 * MCP (Model Context Protocol) Server Card adapter
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */

import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from './types';

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
    return {
      uts_version: '1.0.0',
      subject: {
        id: mcp.url ?? mcp.name,
        name: mcp.name,
        type: 'tool',
        description: mcp.description,
      },
      identity: {
        // MCP Server Cards have no native cryptographic identity
        key_algorithm: 'Ed25519',
      },
      trust: {
        score: 0, // MCP Cards have no native trust — must be augmented by ATC
        confidence: 'low',
        evidence: [],
        assessor: 'self',
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
      const uts = this.fromNative(payload);
      // MCP Cards have no signature to verify — always valid structurally
      return {
        valid: true,
        uts,
        verified_via: 'mcp-card',
        warnings: ['MCP Server Cards have no cryptographic signature — trust score 0 by default'],
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
