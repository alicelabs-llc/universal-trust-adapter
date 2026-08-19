# dev.to Comment Monitor — Setup Guide

## What this does

A GitHub Actions workflow runs **every hour** and checks all your dev.to articles for new comments. When someone comments on any of your posts (and you haven't seen it yet), you get an **email at support@alicelabs.site** with:

- The commenter's username
- The article title and URL
- An excerpt of their comment
- A direct link to reply

You only get emailed when there's **new** activity — not every hour. The state is tracked in `.github/devto-state.json`.

## One-time setup (5 minutes)

### Step 1: Generate a Gmail App Password

The monitor sends emails through your Gmail account. For security, Gmail requires an "App Password" instead of your normal password.

1. Go to https://myaccount.google.com/security
2. Make sure **2-Step Verification** is enabled (required for App Passwords)
3. In the search bar, type "App passwords" or go to https://myaccount.google.com/apppasswords
4. Create a new app password with name "MarketNow Monitor"
5. Google will show you a 16-character password like `abcd efgh ijkl mnop`
6. **Copy this password** (you won't see it again) — remove the spaces

### Step 2: Add GitHub Secrets

Go to: https://github.com/alicelabs-llc/marketnow/settings/secrets/actions

Click "New repository secret" for each of these:

| Secret name | Value |
|---|---|
| `SMTP_USER` | `support@alicelabs.site` |
| `SMTP_PASS` | your 16-char Gmail App Password (no spaces) |
| `NOTIFY_EMAIL` | `support@alicelabs.site` (or any email you want notifications sent to) |
| `DEVTO_API_KEY` | `WYK9tdVMev3K7xwtbWxvkwNu` (already hardcoded as fallback, but add it as secret for security) |

### Step 3: Verify the workflow is enabled

Go to: https://github.com/alicelabs-llc/marketnow/actions/workflows/devto-monitor.yml

- The workflow runs automatically every hour at minute :00
- You can also click "Run workflow" to test it manually

## How it works

```
Every hour (cron: '0 * * * *')
    ↓
GitHub Actions runs scripts/devto-monitor.py
    ↓
Script fetches all your dev.to articles via API
    ↓
For each article, fetches all comments
    ↓
Compares against .github/devto-state.json (seen comment IDs)
    ↓
If NEW comments found:
    → Sends email to support@alicelabs.site
    → Updates .github/devto-state.json
    → Commits state back to repo
If no new comments:
    → Silently exits (no email)
```

## Testing the monitor

To run the monitor manually and verify the email works:

1. Go to https://github.com/alicelabs-llc/marketnow/actions/workflows/devto-monitor.yml
2. Click "Run workflow" → "Run workflow"
3. Wait ~2 minutes for the run to complete
4. Check the run logs — you should see:
   - "Authenticated as: @edison_flores_6d2cd381b13"
   - "Found N articles"
   - Either "NEW comments needing attention: N" or "No new comments"
5. If new comments: check your email at support@alicelabs.site

## Troubleshooting

### "Email failed: SMTPAuthenticationError"

- Your Gmail App Password is wrong or has spaces
- 2-Step Verification might not be enabled
- Re-generate the App Password and update the `SMTP_PASS` secret

### "HTTP 403 Forbidden Bots"

- dev.to sometimes rate-limits aggressive requests
- The script uses a proper User-Agent header to avoid this
- If it persists, the workflow will retry next hour

### "No new comments found" but you see comments on dev.to

- The state file (`.github/devto-state.json`) might be out of sync
- This is normal — the script only flags comments it hasn't seen before
- To re-notify on all comments: delete `.github/devto-state.json` and commit

### Workflow not running

- GitHub disables scheduled workflows on repos with no activity for 60 days
- To keep it active: commit something at least once a month
- You can also run it manually via "Run workflow" button

## Files

| File | Purpose |
|---|---|
| `scripts/devto-monitor.py` | The monitor script (Python) |
| `.github/workflows/devto-monitor.yml` | GitHub Actions workflow (runs hourly) |
| `.github/devto-state.json` | State file (tracks seen comment IDs) |
| `docs/DEVTO_MONITOR_SETUP.md` | This file |

## Cost

**Free.** GitHub Actions gives 2,000 free minutes/month for public repos. This workflow uses ~30 seconds per run × 24 runs/day × 30 days = ~360 minutes/month. Well within the free tier.
