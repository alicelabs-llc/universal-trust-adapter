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
export declare const UTS_VERSION: "2.0.0";
export interface UTSv2 {
    uts_version: typeof UTS_VERSION;
    subject: UTSSubject;
    identity: UTSIdentity;
    attestations: UTSAttestation[];
    capabilities: UTSCapabilities;
    policies: UTSPolicy[];
    provenance: UTSProvenance;
    lifecycle: UTSLifecycle;
    assessment: UTSAssessment;
    format: UTSFormat;
    warnings?: string[];
}
export interface UTSSubject {
    id: string;
    name: string;
    type: 'agent' | 'tool' | 'service' | 'human' | 'organization' | 'runtime';
    description?: string;
}
export interface UTSIdentity {
    public_keys: UTSPublicKey[];
    dids?: string[];
    tee_attestations?: UTSTEEAttestation[];
    oauth_subject?: string;
}
export interface UTSPublicKey {
    key: string;
    algorithm: 'Ed25519' | 'ECDSA-P256' | 'RSA-2048' | 'secp256k1' | 'ES256' | 'RS256';
    key_id: string;
    status: 'active' | 'revoked' | 'expired';
    revoked_at?: string;
}
export interface UTSTEEAttestation {
    type: 'SGX' | 'TrustZone' | 'SEV-SNP' | 'Nitro' | 'None';
    quote?: string;
    verified: boolean;
    verified_at?: string;
}
export interface UTSAttestation {
    type: UTSAttestationType;
    issuer: string;
    evidence: UTSEvidence[];
    signature?: {
        algorithm: string;
        value: string;
        domain: string;
        key_id: string;
    };
    issued_at: string;
    expires_at?: string;
}
export type UTSAttestationType = 'sentinel-audit' | 'static-analysis' | 'sandbox-test' | 'human-review' | 'on-chain-verification' | 'tee-attestation' | 'owasp-mcp-scan' | 'runtime-observation' | 'slsa-provenance' | 'sigstore-signature' | 'sbom-analysis';
export interface UTSEvidence {
    type: string;
    source: string;
    result: 'pass' | 'fail' | 'warn' | 'info';
    details?: string;
    timestamp: string;
    evidence_hash?: string;
}
export interface UTSCapabilities {
    provides: string[];
    requires: string[];
    protocols: ('mcp' | 'a2a' | 'jsonrpc' | 'rest' | 'grpc' | 'websocket')[];
    rate_limits?: {
        requests: number;
        window: string;
    };
}
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
export interface UTSProvenance {
    source: string;
    source_url?: string;
    artifact_binding?: {
        git: {
            repository: string;
            commit_sha: string;
        };
        npm?: {
            package: string;
            version: string;
            tarball_sha256: string;
        };
        oci?: {
            image: string;
            digest: string;
        };
        slsa?: {
            provenance_url: string;
            build_level: string;
        };
        binding_hash: string;
    };
    original_signature_hash?: string;
    original_format?: string;
    bridged_at?: string;
    bridged_by?: string;
}
export interface UTSLifecycle {
    issued_at: string;
    expires_at?: string;
    revoked: boolean;
    revocation_url?: string;
    revocation_method?: 'crl' | 'ocsp' | 'bitstring-status-list' | 'none';
    version: string;
}
export interface UTSAssessment {
    methodology: string;
    methodology_version: string;
    inputs: UTSAssessmentInput[];
    result: {
        score: number;
        confidence: 'low' | 'medium' | 'high';
        risk_level: 'low' | 'medium' | 'high' | 'critical' | 'not_audited';
    };
    computed_at: string;
    computed_by: string;
    reproducible: boolean;
}
export interface UTSAssessmentInput {
    name: string;
    value: string;
    hash: string;
}
export interface UTSFormat {
    type: 'atc-v1' | 'atc-v2' | 'atc-v3' | 'eat-ai' | 'zta' | 'a2a-card' | 'mcp-card' | 'w3c-vc' | 'oauth-token' | 'spiffe-svid';
    version: string;
    raw: unknown;
}
export declare const UTS_V2_JSON_SCHEMA: {
    readonly $schema: "https://json-schema.org/draft/2020-12/schema";
    readonly $id: "https://universal-trust-adapter.vercel.app/specs/UTS-v2.0.json";
    readonly title: "Universal Trust Schema (UTS) v2.0";
    readonly description: "Canonical trust data model with separated Identity, Attestations, Evidence, Capabilities, Policies, Provenance, Lifecycle and Assessment.";
    readonly type: "object";
    readonly required: readonly ["uts_version", "subject", "identity", "attestations", "capabilities", "policies", "provenance", "lifecycle", "assessment", "format"];
    readonly properties: {
        readonly uts_version: {
            readonly type: "string";
            readonly const: "2.0.0";
        };
        readonly subject: {
            readonly type: "object";
            readonly required: readonly ["id", "name", "type"];
        };
        readonly identity: {
            readonly type: "object";
            readonly required: readonly ["public_keys"];
        };
        readonly attestations: {
            readonly type: "array";
        };
        readonly capabilities: {
            readonly type: "object";
            readonly required: readonly ["provides", "requires", "protocols"];
        };
        readonly policies: {
            readonly type: "array";
        };
        readonly provenance: {
            readonly type: "object";
            readonly required: readonly ["source"];
        };
        readonly lifecycle: {
            readonly type: "object";
            readonly required: readonly ["issued_at", "revoked", "version"];
        };
        readonly assessment: {
            readonly type: "object";
            readonly required: readonly ["methodology", "methodology_version", "inputs", "result", "computed_at", "computed_by", "reproducible"];
        };
        readonly format: {
            readonly type: "object";
            readonly required: readonly ["type", "version", "raw"];
        };
        readonly warnings: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
    };
};
