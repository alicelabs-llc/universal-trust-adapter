---
title: Hardening an MCP server for autonomous agents — 4 rules I learned the hard way
published: true
description: How we refactored marketnow-mcp from v1.7.0 to v1.9.0 to stop LLM tool-call failures. Four golden rules: marketnow_ namespace, intent-oriented descriptions, strict JSON-Schemas, and structured isError envelopes.
tags: mcp, ai, security, typescript
cover_image: https://marketnow.site/og-image.png
date: 2026-08-10T10:00:00Z
---

If you ship a Model Context Protocol (MCP) server today, your consumers are not human beings. They are autonomous agents — Claude Desktop, Cursor, Cline, Continue, LangChain, LlamaIndex. And here is the part that took me three versions to internalize:

**Agents do not read your README.**

When Claude Desktop decides whether to invoke your tool, it does not consult your beautifully written documentation. It consults the JSON-Schema returned by `tools/list`. If your schema is ambiguous, the LLM's JSON generation will be ambiguous, and the tool call will fail silently inside the agent loop. The user sees "the agent gave up" — and you never hear about it.

This is the story of how `marketnow-mcp@1.7.0` (11 tools, ambiguous schemas, occasional agent hallucinations) became `marketnow-mcp@1.9.0` (12 tools, strict schemas, zero uncaught errors in our smoke tests). I am publishing it because I think the four rules I ended up with generalize to any MCP server that wants to be reliably consumable by autonomous agents.

---

## The problem in one screenshot

Here is what `tools/list` returned in v1.7.0 for our `search_skills` tool:

```json
{
  "name": "search_skills",
  "description": "Search the MarketNow marketplace for MCP-compatible skills...",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Natural language or keyword search..." },
      "category": { "type": "string", "description": "Filter by category (optional). One of: AI/ML, Data, Web/API, Security, DevOps, Communication, etc." },
      "max_price": { "type": "number", "description": "Maximum price in USD (optional, e.g. 2.99)" },
      "limit": { "type": "number", "description": "Max results to return (default 10, max 50)" }
    }
  }
}
```

Spot the three time bombs:

1. **Tool name has no namespace.** `search_skills` could collide with any other MCP server the agent has loaded. The agent has to disambiguate by guessing.
2. **`category` is a free string** that "should be" one of a known list — but the schema says `string`. The LLM will happily pass `"ai-ml"` (kebab-case) or `"ai ml"` (with a space) and your runtime will silently filter to nothing.
3. **`limit` has no bounds.** The description says "max 50" but the schema says nothing. An agent that reasons "I want all the skills" will pass `9999` and your server will fetch nine thousand rows.

We were seeing all three failure modes in production. Agents would call `search_skills` with `category: "ai/ml"` (slash, not the literal `"AI/ML"` we expected) and our runtime would return zero results, the agent would conclude the marketplace had no AI tools, and the user would conclude the agent was broken.

---

## Rule A — Deterministic tool names with a namespace prefix

I started by renaming every tool from `snake_case` to `marketnow_snake_case`:

| v1.7.0 (legacy)        | v1.9.0                          |
|------------------------|----------------------------------|
| `search_skills`        | `marketnow_search_skills`        |
| `get_skill`            | `marketnow_get_skill`            |
| `verify_trust`         | `marketnow_verify_trust`          |
| `submit_skill`         | `marketnow_submit_skill`          |
| ...                    | ...                              |

This is a **breaking change**. Any agent that hard-coded `search_skills` breaks on upgrade. But agents that consume `tools/list` dynamically (the correct pattern) pick up the new names automatically.

The namespace prefix gives the LLM two things at tool-choice time:

1. A stable namespace it can recognize ("ah, this is a MarketNow tool, I should look at my MarketNow context")
2. A disambiguator from any other server's `search_skills` that might be loaded in the same session

You can pick any prefix that matches your server identity. We picked `marketnow_` because that is our product name. The Anthropic MCP servers list itself uses `mcp__` as a transport-level disambiguator, but at the application level a domain-specific prefix is clearer.

---

## Rule B — Intent-oriented descriptions

The v1.7.0 description for `get_install_command` was:

> *"Get the install command for a skill. All skills are FREE."*

This is a **functional description** — it tells the agent what the code does. It does not tell the agent **when** to call it or **why**.

The v1.9.0 description is:

> *"Get the exact `npx` install command for a skill. Use this when an agent has already selected a skill via `marketnow_search_skills` or `marketnow_recommend_skills` and is ready to install. All skills are currently FREE — no purchase step is required."*

The differences:

- It states the precondition ("has already selected a skill via..."). The LLM now knows this is step 2 of a 2-step flow, not a discovery tool.
- It names the predecessor tools by their v1.9.0 names, so the agent's plan graph stays consistent.
- It clarifies the side effect ("ready to install").

Every description in v1.9.0 answers three questions:

1. **When** should I call this? (precondition or trigger)
2. **Why** should I call it? (what the agent gets out of it)
3. **What's next?** (the natural successor tool, if any)

For `marketnow_get_owasp_compliance` (new in v1.9.0):

> *"Get MarketNow's alignment with the OWASP MCP Cheat Sheet... Also returns the live tool fingerprint (SHA-256) and capability manifest (filesystem/network/shell/credentials/process) for any registered skill. Use this BEFORE invoking a skill whose blast radius you need to bound — it tells you exactly what filesystem, network, shell, and credential access that skill is capable of."*

"Use this BEFORE" is the magic phrase. It tells the LLM this is a pre-flight check, not an afterthought.

---

## Rule C — Strict JSON-Schema

This is the rule that took the longest to get right, because "strict" is a moving target. Here is what v1.9.0 enforces on every `inputSchema.properties[*]`:

### C.1 `enum` on every categorical field

```js
category: {
  type: 'string',
  enum: ['AI/ML', 'Data', 'Web/API', 'Security', 'DevOps', 'Communication', 'Productivity', 'Automation', 'Finance', 'Marketing', 'Other'],
  description: 'Optional category filter. Must be one of the known marketplace categories.'
}

sort_by: {
  type: 'string',
  enum: ['relevance', 'price_asc', 'price_desc', 'newest', 'sentinel_desc'],
  description: 'Sort criterion. Default: relevance.'
}
```

If a value can be enumerated, **enumerate it**. Do not write "one of: AI/ML, Data, ..." in the description and leave the type as bare `string` — the LLM will not treat that as a constraint.

### C.2 `pattern` on every structured ID

```js
card_id: {
  type: 'string',
  pattern: '^ATC-\\d{4}-\\d{6,}$',
  description: 'ATC card ID. Format: ATC-YYYY-NNNNNNN (e.g. ATC-2026-7777670).'
}

receipt_id: {
  type: 'string',
  pattern: '^rcpt_[a-z0-9]{16,}$',
  description: 'Receipt ID. Must start with "rcpt_" followed by at least 16 alphanumeric characters.'
}
```

We had a path-traversal bug in v1.7.0 where an agent passed `card_id: '../../etc/passwd'` (it was hallucinating from an unrelated context window) and our handler happily tried to look it up. The v1.9.0 pattern rejects it at the schema layer — the LLM sees the constraint at `tools/list` time and rarely generates an invalid value, and even if it does, the runtime rejects it with a structured error (Rule D).

The key insight: **the schema pattern and the runtime validator must use the same regex**. We centralized all patterns in a `PATTERNS` object and reused it in both places, preventing drift:

```js
const PATTERNS = {
  skill_id: /^[a-z0-9-]+$/i,
  card_id: /^ATC-\d{4}-\d{6,}$/i,
  receipt_id: /^rcpt_[a-z0-9]{16,}$/i,
  ref_code: /^ref_[a-z0-9]{6,}$/i,
  agent_id: /^[a-z0-9_-]{3,64}$/i,
  repo_url: /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/i,
};

// Used in the schema:
pattern: PATTERNS.card_id.source

// Used in the validator:
function validatePattern(name, value, pattern, example) {
  if (!pattern.test(value)) {
    const err = new Error(`Invalid ${name}: must match ${pattern.toString()}`);
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
}
```

### C.3 Numeric bounds with `minimum` and `maximum`

```js
limit: {
  type: 'integer',
  minimum: 1,
  maximum: 50,
  description: 'Maximum number of results to return. Default: 10. Hard ceiling: 50.',
  default: 10
}

max_price: {
  type: 'number',
  minimum: 0,
  maximum: 1000,
  description: 'Optional upper bound on price in USD.'
}
```

In v1.7.0 an agent could pass `limit: 99999` and our server would try to slice 100K rows from a JSON catalog. In v1.9.0 the schema rejects it, and the runtime also clamps to the bound just in case:

```js
function clampInt(value, min, max, fallback) {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n)) {
    const err = new Error(`Expected integer, got: ${value}`);
    err.code = 'INVALID_ARGUMENT';
    throw err;
  }
  return Math.max(min, Math.min(max, n));
}
```

### C.4 String length bounds with `minLength` and `maxLength`

```js
task: {
  type: 'string',
  minLength: 3,
  maxLength: 300,
  description: 'What you want to do, in plain English (e.g. "scrape a website", "query PostgreSQL"). Minimum 3 characters.'
}
```

Why does this matter? Because without `maxLength`, an agent that decides "more context is better" will pass 5,000 characters of context into your `task` field and your keyword-matching scorer will spend 3 seconds on every call. With a 300-char cap, the LLM learns to summarize.

### C.5 No `any` types

This sounds obvious but it is easy to violate by accident. Any time you write `properties: {}` and rely on default behavior, you are implicitly allowing `any`. In v1.9.0 every property declares a concrete `type`. Even our no-arg tools like `marketnow_list_categories` declare:

```js
inputSchema: {
  type: 'object',
  properties: {}
}
```

The `properties: {}` is intentional — there are no parameters. But the `type: 'object'` is what tells the LLM "this is an object, not a stringified object."

---

## Rule D — Structured error envelopes (`isError: true`)

This is the rule that prevents the agent loop from breaking. In v1.7.0 our handler looked like:

```js
try {
  let result = await handleTool(args);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
} catch (err) {
  return {
    content: [{ type: 'text', text: `Error: ${err.message}` }],
    isError: true
  };
}
```

This looks correct — it has `isError: true`. But the payload is just `err.message` as a plain string, which means:

1. The agent sees `"Error: Invalid card_id"` and has to parse English to figure out what to do.
2. The agent has no machine-readable error code to branch on.
3. Stack traces might leak (depending on how `err.message` is constructed).
4. There is no hint about how to recover.

The v1.9.0 handler:

```js
} catch (err) {
  const isInvalidArgs = err.code === 'INVALID_ARGUMENT';
  const isNotFound = err.code === 'NOT_FOUND';
  const isUnknownTool = err.code === 'UNKNOWN_TOOL';

  const errorPayload = {
    success: false,
    error: err.code || 'INTERNAL_ERROR',
    tool: name,
    message: err.message || 'Unknown error',
    ...(isInvalidArgs ? { hint: 'Re-read the inputSchema for this tool from ListTools response.' } : {}),
    ...(isNotFound ? { hint: 'Verify the ID against marketnow_search_skills output.' } : {}),
    ...(isUnknownTool ? { hint: 'Call ListTools to enumerate valid marketnow_* tool names.' } : {}),
  };

  return {
    isError: true,
    content: [
      { type: 'text', text: JSON.stringify(errorPayload, null, 2) }
    ]
  };
}
```

The key differences:

1. **`error` is a code, not a message.** The agent can branch on `INVALID_ARGUMENT` vs `NOT_FOUND` vs `UNKNOWN_TOOL` vs `INTERNAL_ERROR` programmatically.
2. **`hint` is contextual.** For invalid arguments, the agent is told to re-read the schema. For not-found, it is told to verify against search results. For unknown-tool, it is told to call `ListTools`.
3. **`err.stack` is never serialized.** Only `err.message` and `err.code`. No server internals leak to the agent.
4. **The payload is JSON, not English.** The agent parses it as a structured object, not as natural language it has to interpret.

This is the single biggest improvement in agent reliability we shipped. After this change, our smoke tests show agents recovering from invalid inputs in a single retry — they get `INVALID_ARGUMENT` with a hint, re-call `tools/list`, and pass a valid value.

---

## The full audit

I wrote all of this up in `AUDIT.md` inside the npm package, along with the smoke-test commands so anyone can verify the contract:

```bash
# List tools — all should have marketnow_ prefix
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  node index.js | jq '.result.tools[].name'

# Verify error path on invalid input
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"marketnow_get_skill","arguments":{"skill_id":"../../etc/passwd"}},"id":2}' | \
  node index.js | jq '.result'
```

The npm package is [`marketnow-mcp@1.9.0`](https://www.npmjs.com/package/marketnow-mcp). The full source is on [GitHub](https://github.com/alicelabs-llc/marketnow/tree/master/mcp-server). The audit document is [`mcp-server/AUDIT.md`](https://github.com/alicelabs-llc/marketnow/blob/master/mcp-server/AUDIT.md).

---

## The four rules, in one table

| Rule | What it prevents | How to verify |
|------|------------------|--------------|
| A. `marketnow_` snake_case names | Tool-name collisions across loaded MCP servers | `tools/list` — every `.name` starts with the prefix |
| B. Intent-oriented descriptions | LLM not knowing when or why to call | Description answers WHEN/WHY, names predecessor tools |
| C. Strict JSON-Schema (enum/pattern/bounds) | LLM generating invalid JSON values | Every `properties[*]` has `type` + one of (`enum`/`pattern`/`min`/`max`) |
| D. Structured `{ content, isError }` envelopes | Agent loop breaking on uncaught exceptions | Errors return `isError: true` with `error` code + `hint`, never throw |

If you are building an MCP server today, please do all four. The MCP spec does not enforce them — but autonomous agents will reward you for it.

---

## What's next for us

`marketnow-mcp@1.9.0` is the v1.x floor. The v5.1-v6.0 roadmap (in the repo's `ROADMAP.md`) layers on:

- **Full tool fingerprinting with provenance** — SHA-256 of the tool definition, signed by the publisher's Ed25519 key
- **Confidence scoring** — every tool call returns a confidence score so the agent can decide whether to trust the result
- **Transparency log** — append-only Merkle log of every tool definition change
- **Behavioral baselining** — runtime profiling of tool call patterns, alert on drift

But the four rules in this post are the foundation. Without them, nothing above them works.

---

*If you want to try the v1.9.0 server:*

```bash
npx -y marketnow-mcp@1.9.0
```

Add this to your Claude Desktop config and ask Claude: *"What OWASP MCP controls does the marketnow_get_owasp_compliance tool expose, and what filesystem or network capabilities does the skill mn-gen-00003 have?"* — you will see the agent consume the strict schema, generate valid JSON, and return a structured response. That is the v1.9.0 contract in action.

---

*MarketNow is security infrastructure for AI agents, built by AliceLabs LLC (Wyoming, USA). Founder: Edison Flores. The Sentinel audit pipeline has performed 1,211,488 security checks and quarantined 80 malicious skills. Audit report: [marketnow.site/api/audit-report.json](https://marketnow.site/api/audit-report.json).*
