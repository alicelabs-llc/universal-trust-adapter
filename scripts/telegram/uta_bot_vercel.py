#!/usr/bin/env python3
"""
UTA Verify Bot — Vercel Serverless Webhook Version

This version uses webhooks instead of long polling.
Deploy on Vercel free tier (100k invocations/month).

Setup:
1. Push this file to a GitHub repo
2. Import repo on vercel.com
3. Set environment variable: UTA_BOT_TOKEN
4. Deploy — get URL like https://uta-bot.vercel.app
5. Set webhook: 
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://uta-bot.vercel.app/api/webhook"
"""
import json
import os
import urllib.request
import urllib.error

BOT_TOKEN = os.environ.get("UTA_BOT_TOKEN", "")
UTA_API_URL = "https://www.marketnow.site/api/trust"
TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}"


def uta_verify(card):
    """Call UTA API to verify a credential."""
    payload = json.dumps({"payload": card}).encode()
    req = urllib.request.Request(
        f"{UTA_API_URL}?action=verify",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


def uta_formats():
    """List supported credential formats."""
    req = urllib.request.Request(f"{UTA_API_URL}?action=formats")
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e)}


def tg_send_message(chat_id, text):
    """Send a message via Telegram."""
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True
    }).encode()
    req = urllib.request.Request(
        f"{TELEGRAM_API}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read())
    except Exception as e:
        return None


def handle_message(message):
    """Process a single Telegram message."""
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")
    
    if not text or not chat_id:
        return
    
    if text.startswith("/start"):
        tg_send_message(chat_id, 
            "🤖 UTA Verify Bot\n\n"
            "I verify credentials for AI agents.\n\n"
            "Commands:\n"
            "/verify <credential> — verify any credential\n"
            "/formats — list 8 supported formats\n"
            "/help — full help\n\n"
            "API: https://www.marketnow.site/api/trust\n"
            "Repo: https://github.com/alicelabs-llc/universal-trust-adapter")
    
    elif text.startswith("/formats"):
        result = uta_formats()
        formats = result.get("formats", [])
        msg = "📋 Supported Formats (8):\n\n"
        for i, f in enumerate(formats, 1):
            msg += f"{i}. {f.get('name','?')} ({f.get('id','?')})\n"
        msg += f"\nAPI: https://www.marketnow.site/api/trust?action=formats"
        tg_send_message(chat_id, msg)
    
    elif text.startswith("/verify"):
        credential = text[len("/verify"):].strip()
        if not credential or len(credential) < 10:
            tg_send_message(chat_id, "❌ Usage: /verify <credential>")
            return
        
        result = uta_verify(credential)
        if "error" in result:
            tg_send_message(chat_id, f"❌ Error: {result['error'][:200]}")
            return
        
        decision = result.get("decision", "UNKNOWN")
        detected_format = result.get("detected_format", "?")
        issuer = result.get("issuer", "?")
        failed_stage = result.get("failed_stage")
        
        emoji = "✅" if decision == "PERMIT" else "❌" if decision == "DENY" else "⚠️"
        msg = f"{emoji} Verification Result\n\n"
        msg += f"Decision: {decision}\n"
        msg += f"Format: {detected_format}\n"
        msg += f"Issuer: {issuer}\n"
        if failed_stage:
            msg += f"Failed at: {failed_stage}\n"
        msg += f"\nVerified by UTA 12-stage pipeline\n"
        msg += f"API: https://www.marketnow.site/api/trust"
        tg_send_message(chat_id, msg)
    
    elif text.startswith("/help"):
        tg_send_message(chat_id,
            "📖 UTA Verify Bot — Help\n\n"
            "I verify credentials for AI agents.\n\n"
            "Commands:\n"
            "/verify <credential> — verify (JWT, W3C VC, MCP Card, ATC, X.509, etc.)\n"
            "/formats — list 8 supported formats\n"
            "/help — this message\n\n"
            "Send any text >20 chars and I'll auto-verify it.\n\n"
            "Repo: https://github.com/alicelabs-llc/universal-trust-adapter\n"
            "API: https://www.marketnow.site/api/trust")
    
    else:
        # Auto-verify any text >20 chars
        if len(text) > 20:
            handle_message({"chat": {"id": chat_id}, "text": f"/verify {text}"})
        else:
            tg_send_message(chat_id, 
                "Send me a credential to verify, or use /help")


def handler(request):
    """Vercel serverless function handler."""
    if request.method != "POST":
        return {"status": "ok", "message": "UTA Bot webhook is running"}
    
    try:
        body = request.json()
        message = body.get("message") or body.get("edited_message")
        if message:
            handle_message(message)
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
