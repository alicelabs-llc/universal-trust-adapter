# Fix C4: OWASP MCP Top 10 Mapping Correction

## Bug
The ATC v2.0 spec had incorrect OWASP MCP Top 10 claim names:

| Claim (incorrect) | Claim (correct) |
|---|---|
| mcp01_tool_poisoning | mcp01_prompt_injection |
| mcp02_supply_chain | mcp02_tool_poisoning |
| mcp03_prompt_injection | mcp03_supply_chain |

## Status
✅ Fixed in UTA v1.0.0

## Correct mapping
```
MCP01 = prompt_injection
MCP02 = tool_poisoning
MCP03 = supply_chain
MCP04 = credential_exfiltration
MCP05 = excessive_permissions
MCP06 = insecure_communication
MCP07 = insufficient_logging
MCP08 = improper_error_handling
MCP09 = inadequate_testing
MCP10 = supply_chain_dependencies
```
