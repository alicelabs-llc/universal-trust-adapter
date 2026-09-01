# UTA Integrations

A guide to integrating Universal Trust Adapter (UTA) with other tools in the AI agent security ecosystem.

## Defense-in-depth stack

UTA is one layer in a defense-in-depth strategy for AI agent security. The full stack:

```
Agent decides to call a tool
    ↓
[UTA: credential verification]
    Is this tool's credential valid? Who issued it? Is it expired/revoked?
    ↓ PERMIT
[L1.9: quarantine / prompt injection firewall]
    Does the tool's input contain prompt injection? Suspicious patterns?
    ↓ clean
[L3: runtime drift monitoring]
    Did the tool change since install? Has its behavior drifted?
    ↓ no drift
[gate.cat: action veto]
    Is the specific action irreversible/destructive? (rm -rf, DROP TABLE, etc.)
    ↓ not blocked
    execute
```

Each layer catches a different threat class:

| Layer | Catches | Doesn't catch |
|-------|---------|---------------|
| UTA | Invalid credentials, revoked certs, wrong issuer | Prompt injection, action safety |
| L1.9 | Prompt injection, suspicious patterns | Credential validity, action safety |
| L3 | Tool drift, behavior changes | Credential validity, action safety |
| gate.cat | Destructive actions (rm -rf, DROP TABLE) | Credential validity, prompt injection |

## Current integrations

### gate.cat — exec boundary veto

**What it does:** gate.cat provides a deterministic, fail-closed action veto at the execution boundary. It blocks irreversible actions (`rm -rf`, `DROP TABLE`, `terraform destroy`, `curl|sh`) before they execute.

**Repo:** https://github.com/BGMLAI/gate.cat  
**PyPI:** `gate.cat` (v0.4.18)  
**License:** Apache 2.0  
**Author:** Bogumił Jankiewicz (@BGMLAI)

**How it fits with UTA:**
- UTA verifies the tool's credential (pre-call)
- gate.cat verifies the action is safe (in-call)
- They are complements, not substitutes

**Integration status:** Proposed in [Issue #12](https://github.com/alicelabs-llc/universal-trust-adapter/issues/12). Awaiting feedback from @bogumi_jankiewicz.

**Reference architecture:**
```python
from marketnow_trust import verify
from gatecat import check_action

# 1. Verify credential (UTA)
result = verify(tool.credential)
if result.decision != 'PERMIT':
    raise PermissionError(f"Credential failed: {result.failed_stage}")

# 2. Check action safety (gate.cat)
check_action("agent", tool.command)  # raises ActionVetoed if destructive

# 3. Execute
tool.execute()
```

## Proposed integrations (RFC issues opened)

UTA has been proposed as an optional trust verification hook in the following agent frameworks and tools:

| Tool | Issue | Status |
|------|-------|--------|
| HumanLayer | [#1101](https://github.com/humanlayer/humanlayer/issues/1101) | Open |
| LangGraph | [#8791](https://github.com/langchain-ai/langgraph/issues/8791) | Open |
| Aider | [#5665](https://github.com/Aider-AI/aider/issues/5665) | Open |
| OpenHands | [#17084](https://github.com/OpenHands/OpenHands/issues/17084) | Open |
| Langfuse | [#16920](https://github.com/langfuse/langfuse/issues/16920) | Open (1 reaction) |
| E2B | [#1791](https://github.com/e2b-dev/E2B/issues/1791) | Open |
| Vercel AI SDK | [#20147](https://github.com/vercel/ai/issues/20147) | Open (classified as Feature) |
| promptfoo | [#10599](https://github.com/promptfoo/promptfoo/issues/10599) | Open |
| SPIFFE | [#425](https://github.com/spiffe/spiffe/issues/425) | Open |
| MCP Servers list | [#4736](https://github.com/modelcontextprotocol/servers/issues/4736) | Open |

Earlier round of RFCs:

| Tool | Issue | Status |
|------|-------|--------|
| Continue | [#13212](https://github.com/continuedev/continue/issues/13212) | Open |
| LangChain | [#40102](https://github.com/langchain-ai/langchain/issues/40102) | Closed (auto-triage) |
| LlamaIndex | [#22920](https://github.com/run-llama/llama_index/issues/22920) | Open |
| AutoGen | [#8139](https://github.com/microsoft/autogen/issues/8139) | Open |
| Pydantic AI | [#7981](https://github.com/pydantic/pydantic-ai/issues/7981) | Open |
| Semantic Kernel | [#14356](https://github.com/microsoft/semantic-kernel/issues/14356) | Open |
| Google ADK | [#6974](https://github.com/google/adk-python/issues/6974) | Open |
| OpenAI Agents SDK | [#4806](https://github.com/openai/openai-agents-python/issues/4806) | Open |
| Anthropic SDK | [#1904](https://github.com/anthropics/anthropic-sdk-python/issues/1904) | Open |
| Haystack | [#12565](https://github.com/deepset-ai/haystack/issues/12565) | Open |
| LiteLLM | [#39123](https://github.com/BerriAI/litellm/issues/39123) | Open |
| Ant Design X | [#2043](https://github.com/ant-design/x/issues/2043) | Open |

## Observability integrations

UTA's verification receipts can be logged alongside LLM traces in observability platforms:

### Langfuse

**Proposed in [#16920](https://github.com/langfuse/langfuse/issues/16920):** Log UTA's `verify()` receipt as `metadata.trust_receipt` on trace events.

```typescript
langfuse.trace({
  name: 'tool_call',
  input: toolArgs,
  output: toolResult,
  metadata: {
    trust_receipt: utaReceipt  // UTA verify() result
  }
});
```

This enables:
- Filter traces by credential issuer
- Audit which credentials were used in a session
- Detect anomalies (same tool, different issuers)

## Sandbox integrations

### E2B

**Proposed in [#1791](https://github.com/e2b-dev/E2B/issues/1791):** Issue ATC v3 cards attesting that code ran in an E2B sandbox.

Use case: when an agent runs code in E2B and the result is used downstream, the downstream consumer can verify:
- Did the code actually run in an E2B sandbox?
- Was the sandbox fresh (no prior state)?
- Is the result cryptographically attested?

## Testing integrations

### promptfoo

**Proposed in [#10599](https://github.com/promptfoo/promptfoo/issues/10599):** Add `trust-verification` as a promptfoo test assertion type.

```yaml
tests:
  - description: 'Agent rejects expired credential'
    assert:
      - type: trust-verification
        value:
          credential: expired-jwt
          expected_decision: DENY
          expected_failed_stage: LIFECYCLE
```

UTA's [conformance vectors](./tests/conformance/vectors/) provide 9 test vectors covering valid, expired, revoked, and invalid-signature cases.

## Identity integrations

### SPIFFE/SPIRE

**Proposed in [#425](https://github.com/spiffe/spiffe/issues/425):** UTA adapter for SPIFFE SVIDs.

SPIFFE SVIDs (JWT-SVID and X.509-SVID) would be treated as first-class credentials in UTA's 12-stage pipeline, alongside the existing 8 formats.

## Supply chain integrations

### Sigstore / Rekor

**Tracked in [Issue #13](https://github.com/alicelabs-llc/universal-trust-adapter/issues/13):** Anchor release tarball SHA-256s in Rekor (append-only transparency log) for third-party countersignature.

This addresses the "publisher can't rewrite the anchor" requirement identified by @anp2network.

## How to add an integration

If you're building a tool that could integrate with UTA:

1. **Check existing proposals** — search the [issues](https://github.com/alicelabs-llc/universal-trust-adapter/issues) for your tool name
2. **Open an issue** — describe the integration use case
3. **Use the public API** — `https://www.marketnow.site/api/trust` (no auth required for verification)
4. **Or use the NPM package** — `npm install @marketnow/trust-core`

```javascript
import { verify } from '@marketnow/trust-core';

const result = await verify(credential);
if (result.decision === 'PERMIT') {
  // Credential is valid — proceed
} else {
  // Credential failed verification
  console.log(result.failed_stage);
}
```

## References

- UTA repo: https://github.com/alicelabs-llc/universal-trust-adapter
- UTA API: https://www.marketnow.site/api/trust
- UTA conformance vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/tests/conformance/vectors
- UTA snippets (14 languages): https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/snippets
- gate.cat: https://github.com/BGMLAI/gate.cat
