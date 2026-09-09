/**
 * @marketnow/trust-core
 * BLOQUE D: Updated index — exports crypto + pipeline + UTS v2
 * v2.0.0: + v5.2 BEHAVIOR, v5.3 POLICY, v5.4 TRAJECTORY, v6.0 preview
 */

export {
  canonicalize,
  canonicalHash,
  sign as ed25519Sign,
  verify as ed25519Verify,
  generateEd25519KeyPair,
  generatePoPChallenge,
  createPoPResponse,
  verifyPoP,
  computeArtifactBinding,
  DOMAINS,
  type Ed25519KeyPair,
  type PoPChallenge,
  type PoPResponse,
  type ArtifactBinding,
  type SignatureDomain,
} from './crypto.js';

// Backwards-compat aliases — old callers imported `sign` / `verify`.
export { sign, verify } from './crypto.js';

export {
  verifyCredential,
  type VerificationContext,
  type VerificationResult,
  type VerificationStage,
  type StageResult,
} from './verification-pipeline.js';

export { TrustEngine } from './trust-engine.js';
export * from './types.js';

// ============================================================================
// v5.2 — BEHAVIOR (shipped 2026-09, roadmap leapfrog)
// ============================================================================

export {
  computeBaseline,
  storeBaseline,
  getBaseline,
  listBaselines,
  deleteBaseline,
  hasEnoughObservations,
  hashBaseline,
  BASELINE_VERSION,
  DEFAULT_OBSERVATION_WINDOW_HOURS,
  MINIMUM_OBSERVATIONS_FOR_BASELINE,
  type BehaviorObservation,
  type MetricSummary,
  type BaselineProfile,
} from './behavioral-baseline.js';

export {
  detectDrift,
  DRIFT_VERSION,
  DRIFT_THRESHOLDS,
  SEVERITY_SCORE_IMPACT,
  type DriftSeverity,
  type DriftAlgorithm,
  type DriftSignal,
  type DriftResult,
} from './drift-detection.js';

export {
  analyzeBehavior,
  PATTERNS,
  BEHAVIOR_ANALYSIS_VERSION,
  type BehaviorFlag,
  type FlagSeverity,
  type NetworkConnection,
  type FileAccess,
  type ProcessSpawn,
  type BehaviorAnalysisResult,
} from './behavior-analysis.js';

// ============================================================================
// v5.3 — POLICY (shipped 2026-09, roadmap leapfrog)
// ============================================================================

export {
  matchCapabilities,
  checkFilesystemAccess,
  checkNetworkAccess,
  checkShellAccess,
  checkCredentialAccess,
  checkPaymentAccess,
  MINIMAL_SAFE,
  FULL_ACCESS,
  CAPABILITY_GRAPH_VERSION,
  CAPABILITY_LEVELS,
  type CapabilityLevel,
  type NetworkScope,
  type ShellAccess,
  type CredentialAccess,
  type CapabilityManifest,
  type CapabilityRequirements,
  type CapabilityCheckResult,
  type CapabilityMatchResult,
} from './capability-graph.js';

export {
  evaluatePolicy,
  createApprovalRequest,
  getApprovalStatus,
  approveRequest,
  denyRequest,
  cleanupExpiredApprovals,
  DEFAULT_STRICT_POLICY,
  DEFAULT_ENTERPRISE_POLICY,
  DEFAULT_PERMISSIVE_POLICY,
  POLICY_VERSION,
  DEFAULT_APPROVAL_TTL_MINUTES,
  MAX_PENDING_APPROVALS,
  type DecisionAction,
  type ApprovalStatus,
  type OrgPolicy,
  type TrustDecision,
  type ApprovalRequest,
} from './org-policy.js';

// ============================================================================
// v5.4 — TRAJECTORY (shipped 2026-09, roadmap leapfrog)
// ============================================================================

export {
  detectAttackChains,
  buildDataFlowGraph,
  scoreTrajectory,
  ATTACK_CHAIN_PATTERNS,
  TRAJECTORY_VERSION,
  MAX_TRAJECTORY_WINDOW,
  MAX_ATTACK_CHAIN_LENGTH,
  type ToolCall,
  type AttackChainPattern,
  type AttackChainDetection,
  type DataFlowNode,
  type DataFlowEdge,
  type DataFlowGraph,
  type TrajectoryRiskScore,
} from './trajectory-analysis.js';

// ============================================================================
// v6.0 preview — CROSS-AGENT TRUST + MEMORY POISONING (shipped 2026-09)
// ============================================================================

export {
  evaluateDelegation,
  scanMemoryForPoisoning,
  hashMemoryEntry,
  CROSS_AGENT_VERSION,
  MAX_DELEGATION_DEPTH,
  MEMORY_POISONING_VERSION,
  POISONING_PATTERNS,
  type DelegationRequest,
  type DelegationResult,
  type DelegationCheck,
  type MemoryEntry,
  type PoisoningSignal,
  type PoisoningScanResult,
} from './cross-agent-trust.js';

// ============================================================================
// TFP-1.0 + findings + transparency log (v5.1 hardening)
// ============================================================================

export {
  computeToolFingerprint,
  computeFingerprintSet,
  diffFingerprints,
  fingerprintFromToolsList,
  FINGERPRINT_VERSION,
  FINGERPRINT_ALGORITHM,
  type McpToolDefinition,
  type ToolFingerprint,
  type ToolFingerprintSet,
  type FingerprintDiff,
} from './tool-fingerprint.js';

export {
  computeConfidence,
  computeCoverage,
  summarizeFindings,
  compareAuditContexts,
  compareFindingsSummaries,
  defaultRiskScore,
  FINDINGS_SPEC_VERSION,
  FINDINGS_HASH_ALGORITHM,
  COVERAGE_WEIGHTS,
  type Severity,
  type RiskScore,
  type ConfidenceScore,
  type FindingSource,
  type Finding,
  type AuditCoverage,
  type FindingsSummary,
  type ConfidenceFactors,
  type AuditContext,
} from './findings.js';

export {
  RevocationTransparencyLog,
  MerkleTree,
  computeEntryLeafHash,
  verifyEntryHash,
  TRANSPARENCY_LOG_VERSION,
  TRANSPARENCY_LOG_HASH_ALGORITHM,
  TRANSPARENCY_LOG_SIGNATURE_ALGORITHM,
  type AtcState,
  type RevocationReason,
  type RevocationEntry,
  type SignedTreeHead,
  type InclusionProof,
  type ConsistencyProof,
} from './revocation-transparency.js';
