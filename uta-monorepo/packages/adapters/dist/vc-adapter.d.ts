/**
 * @marketnow/trust-adapter-vc
 * W3C Verifiable Credentials 2.0 adapter
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';
export declare class VCAdapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "stable";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(input: IssueInput, _keys: IssuerKeys): Promise<unknown>;
}
