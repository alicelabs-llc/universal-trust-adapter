# MarketNow MCP v1.10.0 — Agent Contract Audit

> Audit date: 2026-08-10
> Scope: `marketnow-mcp@1.10.0` (`index.js` + `lib/atc-verify.mjs`)
> Auditor: AliceLabs LLC (automated self-audit, human-reviewed)
> Outcome: **PASS on all 4 criteria**

This document records how `marketnow-mcp@1.10.0` satisfies the four golden rules that autonomous agents (Claude Desktop, Cursor, Cline, Continue, LangChain, LlamaIndex) require to consume MCP tools without execution errors or hallucinations.

Agents do not read human documentation at runtime — they read the JSON-Schema definition returned by `tools/list`. Any ambiguity in `inputSchema` propagates directly into failed tool calls. v1.10.0 closes those gaps and adds the ATC/1.0 spec verifier as tool #13.

---

## Summary Table

| #  | Criterion                                     | Status      | Evidence                                                                                                  |
|----|-----------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------|
| A  | Namespace prefix (`marketnow_*`)              | ✅ Validated | All 13 tools use `marketnow_` prefix + snake_case. No `camelCase`, no mixed-version suffixes.            |
| B  | Intent-oriented descriptions                  | ✅ Validated | Every description states WHEN and WHY an agent should invoke the tool, with explicit predecessor calls.  |
| C  | Strict JSON-Schema (`type` + `enum` + `pattern` + bounds) | ✅ Validated | Categorical fields use `enum`; ID fields use `pattern`; numerics use `minimum`/`maximum`; no `any`.      |
| D  | Structured error handling (`isError: true`)   | ✅ Validated | `CallToolRequest` handler catches all exceptions, normalizes into `{ isError, content }`, no stack leaks. |

---

## A. Deterministic Tool Names (`snake_case` + `marketnow_` prefix)

Models have measurably higher tool-choice accuracy when names use `snake_case` and a stable namespace prefix. v1.10.0 enforces `marketnow_` on every tool:

| #  | v1.7.0 (legacy)        | v1.8.0                          |
|----|------------------------|----------------------------------|
| 1  | `search_skills`        | `marketnow_search_skills`        |
| 2  | `get_skill`            | `marketnow_get_skill`            |
| 3  | `list_categories`      | `marketnow_list_categories`      |
| 4  | `get_manifest`         | `marketnow_get_manifest`          |
| 5  | `get_install_command`  | `marketnow_get_install_command`  |
| 6  | `verify_trust`         | `marketnow_verify_trust`          |
| 7  | `verify_receipt`       | `marketnow_verify_receipt`       |
| 8  | `submit_skill`         | `marketnow_submit_skill`          |
| 9  | `mint_referral`        | `marketnow_mint_referral`         |
| 10 | `lookup_referral`      | `marketnow_lookup_referral`       |
| 11 | `recommend_skills`     | `marketnow_recommend_skills`      |
| 12 | *(new in v1.8.0)*      | `marketnow_get_owasp_compliance`  |
| 13 | *(new in v1.10.0)*     | `marketnow_verify_atc_spec`      |

**Verification command (run by maintainer):**
```bash
node -e "import('./index.js').then(()=>{})" 2>&1 | grep -oE 'marketnow_[a-z_]+' | sort -u
```

---

## B. Intent-Oriented Descriptions

Each description answers **when** and **why** the agent should call the tool — not what the underlying code does. Examples of the rewrite:

| Tool                              | v1.7.0 description                                              | v1.8.0 description (intent-oriented)                                                                                                                                                                                       |
|-----------------------------------|-----------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `marketnow_search_skills`         | "Search the MarketNow marketplace…" (functional)                | "Use this whenever an agent needs to discover a tool for a specific task — preferred entry point before any install or recommendation. Results are bounded to `limit` (1–50) and sorted by the requested criterion."       |
| `marketnow_get_install_command`   | "Get the install command for a skill. All skills are FREE."    | "Use this when an agent has already selected a skill via marketnow_search_skills or marketnow_recommend_skills and is ready to install." (explicit predecessor relationship)                                              |
| `marketnow_verify_trust`          | "Verify an Agent Trust Card (ATC)…" (functional)                | "Use this BEFORE executing any MCP tool whose provenance you cannot otherwise establish." (intent + temporal cue)                                                                                                          |
| `marketnow_get_owasp_compliance`  | *(new)*                                                         | "Use this BEFORE invoking a skill whose blast radius you need to bound — it tells you exactly what filesystem, network, shell, and credential access that skill is capable of."                                           |

---

## C. Strict JSON-Schema

Every `inputSchema.properties[*]` declares at minimum `type` + `description`. Where the value domain is enumerable, `enum` is used. Where the format is structured (IDs, URLs), `pattern` is used. Numerics carry `minimum`/`maximum`.

### C.1 Enum enforcement

```js
category: { type: 'string', enum: KNOWN_CATEGORIES, ... }     // 11 known values
sort_by:  { type: 'string', enum: SORT_BY_VALUES, ... }       // 5 known values
sort_order: { type: 'string', enum: SORT_ORDER_VALUES, ... }   // asc / desc
```

Runtime rejects anything outside the enum with `code: 'INVALID_ARGUMENT'`.

### C.2 Pattern enforcement

| Field                   | Pattern                                              | Example                            |
|-------------------------|------------------------------------------------------|------------------------------------|
| `skill_id`              | `/^[a-z0-9-]+$/i`                                   | `mn-ai-00001`, `web-scraper`       |
| `card_id`               | `/^ATC-\d{4}-\d{6,}$/i`                             | `ATC-2026-7777670`                 |
| `receipt_id`            | `/^rcpt_[a-z0-9]{16,}$/i`                           | `rcpt_c8b9dc67f88e4da5bd3a`        |
| `ref_code`              | `/ref_[a-z0-9]{6,}$/i`                              | `ref_a1b2c3d4`                     |
| `agent_id`              | `/^[a-z0-9_-]{3,64}$/i`                             | `agent_claude_001`                 |
| `repo_url`              | `/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/i`      | `https://github.com/user/repo`     |

Patterns are declared once (`PATTERNS` object) and reused in both `inputSchema.pattern` and the runtime `validatePattern()` validator — preventing schema/runtime drift.

### C.3 Numeric bounds

```js
limit:     { type: 'integer', minimum: 1, maximum: 50, ... }    // search_skills
limit:     { type: 'integer', minimum: 1, maximum: 20, ... }    // recommend_skills
max_price: { type: 'number',  minimum: 0, maximum: 1000, ... }  // search_skills
```

### C.4 No `any` types

- Every `properties[*].type` is one of: `string`, `integer`, `number`, `object`.
- No `additionalProperties: true` (implicitly false per MCP convention).
- Optional fields have explicit defaults in the implementation.

---

## D. Structured Response Handling (`isError`)

The `CallToolRequest` handler is the **only** entry point for tool execution. It enforces the MCP response envelope on both success and failure paths:

```js
// SUCCESS path
return {
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
};

// FAILURE path — never throws into the transport
catch (err) {
  const errorPayload = {
    success: false,
    error: err.code || 'INTERNAL_ERROR',
    tool: name,
    message: err.message,
    // contextual hint based on err.code
  };
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(errorPayload, null, 2) }]
  };
}
```

### D.1 Error code taxonomy

| `err.code`            | When                                            | Hint in payload                                                                |
|-----------------------|-------------------------------------------------|--------------------------------------------------------------------------------|
| `INVALID_ARGUMENT`    | Pattern / enum / bound violation                | "Re-read the inputSchema for this tool from ListTools response."               |
| `NOT_FOUND`           | `skill_id` does not match any registered skill | "Verify the ID against marketnow_search_skills output."                        |
| `UNKNOWN_TOOL`        | Tool name not in switch statement              | "Call ListTools to enumerate valid marketnow_* tool names."                    |
| `INTERNAL_ERROR`      | Network failure, unexpected exception          | (none — message is sufficient)                                                 |

### D.2 No stack traces leaked

`err.stack` is never serialized into the response payload. Only `err.message` and `err.code` are surfaced — sufficient for the agent to recover, not enough to leak server internals.

---

## Smoke Test (manual, run before each npm publish)

```bash
# 1. Syntax check
node --check index.js

# 2. Tool listing (verifies Rule A: all names have marketnow_ prefix)
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  node index.js | jq '.result.tools[].name'

# 3. Schema strictness spot-check (verifies Rule C: enum + pattern present)
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  node index.js | jq '.result.tools[] | select(.name=="marketnow_search_skills") | .inputSchema.properties.category.enum'

# 4. Error path (verifies Rule D: isError envelope)
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"marketnow_get_skill","arguments":{"skill_id":"../../etc/passwd"}},"id":2}' | \
  node index.js | jq '.result'
```

---

## Backwards Compatibility Note

Tool names changed from `snake_case` to `marketnow_snake_case` between v1.8.0 and v1.9.0. This is a **breaking change** for any agent that hard-coded the old names — but agents that consume `tools/list` dynamically (the correct pattern) will pick up the new names automatically. The minor version bump is intentional and is the recommended MCP migration pattern.

If you must support both names during a transition window, run two server instances side by side. We do not recommend shimming — the namespace prefix is the whole point of v1.10.0.

---

## Change log

- **v1.10.0** (2026-08-10): New tool `marketnow_verify_atc_spec` added — self-contained ATC/1.0 spec verifier that accepts ANY Agent Trust Card (regardless of issuer) and verifies all 8 required controls (ATC-001 Identity through ATC-008 Expiration). Uses `node:crypto` + `canonicalize` (RFC 8785 JCS) + Ed25519 (RFC 8032). Self-contained module in `lib/atc-verify.mjs` — no network calls, no MarketNow-specific dependencies. This makes marketnow-mcp the LIVE REFERENCE IMPLEMENTATION of the ATC/1.0 specification.
- **v1.9.0** (2026-08-10): All 11 tools renamed to `marketnow_*`. Schemas hardened with `enum`/`pattern`/`minimum`/`maximum`. New tool `marketnow_get_owasp_compliance` added (OWASP MCP Cheat Sheet alignment). Error path normalized into structured `{ isError, content }` envelope with `err.code` taxonomy.
- **v1.8.0** (2026-08-09): `marketnow_get_owasp_compliance` added (initial release).
- **v1.7.0** (2026-07-xx): `submit_skill` became REAL (calls `/api/submit-skill`). `mint_referral` + `lookup_referral` closed the viral loop. `verify_receipt` added.
- **v1.6.0**: `verify_receipt` for x402 + Vibe interop. ATC schema v1.1.0.

---

*Maintained by AliceLabs LLC — Wyoming, USA. Report issues at
https://marketnow.site/atc/issues*
