# anthropic-uta-guard

UTA trust gate for Anthropic SDK tool use — **fail-closed**, outside the SDK.

Background: [anthropics/anthropic-sdk-python#1904](https://github.com/anthropics/anthropic-sdk-python/issues/1904)
was closed as *not_planned*. Respect that boundary: this guard lives in OUR
repository and wraps the SDK from the outside. Zero Anthropic code is changed.

## Pattern

```
model returns tool_use block
      │
      ▼
verify_tool_use(name, input, trust_card)   ── POST {UTA_VERIFY_URL}
      │                                    ── any error ⇒ DENY (fail-closed)
   ALLOW? ── no ──► tool_result: { blocked, reason }
      │
     yes
      ▼
your real_executor(input) runs
```

## Usage

```python
from anthropic_uta_guard import guarded_tool_result

TRUST_CARD = {
    "issuer": "alicelabs-llc",
    "subject": "my-agent",
    "mcp_server": "io.github.edgarfloresguerra2011-a11y/marketnow",
}

for block in response.content:
    if block.type == "tool_use":
        result = guarded_tool_result(
            block,
            real_executor=lambda tool_input: do_the_real_thing(tool_input),
            trust_card=TRUST_CARD,
        )
        if result["blocked"]:
            ...  # feed the refusal back to the model as tool_result
```

## Environment

| Var | Default | Meaning |
|---|---|---|
| `UTA_VERIFY_URL` | `https://www.marketnow.site/api/trust?action=verify` | UTA instance to verify against |
| `UTA_VERIFY_TIMEOUT` | `5` | seconds before the check aborts (=> DENY) |

## Why fail-closed

If UTA is unreachable, the agent does NOTHING, not everything. Timeout, HTTP
error, or malformed JSON all resolve to `DENY` — your real executor never runs.

Status: **POC** (v0.1.0). APIs may change. Issues go in THIS repository.
