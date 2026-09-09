/**
 * @marketnow/trust-core
 * Organization Policies + Approval Workflow — v5.3.2 + v5.3.3
 *
 * Per-org risk context: same tool = safe for A, blocked for B.
 * Approval workflow: REQUIRE_APPROVAL | BLOCK | REQUIRE_APPROVAL.
 *
 * Closes GitHub Issues #6 and #7.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */
import type { CapabilityManifest, CapabilityRequirements } from './capability-graph.js';
export type DecisionAction = 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';
export interface OrgPolicy {
    org_id: string;
    org_name: string;
    min_trust_score: number;
    max_trust_score: number;
    required_capabilities: CapabilityRequirements;
    denied_capabilities: string[];
    approval_threshold: {
        score_range: [number, number];
        action: DecisionAction;
    }[];
    risk_overrides: Array<{
        tool_id: string;
        action: DecisionAction;
        reason: string;
    }>;
    policy_version: '1.0.0';
}
export interface TrustDecision {
    action: DecisionAction;
    reason: string;
    rules_triggered: string[];
    org_id: string;
    tool_id: string;
    trust_score: number;
    manifest_match: boolean;
    timestamp: string;
    decision_version: '1.0.0';
}
export interface ApprovalRequest {
    request_id: string;
    org_id: string;
    tool_id: string;
    trust_score: number;
    requested_action: string;
    status: ApprovalStatus;
    requested_at: string;
    expires_at: string;
    decided_by?: string;
    decided_at?: string;
    reason?: string;
}
/**
 * Evaluate a tool against an organization's policy.
 * Returns: ALLOW, REQUIRE_APPROVAL, or BLOCK.
 */
export declare function evaluatePolicy(trustScore: number, manifest: CapabilityManifest, policy: OrgPolicy): TrustDecision;
export declare const DEFAULT_STRICT_POLICY: OrgPolicy;
export declare const DEFAULT_ENTERPRISE_POLICY: OrgPolicy;
export declare const DEFAULT_PERMISSIVE_POLICY: OrgPolicy;
/**
 * Create an approval request for a tool that needs human review.
 */
export declare function createApprovalRequest(orgId: string, toolId: string, trustScore: number, requestedAction: string, ttlMinutes?: number): ApprovalRequest;
/**
 * Check the status of an approval request.
 */
export declare function getApprovalStatus(requestId: string): ApprovalRequest | undefined;
/**
 * Approve a pending request.
 */
export declare function approveRequest(requestId: string, decidedBy: string, reason?: string): ApprovalRequest | undefined;
/**
 * Deny a pending request.
 */
export declare function denyRequest(requestId: string, decidedBy: string, reason?: string): ApprovalRequest | undefined;
/**
 * Clean up expired requests.
 */
export declare function cleanupExpiredApprovals(): number;
export declare const POLICY_VERSION = "1.0.0";
export declare const DEFAULT_APPROVAL_TTL_MINUTES = 30;
export declare const MAX_PENDING_APPROVALS = 1000;
