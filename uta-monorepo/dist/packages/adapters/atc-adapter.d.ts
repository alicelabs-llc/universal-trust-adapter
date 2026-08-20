/**
 * @marketnow/trust-adapter-atc
 * ATC v2.0 / v3.0 adapter — translates ATC credentials to/from UTS
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';
export declare class ATCAdapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "stable";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(input: IssueInput, keys: IssuerKeys): Promise<unknown>;
    private subjectTypeFromATC;
    private subjectTypeToATC;
    private confidenceFromScore;
    private trustLevelFromScore;
    private riskFromScore;
    private extractEvidence;
    private computeExpiry;
    private defaultExpiry;
}
