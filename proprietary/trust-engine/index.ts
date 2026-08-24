/**
 * @marketnow/trust-core
 * Universal Trust Adapter — translates between all trust formats via UTS
 *
 * Usage:
 *   import { TrustEngine, ATCAdapter, EATAdapter } from '@marketnow/trust-core';
 *
 *   const engine = new TrustEngine({
 *     adapters: [new ATCAdapter(), new EATAdapter()],
 *   });
 *
 *   const result = await engine.verifyAny(unknownPayload);
 *
 * MIT License — AliceLabs LLC 2026
 */

export { TrustEngine } from './trust-engine';
export type {
  TrustAdapter,
  UniversalTrustSchema,
  UTSSubject,
  UTSIdentity,
  UTSTrust,
  UTSCapabilities,
  UTSPolicy,
  UTSProvenance,
  UTSLifecycle,
  UTSFormat,
  TrustEvidence,
  VerifyOptions,
  VerifyResult,
  IssueInput,
  IssuerKeys,
  EngineConfig,
  DetectResult,
  NativeFormat,
  SubjectType,
  KeyAlgorithm,
  TEEType,
  Confidence,
  EvidenceType,
  EvidenceResult,
  Protocol,
  FilesystemAccess,
  ShellAccess,
  ProvenanceSource,
} from './types';

// All adapters
export { ATCAdapter } from './atc-adapter';
export { EATAdapter } from './eat-adapter';
export { ZTAAdapter } from './zta-adapter';
export { A2AAdapter } from './a2a-adapter';
export { MCPAdapter } from './mcp-adapter';
export { VCAdapter } from './vc-adapter';
export { OAuthAdapter } from './oauth-adapter';
export { SPIFFEAdapter } from './spiffe-adapter';

// Convenience: register all adapters at once
import { TrustEngine } from './trust-engine';
import { ATCAdapter } from './atc-adapter';
import { EATAdapter } from './eat-adapter';
import { ZTAAdapter } from './zta-adapter';
import { A2AAdapter } from './a2a-adapter';
import { MCPAdapter } from './mcp-adapter';
import { VCAdapter } from './vc-adapter';
import { OAuthAdapter } from './oauth-adapter';
import { SPIFFEAdapter } from './spiffe-adapter';

export function createEngineWithAllAdapters(config?: { issuer_keys?: any }): TrustEngine {
  return new TrustEngine({
    adapters: [
      new ATCAdapter(),
      new EATAdapter(),
      new ZTAAdapter(),
      new A2AAdapter(),
      new MCPAdapter(),
      new VCAdapter(),
      new OAuthAdapter(),
      new SPIFFEAdapter(),
    ],
    issuer_keys: config?.issuer_keys,
  });
}
