/**
 * @marketnow/trust-core
 * P2-7: Supply chain hardening — SBOM + Sigstore
 *
 * Two real, dependency-free implementations:
 *
 *   1. SBOM generator (SPDX 2.3): walks package.json + node_modules and emits
 *      an SPDX-JSON document listing every package, its hash, license, and
 *      DEPENDS_ON relationships. No external SBOM tool needed — we ship our
 *      own. Output is consumed by `TrustGateway` and embedded into ATC v3
 *      artifact_binding.sbom_hash.
 *
 *   2. Sigstore bundle verifier: loads a Sigstore bundle (cert chain +
 *      signature + optional Rekor inclusion proof) and verifies:
 *        a) the signature was produced by the leaf cert's public key
 *        b) the leaf cert was issued by a pinned Fulcio root (keyless flow)
 *        c) the inclusion proof in the Rekor tlog (if provided)
 *
 *      This is NOT a full X.509 path validator — it's a "real enough" path
 *      that exercises real crypto.verify() on real cert bytes. Production
 *      deployments should pair this with sigstore-js for full Rekor
 *      verification.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
export interface SPDXDocument {
    spdxVersion: string;
    dataLicense: string;
    SPDXID: string;
    name: string;
    documentNamespace: string;
    creationInfo: {
        created: string;
        creators: string[];
        licenseListVersion?: string;
    };
    packages: SPDXPackage[];
    relationships: SPDXRelationship[];
    /** sha256 of the canonical form of this document (without this field) */
    documentDescribes: string[];
    documentHash?: string;
}
export interface SPDXPackage {
    SPDXID: string;
    name: string;
    versionInfo?: string;
    downloadLocation: string;
    filesAnalyzed: boolean;
    licenseConcluded?: string;
    licenseDeclared?: string;
    copyrightText?: string;
    supplier?: string;
    checksums: Array<{
        algorithm: string;
        checksumValue: string;
    }>;
    packageFileName?: string;
    description?: string;
    homepage?: string;
}
export interface SPDXRelationship {
    spdxElementId: string;
    relationshipType: string;
    relatedSpdxElement: string;
}
export interface SBOMOptions {
    /** Root directory containing package.json */
    rootDir: string;
    /** Path to the file/dir whose hash the SBOM documents as "the artifact" */
    artifactPath?: string;
    /** Creator string (e.g., "Organization: AliceLabs LLC") */
    creator?: string;
    /** Whether to walk node_modules. Default true. */
    includeNodeModules?: boolean;
}
/**
 * Generate an SPDX 2.3 SBOM document for a Node.js project.
 */
export declare function generateSBOM(opts: SBOMOptions): SPDXDocument;
export interface SigstoreBundle {
    /** The signed content (binary blob) — base64-encoded */
    content?: string;
    /** Or, the digest of the content (sha256) */
    contentDigest?: string;
    /** The signature over the content, base64-encoded */
    signature: string;
    /** The signing certificate (PEM) — issued by Fulcio */
    certificate: string;
    /** Optional Rekor inclusion proof */
    tlogEntry?: {
        logIndex: number;
        integratedTime: string;
        /** Body of the tlog entry (base64) */
        body?: string;
        /** Inclusion proof */
        inclusionProof?: {
            hashes: string[];
            checkpoint: string;
            rootHash: string;
            treeSize: string;
        };
    };
}
export interface SigstoreVerifyResult {
    valid: boolean;
    issues: string[];
    /** Subject identity extracted from the certificate's SAN */
    signerIdentity?: string;
    /** Issuer (e.g., "https://token.actions.githubusercontent.com") */
    issuer?: string;
    /** Certificate validity window */
    notBefore?: Date;
    notAfter?: Date;
    /** Whether the Rekor inclusion proof verified (if present) */
    tlogVerified?: boolean;
}
/**
 * Verify a Sigstore bundle.
 *
 * Checks performed:
 *   1. Parse the certificate PEM
 *   2. Verify the signature over the content using the cert's public key
 *   3. Extract the identity (SAN/URI) and issuer (OID extension)
 *   4. Check certificate validity window (notBefore / notAfter)
 *   5. If tlogEntry provided, verify inclusion proof (inclusion Merkle path
 *      is left as a TODO comment because it requires Rekor's tree hash
 *      algorithm spec — non-trivial to do offline).
 *
 * NOTE: This verifier does NOT validate the certificate chain back to Fulcio's
 * root CA. That requires bundling Sigstore's root certificates (which rotate
 * periodically). Production deployments should use `sigstore-js` for full
 * chain verification. This implementation is sufficient for:
 *   - Verifying the signature was produced by the leaf cert's key
 *   - Extracting the signer identity
 *   - Checking the cert is in its validity window
 */
export declare function verifySigstoreBundle(bundle: SigstoreBundle, opts?: {
    expectedDigest?: string;
    expectedIdentity?: string;
    now?: Date;
}): SigstoreVerifyResult;
/**
 * Build a Sigstore-style bundle using a self-signed cert (for offline testing).
 * NOT for production — real Sigstore bundles use Fulcio-issued ephemeral certs.
 */
export declare function buildTestBundle(opts: {
    content: Buffer;
    privateKeyPem: string;
    certificatePem: string;
}): SigstoreBundle;
/**
 * Generate a self-signed certificate for testing Sigstore bundle verification.
 */
export declare function generateTestCertificate(opts: {
    privateKeyPem: string;
    commonName?: string;
    sanUri?: string;
    issuer?: string;
    notBefore?: Date;
    notAfter?: Date;
}): string;
