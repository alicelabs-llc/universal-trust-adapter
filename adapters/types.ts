/**
 * @marketnow/trust-core
 * Universal Trust Schema TypeScript types
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 * Copyright (c) 2026 AliceLabs LLC. All rights reserved.
 * https://github.com/eddyflores100-lang/universal-trust-adapter/blob/main/LICENSE-AL-1.0
 *
 * COMMERCIAL USE REQUIRES A SEPARATE COMMERCIAL LICENSE.
 * Contact: legal@alicelabs.site
 */

export type UTSVersion = '1.0.0';

export type SubjectType = 'agent' | 'tool' | 'service' | 'human' | 'organization' | 'runtime';

export type KeyAlgorithm = 'Ed25519' | 'ECDSA-P256' | 'RSA-2048' | 'secp256k1' | 'ES256' | 'RS256';

export type TEEType = 'SGX' | 'TrustZone' | 'SEV-SNP' | 'Nitro' | 'None';

export type Confidence = 'low' | 'medium' | 'high';

export type EvidenceType =
  | 'sentinel-audit'
  | 'static-analysis'
  | 'sandbox-test'
  | 'human-review'
  | 'on-chain-verification'
  | 'tee-attestation'
  | 'owasp-mcp-scan'
  | 'runtime-observation';

export type EvidenceResult = 'pass' | 'fail' | 'warn' | 'info';

export type Protocol = 'mcp' | 'a2a' | 'jsonrpc' | 'rest' | 'grpc' | 'websocket';

export type FilesystemAccess = 'none' | 'read' | 'read-write';
export type ShellAccess = 'none' | 'sandboxed' | 'unrestricted';

export type ProvenanceSource =
  | 'marketnow'
  | 'claude'
  | 'mcp-registry'
  | 'a2a-network'
  | 'self-signed'
  | 'external';

export type NativeFormat =
  | 'atc-v2'
  | 'atc-v3'
  | 'eat-ai'
  | 'zta'
  | 'a2a-card'
  | 'mcp-card'
  | 'w3c-vc'
  | 'oauth-token'
  | 'spiffe-svid';

export interface TrustEvidence {
  type: EvidenceType;
  source: string;
  result: EvidenceResult;
  details?: string;
  timestamp: string;
  evidence_hash?: string;
}

export interface UTSSubject {
  id: string;
  name: string;
  type: SubjectType;
  description?: string;
}

export interface UTSIdentity {
  public_key?: string;
  key_algorithm?: KeyAlgorithm;
  key_id?: string;
  attestation?: {
    type: TEEType;
    quote?: string;
  };
  oauth_subject?: string;
  did?: string;
}

export interface UTSTrust {
  score: number; // 0-10
  confidence: Confidence;
  evidence: TrustEvidence[];
  assessor: string;
  assessed_at: string;
  expires_at?: string;
}

export interface UTSCapabilities {
  provides?: string[];
  requires?: string[];
  protocols?: Protocol[];
  rate_limits?: {
    requests: number;
    window: string;
  };
}

export interface UTSPolicy {
  max_spend_usd?: number;
  allowed_actions?: string[];
  denied_actions?: string[];
  allowed_networks?: string[];
  filesystem_access?: FilesystemAccess;
  shell_access?: ShellAccess;
}

export interface UTSProvenance {
  source: ProvenanceSource;
  source_url?: string;
  artifact_hash?: string;
  commit_sha?: string;
  registry_id?: string;
}

export interface UTSLifecycle {
  issued_at: string;
  expires_at?: string;
  revoked: boolean;
  revocation_url?: string;
  version: string;
}

export interface UTSFormat {
  type: NativeFormat;
  version: string;
  raw: unknown;
}

export interface UniversalTrustSchema {
  uts_version: UTSVersion;
  subject: UTSSubject;
  identity: UTSIdentity;
  trust: UTSTrust;
  capabilities?: UTSCapabilities;
  policy?: UTSPolicy;
  provenance: UTSProvenance;
  lifecycle: UTSLifecycle;
  format: UTSFormat;
}

/**
 * Adapter interface — each native format implements this.
 */
export interface TrustAdapter {
  /** Format ID this adapter handles (e.g., 'atc-v3') */
  formatId: NativeFormat;

  /** Human-readable name (e.g., 'ATC v3.0') */
  formatName: string;

  /** Implementation status */
  status: 'stable' | 'beta' | 'experimental' | 'planned';

  /** Detect whether a payload matches this format */
  detect(payload: unknown): boolean;

  /** Parse native payload → UTS */
  fromNative(payload: unknown): UniversalTrustSchema;

  /** Convert UTS → native payload */
  toNative(uts: UniversalTrustSchema): unknown;

  /** Verify a native payload's signature */
  verify(payload: unknown, options?: VerifyOptions): Promise<VerifyResult>;

  /** Issue a credential in this format */
  issue(input: IssueInput, keys: IssuerKeys): Promise<unknown>;
}

export interface VerifyOptions {
  offline?: boolean;
  skip_ocsp?: boolean;
  artifact_path?: string;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  uts?: UniversalTrustSchema;
  warnings?: string[];
  verified_via?: NativeFormat;
}

export interface IssueInput {
  subject: UTSSubject;
  identity?: UTSIdentity;
  trust: Omit<UTSTrust, 'assessed_at'> & { assessed_at?: string };
  capabilities?: UTSCapabilities;
  policy?: UTSPolicy;
  provenance?: Partial<UTSProvenance>;
  expires_in_days?: number;
}

export interface IssuerKeys {
  ed25519_private_key?: Uint8Array;
  es256_private_key?: Uint8Array;
  rsa_private_key?: Uint8Array;
  did?: string;
}

export interface EngineConfig {
  adapters: TrustAdapter[];
  issuer_keys?: IssuerKeys;
  default_format?: NativeFormat;
}

export interface DetectResult {
  format: NativeFormat;
  confidence: number;
  adapter: TrustAdapter;
}
