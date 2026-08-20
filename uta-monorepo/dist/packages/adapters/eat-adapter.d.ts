/**
 * @marketnow/trust-adapter-eat
 * IETF EAT-AI (Entity Attestation Token for AI Agents) adapter
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * Commercial use requires a separate commercial license. Contact: legal@alicelabs.site
 *
 * Spec: draft-messous-eat-ai-00 (Feb 2026)
 * Format: CWT (CBOR Web Token) + COSE
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys, NativeFormat } from '../core/types.js';
export declare class EATAdapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "experimental";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(input: IssueInput, keys: IssuerKeys): Promise<unknown>;
}
