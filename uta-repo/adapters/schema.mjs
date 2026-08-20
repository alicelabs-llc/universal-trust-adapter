// MarketNow — Universal Trust Schema (UTS) v1.0
// Plain JS (no TypeScript) — works in Vercel Lambda

export const UTS_VERSION = '1.0.0';

export const OWASP_MCP_TOP_10 = {
  MCP01: 'prompt_injection',      // CORRECTED (was: tool_poisoning)
  MCP02: 'tool_poisoning',        // CORRECTED (was: supply_chain)
  MCP03: 'supply_chain',          // CORRECTED (was: prompt_injection)
  MCP04: 'credential_exfiltration',
  MCP05: 'excessive_permissions',
  MCP06: 'insecure_communication',
  MCP07: 'insufficient_logging',
  MCP08: 'improper_error_handling',
  MCP09: 'inadequate_testing',
  MCP10: 'supply_chain_dependencies',
};

// Adapter interface (documented, not enforced in JS)
// Implementations should have: formatId, formatName, formatVersion, status,
// fromNative(payload), toNative(uts), verify(payload, caPublicKey), detect(payload)
