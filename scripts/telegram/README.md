# UTA Telegram Bot — Agent-First Verification

## What this is

A **Telegram bot that is itself an agent**. Other AI agents (Claude, Cursor, Codex, Cline, or any MCP client) can chat with it to verify credentials using UTA.

## Why this is agent-first

- **Agents use Telegram already** — `mcp-telegram` (192 downloads/week) connects Claude/Cursor/Codex to Telegram user accounts
- **Bot API is HTTP-based** — any agent can call it with a simple POST
- **No auth required** — agents just send `/verify <credential>` and get a structured response
- **Fail-closed by design** — UNKNOWN = DENY, ERROR = DENY (matches UTA's golden rule)

## Architecture

```
Agent (Claude/Cursor/Codex/Cline)
    ↓
    sends /verify <credential> to @uta_verify_bot
    ↓
UTA Verify Bot (this script)
    ↓
    calls https://www.marketnow.site/api/trust?action=verify
    ↓
    returns PERMIT/DENY/UNDETERMINED + 12-stage pipeline result
    ↓
Agent decides what to do
```

## Setup (5 minutes)

### Step 1: Create the bot

1. Open Telegram, search **@BotFather**
2. Send `/newbot`
3. Name: `UTA Verify Bot`
4. Username: `uta_verify_bot` (must end in `_bot`)
5. BotFather gives you a token like: `7812345678:AAH...`
6. Copy the token

### Step 2: Configure the bot (optional, but recommended)

Send these commands to @BotFather:
```
/setdescription
Send: Universal Trust Adapter — I verify credentials for AI agents. 8 formats, 12-stage pipeline. Send /verify <credential>.

/setabouttext
Send: UTA Verify Bot — agent-first credential verification. Supports JWT, W3C VC, MCP Cards, ATC v3, A2A, EAT-AI, ZTA, X.509. 12-stage pipeline. Fail-closed.

/setuserpic
Send: (upload a logo image)
```

### Step 3: Run the bot

```bash
export UTA_BOT_TOKEN="your-token-here"
nohup python3 /home/z/my-project/scripts/telegram/uta_verify_bot.py > /dev/null 2>&1 &

# Save PID
echo $! > /home/z/my-project/download/telegram/bot.pid
```

### Step 4: Test it

1. Open Telegram, search your bot's username
2. Send `/start`
3. Send `/formats` — should list 8 formats
4. Send `/pipeline` — should show 12-stage pipeline
5. Send `/verify eyJhbGciOiJFZERTQSIs...` with a real JWT — should verify

## How agents use this bot

### Option A: Direct Telegram API (any agent)

```bash
# Agent sends a credential to verify
curl -X POST "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "<bot_chat_id>",
    "text": "/verify eyJhbGciOiJFZERTQSIs..."
  }'

# Agent polls for response
curl "https://api.telegram.org/bot<TOKEN>/getUpdates"
```

### Option B: Via MCP (Claude, Cursor, Codex, Cline)

1. Install `mcp-telegram` in your MCP client:
   ```bash
   npm install -g mcp-telegram
   ```

2. Configure your MCP client to connect to Telegram
3. Tell your agent: "verify this credential with @uta_verify_bot"
4. Agent sends `/verify <credential>` via MCP
5. Agent receives verification result

### Option C: Via UTA API directly (no Telegram needed)

Agents that don't need Telegram can call UTA directly:
```bash
curl -X POST "https://www.marketnow.site/api/trust?action=verify" \
  -H "Content-Type: application/json" \
  -d '{"card": "<credential>"}'
```

## Bot commands

| Command | What it does |
|---------|--------------|
| `/start` | Welcome message with bot info |
| `/verify <credential>` | Verify any credential (auto-detects format) |
| `/formats` | List 8 supported formats |
| `/pipeline` | Show 12-stage verification pipeline |
| `/help` | Full help with usage examples |

If you send any text >20 chars without a command, the bot treats it as a credential and verifies it automatically.

## Files

| File | Purpose |
|------|---------|
| `/home/z/my-project/scripts/telegram/uta_verify_bot.py` | The bot script |
| `/home/z/my-project/download/telegram/bot.log` | Bot activity log |
| `/home/z/my-project/download/telegram/bot.pid` | Bot process ID |

## Management

```bash
# Start the bot
export UTA_BOT_TOKEN="your-token"
nohup python3 /home/z/my-project/scripts/telegram/uta_verify_bot.py > /dev/null 2>&1 &
echo $! > /home/z/my-project/download/telegram/bot.pid

# Check if running
ps aux | grep uta_verify_bot

# View logs
tail -f /home/z/my-project/download/telegram/bot.log

# Stop the bot
kill $(cat /home/z/my-project/download/telegram/bot.pid)
# or: pkill -f uta_verify_bot

# Restart
pkill -f uta_verify_bot
nohup python3 /home/z/my-project/scripts/telegram/uta_verify_bot.py > /dev/null 2>&1 &
```

## Why this is better than a broadcast channel

| Approach | Problem |
|----------|---------|
| Broadcast channel (@uta_trust) | One-way, no interaction, humans only |
| Bot that posts in groups | Spam, gets banned |
| **Bot that verifies credentials** | Agent-first, interactive, fail-closed, useful |

This bot is **a service** that other agents consume. It's not marketing — it's infrastructure.

## Next steps after bot is running

1. **List bot in MCP directories** — submit to `modelcontextprotocol/servers` (already opened issue #4736)
2. **Document bot in INTEGRATIONS.md** — add Telegram bot as a consumption channel
3. **Add to README** — "Use UTA via Telegram: talk to @uta_verify_bot"
4. **Monitor usage** — bot.log shows every verification request
5. **Collect feedback** — when agents use it, log what formats they verify most

## Limitations

- **Long polling** (not webhooks) — simpler but uses more requests. For high volume, switch to webhooks
- **No rate limiting** — anyone who finds the bot can use it. Add rate limiting if abused
- **No auth** — bot is public. Anyone with the username can send credentials. This is by design (agents don't have auth tokens)
- **Credential privacy** — credentials sent to the bot go through UTA's API. Don't send production secrets to test
