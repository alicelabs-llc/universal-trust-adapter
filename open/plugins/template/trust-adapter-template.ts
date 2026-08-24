/**
 * @marketnow/trust-adapter-template
 * Template for building custom trust adapters that plug into the Universal Trust Adapter (UTA)
 *
 * MIT License — Copyright (c) 2026 AliceLabs LLC
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/open/plugins/template/LICENSE-MIT
 *
 * This template is MIT-licensed so anyone can write plugins that plug into UTA.
 * The UTA engine itself is proprietary (AL-1.0). See docs/ARCHITECTURE.md.
 *
 * Usage:
 *   1. Copy this file and rename the class (e.g., MyFormatAdapter)
 *   2. Implement the 5 required methods: detect, fromNative, toNative, verify, issue
 *   3. Test against the UTS spec (open/uts-spec/)
 *   4. Publish as @your-org/trust-adapter-myformat on npm
 *   5. (Optional) Submit a PR to include your adapter in UTA's built-in set
 */

import type {
  TrustAdapter,
  UniversalTrustSchema,
  VerifyOptions,
  VerifyResult,
  IssueInput,
  IssuerKeys,
  NativeFormat,
} from '@marketnow/trust-core/types';

/**
 * Example adapter template. Replace "MyFormat" with your format name.
 *
 * The format ID must be unique. Use kebab-case, prefixed with your org if
 * it's a custom format (e.g., "acme-trust-v1").
 */
export class MyFormatAdapter implements TrustAdapter {
  formatId: NativeFormat = 'my-format' as NativeFormat;
  formatName = 'My Custom Trust Format';
  status = 'experimental' as const;

  /**
   * Detect whether a payload matches this adapter's format.
   *
   * Should return true ONLY if the payload is unambiguously this format.
   * The engine iterates adapters in registration order and picks the first match.
   *
   * @example
   *   detect(payload) {
   *     return typeof payload === 'object'
   *       && payload !== null
   *       && 'my_format_version' in payload;
   *   }
   */
  detect(payload: unknown): boolean {
    // TODO: Implement detection logic for your format
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return 'my_format_version' in p;
  }

  /**
   * Parse a native payload into the Universal Trust Schema (UTS).
   *
   * This is the "compile" step — translate FROM your format's native
   * representation INTO the canonical UTS.
   *
   * Preserve all original fields in `format.raw` for lossless round-trip.
   */
  fromNative(payload: unknown): UniversalTrustSchema {
    if (!this.detect(payload)) {
      throw new Error('Payload is not a MyFormat credential');
    }
    const p = payload as Record<string, any>;

    return {
      uts_version: '1.0.0',
      subject: {
        id: p.subject_id ?? 'unknown',
        name: p.subject_name ?? p.subject_id ?? 'unknown',
        type: 'agent',
      },
      identity: {
        public_key: p.public_key,
        key_algorithm: 'Ed25519',
        did: p.did,
      },
      trust: {
        score: p.trust_score ?? 5,
        confidence: p.confidence ?? 'medium',
        evidence: p.evidence ?? [],
        assessor: p.issuer ?? 'unknown',
        assessed_at: p.issued_at ?? new Date().toISOString(),
        expires_at: p.expires_at,
      },
      capabilities: undefined,  // populate if your format has capability data
      policy: undefined,         // populate if your format has policy data
      provenance: {
        source: 'external',
      },
      lifecycle: {
        issued_at: p.issued_at ?? new Date().toISOString(),
        expires_at: p.expires_at,
        revoked: p.revoked ?? false,
        revocation_url: p.revocation_url,
        version: p.version ?? '1.0',
      },
      format: {
        type: 'my-format' as NativeFormat,
        version: p.version ?? '1.0',
        raw: p,  // preserve original for lossless round-trip
      },
    };
  }

  /**
   * Convert a UTS instance back to your native format.
   *
   * This is the "decompile" step — translate FROM canonical UTS INTO
   * your format's native representation.
   *
   * If your format doesn't support certain UTS fields (e.g., it has no
   * concept of "policy"), just omit them. The original is preserved in
   * `format.raw` for round-trip translation.
   */
  toNative(uts: UniversalTrustSchema): unknown {
    return {
      my_format_version: '1.0',
      subject_id: uts.subject.id,
      subject_name: uts.subject.name,
      public_key: uts.identity.public_key,
      did: uts.identity.did,
      trust_score: uts.trust.score,
      confidence: uts.trust.confidence,
      evidence: uts.trust.evidence,
      issuer: uts.trust.assessor,
      issued_at: uts.lifecycle.issued_at,
      expires_at: uts.lifecycle.expires_at,
      revoked: uts.lifecycle.revoked,
      revocation_url: uts.lifecycle.revocation_url,
      version: uts.lifecycle.version,
    };
  }

  /**
   * Verify a native payload's signature.
   *
   * This should validate the cryptographic signature of the payload
   * using whatever scheme your format uses (Ed25519, ECDSA, RSA, etc.).
   *
   * If verification fails, return { valid: false, reason: string }.
   * If verification succeeds, return { valid: true, uts: UniversalTrustSchema }.
   */
  async verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult> {
    try {
      const uts = this.fromNative(payload);
      // TODO: Implement actual signature verification here
      // Example for Ed25519:
      //   const sig = (payload as any).signature;
      //   const pubKey = uts.identity.public_key;
      //   const valid = await ed25519.verify(sig, canonicalize(payload), pubKey);
      //   if (!valid) return { valid: false, reason: 'Invalid signature' };
      return { valid: true, uts, verified_via: this.formatId };
    } catch (e) {
      return { valid: false, reason: (e as Error).message };
    }
  }

  /**
   * Issue a new credential in your native format.
   *
   * Takes an IssueInput (subject, identity, trust, capabilities, policy)
   * and a set of issuer keys, and produces a signed credential.
   *
   * Only needed if you want your adapter to support issuance (not just verification).
   */
  async issue(input: IssueInput, keys: IssuerKeys): Promise<unknown> {
    if (!keys.ed25519_private_key) {
      throw new Error('Ed25519 private key required for MyFormat issuance');
    }
    const uts: UniversalTrustSchema = {
      uts_version: '1.0.0',
      subject: input.subject,
      identity: input.identity ?? {},
      trust: {
        ...input.trust,
        assessed_at: input.trust.assessed_at ?? new Date().toISOString(),
      } as any,
      capabilities: input.capabilities,
      policy: input.policy,
      provenance: { source: 'external', ...input.provenance },
      lifecycle: {
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + (input.expires_in_days ?? 90) * 24 * 3600 * 1000).toISOString(),
        revoked: false,
        version: '1.0',
      },
      format: { type: this.formatId, version: '1.0', raw: {} },
    };
    const credential = this.toNative(uts);
    // TODO: Sign the credential with keys.ed25519_private_key and add the signature field
    return credential;
  }
}

/**
 * Example: How to register your adapter with the TrustEngine
 *
 * import { TrustEngine } from '@marketnow/trust-core';
 * import { MyFormatAdapter } from '@your-org/trust-adapter-myformat';
 *
 * const engine = new TrustEngine({
 *   adapters: [new MyFormatAdapter()],
 * });
 *
 * const result = await engine.verifyAny(payload);
 * // → { valid: true, detected_format: 'my-format', uts: {...} }
 */
