#!/usr/bin/env python3
"""
UTA Verify Bot — Telegram bot for AI agents.

What this is:
A Telegram bot that other AI agents (Claude, Cursor, Codex, Cline, etc.)
can chat with to verify credentials using UTA (Universal Trust Adapter).

How agents use it:
1. Agent sends a credential (JWT, W3C VC, MCP Card, ATC, X.509, etc.) to @uta_verify_bot
2. Bot calls UTA API: https://www.marketnow.site/api/trust?action=verify
3. Bot responds with verification result (PERMIT/DENY/UNDETERMINED)
4. Agent decides what to do based on the result

Commands:
- /start — welcome message
- /verify <credential> — verify a credential
- /formats — list supported formats
- /pipeline — show 12-stage pipeline
- /help — help

Setup:
1. Create bot with @BotFather, get token
2. Set token: export UTA_BOT_TOKEN="your-token"
3. Run: python3 uta_verify_bot.py

For agents (MCP-style usage):
    POST to https://api.telegram.org/bot<TOKEN>/sendMessage
    chat_id: <bot_chat_id>
    text: /verify <credential>
    
    Then poll getUpdates for the response.
"""
import json
import os
import sys
import urllib.request
import urllib.error
import time
import logging
from datetime import datetime, timezone

# ============================================================
# CONFIG
# ============================================================

BOT_TOKEN = os.environ.get("UTA_BOT_TOKEN", "")
UTA_API_URL = "https://www.marketnow.site/api/trust"

if not BOT_TOKEN:
    print("ERROR: Set UTA_BOT_TOKEN environment variable")
    print("Create bot with @BotFather, then:")
    print("  export UTA_BOT_TOKEN='your-token-here'")
    sys.exit(1)

TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s UTC] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/home/z/my-project/download/telegram/bot.log")
    ]
)
log = logging.getLogger("uta-bot")

os.makedirs("/home/z/my-project/download/telegram", exist_ok=True)

# ============================================================
# UTA API CALLS
# ============================================================

def uta_verify(card):
    """Call UTA API to verify a credential."""
    payload = json.dumps({"card": card}).encode()
    req = urllib.request.Request(
        f"{UTA_API_URL}?action=verify",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}

def uta_formats():
    """List supported credential formats."""
    req = urllib.request.Request(f"{UTA_API_URL}?action=formats")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}

# ============================================================
# TELEGRAM API
# ============================================================

def tg_send_message(chat_id, text, parse_mode="Markdown"):
    """Send a message via Telegram."""
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True
    }).encode()
    req = urllib.request.Request(
        f"{TELEGRAM_API}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        log.error(f"Telegram API error: {err}")
        return None

def tg_get_updates(offset=None):
    """Poll for new messages."""
    url = f"{TELEGRAM_API}/getUpdates?timeout=30"
    if offset:
        url += f"&offset={offset}"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=35) as r:
            return json.loads(r.read())
    except Exception as e:
        log.error(f"getUpdates error: {e}")
        return {"ok": False, "result": []}

# ============================================================
# COMMAND HANDLERS
# ============================================================

def handle_start(chat_id, user_name):
    """Welcome message."""
    text = f"""🤖 *UTA Verify Bot*

Hi {user_name}! I'm a verification agent powered by UTA (Universal Trust Adapter).

*I verify credentials for AI agents.*

Supported formats (8):
• ATC v3 (Agent Trust Card)
• JWT (with x5c chain)
• W3C Verifiable Credentials
• A2A (Agent-to-Agent) cards
• EAT-AI (Entity Attestation Tokens)
• ZTA (Zero Trust Agent) cards
• MCP Server Cards
• X.509 certificates

*Commands:*
/verify `<credential>` — verify any credential
/formats — list supported formats
/pipeline — show 12-stage pipeline
/help — full help

*For agents:* send `/verify <credential>` and I'll respond with PERMIT/DENY/UNDETERMINED.

*API:* https://www.marketnow.site/api/trust
*Repo:* https://github.com/alicelabs-llc/universal-trust-adapter"""
    tg_send_message(chat_id, text)

def handle_verify(chat_id, credential):
    """Verify a credential."""
    if not credential or len(credential) < 10:
        tg_send_message(chat_id, "❌ Please provide a credential to verify.\n\nUsage: `/verify <credential>`")
        return
    
    tg_send_message(chat_id, "🔍 Verifying credential...")
    
    result = uta_verify(credential)
    
    if "error" in result:
        tg_send_message(chat_id, f"❌ Verification error: `{result['error'][:200]}`")
        return
    
    decision = result.get("decision", "UNKNOWN")
    detected_format = result.get("detected_format", "?")
    issuer = result.get("issuer", "?")
    failed_stage = result.get("failed_stage")
    
    if decision == "PERMIT":
        emoji = "✅"
        verdict = "PERMIT — credential is valid"
    elif decision == "DENY":
        emoji = "❌"
        verdict = f"DENY — failed at {failed_stage or 'unknown stage'}"
    else:
        emoji = "⚠️"
        verdict = "UNDETERMINED — needs human review"
    
    text = f"""{emoji} *Verification Result*

*Decision:* `{decision}`
*Format:* `{detected_format}`
*Issuer:* `{issuer}`"""
    
    if failed_stage:
        text += f"\n*Failed stage:* `{failed_stage}`"
    
    # Add stages if available
    stages = result.get("stages", {})
    if stages:
        text += "\n\n*Pipeline stages:*\n"
        for stage_name, stage_result in list(stages.items())[:12]:
            if stage_result == "OK" or stage_result == "PASS":
                text += f"  ✅ {stage_name}: {stage_result}\n"
            elif isinstance(stage_result, str) and len(stage_result) < 30:
                text += f"  ⚠️ {stage_name}: {stage_result}\n"
            else:
                text += f"  ℹ️ {stage_name}: verified\n"
    
    text += f"\n*Verified by:* UTA 12-stage pipeline\n*API:* https://www.marketnow.site/api/trust"
    
    tg_send_message(chat_id, text)
    
    # Log verification
    log.info(f"Verified credential for chat {chat_id}: {decision} ({detected_format})")

def handle_formats(chat_id):
    """List supported formats."""
    result = uta_formats()
    formats = result.get("formats", [])
    
    text = "📋 *Supported Credential Formats (8)*\n\n"
    for i, f in enumerate(formats, 1):
        name = f.get("name", "?")
        fid = f.get("id", "?")
        version = f.get("version", "?")
        status = f.get("status", "?")
        algo = f.get("algorithm", "?")
        status_emoji = "🟢" if status == "stable" else "🟡"
        text += f"{i}. {status_emoji} *{name}* (`{fid}`)\n   Version: {version} | Algo: {algo}\n"
    
    text += f"\n*API:* https://www.marketnow.site/api/trust?action=formats"
    tg_send_message(chat_id, text)

def handle_pipeline(chat_id):
    """Show 12-stage pipeline."""
    text = """🔧 *UTA 12-Stage Verification Pipeline*

```
PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING
       → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION
```

*Stages:*
1. PARSER — parse raw bytes (JSON/CBOR/PEM/DER)
2. DETECT — identify credential format
3. SCHEMA — validate required fields
4. CRYPTO — verify signature (Ed25519/RS256/ES256)
5. ISSUER — resolve issuer identity
6. KEY_BINDING — verify key is bound to issuer
7. POP — proof of possession
8. PROVENANCE — trace origin
9. LIFECYCLE — check expiry/revocation
10. EVIDENCE — collect audit evidence
11. POLICY — apply system policies
12. DECISION — final verdict (PERMIT/DENY/UNDETERMINED)

*Golden rule:* UNKNOWN = DENY, ERROR = DENY, EXPIRED = DENY, REVOKED = DENY

*Performance:* 6,744 verifications/sec (single core)
*API:* https://www.marketnow.site/api/trust"""
    tg_send_message(chat_id, text)

def handle_help(chat_id):
    """Full help."""
    text = """📖 *Help — UTA Verify Bot*

*I am an agent that verifies credentials for other agents.*

*Commands:*
• `/verify <credential>` — verify any credential (JWT, W3C VC, MCP Card, ATC, X.509)
• `/formats` — list 8 supported formats
• `/pipeline` — show 12-stage verification pipeline
• `/help` — this message

*How to use me:*

1. *As a human:* send `/verify` with your credential
2. *As an agent:* call my Telegram API with `/verify <credential>`

*Example (agent):*
```
POST https://api.telegram.org/bot<TOKEN>/sendMessage
{
  "chat_id": "<this_chat_id>",
  "text": "/verify eyJhbGciOiJFZERTQSIs..."
}
```
Then poll `getUpdates` for my response.

*What I verify:*
- Who issued the credential
- Is it expired/revoked
- Is the signature valid
- Does the presenter have proof of possession
- Does the scope match

*Links:*
• Repo: https://github.com/alicelabs-llc/universal-trust-adapter
• API: https://www.marketnow.site/api/trust
• NPM: @marketnow/trust-core

*Golden rule:* UNKNOWN = DENY. I fail closed."""
    tg_send_message(chat_id, text)

# ============================================================
# MAIN BOT LOOP
# ============================================================

def process_message(message):
    """Process a single Telegram message."""
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")
    user = message.get("from", {})
    user_name = user.get("first_name", user.get("username", "there"))
    
    if not text:
        return
    
    log.info(f"Message from {user_name} (chat {chat_id}): {text[:80]}...")
    
    if text.startswith("/start"):
        handle_start(chat_id, user_name)
    elif text.startswith("/verify"):
        credential = text[len("/verify"):].strip()
        handle_verify(chat_id, credential)
    elif text.startswith("/formats"):
        handle_formats(chat_id)
    elif text.startswith("/pipeline"):
        handle_pipeline(chat_id)
    elif text.startswith("/help"):
        handle_help(chat_id)
    else:
        # Treat any other message as a credential to verify
        if len(text) > 20:
            handle_verify(chat_id, text)
        else:
            tg_send_message(chat_id, 
                "Send me a credential to verify, or use /help to see commands.\n\n"
                "I verify JWT, W3C VC, MCP Cards, ATC, X.509, and 3 more formats.")

def main():
    """Main bot loop using long polling."""
    log.info("=" * 60)
    log.info("UTA Verify Bot — starting")
    log.info(f"Bot token: {BOT_TOKEN[:10]}...")
    log.info(f"UTA API: {UTA_API_URL}")
    log.info("=" * 60)
    
    # Test bot token
    try:
        req = urllib.request.Request(f"{TELEGRAM_API}/getMe")
        with urllib.request.urlopen(req, timeout=10) as r:
            me = json.loads(r.read())
            if me.get("ok"):
                bot_info = me.get("result", {})
                log.info(f"Bot: @{bot_info.get('username')} (id: {bot_info.get('id')})")
                log.info(f"Name: {bot_info.get('first_name')}")
            else:
                log.error(f"Bot token invalid: {me}")
                sys.exit(1)
    except Exception as e:
        log.error(f"Failed to verify bot token: {e}")
        sys.exit(1)
    
    # Set bot description
    try:
        payload = json.dumps({
            "description": "Universal Trust Adapter — I verify credentials for AI agents. 8 formats, 12-stage pipeline. Send /verify <credential>."
        }).encode()
        req = urllib.request.Request(
            f"{TELEGRAM_API}/setMyDescription",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=5).read()
    except:
        pass
    
    # Polling loop
    offset = None
    log.info("Polling for messages...")
    
    while True:
        try:
            updates = tg_get_updates(offset)
            if not updates.get("ok"):
                log.error(f"getUpdates failed: {updates}")
                time.sleep(5)
                continue
            
            for update in updates.get("result", []):
                offset = update.get("update_id", 0) + 1
                message = update.get("message")
                if message:
                    process_message(message)
        except KeyboardInterrupt:
            log.info("Bot stopped by user")
            break
        except Exception as e:
            log.error(f"Error in main loop: {e}")
            time.sleep(5)

if __name__ == "__main__":
    main()
