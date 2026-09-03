# openai-agents-uta-hooks

UTA trust verification for the **OpenAI Agents SDK** via public `RunHooks`.
**Fail-closed.**

OpenAI declined core integration (#4806: SDK repo tracks bugs, not third-party
features). This adapter uses only the public hooks API — `on_tool_start` denies
any tool call whose UTA trust card is missing, invalid or below threshold.

```python
from openai_agents_uta_hooks import build_uta_hooks
hooks = build_uta_hooks(trust_credential=card, min_trust_score=70)
# pass `hooks=` to Runner.run(...)
```

Config: `UTA_VERIFY_URL`, `UTA_VERIFY_TIMEOUT`. Status: **POC v0.1.0** · AL-1.0.
