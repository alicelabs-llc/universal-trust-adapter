# e2b-uta-attestation

Out-of-band UTA trust attestation for **E2B** sandboxes. **Fail-closed.**

E2B closed our outreach as not_planned (#1791: tracker, not forum). This wrapper
changes nothing in E2B: it verifies the code artifact's UTA trust card BEFORE it
runs in the sandbox, and returns a signed-style attestation receipt (sha256,
trust score, decision) alongside the execution result.

```python
from e2b_uta_attestation import attested_run
out = attested_run(sandbox, code, trust_credential=card, min_trust_score=70)
# {"result": ..., "attestation": {"decision": "ALLOW", "trust_score": 87, ...}}
```

Config: `UTA_VERIFY_URL`, `UTA_VERIFY_TIMEOUT`. Status: **POC v0.1.0** · AL-1.0.
