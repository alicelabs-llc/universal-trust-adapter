# Integrations — standalone trust-verification adapters

Round 2 strategy (see `marketnow/OUTREACH_ROUND2_STRATEGY.md`): we stopped asking
projects to integrate UTA and shipped the integrations on our side instead.

Every adapter here:

- **Fail-closed** — if verification is unavailable, the tool call is DENIED.
- Uses the real UTA verification endpoint: `POST {UTA_VERIFY_URL}` (default
  `https://www.marketnow.site/api/trust?action=verify`), body `{"payload": <credential JSON>}`.
- Is a standalone package. No third-party core is modified, no PRs required.

| Package | Ecosystem | Hook point |
|---|---|---|
| [`crewai-uta-adapter`](./crewai-uta-adapter/) | CrewAI | `BaseTool` subclass (their recommended recipe) |
| [`langchain-uta-middleware`](./langchain-uta-middleware/) | LangChain | `Runnable` wrapper around any tool |
| [`openai-agents-uta-hooks`](./openai-agents-uta-hooks/) | OpenAI Agents SDK | `RunHooks.on_tool_start` |
| [`e2b-uta-attestation`](./e2b-uta-attestation/) | E2B sandboxes | pre-exec attestation wrapper |

Status: **POC**. APIs may change. Issues go in THIS repository.
