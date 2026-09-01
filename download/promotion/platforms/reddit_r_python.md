<!-- Target: r/python -->
<!-- Post type: text post -->

**Title:** Python adapter for Universal Trust Adapter — verify AI agent credentials in 8 formats

**Body:**

Hey r/python —

I built a credential verification layer for AI agents and wrote a Python adapter: **marketnow-trust** on PyPI.

```python
from marketnow_trust import verify

result = verify(card)
if result.decision == 'PERMIT':
    execute_tool()
else:
    log_failure(result.failed_stage)
```

**8 formats supported:** ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Cards, X.509

**12-stage pipeline:** parser → detect → schema → crypto → issuer → key_binding → pop → provenance → lifecycle → evidence → policy → decision

**Benchmarks:**
- 6,744 verifications/sec (single core, Node.js core; Python adapter calls the API)
- 16 tests in Python adapter
- 23 property tests in conformance suite

The Python adapter calls the public API (https://www.marketnow.site/api/trust) so no native crypto deps needed.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
Snippets: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets/python

I opened RFC issues in LangChain, LlamaIndex, AutoGen, Pydantic AI, Google ADK, and Haystack proposing optional `trust_verifier` hooks. Links in the repo.

Curious what r/python thinks of the API shape.
