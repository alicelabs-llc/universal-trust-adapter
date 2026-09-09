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
    risk_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    attack_chains_detected: AttackChainDetection[];
    exfiltration_detected: boolean;
    should_block_call: number | null;
    reason: string;
    computed_at: string;
}
export declare const ATTACK_CHAIN_PATTERNS: AttackChainPattern[];
/**
 * Detect attack chains in a sequence of tool calls.
 * Looks for known patterns in the call history.
 */
export declare function detectAttackChains(calls: ToolCall[]): AttackChainDetection[];
/**
 * Build a data flow graph from tool calls.
 * Tracks where data comes from and where it goes.
 */
export declare function buildDataFlowGraph(calls: ToolCall[]): DataFlowGraph;
/**
 * Score the entire trajectory of a session.
 * Blocks call N if calls 1..N-1 look suspicious collectively.
 */
export declare function scoreTrajectory(calls: ToolCall[]): TrajectoryRiskScore;
export declare const TRAJECTORY_VERSION = "1.0.0";
export declare const MAX_TRAJECTORY_WINDOW = 1000;
export declare const MAX_ATTACK_CHAIN_LENGTH = 10;
