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

import type { CapabilityManifest } from './capability-graph.js';
import { matchCapabilities } from './capability-graph.js';

// ============================================================================
// Types
// ============================================================================

export type DecisionAction = 'ALLOW' | 'REQUIRE_APPROVAL' | 'BLOCK';
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface OrgPolicy {
  org_id: string;
  org_name: string;
  min_trust_score: number;
  max_trust_score: number;
  required_capabilities: Partial<CapabilityManifest>;
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

// ============================================================================
// Decision engine
// ============================================================================

const DEFAULT_THRESHOLDS: ApprovalRequest['approval_threshold'] = undefined as any;

/**
 * Evaluate a tool against an organization's policy.
 * Returns: ALLOW, REQUIRE_APPROVAL, or BLOCK.
 */
export function evaluatePolicy(
  trustScore: number,
  manifest: CapabilityManifest,
  policy: OrgPolicy,
): TrustDecision {
  const rulesTriggered: string[] = [];
  let action: DecisionAction = 'ALLOW';
  let reason = 'All checks passed';

  // Rule 1: Minimum trust score
  if (trustScore < policy.min_trust_score) {
    action = 'BLOCK';
    reason = `Trust score ${trustScore} below minimum ${policy.min_trust_score}`;
    rulesTriggered.push('min_trust_score');
    return buildDecision(action, reason, rulesTriggered, policy, manifest, trustScore);
  }

  // Rule 2: Maximum trust score check (suspiciously high?)
  if (trustScore > policy.max_trust_score) {
    rulesTriggered.push('suspiciously_high_score');
    // Don't block, but warn
  }

  // Rule 3: Capability match
  if (policy.required_capabilities) {
    const match = matchCapabilities(manifest, policy.required_capabilities);
    if (!match.matches) {
      action = 'BLOCK';
      reason = `Missing required capabilities: ${match.unsatisfied.map(u => u.capability).join(', ')}`;
      rulesTriggered.push('capability_mismatch');
      return buildDecision(action, reason, rulesTriggered, policy, manifest, trustScore);
    }
    rulesTriggered.push('capability_match_passed');
  }

  // Rule 4: Denied capabilities
  for (const denied of policy.denied_capabilities) {
    const parts = denied.split('.');
    const category = parts[0];
    const sub = parts[1];

    if (category === 'shell' && sub === 'exec' && manifest.shell.exec !== 'none') {
      action = 'BLOCK';
      reason = `Denied capability: ${denied}`;
      rulesTriggered.push('denied_capability_shell');
      return buildDecision(action, reason, rulesTriggered, policy, manifest, trustScore);
    }
    if (category === 'network' && sub === 'egress' && manifest.network.egress !== 'none') {
      action = 'BLOCK';
      reason = `Denied capability: ${denied}`;
      rulesTriggered.push('denied_capability_network');
      return buildDecision(action, reason, rulesTriggered, policy, manifest, trustScore);
    }
  }

  // Rule 5: Approval thresholds
  for (const threshold of policy.approval_threshold) {
    const [min, max] = threshold.score_range;
    if (trustScore >= min && trustScore <= max) {
      action = threshold.action;
      reason = `Score ${trustScore} in range [${min}, ${max}] → ${threshold.action}`;
      rulesTriggered.push('approval_threshold');
      break;
    }
  }

  // Rule 6: Risk overrides (per-tool)
  for (const override of policy.risk_overrides) {
    // Match by tool_id prefix
    if (override.tool_id === '*' || override.tool_id === manifest.tool_id) {
      action = override.action;
      reason = `Override: ${override.reason}`;
      rulesTriggered.push('risk_override');
      break;
    }
  }

  return buildDecision(action, reason, rulesTriggered, policy, manifest, trustScore);
}

function buildDecision(
  action: DecisionAction,
  reason: string,
  rules: string[],
  policy: OrgPolicy,
  manifest: CapabilityManifest,
  trustScore: number,
): TrustDecision {
  return {
    action,
    reason,
    rules_triggered: rules,
    org_id: policy.org_id,
    tool_id: manifest.tool_id,
    trust_score: trustScore,
    manifest_match: true,
    timestamp: new Date().toISOString(),
    decision_version: '1.0.0',
  };
}

// ============================================================================
// Default policies
// ============================================================================

export const DEFAULT_STRICT_POLICY: OrgPolicy = {
  org_id: 'default-strict',
  org_name: 'Default Strict Policy',
  min_trust_score: 7,
  max_trust_score: 10,
  required_capabilities: {
    filesystem: { read: 'read', write: 'none' },
    network: { egress: 'none' },
    shell: { exec: 'none' },
  },
  denied_capabilities: ['shell.exec', 'network.egress', 'credentials.read_env'],
  approval_threshold: [
    { score_range: [0, 4], action: 'BLOCK' },
    { score_range: [5, 7], action: 'REQUIRE_APPROVAL' },
    { score_range: [8, 10], action: 'ALLOW' },
  ],
  risk_overrides: [],
  policy_version: '1.0.0',
};

export const DEFAULT_ENTERPRISE_POLICY: OrgPolicy = {
  org_id: 'default-enterprise',
  org_name: 'Enterprise Policy',
  min_trust_score: 8,
  max_trust_score: 10,
  required_capabilities: {
    filesystem: { read: 'read', write: 'none' },
    network: { egress: 'allowlist' },
    shell: { exec: 'none' },
    credentials: { read_env: 'env_allowlist' },
  },
  denied_capabilities: ['shell.exec', 'credentials.read_files'],
  approval_threshold: [
    { score_range: [0, 5], action: 'BLOCK' },
    { score_range: [6, 7], action: 'REQUIRE_APPROVAL' },
    { score_range: [8, 10], action: 'ALLOW' },
  ],
  risk_overrides: [],
  policy_version: '1.0.0',
};

export const DEFAULT_PERMISSIVE_POLICY: OrgPolicy = {
  org_id: 'default-permissive',
  org_name: 'Permissive Policy (development only)',
  min_trust_score: 0,
  max_trust_score: 10,
  required_capabilities: {},
  denied_capabilities: [],
  approval_threshold: [
    { score_range: [0, 3], action: 'REQUIRE_APPROVAL' },
    { score_range: [4, 10], action: 'ALLOW' },
  ],
  risk_overrides: [],
  policy_version: '1.0.0',
};

// ============================================================================
// Approval workflow
// ============================================================================

const approvalStore = new Map<string, ApprovalRequest>();

/**
 * Create an approval request for a tool that needs human review.
 */
export function createApprovalRequest(
  orgId: string,
  toolId: string,
  trustScore: number,
  requestedAction: string,
  ttlMinutes: number = 30,
): ApprovalRequest {
  const requestId = `APR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  const request: ApprovalRequest = {
    request_id: requestId,
    org_id: orgId,
    tool_id: toolId,
    trust_score: trustScore,
    requested_action: requestedAction,
    status: 'pending',
    requested_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };

  approvalStore.set(requestId, request);
  return request;
}

/**
 * Check the status of an approval request.
 */
export function getApprovalStatus(requestId: string): ApprovalRequest | undefined {
  const request = approvalStore.get(requestId);
  if (!request) return undefined;

  // Check if expired
  if (request.status === 'pending') {
    const now = new Date();
    const expires = new Date(request.expires_at);
    if (now > expires) {
      request.status = 'expired';
      request.reason = 'Approval request expired';
    }
  }

  return request;
}

/**
 * Approve a pending request.
 */
export function approveRequest(
  requestId: string,
  decidedBy: string,
  reason?: string,
): ApprovalRequest | undefined {
  const request = approvalStore.get(requestId);
  if (!request) return undefined;
  if (request.status !== 'pending') return request;

  request.status = 'approved';
  request.decided_by = decidedBy;
  request.decided_at = new Date().toISOString();
  request.reason = reason;
  return request;
}

/**
 * Deny a pending request.
 */
export function denyRequest(
  requestId: string,
  decidedBy: string,
  reason?: string,
): ApprovalRequest | undefined {
  const request = approvalStore.get(requestId);
  if (!request) return undefined;
  if (request.status !== 'pending') return request;

  request.status = 'denied';
  request.decided_by = decidedBy;
  request.decided_at = new Date().toISOString();
  request.reason = reason;
  return request;
}

/**
 * Clean up expired requests.
 */
export function cleanupExpiredApprovals(): number {
  let cleaned = 0;
  const now = new Date();
  for (const [id, request] of approvalStore.entries()) {
    if (request.status === 'pending') {
      const expires = new Date(request.expires_at);
      if (now > expires) {
        request.status = 'expired';
        request.reason = 'Expired during cleanup';
        cleaned++;
      }
    }
  }
  return cleaned;
}

// ============================================================================
// Constants
// ============================================================================

export const POLICY_VERSION = '1.0.0';
export const DEFAULT_APPROVAL_TTL_MINUTES = 30;
export const MAX_PENDING_APPROVALS = 1000;
