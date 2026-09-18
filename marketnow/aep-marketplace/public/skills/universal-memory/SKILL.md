---
name: universal-memory
description: Persistent local memory for ANY AI agent — one shared memory store across Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, Gemini CLI, Cline, AMP, OpenClaw and every agent that can read and write files. Use when the user asks to remember a decision, rule, or preference, wants to recall past context, or asks what you remember about them or the project. 100% local, zero cloud, zero API keys, zero dependencies.
---

# Universal Memory

One persistent, **shared** memory store for every AI agent on the machine.
Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini CLI, Cline — any agent
that can read and write files can use it. A decision your user made in a
Cursor session is visible to Claude Code in the next one. No cloud, no API
keys, no dependencies. Your data never leaves the machine.

- Global memory: `~/.universal-memory/memory.jsonl`
- Project memory: `./.universal-memory/memory.jsonl`

Both files are plain JSON Lines. The optional CLI (`memory.cjs` / `memory.py`)
is a convenience — the file protocol below is the source of truth.

## Session start

Read the memories before answering anything memory-sensitive:

1. If `~/.universal-memory/memory.jsonl` exists, read it (global scope).
2. If `./.universal-memory/memory.jsonl` exists, read it too (project scope —
   it overrides global on conflicts).
3. Silently apply what you find: treat `rule` entries as hard rules,
   `decision` entries as settled choices, `preference` entries as user
   defaults. Do not re-litigate them unless the user asks.

## When the user asks what you remember

Run `profile` (or read both files) and summarise in plain language, grouped
by decisions, rules, preferences and facts. Always name the scope (global
vs this project). Never invent memories — only report what is in the files.

## When the user states something durable

If the user says "remember that …", or makes an architectural decision,
states a coding rule, or expresses a preference worth keeping, distil it
into ONE concise line and store it:

```bash
node memory.cjs remember "Use PostgreSQL, not MongoDB, for new services" \
  --type decision --scope global --tag database --agent claude-code
```

- `--type` one of `decision | rule | preference | fact | context`
  (default `fact`). Use `context` for project-specific working state.
- `--scope` `global` (default) or `project`.
- `--agent` your agent name, so the profile shows cross-agent history.

## When the user asks to recall something specific

```bash
node memory.cjs recall "database choice" --limit 5
```

Report the matches with their dates. If nothing matches, say so — do not
guess or fabricate.

## When the user asks to forget

```bash
node memory.cjs forget um-1760000000-ab12cd
```

Ask for confirmation first if the memory is a `rule` or `decision`.
Deletion is real (the line is removed from the JSONL file) — there is no
soft-delete, no shadow copy, no telemetry.

## File protocol (no CLI available)

If neither CLI can be used, operate on the files directly:

- **Read** both JSONL files at session start (global, then project).
- **Store** one entry per line, appended to the file:

```json
{"id":"um-1760000000-ab12cd","ts":"2026-09-17T12:34:56.000Z","type":"decision","scope":"global","text":"Use PostgreSQL, not MongoDB, for new services","tags":["database"],"agent":"claude-code"}
```

- `id` must be unique (`um-<epoch-ms>-<6 hex chars>`), `ts` is ISO-8601 UTC.
- **Forget** = rewrite the file without that line (atomic: write temp, rename).
- Keep the JSONL sorted naturally by append order; never reorder history.
- One fact per line. Small, distilled entries — not transcripts.

## Honesty rules

- Never invent or extrapolate memories. Only what is in the files.
- `rule` and `decision` entries are settled — challenge them only if the
  user explicitly asks, and store the new outcome when they overrule one.
- When unsure whether something is worth remembering, ask the user.
- Memories are the USER's data. Offer `export` (markdown) anytime they want
  a copy, and `forget` anytime they want erasure.

## Optional CLI setup

Download once into the project (or anywhere on PATH):

```bash
curl -fsSL https://marketnow.site/skills/universal-memory/install.sh -o um-install.sh
bash um-install.sh   # installs ./skills/universal-memory/ + optional CLI on PATH
```

`memory.cjs` requires Node >= 18; `memory.py` requires Python >= 3.8. Pick
either — they read and write the exact same store. The skill is MIT
licensed and published by MarketNow (marketnow.site/s/universal-memory).
