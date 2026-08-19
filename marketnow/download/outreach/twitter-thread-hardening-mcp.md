# Twitter Thread — MarketNow MCP v1.9.0 + dev.to article

> **Post as a thread (8 tweets). Each tweet below is a separate post. The "🧵" emoji at the end of each tweet (except the last) signals "next tweet in thread".**
>
> **Audience:** AI agents developers, MCP server builders, security engineers
> **Hashtags:** #MCP #AI #Security #TypeScript #AgentSecurity
> **Recommended posting time:** 2026-08-10 09:00 PT / 12:00 ET / 18:00 UTC

---

## Tweet 1 (hook)

We just shipped `marketnow-mcp@1.9.0` — a breaking change that took 2 versions to figure out.

If you're building an MCP server today, your consumers are NOT humans. They are autonomous agents (Claude Desktop, Cursor, Cline, LangChain, LlamaIndex).

Agents do not read your README. 🧵

---

## Tweet 2 (the problem)

When Claude Desktop decides whether to call your tool, it doesn't consult your docs.

It consults the JSON-Schema returned by `tools/list`.

If your schema is ambiguous → the LLM's JSON generation is ambiguous → the tool call fails silently inside the agent loop → the user sees "the agent gave up."

You never hear about it.

---

## Tweet 3 (the 4 rules)

4 golden rules we ended up with — they generalize to any MCP server:

A. Deterministic tool names with a namespace prefix (`marketnow_*`)
B. Intent-oriented descriptions (WHEN/WHY, not WHAT)
C. Strict JSON-Schema (`type` + `enum` + `pattern` + bounds, no `any`)
D. Structured `{ content, isError }` responses (no exceptions into the agent loop)

---

## Tweet 4 (Rule A — namespacing)

Rule A in practice.

❌ v1.7.0: `search_skills` (collides with any other server's `search_skills`)
✅ v1.9.0: `marketnow_search_skills` (stable namespace + snake_case)

Tool-name collisions break tool-choice. Namespacing fixes it.

---

## Tweet 5 (Rule C — schemas)

Rule C is the rule that took longest.

❌ `category: { type: "string", description: "One of: AI/ML, Data, ..." }`
✅ `category: { type: "string", enum: ["AI/ML", "Data", ...] }`

The LLM treats descriptions as hints, schemas as constraints. Enumerate every categorical value.

---

## Tweet 6 (Rule D — error envelopes)

Rule D prevents the agent loop from breaking.

❌ v1.7.0: `{ content: [{ text: "Error: Invalid card_id" }] }`
✅ v1.9.0: `{ isError: true, content: [{ text: JSON.stringify({ error: "INVALID_ARGUMENT", hint: "Re-read the inputSchema" }) }] }`

Errors return codes, not English. No stack traces leak.

---

## Tweet 7 (the result)

After v1.9.0, our smoke tests show agents recovering from invalid inputs in a single retry.

They get `INVALID_ARGUMENT` with a hint → re-call `tools/list` → pass a valid value.

That's the v1.9.0 contract in action. ✅

---

## Tweet 8 (CTA + dev.to link)

Full write-up (with code snippets from the v1.7.0 → v1.9.0 diff) on dev.to:

🔗 https://dev.to/edison_flores_6d2cd381b13/hardening-an-mcp-server-for-autonomous-agents-4-rules-i-learned-the-hard-way-441d

Try the v1.9.0 server: `npx -y marketnow-mcp@1.9.0`

Audit document: https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/mcp-server/AUDIT.md

#MCP #AI #Security #TypeScript

---

## Companion posts (LinkedIn / Reddit)

### LinkedIn (longer version)

Title: "What I learned hardening an MCP server for autonomous agents"

Body:
> Just published: "Hardening an MCP server for autonomous agents — 4 rules I learned the hard way" on dev.to.
>
> The thesis: when you ship an MCP server today, your consumers are NOT humans. They are autonomous agents (Claude Desktop, Cursor, Cline, LangChain, LlamaIndex). Agents do not read your README — they read the JSON-Schema returned by `tools/list`. Any ambiguity in your schema propagates directly into failed tool calls.
>
> 4 golden rules we ended up with at MarketNow:
> A. Deterministic tool names with a namespace prefix (`marketnow_*`)
> B. Intent-oriented descriptions (WHEN/WHY, not WHAT)
> C. Strict JSON-Schema (type + enum + pattern + bounds, no `any`)
> D. Structured `{ content, isError }` responses with error code taxonomy
>
> The result: marketnow-mcp@1.9.0 — 12 tools, all namespaced, with a full audit document shipped inside the npm tarball.
>
> Article: https://dev.to/edison_flores_6d2cd381b13/hardening-an-mcp-server-for-autonomous-agents-4-rules-i-learned-the-hard-way-441d
> npm: https://www.npmjs.com/package/marketnow-mcp
> GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow

### Reddit (r/mcp)

Title: "[OC] Hardening an MCP server for autonomous agents — 4 rules I learned the hard way (marketnow-mcp v1.7.0 → v1.9.0)"

Body:
> Hey r/mcp —
>
> Just published a write-up of what I learned shipping marketnow-mcp v1.9.0. The thesis: agents do not read your README. They read the JSON-Schema returned by `tools/list`. If your schema is ambiguous, the LLM's JSON generation is ambiguous, and the tool call fails silently inside the agent loop.
>
> 4 golden rules I ended up with:
> A. Deterministic tool names with a namespace prefix (`marketnow_*`)
> B. Intent-oriented descriptions (WHEN/WHY, not WHAT)
> C. Strict JSON-Schema (type + enum + pattern + bounds, no `any`)
> D. Structured `{ content, isError }` responses with error code taxonomy
>
> Full article with code snippets (v1.7.0 → v1.9.0 diff): https://dev.to/edison_flores_6d2cd381b13/hardening-an-mcp-server-for-autonomous-agents-4-rules-i-learned-the-hard-way-441d
>
> Audit document (in the npm tarball): https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/mcp-server/AUDIT.md
>
> Try it: `npx -y marketnow-mcp@1.9.0`
>
> Would love feedback from anyone building MCP-consuming agents who has hit the "tool ambiguity → JSON generation failure" problem.
