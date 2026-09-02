# langchain-uta-middleware

UTA trust verification for **LangChain** tools. **Fail-closed.**

LangChain bot-closed our core-integration issues (#40100/#40102 — their tracker
requires `type=Feature` via web UI). So we shipped it as a standalone package:
a `Runnable` wrapper. Zero LangChain changes.

```python
from langchain_uta_middleware import uta_verified
safe_tool = uta_verified(my_langchain_tool, trust_credential=card, min_trust_score=70)
# chain | safe_tool  — DENIES if UTA cannot verify the trust card
```

Config: `UTA_VERIFY_URL`, `UTA_VERIFY_TIMEOUT`. Status: **POC v0.1.0** · AL-1.0.
