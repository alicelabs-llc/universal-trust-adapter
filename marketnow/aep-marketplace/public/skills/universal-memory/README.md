# universal-memory

**Persistent local memory for ANY AI agent.** One shared memory store across
Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, Gemini CLI, Cline, AMP,
OpenClaw — and any agent that can read and write files.

- **100% local** — memories live in two JSONL files on your machine. No cloud,
  no API keys, no accounts, no telemetry. Your data never leaves the machine.
- **Zero dependencies** — a single Node file (`memory.cjs`, Node >= 18) or a
  single Python file (`memory.py`, Python >= 3.8). Pick either; they read and
  write the exact same store.
- **Cross-agent by design** — a decision stored by Cursor is recalled by Claude
  Code in the next session. Every entry records which agent wrote it.
- **Real deletion** — `forget` removes the line from the file. No shadow
  copies, no soft-delete, no "anonymized" retention.
- **File protocol first** — the CLI is a convenience. Agents that cannot run
  commands can operate on the JSONL files directly (see SKILL.md).

## Install

```bash
curl -fsSL https://marketnow.site/skills/universal-memory/install.sh -o um-install.sh
bash um-install.sh
```

Or manually: download `SKILL.md`, `memory.cjs`, `memory.py` from
<https://marketnow.site/skills/universal-memory/> into your project
(`./skills/universal-memory/`) or anywhere on PATH.

## Usage

```bash
# store (an agent distils the user's statement into one concise line)
node memory.cjs remember "Use PostgreSQL, not MongoDB, for new services" \
  --type decision --scope global --tag database --agent claude-code

# recall
node memory.cjs recall "database" --limit 5

# grouped profile (what do you remember about me?)
python3 memory.py profile

# forget — real delete
python3 memory.py forget um-1760000000-ab12cd

# counts / export / health
node memory.cjs stats
python3 memory.py export --format md
node memory.cjs doctor
```

Types: `decision` · `rule` · `preference` · `fact` · `context`.
Scopes: `global` (`~/.universal-memory/memory.jsonl`) · `project`
(`./.universal-memory/memory.jsonl`). Add `--json` to any command for
machine-readable output. Set `AGENT_NAME` in the environment and the CLI
tags every memory with it automatically.

## Agent setup

- **Claude Code / Codex / Cline** — drop this directory into your skills folder
  (e.g. `~/.claude/skills/universal-memory/`); the agent discovers SKILL.md.
- **Cursor / Windsurf** — reference SKILL.md from your rules file, or keep the
  CLI on PATH and mention it in your project rules.
- **Any agent** — point it at this README or SKILL.md. The file protocol in
  SKILL.md is the full spec: read both stores at session start, append one
  JSON line per memory, rewrite atomically on forget.

## Security posture

Published by MarketNow (marketnow.site), MIT licensed. The CLIs make **zero
network calls** (verifiable by reading the source — there is no fetch, no
http, no dns). Install is a plain file download from marketnow.site; the
installer is 30 lines of readable curl. No obfuscation, no bundling, no
post-install scripts.

| | universal-memory | cloud memory products |
|---|---|---|
| Data location | your disk | their servers |
| API key | none | required |
| Network calls | **0** | every operation |
| Works with | every agent | their SDK/clients |
| Deletion | real | "as required by law" |

## License

MIT — (c) 2026 AliceLabs LLC / MarketNow.
Catalog page: <https://marketnow.site/s/universal-memory>
