/**
 * UTA Plugin Template — MIT License
 *
 * Copy this directory to create a new adapter package. Replace:
 *   - "my-adapter" → your adapter name
 *   - "MyAdapter" → your adapter class name
 *   - "my-format" → your NativeFormat ID (must be added to core/types.ts)
 *
 * Example plugins:
 *   - X.509 certificate adapter
 *   - Kerberos ticket adapter
 *   - Custom enterprise attestation format
 *   - Hardware security module (HSM) attestation
 *
 * The MIT license allows unrestricted commercial use, including
 * closed-source plugins that link against the source-available
 * @marketnow/trust-core package.
 *
 * MIT License
 *
 * Copyright (c) [YEAR] [YOUR NAME]
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */
import type { TrustAdapter, UniversalTrustSchema, VerifyOptions, VerifyResult, IssueInput, IssuerKeys } from '@marketnow/trust-core';
type NativeFormat = string;
export interface MyFormatCredential {
    version: string;
    issuer: string;
    subject: string;
    issued_at: string;
    expires_at?: string;
    claims: Record<string, unknown>;
    signature?: {
        algorithm: 'Ed25519 (RFC 8032)';
        value: string;
        domain: string;
        key_id: string;
        signed_at: string;
    };
}
export interface MyFormatIssueParams {
    issuer: string;
    subject: string;
    claims: Record<string, unknown>;
    expires_in_days: number;
    issuer_private_key_pem: string;
    issuer_key_id: string;
}
export declare function issueMyFormatCredential(params: MyFormatIssueParams): MyFormatCredential;
export interface MyFormatVerifyResult {
    valid: boolean;
    issues: string[];
    signature_valid: boolean;
    expired: boolean;
}
export declare function verifyMyFormatCredential(cred: MyFormatCredential, issuerPublicKeyPem: string, options?: {
    now?: Date;
    skipExpiry?: boolean;
}): MyFormatVerifyResult;
export declare class MyAdapter implements TrustAdapter {
    formatId: NativeFormat;
    formatName: string;
    status: "stable";
    detect(payload: unknown): boolean;
    fromNative(payload: unknown): UniversalTrustSchema;
    toNative(uts: UniversalTrustSchema): unknown;
    verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;
    issue(input: IssueInput, keys: IssuerKeys): Promise<unknown>;
}
export {};
