/**
 * @marketnow/trust-core
 * BLOQUE D: Updated index — exports crypto + pipeline + UTS v2
 */
export { canonicalize, canonicalHash, sign as ed25519Sign, verify as ed25519Verify, generateEd25519KeyPair, generatePoPChallenge, createPoPResponse, verifyPoP, computeArtifactBinding, DOMAINS, type Ed25519KeyPair, type PoPChallenge, type PoPResponse, type ArtifactBinding, type SignatureDomain, } from './crypto.js';
export { sign, verify } from './crypto.js';
export { verifyCredential, type VerificationContext, type VerificationResult, type VerificationStage, type StageResult, } from './verification-pipeline.js';
export { TrustEngine } from './trust-engine.js';
export * from './types.js';
