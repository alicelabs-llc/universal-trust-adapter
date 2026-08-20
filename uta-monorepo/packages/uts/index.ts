/**
 * @marketnow/uts
 * BLOQUE C: Universal Trust Schema v2 — Canonical Trust Data Model
 *
 * UTS v2 separates concerns:
 *   - Identity (who)
 *   - Attestations (signed evidence)
 *   - Capabilities (what it can do)
 *   - Policies (what is allowed)
 *   - Provenance (where it came from)
 *   - Lifecycle (when valid)
 *   - Assessment (reproducible score)
 *
 * The score is NOT "trust" — it is a reproducible assessment result
 * linked to hashes of signed evidence.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

// ── UTS v2.0.0 Types ──────────────────────────────────────────────────────

export const UTS_VERSION = '2.0.0' as const;

export interface UTSv2 {
  uts_version: typeof UTS_VERSION;

  // ── WHO ──
  subject: UTSSubject;

  // ── HOW DO WE VERIFY IDENTITY ──
  identity: UTSIdentity;

  // ── SIGNED EVIDENCE (not opinions) ──
  attestations: UTSAttestation[];

  // ── WHAT CAN IT DO ──
  capabilities: UTSCapabilities;

  // ── WHAT IS ALLOWED ──
  policies: UTSPolicy[];

  // ── WHERE DID IT COME FROM ──
  provenance: UTSProvenance;

  // ── WHEN IS IT VALID ──
  lifecycle: UTSLifecycle;

  // ── REPRODUCIBLE ASSESSMENT (not "trust score") ──
  assessment: UTSAssessment;

  // ── FORMAT METADATA ──
  format: UTSFormat;

  // ── TRANSLATION WARNINGS ──
  warnings?: string[];
}

// ── Subject ──────────────────────────────────────────────────────────────

export interface UTSSubject {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'service' | 'human' | 'organization' | 'runtime';
  description?: string;
}

// ── Identity ─────────────────────────────────────────────────────────────

export interface UTSIdentity {
  public_keys: UTSPublicKey[];
  dids?: string[];
  tee_attestations?: UTSTEEAttestation[];
  oauth_subject?: string;
}

export interface UTSPublicKey {
  key: string; // PEM or base64
  algorithm: 'Ed25519' | 'ECDSA-P256' | 'RSA-2048' | 'secp256k1' | 'ES256' | 'RS256';
  key_id: string; // identifier for rotation
  status: 'active' | 'revoked' | 'expired';
  revoked_at?: string;
}

export interface UTSTEEAttestation {
  type: 'SGX' | 'TrustZone' | 'SEV-SNP' | 'Nitro' | 'None';
  quote?: string; // hardware attestation quote
  verified: boolean;
  verified_at?: string;
}

// ── Attestations (signed evidence, not opinions) ────────────────────────

export interface UTSAttestation {
  type: UTSAttestationType;
  issuer: string; // who issued this attestation
  evidence: UTSEvidence[];
  signature?: {
    algorithm: string;
    value: string;
    domain: string; // domain separation string
    key_id: string;
  };
  issued_at: string;
  expires_at?: string;
}

export type UTSAttestationType =
  | 'sentinel-audit'
  | 'static-analysis'
  | 'sandbox-test'
  | 'human-review'
  | 'on-chain-verification'
  | 'tee-attestation'
  | 'owasp-mcp-scan'
  | 'runtime-observation'
  | 'slsa-provenance'
  | 'sigstore-signature'
  | 'sbom-analysis';

export interface UTSEvidence {
  type: string;
  source: string;
  result: 'pass' | 'fail' | 'warn' | 'info';
  details?: string;
  timestamp: string;
  evidence_hash?: string; // content-addressed hash
}

// ── Capabilities ─────────────────────────────────────────────────────────

export interface UTSCapabilities {
  provides: string[];
  requires: string[];
  protocols: ('mcp' | 'a2a' | 'jsonrpc' | 'rest' | 'grpc' | 'websocket')[];
  rate_limits?: {
    requests: number;
    window: string;
  };
}

// ── Policies ─────────────────────────────────────────────────────────────

export interface UTSPolicy {
  id: string;
  max_spend_usd?: number;
  allowed_actions?: string[];
  denied_actions?: string[];
  filesystem_access?: 'none' | 'read' | 'read-write';
  shell_access?: 'none' | 'sandboxed' | 'unrestricted';
  network_access?: 'none' | 'allowlist' | 'all';
  expires_at?: string;
}

// ── Provenance (supply chain) ────────────────────────────────────────────

export interface UTSProvenance {
  source: string;
  source_url?: string;
  artifact_binding?: {
    git: { repository: string; commit_sha: string };
    npm?: { package: string; version: string; tarball_sha256: string };
    oci?: { image: string; digest: string };
    slsa?: { provenance_url: string; build_level: string };
    binding_hash: string;
  };
  // Attestation chaining for bridge operations
  original_signature_hash?: string;
  original_format?: string;
  bridged_at?: string;
  bridged_by?: string;
}

// ── Lifecycle ────────────────────────────────────────────────────────────

export interface UTSLifecycle {
  issued_at: string;
  expires_at?: string;
  revoked: boolean;
  revocation_url?: string;
  revocation_method?: 'crl' | 'ocsp' | 'bitstring-status-list' | 'none';
  version: string;
}

// ── Assessment (reproducible, not opinion) ────────────────────────────────

export interface UTSAssessment {
  methodology: string; // e.g., "Sentinel v2.5"
  methodology_version: string;
  inputs: UTSAssessmentInput[];
  result: {
    score: number; // 0-10
    confidence: 'low' | 'medium' | 'high';
    risk_level: 'low' | 'medium' | 'high' | 'critical' | 'not_audited';
  };
  computed_at: string;
  computed_by: string;
  reproducible: boolean; // can a third party recompute this score?
}

export interface UTSAssessmentInput {
  name: string;
  value: string;
  hash: string; // content-addressed hash of the input
}

// ── Format Metadata ──────────────────────────────────────────────────────

export interface UTSFormat {
  type:
    | 'atc-v1' | 'atc-v2' | 'atc-v3'
    | 'eat-ai'
    | 'zta'
    | 'a2a-card'
    | 'mcp-card'
    | 'w3c-vc'
    | 'oauth-token'
    | 'spiffe-svid';
  version: string;
  raw: unknown; // original payload — NEVER destroyed (lossless)
}

// ── JSON Schema for UTS v2 ────────────────────────────────────────────────

export const UTS_V2_JSON_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://universal-trust-adapter.vercel.app/specs/UTS-v2.0.json",
  "title": "Universal Trust Schema (UTS) v2.0",
  "description": "Canonical trust data model with separated Identity, Attestations, Evidence, Capabilities, Policies, Provenance, Lifecycle and Assessment.",
  "type": "object",
  "required": ["uts_version", "subject", "identity", "attestations", "capabilities", "policies", "provenance", "lifecycle", "assessment", "format"],
  "properties": {
    "uts_version": { "type": "string", "const": "2.0.0" },
    "subject": { "type": "object", "required": ["id", "name", "type"] },
    "identity": { "type": "object", "required": ["public_keys"] },
    "attestations": { "type": "array" },
    "capabilities": { "type": "object", "required": ["provides", "requires", "protocols"] },
    "policies": { "type": "array" },
    "provenance": { "type": "object", "required": ["source"] },
    "lifecycle": { "type": "object", "required": ["issued_at", "revoked", "version"] },
    "assessment": {
      "type": "object",
      "required": ["methodology", "methodology_version", "inputs", "result", "computed_at", "computed_by", "reproducible"]
    },
    "format": { "type": "object", "required": ["type", "version", "raw"] },
    "warnings": { "type": "array", "items": { "type": "string" } }
  }
} as const;
