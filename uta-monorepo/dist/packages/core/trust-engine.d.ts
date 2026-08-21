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
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, NativeFormat, DetectResult, EngineConfig } from './types';
export declare class TrustEngine {
    private adapters;
    private issuerKeys?;
    private defaultFormat?;
    constructor(config: EngineConfig);
    /**
     * Register an additional adapter at runtime.
     */
    registerAdapter(adapter: TrustAdapter): void;
    /**
     * List all available formats.
     */
    listFormats(): {
        id: NativeFormat;
        name: string;
        status: string;
    }[];
    /**
     * Detect the format of an unknown payload.
     * Returns the adapter with highest detection confidence.
     */
    detectFormat(payload: unknown): DetectResult | null;
    /**
     * Verify any payload (auto-detect format).
     */
    verifyAny(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    /**
     * Verify a payload known to be in a specific format.
     */
    verifyAs(format: NativeFormat, payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    /**
     * Translate a payload from one format to another via UTS.
     */
    translate(payload: unknown, opts: {
        from?: NativeFormat;
        to: NativeFormat;
    }): unknown;
    /**
     * Convert a native payload to its UTS representation.
     */
    toUTS(payload: unknown, fromFormat?: NativeFormat): UniversalTrustSchema;
    /**
     * Convert a UTS representation to a native format.
     */
    fromUTS(uts: UniversalTrustSchema, toFormat: NativeFormat): unknown;
    /**
     * Issue a credential in multiple formats simultaneously.
     */
    issueMulti(input: IssueInput, formats: NativeFormat[]): Promise<Record<string, unknown>>;
    /**
     * Bridge: verify in one ecosystem, re-issue as another.
     */
    bridge(opts: {
        verify_in: NativeFormat;
        issue_as: NativeFormat;
        payload: unknown;
        policy?: {
            min_trust_score?: number;
        };
    }): Promise<{
        verified: boolean;
        original?: UniversalTrustSchema;
        issued?: unknown;
        bridge_log: string;
    }>;
}
export type { TrustAdapter, UniversalTrustSchema, NativeFormat } from './types';
