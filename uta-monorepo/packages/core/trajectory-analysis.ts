/**
 * @marketnow/trust-core
 * Multi-Tool Attack Chain Analysis + Data Flow Tracking — v5.4
 *
 * Detects multi-step attack chains across tool calls.
 * Tracks data flow from untrusted inputs through the agent pipeline.
 *
 * Closes GitHub Issues #8 and #9.
 *
 * AliceLabs Source-Available License v1.0 (AL-1.0)
 */

import { createHash } from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

export interface ToolCall {
  call_id: string;
  session_id: string;
  agent_id: string;
  tool_name: string;
  tool_id: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  result_summary?: string;
  timestamp: string;
  allowed: boolean;
  trust_score_at_call: number;
}

export interface AttackChainPattern {
  pattern_id: string;
  name: string;
  description: string;
  /** Sequence of tool names that constitute the attack */
  sequence: string[];
  /** Max time between first and last call (ms) */
  max_window_ms: number;
  /** Severity if detected */
  severity: 'high' | 'critical';
  /** Required data flow (e.g., URL extracted in step 2 must appear in step 4) */
  data_flow_required?: boolean;
}

export interface AttackChainDetection {
  pattern: AttackChainPattern;
  calls: ToolCall[];
  start_time: string;
  end_time: string;
  duration_ms: number;
  severity: 'high' | 'critical';
  description: string;
  evidence: string;
  should_block: boolean;
}

export interface DataFlowNode {
  node_id: string;
  call_id: string;
  tool_name: string;
  data_type: 'user_input' | 'tool_output' | 'llm_generated' | 'secret' | 'file_content' | 'api_response' | 'db_query' | 'shell_output';
  data_hash: string;
  data_preview: string;
  is_sensitive: boolean;
  is_external_egress: boolean;
  timestamp: string;
}

export interface DataFlowEdge {
  from_node: string;
  to_node: string;
  relationship: 'passes_to' | 'extracts_from' | 'writes_to' | 'sends_to' | 'embeds_in';
  description: string;
}

export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  exfiltration_paths: Array<{
    path: string[];
    description: string;
    severity: 'high' | 'critical';
  }>;
}

export interface TrajectoryRiskScore {
  session_id: string;
  total_calls: number;
  risk_score: number; // 0-10
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  attack_chains_detected: AttackChainDetection[];
  exfiltration_detected: boolean;
  should_block_call: number | null; // which call number to block
  reason: string;
  computed_at: string;
}

// ============================================================================
// Predefined attack chain patterns
// ============================================================================

export const ATTACK_CHAIN_PATTERNS: AttackChainPattern[] = [
  {
    pattern_id: 'AC-001',
    name: 'Search → Read → Extract URL → Download → Execute',
    description: 'Agent searches for info, reads a file containing a URL, downloads payload, executes it',
    sequence: ['search', 'read', 'fetch', 'execute'],
    max_window_ms: 5 * 60 * 1000, // 5 min
    severity: 'critical',
    data_flow_required: true,
  },
  {
    pattern_id: 'AC-002',
    name: 'Read .env → Exfiltrate via network',
    description: 'Agent reads .env file, then sends the contents to an external host',
    sequence: ['read', 'fetch'],
    max_window_ms: 60 * 1000, // 1 min
    severity: 'critical',
    data_flow_required: true,
  },
  {
    pattern_id: 'AC-003',
    name: 'DB Query → Extract → External API call',
    description: 'Agent queries database, extracts sensitive data, sends to external API',
    sequence: ['query', 'fetch'],
    max_window_ms: 2 * 60 * 1000,
    severity: 'high',
    data_flow_required: true,
  },
  {
    pattern_id: 'AC-004',
    name: 'File read → Shell exec with file content',
    description: 'Agent reads a file, then passes its content to shell execution',
    sequence: ['read', 'execute'],
    max_window_ms: 30 * 1000,
    severity: 'high',
    data_flow_required: true,
  },
  {
    pattern_id: 'AC-005',
    name: 'Fetch → Write → Execute (supply chain drop)',
    description: 'Agent downloads a file, writes it to disk, then executes it',
    sequence: ['fetch', 'write', 'execute'],
    max_window_ms: 3 * 60 * 1000,
    severity: 'critical',
    data_flow_required: false,
  },
  {
    pattern_id: 'AC-006',
    name: 'Credential access → Network egress',
    description: 'Agent accesses credential store, then makes network call',
    sequence: ['read_env', 'fetch'],
    max_window_ms: 30 * 1000,
    severity: 'critical',
    data_flow_required: true,
  },
  {
    pattern_id: 'AC-007',
    name: 'Prompt injection → Tool execution',
    description: 'Tool returns injected instructions, agent follows them in next call',
    sequence: ['fetch', 'execute'],
    max_window_ms: 60 * 1000,
    severity: 'high',
    data_flow_required: false,
  },
  {
    pattern_id: 'AC-008',
    name: 'Reconnaissance → Exploit → Persist',
    description: 'Agent scans filesystem, exploits vulnerability, writes persistence mechanism',
    sequence: ['search', 'read', 'write'],
    max_window_ms: 5 * 60 * 1000,
    severity: 'high',
    data_flow_required: false,
  },
];

// ============================================================================
// Attack chain detection
// ============================================================================

/**
 * Detect attack chains in a sequence of tool calls.
 * Looks for known patterns in the call history.
 */
export function detectAttackChains(calls: ToolCall[]): AttackChainDetection[] {
  const detections: AttackChainDetection[] = [];

  for (const pattern of ATTACK_CHAIN_PATTERNS) {
    // Slide a window over the calls
    for (let i = 0; i <= calls.length - pattern.sequence.length; i++) {
      const window = calls.slice(i, i + pattern.sequence.length);

      // Check if the tool names match the pattern
      const matches = window.every((call, idx) => {
        const expected = pattern.sequence[idx];
        return call.tool_name.includes(expected) || call.tool_name === expected;
      });

      if (!matches) continue;

      // Check time window
      const startTime = new Date(window[0].timestamp).getTime();
      const endTime = new Date(window[window.length - 1].timestamp).getTime();
      const duration = endTime - startTime;

      if (duration > pattern.max_window_ms) continue;

      // Check data flow if required
      if (pattern.data_flow_required) {
        const hasDataFlow = checkDataFlowBetweenCalls(window);
        if (!hasDataFlow) continue;
      }

      // All checks passed — this is a detection
      detections.push({
        pattern,
        calls: window,
        start_time: window[0].timestamp,
        end_time: window[window.length - 1].timestamp,
        duration_ms: duration,
        severity: pattern.severity,
        description: `Attack chain detected: ${pattern.name}`,
        evidence: `Calls: ${window.map(c => `${c.tool_name}(${c.call_id})`).join(' → ')}`,
        should_block: pattern.severity === 'critical',
      });
    }
  }

  return detections;
}

/**
 * Check if data flows between calls (rough heuristic).
 * Looks for shared content between tool outputs and subsequent tool inputs.
 */
function checkDataFlowBetweenCalls(calls: ToolCall[]): boolean {
  for (let i = 0; i < calls.length - 1; i++) {
    const output = calls[i].result_summary || JSON.stringify(calls[i].result || '');
    const input = JSON.stringify(calls[i + 1].arguments || {});

    // Check if any substring of the output appears in the next call's input
    if (output.length > 10 && input.length > 10) {
      // Take a sample from the output
      const sample = output.slice(0, Math.min(50, output.length));
      if (input.includes(sample)) {
        return true;
      }
    }
  }
  return false;
}

// ============================================================================
// Data flow tracking
// ============================================================================

const SENSITIVE_DATA_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /credential/i,
  /private[_-]?key/i,
  /BEGIN.*PRIVATE KEY/i,
  /aws_access/i,
  /aws_secret/i,
];

/**
 * Build a data flow graph from tool calls.
 * Tracks where data comes from and where it goes.
 */
export function buildDataFlowGraph(calls: ToolCall[]): DataFlowGraph {
  const nodes: DataFlowNode[] = [];
  const edges: DataFlowEdge[] = [];
  const exfiltrationPaths: Array<{ path: string[]; description: string; severity: 'high' | 'critical' }> = [];

  for (const call of calls) {
    // Create node for the call's output
    const outputHash = createHash('sha256')
      .update(JSON.stringify(call.result || ''))
      .digest('hex');

    const isSensitive = SENSITIVE_DATA_PATTERNS.some(p =>
      p.test(JSON.stringify(call.result || '')) ||
      p.test(JSON.stringify(call.arguments || ''))
    );

    const isExternalEgress = call.tool_name.includes('fetch') ||
                              call.tool_name.includes('send') ||
                              call.tool_name.includes('post');

    const node: DataFlowNode = {
      node_id: `node-${call.call_id}`,
      call_id: call.call_id,
      tool_name: call.tool_name,
      data_type: isExternalEgress ? 'api_response' : 'tool_output',
      data_hash: outputHash,
      data_preview: (JSON.stringify(call.result || '')).slice(0, 100),
      is_sensitive: isSensitive,
      is_external_egress: isExternalEgress,
      timestamp: call.timestamp,
    };
    nodes.push(node);

    // Create edges from previous call's output to this call's input
    if (nodes.length > 1) {
      const prevNode = nodes[nodes.length - 2];
      edges.push({
        from_node: prevNode.node_id,
        to_node: node.node_id,
        relationship: 'passes_to',
        description: `${prevNode.tool_name} → ${node.tool_name}`,
      });
    }

    // Check for exfiltration: sensitive data flowing to external egress
    if (isSensitive && isExternalEgress) {
      // Trace back the path
      const path = traceBackPath(node, nodes, edges);
      exfiltrationPaths.push({
        path,
        description: `Sensitive data (${node.data_type}) sent to external endpoint via ${call.tool_name}`,
        severity: 'critical',
      });
    }
  }

  return { nodes, edges, exfiltration_paths: exfiltrationPaths };
}

/**
 * Trace back the path from a node to its origins.
 */
function traceBackPath(
  targetNode: DataFlowNode,
  allNodes: DataFlowNode[],
  allEdges: DataFlowEdge[],
): string[] {
  const path: string[] = [targetNode.node_id];
  let current = targetNode;

  for (let i = 0; i < 20; i++) { // max 20 hops
    const incomingEdge = allEdges.find(e => e.to_node === current.node_id);
    if (!incomingEdge) break;

    const sourceNode = allNodes.find(n => n.node_id === incomingEdge.from_node);
    if (!sourceNode) break;

    path.unshift(sourceNode.node_id);
    current = sourceNode;
  }

  return path;
}

// ============================================================================
// Trajectory risk scoring
// ============================================================================

/**
 * Score the entire trajectory of a session.
 * Blocks call N if calls 1..N-1 look suspicious collectively.
 */
export function scoreTrajectory(calls: ToolCall[]): TrajectoryRiskScore {
  const sessionId = calls[0]?.session_id || 'unknown';
  const totalCalls = calls.length;

  // Detect attack chains
  const attackChains = detectAttackChains(calls);

  // Build data flow graph
  const dataFlow = buildDataFlowGraph(calls);
  const hasExfiltration = dataFlow.exfiltration_paths.length > 0;

  // Calculate risk score
  let riskScore = 0;
  let shouldBlockCall: number | null = null;

  // Attack chains add risk
  for (const chain of attackChains) {
    if (chain.severity === 'critical') {
      riskScore = Math.max(riskScore, 10);
      // Block the last call in the chain
      const lastCall = chain.calls[chain.calls.length - 1];
      const callIndex = calls.findIndex(c => c.call_id === lastCall.call_id);
      if (callIndex >= 0) {
        shouldBlockCall = callIndex;
      }
    } else if (chain.severity === 'high') {
      riskScore = Math.max(riskScore, 7);
    }
  }

  // Exfiltration adds risk
  if (hasExfiltration) {
    riskScore = Math.max(riskScore, 10);
    // Find the call that caused the exfiltration
    const exfilPath = dataFlow.exfiltration_paths[0];
    if (exfilPath) {
      const lastNodeId = exfilPath.path[exfilPath.path.length - 1];
      const lastCallId = lastNodeId.replace('node-', '');
      const callIndex = calls.findIndex(c => c.call_id === lastCallId);
      if (callIndex >= 0) {
        shouldBlockCall = callIndex;
      }
    }
  }

  // Blocked calls in history add risk
  const blockedCount = calls.filter(c => !c.allowed).length;
  if (blockedCount > 0) {
    riskScore = Math.max(riskScore, Math.min(8, 3 + blockedCount));
  }

  // Low trust score calls add risk
  const lowTrustCalls = calls.filter(c => c.trust_score_at_call < 5).length;
  if (lowTrustCalls > 2) {
    riskScore = Math.max(riskScore, 6);
  }

  // Determine risk level
  const riskLevel = riskScore >= 8 ? 'critical' : riskScore >= 5 ? 'high' : riskScore >= 3 ? 'medium' : 'low';

  // Build reason
  const reasons: string[] = [];
  if (attackChains.length > 0) {
    reasons.push(`${attackChains.length} attack chain(s) detected`);
  }
  if (hasExfiltration) {
    reasons.push('data exfiltration detected');
  }
  if (blockedCount > 0) {
    reasons.push(`${blockedCount} blocked call(s) in history`);
  }
  if (lowTrustCalls > 2) {
    reasons.push(`${lowTrustCalls} low-trust calls`);
  }
  if (reasons.length === 0) {
    reasons.push('no suspicious patterns detected');
  }

  return {
    session_id: sessionId,
    total_calls: totalCalls,
    risk_score: riskScore,
    risk_level: riskLevel,
    attack_chains_detected: attackChains,
    exfiltration_detected: hasExfiltration,
    should_block_call: shouldBlockCall,
    reason: reasons.join('; '),
    computed_at: new Date().toISOString(),
  };
}

// ============================================================================
// Constants
// ============================================================================

export const TRAJECTORY_VERSION = '1.0.0';
export const MAX_TRAJECTORY_WINDOW = 1000; // max calls to analyze
export const MAX_ATTACK_CHAIN_LENGTH = 10; // max steps in a chain
