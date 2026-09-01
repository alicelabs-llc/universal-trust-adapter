#!/bin/bash
# UTA Bot — Auto-restart wrapper
# If the bot dies, restart it immediately

LOG="/home/z/my-project/download/telegram/bot.log"
SCRIPT="/home/z/my-project/scripts/telegram/uta_verify_bot.py"
export UTA_BOT_TOKEN="8724927280:AAGbG4EaDuMjTBd0tRcNM-vCue9XfUzWEA4"

mkdir -p /home/z/my-project/download/telegram

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Bot supervisor started" >> "$LOG"

while true; do
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Starting bot..." >> "$LOG"
    
    /usr/bin/python3 "$SCRIPT" >> "$LOG" 2>&1
    EXIT_CODE=$?
    
    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Bot exited (code $EXIT_CODE), restarting in 3s..." >> "$LOG"
    sleep 3
done
