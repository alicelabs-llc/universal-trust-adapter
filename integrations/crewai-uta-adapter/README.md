# crewai-uta-adapter

Trust verification for **CrewAI** tools via the Universal Trust Adapter (UTA).
**Fail-closed:** if UTA cannot verify the tool's trust card, the tool call is denied.

## Why this exists

CrewAI's maintainers declined a core integration (their #7195 response: the
framework already exposes extension points). This adapter respects that: it is a
standalone `BaseTool` subclass using CrewAI's public API. No CrewAI changes, no PRs.

## Install / use (POC)

```bash
pip install -e .   # or copy crewai_uta_adapter.py into your project
```

```python
from crewai_uta_adapter import UTAProtectedTool, verify_with_uta
from my_tools import SearchTool

tool = UTAProtectedTool(
    SearchTool(),
    trust_credential=trust_card_json,   # UTA trust card of the tool's MCP server
    min_trust_score=70,
)
# pass `tool` to your Crew as usual
```

Configuration: `UTA_VERIFY_URL` (default: public UTA endpoint),
`UTA_VERIFY_TIMEOUT` (default 5s).

## Decision logic

1. No credential → DENY
2. UTA unreachable → DENY (fail-closed)
3. `valid: false` → DENY
4. `uts.trust.score < min_trust_score` → DENY
5. Otherwise → run the wrapped tool

Status: **POC v0.1.0** · License: AliceLabs Source-Available License v1.0 (AL-1.0)
