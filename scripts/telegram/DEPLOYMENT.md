# UTA Verify Bot — Free Deployment Guide

## What we gain by deploying (honest answer)

**Nothing, UNLESS we do these 4 things after deploy:**

1. **Mention @uta_verify_bot in our 140 Dev.to articles** — add a line at the end of each:
   > "Want to verify a credential quickly? Send it to @uta_verify_bot on Telegram."

2. **Add to repo README** — "Use UTA via Telegram: talk to @uta_verify_bot"

3. **List in bot directories:**
   - https://telegrambots.me/submit
   - https://github.com/ebertti/awesome-telegram-bots
   - https://github.com/AnnouncedSoon/awesome-telegram-bots
   - Reddit r/TelegramBots

4. **Add to 3-5 Telegram groups** where AI agent developers hang out

If we do A-D, the bot becomes a **discovery channel** — people find UTA through the bot, try it, and some convert to repo stars / NPM downloads / article readers.

If we DON'T do A-D, the bot is wasted infrastructure.

## Recommended: Oracle Cloud Always Free

**Why:** Only truly free-forever option that runs Python natively.

### Steps (15 minutes)

1. **Create Oracle Cloud account** (free, no credit card charge)
   - Go to: https://cloud.oracle.com
   - Sign up with email
   - Choose "Always Free" eligible services

2. **Create a VM**
   - Go to Compute → Instances → Create Instance
   - Image: Ubuntu 22.04
   - Shape: VM.Standard.E2.1.Micro (Always Free eligible)
   - Download SSH key
   - Click "Create"

3. **SSH into VM**
   ```bash
   ssh -i <your-key.pem> ubuntu@<vm-public-ip>
   ```

4. **Run deployment script**
   ```bash
   # Download and run
   curl -sL https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/scripts/telegram/deploy_oracle.sh | bash
   ```

5. **Verify bot is running**
   ```bash
   sudo systemctl status uta-bot
   tail -f /var/log/uta-bot.log
   ```

6. **Test from Telegram** — send `/start` to @uta_verify_bot

### Why this works 24/7
- Oracle Cloud Always Free = forever free, not trial
- systemd service auto-restarts on crash
- VM survives reboots
- No credit card charge

## Backup option: Vercel (webhook mode)

If Oracle Cloud is too complex, use Vercel:

1. Push `uta_bot_vercel.py` to a GitHub repo
2. Import on vercel.com
3. Set env var: `UTA_BOT_TOKEN=8724927280:AAGbG4EaDuMjTBd0tRcNM-vCue9XfUzWEA4`
4. Deploy
5. Set webhook:
   ```bash
   curl "https://api.telegram.org/bot8724927280:AAGbG4EaDuMjTBd0tRcNM-vCue9XfUzWEA4/setWebhook?url=https://YOUR-APP.vercel.app/api/webhook"
   ```

**Limitations:** 100k invocations/month, 10s timeout (enough for verify)

## Files in this directory

| File | Purpose |
|------|---------|
| `uta_verify_bot.py` | Main bot (long polling, for Oracle/VM) |
| `uta_bot_vercel.py` | Webhook version (for Vercel) |
| `run_bot_supervised.sh` | Supervisor wrapper (restart on crash) |
| `deploy_oracle.sh` | Oracle Cloud deployment script |
| `README.md` | This file |

## What to do AFTER deploy

### Day 1: Verify it works
- [ ] Send /start, /formats, /pipeline, /help from Telegram
- [ ] Send /verify with a real JWT
- [ ] Check logs show the verifications

### Day 2: Promotion
- [ ] Add "Talk to @uta_verify_bot on Telegram" to repo README
- [ ] Add to INTEGRATIONS.md
- [ ] Write a Dev.to article: "UTA is now on Telegram — verify any credential in 1 message"
- [ ] Add the bot link to the bottom of all future Dev.to articles

### Day 3-7: Distribution
- [ ] Submit to https://telegrambots.me/submit
- [ ] Submit to awesome-telegram-bots lists on GitHub
- [ ] Post in r/TelegramBots
- [ ] Join 3 AI agent Telegram groups, mention bot when relevant
- [ ] Add to Telegram bot store: https://storebot.me

### Week 2+: Integration
- [ ] Add bot to MCP directories
- [ ] Write integration guide for agents (how to call via Telegram API)
- [ ] Consider adding webhook for other bots to query UTA programmatically

## Monitoring

Once deployed on Oracle:
```bash
# Check status
sudo systemctl status uta-bot

# View logs
tail -f /var/log/uta-bot.log

# Restart
sudo systemctl restart uta-bot

# Stop
sudo systemctl stop uta-bot
```

## Cost: $0

- Oracle Cloud Always Free: $0 forever
- Telegram Bot API: $0
- UTA API: $0 (our own API)
- GitHub repo: $0

**Total: $0/month, 24/7 uptime**
