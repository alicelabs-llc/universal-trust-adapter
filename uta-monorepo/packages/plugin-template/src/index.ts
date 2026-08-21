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

import { canonicalize, sign as ed25519Sign, verify as ed25519Verify, DOMAINS } from '@marketnow/trust-core';
import type {
  TrustAdapter,
  UniversalTrustSchema,
  VerifyOptions,
  VerifyResult,
  IssueInput,
  IssuerKeys,
} from '@marketnow/trust-core';

// Cast our custom format ID. To use the type-safe approach, add 'my-format' to
// NativeFormat in @marketnow/trust-core/types.ts:
//
//   export type NativeFormat =
//     | 'atc-v2' | 'atc-v3' | ... | 'my-format';  // ← add this
type NativeFormat = string;  // simplified for plugin template

// ============================================================================
// 1. Define your native format
// ============================================================================
// Add 'my-format' to NativeFormat in @marketnow/trust-core/types.ts:
//
//   export type NativeFormat =
//     | 'atc-v2' | 'atc-v3' | 'eat-ai' | 'zta' | 'a2a-card' | 'mcp-card'
//     | 'w3c-vc' | 'oauth-token' | 'spiffe-svid'
//     | 'my-format';  // ← add this
//
// ============================================================================

// Use a custom domain for signature non-reuse. A signature from your adapter
// will NOT verify in any other adapter's domain.
const MY_FORMAT_DOMAIN = 'UTA-MY-FORMAT-CREDENTIAL';

export interface MyFormatCredential {
  // Replace these fields with your format's native fields
  version: string;
  issuer: string;
  subject: string;
  issued_at: string;
  expires_at?: string;
  claims: Record<string, unknown>;
  signature?: {
    algorithm: 'Ed25519 (RFC 8032)';
    value: string;            // 128 hex chars (64 bytes)
    domain: string;           // MY_FORMAT_DOMAIN
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

export function issueMyFormatCredential(params: MyFormatIssueParams): MyFormatCredential {
  const now = new Date();
  const expires = new Date(now.getTime() + params.expires_in_days * 24 * 60 * 60 * 1000);

  const cred: MyFormatCredential = {
    version: '1.0',
    issuer: params.issuer,
    subject: params.subject,
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
    claims: params.claims,
  };

  // Sign WITHOUT signature field, using your domain
  const { signature: _drop, ...payload } = cred;
  const signatureValue = ed25519Sign(payload, params.issuer_private_key_pem, MY_FORMAT_DOMAIN);

  cred.signature = {
    algorithm: 'Ed25519 (RFC 8032)',
    value: signatureValue,
    domain: MY_FORMAT_DOMAIN,
    key_id: params.issuer_key_id,
    signed_at: now.toISOString(),
  };

  return cred;
}

export interface MyFormatVerifyResult {
  valid: boolean;
  issues: string[];
  signature_valid: boolean;
  expired: boolean;
}

export function verifyMyFormatCredential(
  cred: MyFormatCredential,
  issuerPublicKeyPem: string,
  options: { now?: Date; skipExpiry?: boolean } = {}
): MyFormatVerifyResult {
  const issues: string[] = [];
  const now = options.now || new Date();

  if (!cred.issuer) issues.push('missing issuer');
  if (!cred.subject) issues.push('missing subject');

  let expired = false;
  if (!options.skipExpiry && cred.expires_at) {
    if (new Date(cred.expires_at) < now) {
      expired = true;
      issues.push(`expired: ${cred.expires_at}`);
    }
  }

  let signatureValid = false;
  if (!cred.signature) {
    issues.push('missing signature (fail-closed)');
  } else if (cred.signature.domain !== MY_FORMAT_DOMAIN) {
    issues.push(`wrong domain: ${cred.signature.domain}`);
  } else {
    const { signature, ...payload } = cred;
    signatureValid = ed25519Verify(payload, cred.signature.value, issuerPublicKeyPem, MY_FORMAT_DOMAIN);
    if (!signatureValid) issues.push('signature verification failed');
  }

  return {
    valid: issues.length === 0 && signatureValid,
    issues,
    signature_valid: signatureValid,
    expired,
  };
}

// ============================================================================
// Adapter interface implementation
// ============================================================================

export class MyAdapter implements TrustAdapter {
  formatId: NativeFormat = 'my-format';
  formatName = 'My Custom Format';
  status = 'stable' as const;

  detect(payload: unknown): boolean {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return 'version' in p && 'issuer' in p && 'subject' in p && 'claims' in p;
  }

  fromNative(payload: unknown): UniversalTrustSchema {
    const cred = payload as MyFormatCredential;
    return {
      uts_version: '1.0.0',
      subject: {
        id: cred.subject,
        name: cred.subject,
        type: 'agent',
      },
      identity: {
        did: cred.issuer,
        key_algorithm: 'Ed25519',
      },
      trust: {
        score: 5,
        confidence: 'medium',
        evidence: [],
        assessor: cred.issuer,
        assessed_at: cred.issued_at,
        expires_at: cred.expires_at,
      },
      capabilities: { protocols: ['rest'] },
      provenance: { source: 'external' },
      lifecycle: {
        issued_at: cred.issued_at,
        expires_at: cred.expires_at,
        revoked: false,
        version: cred.version,
      },
      format: { type: 'my-format', version: cred.version, raw: cred },
    };
  }

  toNative(uts: UniversalTrustSchema): unknown {
    return {
      version: uts.lifecycle.version,
      issuer: uts.identity.did || 'unknown',
      subject: uts.subject.id,
      issued_at: uts.lifecycle.issued_at,
      expires_at: uts.lifecycle.expires_at,
      claims: {},
    };
  }

  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const cred = payload as MyFormatCredential;
      const caPublicKey = (options as any)?.ca_public_key || (options as any)?.issuer_public_key;
      if (!caPublicKey) {
        return { valid: false, reason: 'no issuer public key provided', uts: this.fromNative(payload) };
      }
      const result = verifyMyFormatCredential(cred, caPublicKey, { skipExpiry: options?.skip_ocsp });
      const uts = this.fromNative(payload);
      return {
        valid: result.valid,
        reason: result.issues.length > 0 ? result.issues.join('; ') : undefined,
        uts,
        warnings: result.expired ? ['credential expired'] : undefined,
        verified_via: 'my-format',
      };
    } catch (e) {
      return { valid: false, reason: (e as Error).message };
    }
  }

  async issue(input: IssueInput, keys: IssuerKeys): Promise<unknown> {
    if (!keys.ed25519_private_key) {
      throw new Error('Ed25519 key required for MyFormat issuance');
    }
    const crypto = await import('node:crypto');
    const privateKey = crypto.createPrivateKey({
      key: Buffer.from(keys.ed25519_private_key),
      format: 'der',
      type: 'pkcs8',
    });
    const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    return issueMyFormatCredential({
      issuer: keys.did || 'did:unknown',
      subject: input.subject.id,
      claims: { subject_name: input.subject.name },
      expires_in_days: input.expires_in_days ?? 90,
      issuer_private_key_pem: privateKeyPem,
      issuer_key_id: 'my-issuer-1',
    });
  }
}

// ============================================================================
// Example test (delete or keep as documentation)
// ============================================================================

// To test your plugin:
//
//   import { generateEd25519KeyPair } from '@marketnow/trust-core';
//   const keys = generateEd25519KeyPair();
//   const cred = issueMyFormatCredential({
//     issuer: 'did:example:ca',
//     subject: 'did:example:agent',
//     claims: { role: 'agent' },
//     expires_in_days: 30,
//     issuer_private_key_pem: keys.privateKeyPem,
//     issuer_key_id: keys.keyId,
//   });
//   const result = verifyMyFormatCredential(cred, keys.publicKeyPem);
//   console.log(result.valid);  // true
