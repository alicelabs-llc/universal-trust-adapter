/**
 * @marketnow/trust-core
 * Universal Trust Engine — translates between all trust formats via UTS
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */

import type {
  TrustAdapter,
  UniversalTrustSchema,
  VerifyOptions,
  VerifyResult,
  IssueInput,
  IssuerKeys,
  NativeFormat,
  DetectResult,
  EngineConfig,
} from './types';

export class TrustEngine {
  private adapters: Map<NativeFormat, TrustAdapter> = new Map();
  private issuerKeys?: IssuerKeys;
  private defaultFormat?: NativeFormat;

  constructor(config: EngineConfig) {
    for (const adapter of config.adapters) {
      this.adapters.set(adapter.formatId, adapter);
    }
    this.issuerKeys = config.issuer_keys;
    this.defaultFormat = config.default_format;
  }

  /**
   * Register an additional adapter at runtime.
   */
  registerAdapter(adapter: TrustAdapter): void {
    this.adapters.set(adapter.formatId, adapter);
  }

  /**
   * List all available formats.
   */
  listFormats(): { id: NativeFormat; name: string; status: string }[] {
    return Array.from(this.adapters.values()).map((a) => ({
      id: a.formatId,
      name: a.formatName,
      status: a.status,
    }));
  }

  /**
   * Detect the format of an unknown payload.
   * Returns the adapter with highest detection confidence.
   */
  detectFormat(payload: unknown): DetectResult | null {
    let best: DetectResult | null = null;
    for (const adapter of this.adapters.values()) {
      try {
        const isMatch = adapter.detect(payload);
        if (isMatch) {
          // Simple confidence model: each adapter either matches or doesn't
          // Real implementation could return a numeric confidence.
          const confidence = 1.0;
          if (!best || confidence > best.confidence) {
            best = { format: adapter.formatId, confidence, adapter };
          }
        }
      } catch {
        // Adapter detection error — skip
      }
    }
    return best;
  }

  /**
   * Verify any payload (auto-detect format).
   */
  async verifyAny(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    const detected = this.detectFormat(payload);
    if (!detected) {
      return {
        valid: false,
        reason: 'No adapter detected a matching format for this payload',
      };
    }
    const result = await detected.adapter.verify(payload, options);
    return { ...result, verified_via: detected.format };
  }

  /**
   * Verify a payload known to be in a specific format.
   */
  async verifyAs(format: NativeFormat, payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    const adapter = this.adapters.get(format);
    if (!adapter) {
      return { valid: false, reason: `No adapter registered for format '${format}'` };
    }
    return adapter.verify(payload, options);
  }

  /**
   * Translate a payload from one format to another via UTS.
   */
  translate(payload: unknown, opts: { from?: NativeFormat; to: NativeFormat }): unknown {
    const fromFormat = opts.from ?? this.detectFormat(payload)?.format;
    if (!fromFormat) {
      throw new Error('Could not detect source format. Specify opts.from explicitly.');
    }
    const fromAdapter = this.adapters.get(fromFormat);
    const toAdapter = this.adapters.get(opts.to);
    if (!fromAdapter) throw new Error(`Adapter for '${fromFormat}' not registered`);
    if (!toAdapter) throw new Error(`Adapter for '${opts.to}' not registered`);

    const uts = fromAdapter.fromNative(payload);
    return toAdapter.toNative(uts);
  }

  /**
   * Convert a native payload to its UTS representation.
   */
  toUTS(payload: unknown, fromFormat?: NativeFormat): UniversalTrustSchema {
    const fmt = fromFormat ?? this.detectFormat(payload)?.format;
    if (!fmt) throw new Error('Could not detect format. Specify fromFormat explicitly.');
    const adapter = this.adapters.get(fmt);
    if (!adapter) throw new Error(`Adapter for '${fmt}' not registered`);
    return adapter.fromNative(payload);
  }

  /**
   * Convert a UTS representation to a native format.
   */
  fromUTS(uts: UniversalTrustSchema, toFormat: NativeFormat): unknown {
    const adapter = this.adapters.get(toFormat);
    if (!adapter) throw new Error(`Adapter for '${toFormat}' not registered`);
    return adapter.toNative(uts);
  }

  /**
   * Issue a credential in multiple formats simultaneously.
   */
  async issueMulti(input: IssueInput, formats: NativeFormat[]): Promise<Record<string, unknown>> {
    if (!this.issuerKeys) {
      throw new Error('No issuer keys configured. Pass issuer_keys in EngineConfig.');
    }
    const result: Record<string, unknown> = {};
    for (const fmt of formats) {
      const adapter = this.adapters.get(fmt);
      if (!adapter) {
        result[fmt] = { error: `Adapter '${fmt}' not registered` };
        continue;
      }
      try {
        result[fmt] = await adapter.issue(input, this.issuerKeys);
      } catch (e) {
        result[fmt] = { error: (e as Error).message };
      }
    }
    return result;
  }

  /**
   * Bridge: verify in one ecosystem, re-issue as another.
   */
  async bridge(opts: {
    verify_in: NativeFormat;
    issue_as: NativeFormat;
    payload: unknown;
    policy?: { min_trust_score?: number };
  }): Promise<{
    verified: boolean;
    original?: UniversalTrustSchema;
    issued?: unknown;
    bridge_log: string;
  }> {
    const verifyResult = await this.verifyAs(opts.verify_in, opts.payload);
    if (!verifyResult.valid) {
      return { verified: false, bridge_log: `Verification failed: ${verifyResult.reason}` };
    }
    const uts = verifyResult.uts;
    if (!uts) {
      return { verified: false, bridge_log: 'No UTS extracted from verified payload' };
    }
    if (opts.policy?.min_trust_score !== undefined) {
      if (uts.trust.score < opts.policy.min_trust_score) {
        return {
          verified: false,
          bridge_log: `Trust score ${uts.trust.score} below threshold ${opts.policy.min_trust_score}`,
        };
      }
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

export type { TrustAdapter, UniversalTrustSchema, NativeFormat } from './types';
