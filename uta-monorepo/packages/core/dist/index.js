"use strict";
/**
 * @marketnow/trust-core
 * BLOQUE D: Updated index — exports crypto + pipeline + UTS v2
 * v2.0.0: + v5.2 BEHAVIOR, v5.3 POLICY, v5.4 TRAJECTORY, v6.0 preview
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PERMISSIVE_POLICY = exports.DEFAULT_ENTERPRISE_POLICY = exports.DEFAULT_STRICT_POLICY = exports.cleanupExpiredApprovals = exports.denyRequest = exports.approveRequest = exports.getApprovalStatus = exports.createApprovalRequest = exports.evaluatePolicy = exports.CAPABILITY_LEVELS = exports.CAPABILITY_GRAPH_VERSION = exports.FULL_ACCESS = exports.MINIMAL_SAFE = exports.checkPaymentAccess = exports.checkCredentialAccess = exports.checkShellAccess = exports.checkNetworkAccess = exports.checkFilesystemAccess = exports.matchCapabilities = exports.BEHAVIOR_ANALYSIS_VERSION = exports.PATTERNS = exports.analyzeBehavior = exports.SEVERITY_SCORE_IMPACT = exports.DRIFT_THRESHOLDS = exports.DRIFT_VERSION = exports.detectDrift = exports.MINIMUM_OBSERVATIONS_FOR_BASELINE = exports.DEFAULT_OBSERVATION_WINDOW_HOURS = exports.BASELINE_VERSION = exports.hashBaseline = exports.hasEnoughObservations = exports.deleteBaseline = exports.listBaselines = exports.getBaseline = exports.storeBaseline = exports.computeBaseline = exports.TrustEngine = exports.verifyCredential = exports.verify = exports.sign = exports.DOMAINS = exports.computeArtifactBinding = exports.verifyPoP = exports.createPoPResponse = exports.generatePoPChallenge = exports.generateEd25519KeyPair = exports.ed25519Verify = exports.ed25519Sign = exports.canonicalHash = exports.canonicalize = void 0;
exports.TRANSPARENCY_LOG_SIGNATURE_ALGORITHM = exports.TRANSPARENCY_LOG_HASH_ALGORITHM = exports.TRANSPARENCY_LOG_VERSION = exports.verifyEntryHash = exports.computeEntryLeafHash = exports.MerkleTree = exports.RevocationTransparencyLog = exports.COVERAGE_WEIGHTS = exports.FINDINGS_HASH_ALGORITHM = exports.FINDINGS_SPEC_VERSION = exports.defaultRiskScore = exports.compareFindingsSummaries = exports.compareAuditContexts = exports.summarizeFindings = exports.computeCoverage = exports.computeConfidence = exports.FINGERPRINT_ALGORITHM = exports.FINGERPRINT_VERSION = exports.fingerprintFromToolsList = exports.diffFingerprints = exports.computeFingerprintSet = exports.computeToolFingerprint = exports.POISONING_PATTERNS = exports.MEMORY_POISONING_VERSION = exports.MAX_DELEGATION_DEPTH = exports.CROSS_AGENT_VERSION = exports.hashMemoryEntry = exports.scanMemoryForPoisoning = exports.evaluateDelegation = exports.MAX_ATTACK_CHAIN_LENGTH = exports.MAX_TRAJECTORY_WINDOW = exports.TRAJECTORY_VERSION = exports.ATTACK_CHAIN_PATTERNS = exports.scoreTrajectory = exports.buildDataFlowGraph = exports.detectAttackChains = exports.MAX_PENDING_APPROVALS = exports.DEFAULT_APPROVAL_TTL_MINUTES = exports.POLICY_VERSION = void 0;
var crypto_js_1 = require("./crypto.js");
Object.defineProperty(exports, "canonicalize", { enumerable: true, get: function () { return crypto_js_1.canonicalize; } });
Object.defineProperty(exports, "canonicalHash", { enumerable: true, get: function () { return crypto_js_1.canonicalHash; } });
Object.defineProperty(exports, "ed25519Sign", { enumerable: true, get: function () { return crypto_js_1.sign; } });
Object.defineProperty(exports, "ed25519Verify", { enumerable: true, get: function () { return crypto_js_1.verify; } });
Object.defineProperty(exports, "generateEd25519KeyPair", { enumerable: true, get: function () { return crypto_js_1.generateEd25519KeyPair; } });
Object.defineProperty(exports, "generatePoPChallenge", { enumerable: true, get: function () { return crypto_js_1.generatePoPChallenge; } });
Object.defineProperty(exports, "createPoPResponse", { enumerable: true, get: function () { return crypto_js_1.createPoPResponse; } });
Object.defineProperty(exports, "verifyPoP", { enumerable: true, get: function () { return crypto_js_1.verifyPoP; } });
Object.defineProperty(exports, "computeArtifactBinding", { enumerable: true, get: function () { return crypto_js_1.computeArtifactBinding; } });
Object.defineProperty(exports, "DOMAINS", { enumerable: true, get: function () { return crypto_js_1.DOMAINS; } });
// Backwards-compat aliases — old callers imported `sign` / `verify`.
var crypto_js_2 = require("./crypto.js");
Object.defineProperty(exports, "sign", { enumerable: true, get: function () { return crypto_js_2.sign; } });
Object.defineProperty(exports, "verify", { enumerable: true, get: function () { return crypto_js_2.verify; } });
var verification_pipeline_js_1 = require("./verification-pipeline.js");
Object.defineProperty(exports, "verifyCredential", { enumerable: true, get: function () { return verification_pipeline_js_1.verifyCredential; } });
var trust_engine_js_1 = require("./trust-engine.js");
Object.defineProperty(exports, "TrustEngine", { enumerable: true, get: function () { return trust_engine_js_1.TrustEngine; } });
__exportStar(require("./types.js"), exports);
// ============================================================================
// v5.2 — BEHAVIOR (shipped 2026-09, roadmap leapfrog)
// ============================================================================
var behavioral_baseline_js_1 = require("./behavioral-baseline.js");
Object.defineProperty(exports, "computeBaseline", { enumerable: true, get: function () { return behavioral_baseline_js_1.computeBaseline; } });
Object.defineProperty(exports, "storeBaseline", { enumerable: true, get: function () { return behavioral_baseline_js_1.storeBaseline; } });
Object.defineProperty(exports, "getBaseline", { enumerable: true, get: function () { return behavioral_baseline_js_1.getBaseline; } });
Object.defineProperty(exports, "listBaselines", { enumerable: true, get: function () { return behavioral_baseline_js_1.listBaselines; } });
Object.defineProperty(exports, "deleteBaseline", { enumerable: true, get: function () { return behavioral_baseline_js_1.deleteBaseline; } });
Object.defineProperty(exports, "hasEnoughObservations", { enumerable: true, get: function () { return behavioral_baseline_js_1.hasEnoughObservations; } });
Object.defineProperty(exports, "hashBaseline", { enumerable: true, get: function () { return behavioral_baseline_js_1.hashBaseline; } });
Object.defineProperty(exports, "BASELINE_VERSION", { enumerable: true, get: function () { return behavioral_baseline_js_1.BASELINE_VERSION; } });
Object.defineProperty(exports, "DEFAULT_OBSERVATION_WINDOW_HOURS", { enumerable: true, get: function () { return behavioral_baseline_js_1.DEFAULT_OBSERVATION_WINDOW_HOURS; } });
Object.defineProperty(exports, "MINIMUM_OBSERVATIONS_FOR_BASELINE", { enumerable: true, get: function () { return behavioral_baseline_js_1.MINIMUM_OBSERVATIONS_FOR_BASELINE; } });
var drift_detection_js_1 = require("./drift-detection.js");
Object.defineProperty(exports, "detectDrift", { enumerable: true, get: function () { return drift_detection_js_1.detectDrift; } });
Object.defineProperty(exports, "DRIFT_VERSION", { enumerable: true, get: function () { return drift_detection_js_1.DRIFT_VERSION; } });
Object.defineProperty(exports, "DRIFT_THRESHOLDS", { enumerable: true, get: function () { return drift_detection_js_1.DRIFT_THRESHOLDS; } });
Object.defineProperty(exports, "SEVERITY_SCORE_IMPACT", { enumerable: true, get: function () { return drift_detection_js_1.SEVERITY_SCORE_IMPACT; } });
var behavior_analysis_js_1 = require("./behavior-analysis.js");
Object.defineProperty(exports, "analyzeBehavior", { enumerable: true, get: function () { return behavior_analysis_js_1.analyzeBehavior; } });
Object.defineProperty(exports, "PATTERNS", { enumerable: true, get: function () { return behavior_analysis_js_1.PATTERNS; } });
Object.defineProperty(exports, "BEHAVIOR_ANALYSIS_VERSION", { enumerable: true, get: function () { return behavior_analysis_js_1.BEHAVIOR_ANALYSIS_VERSION; } });
// ============================================================================
// v5.3 — POLICY (shipped 2026-09, roadmap leapfrog)
// ============================================================================
var capability_graph_js_1 = require("./capability-graph.js");
Object.defineProperty(exports, "matchCapabilities", { enumerable: true, get: function () { return capability_graph_js_1.matchCapabilities; } });
Object.defineProperty(exports, "checkFilesystemAccess", { enumerable: true, get: function () { return capability_graph_js_1.checkFilesystemAccess; } });
Object.defineProperty(exports, "checkNetworkAccess", { enumerable: true, get: function () { return capability_graph_js_1.checkNetworkAccess; } });
Object.defineProperty(exports, "checkShellAccess", { enumerable: true, get: function () { return capability_graph_js_1.checkShellAccess; } });
Object.defineProperty(exports, "checkCredentialAccess", { enumerable: true, get: function () { return capability_graph_js_1.checkCredentialAccess; } });
Object.defineProperty(exports, "checkPaymentAccess", { enumerable: true, get: function () { return capability_graph_js_1.checkPaymentAccess; } });
Object.defineProperty(exports, "MINIMAL_SAFE", { enumerable: true, get: function () { return capability_graph_js_1.MINIMAL_SAFE; } });
Object.defineProperty(exports, "FULL_ACCESS", { enumerable: true, get: function () { return capability_graph_js_1.FULL_ACCESS; } });
Object.defineProperty(exports, "CAPABILITY_GRAPH_VERSION", { enumerable: true, get: function () { return capability_graph_js_1.CAPABILITY_GRAPH_VERSION; } });
Object.defineProperty(exports, "CAPABILITY_LEVELS", { enumerable: true, get: function () { return capability_graph_js_1.CAPABILITY_LEVELS; } });
var org_policy_js_1 = require("./org-policy.js");
Object.defineProperty(exports, "evaluatePolicy", { enumerable: true, get: function () { return org_policy_js_1.evaluatePolicy; } });
Object.defineProperty(exports, "createApprovalRequest", { enumerable: true, get: function () { return org_policy_js_1.createApprovalRequest; } });
Object.defineProperty(exports, "getApprovalStatus", { enumerable: true, get: function () { return org_policy_js_1.getApprovalStatus; } });
Object.defineProperty(exports, "approveRequest", { enumerable: true, get: function () { return org_policy_js_1.approveRequest; } });
Object.defineProperty(exports, "denyRequest", { enumerable: true, get: function () { return org_policy_js_1.denyRequest; } });
Object.defineProperty(exports, "cleanupExpiredApprovals", { enumerable: true, get: function () { return org_policy_js_1.cleanupExpiredApprovals; } });
Object.defineProperty(exports, "DEFAULT_STRICT_POLICY", { enumerable: true, get: function () { return org_policy_js_1.DEFAULT_STRICT_POLICY; } });
Object.defineProperty(exports, "DEFAULT_ENTERPRISE_POLICY", { enumerable: true, get: function () { return org_policy_js_1.DEFAULT_ENTERPRISE_POLICY; } });
Object.defineProperty(exports, "DEFAULT_PERMISSIVE_POLICY", { enumerable: true, get: function () { return org_policy_js_1.DEFAULT_PERMISSIVE_POLICY; } });
Object.defineProperty(exports, "POLICY_VERSION", { enumerable: true, get: function () { return org_policy_js_1.POLICY_VERSION; } });
Object.defineProperty(exports, "DEFAULT_APPROVAL_TTL_MINUTES", { enumerable: true, get: function () { return org_policy_js_1.DEFAULT_APPROVAL_TTL_MINUTES; } });
Object.defineProperty(exports, "MAX_PENDING_APPROVALS", { enumerable: true, get: function () { return org_policy_js_1.MAX_PENDING_APPROVALS; } });
// ============================================================================
// v5.4 — TRAJECTORY (shipped 2026-09, roadmap leapfrog)
// ============================================================================
var trajectory_analysis_js_1 = require("./trajectory-analysis.js");
Object.defineProperty(exports, "detectAttackChains", { enumerable: true, get: function () { return trajectory_analysis_js_1.detectAttackChains; } });
Object.defineProperty(exports, "buildDataFlowGraph", { enumerable: true, get: function () { return trajectory_analysis_js_1.buildDataFlowGraph; } });
Object.defineProperty(exports, "scoreTrajectory", { enumerable: true, get: function () { return trajectory_analysis_js_1.scoreTrajectory; } });
Object.defineProperty(exports, "ATTACK_CHAIN_PATTERNS", { enumerable: true, get: function () { return trajectory_analysis_js_1.ATTACK_CHAIN_PATTERNS; } });
Object.defineProperty(exports, "TRAJECTORY_VERSION", { enumerable: true, get: function () { return trajectory_analysis_js_1.TRAJECTORY_VERSION; } });
Object.defineProperty(exports, "MAX_TRAJECTORY_WINDOW", { enumerable: true, get: function () { return trajectory_analysis_js_1.MAX_TRAJECTORY_WINDOW; } });
Object.defineProperty(exports, "MAX_ATTACK_CHAIN_LENGTH", { enumerable: true, get: function () { return trajectory_analysis_js_1.MAX_ATTACK_CHAIN_LENGTH; } });
// ============================================================================
// v6.0 preview — CROSS-AGENT TRUST + MEMORY POISONING (shipped 2026-09)
// ============================================================================
var cross_agent_trust_js_1 = require("./cross-agent-trust.js");
Object.defineProperty(exports, "evaluateDelegation", { enumerable: true, get: function () { return cross_agent_trust_js_1.evaluateDelegation; } });
Object.defineProperty(exports, "scanMemoryForPoisoning", { enumerable: true, get: function () { return cross_agent_trust_js_1.scanMemoryForPoisoning; } });
Object.defineProperty(exports, "hashMemoryEntry", { enumerable: true, get: function () { return cross_agent_trust_js_1.hashMemoryEntry; } });
Object.defineProperty(exports, "CROSS_AGENT_VERSION", { enumerable: true, get: function () { return cross_agent_trust_js_1.CROSS_AGENT_VERSION; } });
Object.defineProperty(exports, "MAX_DELEGATION_DEPTH", { enumerable: true, get: function () { return cross_agent_trust_js_1.MAX_DELEGATION_DEPTH; } });
Object.defineProperty(exports, "MEMORY_POISONING_VERSION", { enumerable: true, get: function () { return cross_agent_trust_js_1.MEMORY_POISONING_VERSION; } });
Object.defineProperty(exports, "POISONING_PATTERNS", { enumerable: true, get: function () { return cross_agent_trust_js_1.POISONING_PATTERNS; } });
// ============================================================================
// TFP-1.0 + findings + transparency log (v5.1 hardening)
// ============================================================================
var tool_fingerprint_js_1 = require("./tool-fingerprint.js");
Object.defineProperty(exports, "computeToolFingerprint", { enumerable: true, get: function () { return tool_fingerprint_js_1.computeToolFingerprint; } });
Object.defineProperty(exports, "computeFingerprintSet", { enumerable: true, get: function () { return tool_fingerprint_js_1.computeFingerprintSet; } });
Object.defineProperty(exports, "diffFingerprints", { enumerable: true, get: function () { return tool_fingerprint_js_1.diffFingerprints; } });
Object.defineProperty(exports, "fingerprintFromToolsList", { enumerable: true, get: function () { return tool_fingerprint_js_1.fingerprintFromToolsList; } });
Object.defineProperty(exports, "FINGERPRINT_VERSION", { enumerable: true, get: function () { return tool_fingerprint_js_1.FINGERPRINT_VERSION; } });
Object.defineProperty(exports, "FINGERPRINT_ALGORITHM", { enumerable: true, get: function () { return tool_fingerprint_js_1.FINGERPRINT_ALGORITHM; } });
var findings_js_1 = require("./findings.js");
Object.defineProperty(exports, "computeConfidence", { enumerable: true, get: function () { return findings_js_1.computeConfidence; } });
Object.defineProperty(exports, "computeCoverage", { enumerable: true, get: function () { return findings_js_1.computeCoverage; } });
Object.defineProperty(exports, "summarizeFindings", { enumerable: true, get: function () { return findings_js_1.summarizeFindings; } });
Object.defineProperty(exports, "compareAuditContexts", { enumerable: true, get: function () { return findings_js_1.compareAuditContexts; } });
Object.defineProperty(exports, "compareFindingsSummaries", { enumerable: true, get: function () { return findings_js_1.compareFindingsSummaries; } });
Object.defineProperty(exports, "defaultRiskScore", { enumerable: true, get: function () { return findings_js_1.defaultRiskScore; } });
Object.defineProperty(exports, "FINDINGS_SPEC_VERSION", { enumerable: true, get: function () { return findings_js_1.FINDINGS_SPEC_VERSION; } });
Object.defineProperty(exports, "FINDINGS_HASH_ALGORITHM", { enumerable: true, get: function () { return findings_js_1.FINDINGS_HASH_ALGORITHM; } });
Object.defineProperty(exports, "COVERAGE_WEIGHTS", { enumerable: true, get: function () { return findings_js_1.COVERAGE_WEIGHTS; } });
var revocation_transparency_js_1 = require("./revocation-transparency.js");
Object.defineProperty(exports, "RevocationTransparencyLog", { enumerable: true, get: function () { return revocation_transparency_js_1.RevocationTransparencyLog; } });
Object.defineProperty(exports, "MerkleTree", { enumerable: true, get: function () { return revocation_transparency_js_1.MerkleTree; } });
Object.defineProperty(exports, "computeEntryLeafHash", { enumerable: true, get: function () { return revocation_transparency_js_1.computeEntryLeafHash; } });
Object.defineProperty(exports, "verifyEntryHash", { enumerable: true, get: function () { return revocation_transparency_js_1.verifyEntryHash; } });
Object.defineProperty(exports, "TRANSPARENCY_LOG_VERSION", { enumerable: true, get: function () { return revocation_transparency_js_1.TRANSPARENCY_LOG_VERSION; } });
Object.defineProperty(exports, "TRANSPARENCY_LOG_HASH_ALGORITHM", { enumerable: true, get: function () { return revocation_transparency_js_1.TRANSPARENCY_LOG_HASH_ALGORITHM; } });
Object.defineProperty(exports, "TRANSPARENCY_LOG_SIGNATURE_ALGORITHM", { enumerable: true, get: function () { return revocation_transparency_js_1.TRANSPARENCY_LOG_SIGNATURE_ALGORITHM; } });
