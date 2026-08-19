#!/usr/bin/env python3
# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# MarketNow — dev.to Comment Monitor
# ===================================
#
# Monitors all dev.to articles by the authenticated user for new comments.
# When a new comment is detected (from anyone other than the author),
# sends an email notification to support@alicelabs.site.
#
# State is persisted to .github/devto-state.json so we only notify on NEW comments.
#
# Usage:
#   python3 scripts/devto-monitor.py
#
# Environment variables:
#   DEVTO_API_KEY     — dev.to API key (required)
#   SMTP_USER         — Gmail address for sending (e.g. support@alicelabs.site)
#   SMTP_PASS         — Gmail App Password (required for email notifications)
#   NOTIFY_EMAIL      — Recipient email (default: support@alicelabs.site)
#   GITHUB_TOKEN      — For committing state back to repo (optional, for local runs)
#
# Output:
#   - Prints activity report to stdout
#   - Sends email if new comments found
#   - Updates .github/devto-state.json

import json
import os
import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
import urllib.request
import urllib.error

# ═══════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════

DEVTO_API_KEY = os.environ.get('DEVTO_API_KEY', '')
SMTP_USER = os.environ.get('SMTP_USER', 'support@alicelabs.site')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
NOTIFY_EMAIL = os.environ.get('NOTIFY_EMAIL', 'support@alicelabs.site')

# dev.to API base
DEVTO_API = 'https://dev.to/api'

# State file — tracks which comments we've already seen
STATE_FILE = os.environ.get('STATE_FILE', '.github/devto-state.json')

# The author's dev.to username (we don't notify on our own comments)
# This is auto-detected from /api/users/me
AUTHOR_USERNAME = None

# ═══════════════════════════════════════════════════════════════════════════
# HTTP helper with proper User-Agent (dev.to blocks default urllib UA)
# ═══════════════════════════════════════════════════════════════════════════

def api_get(path):
    """GET request to dev.to API with proper headers."""
    url = f'{DEVTO_API}{path}'
    req = urllib.request.Request(url)
    req.add_header('api-key', DEVTO_API_KEY)
    req.add_header('Accept', 'application/vnd.forem.api+json')
    req.add_header('User-Agent', 'MarketNow-Monitor/1.0 (mailto:info@alicelabs.site)')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f'  HTTP {e.code} on {path}: {e.read().decode("utf-8", errors="replace")[:200]}', file=sys.stderr)
        return None
    except Exception as e:
        print(f'  Error on {path}: {e}', file=sys.stderr)
        return None


# ═══════════════════════════════════════════════════════════════════════════
# State management
# ═══════════════════════════════════════════════════════════════════════════

def load_state():
    """Load the state file. Returns a dict with seen comment IDs."""
    try:
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            'seen_comments': {},  # comment_id_code → {article_id, username, created_at}
            'last_check': None,
            'initialized_at': datetime.now(timezone.utc).isoformat(),
        }


def save_state(state, force=False):
    """Save the state file.

    BUG FIX (15 Jul 2026): previously this was called unconditionally at
    the end of main(), which updated `last_check` every run, which made
    the GitHub Actions workflow commit `chore: dev.to monitor state update`
    every hour — 92+ noisy commits in the git log over 8 days.

    Now: only save (and thus only commit) if either:
      - `force=True` (e.g. first run, or seen_comments changed), OR
      - the set of seen comment IDs changed since the last load.

    The `last_check` field is still updated in-memory for the email body,
    but it is NOT the trigger for a commit. The trigger is "did we see a
    new comment?", which is the actual purpose of this monitor.
    """
    if not force:
        # Compare current seen_comments to what's on disk
        try:
            with open(STATE_FILE, 'r') as f:
                old_state = json.load(f)
            old_seen = old_state.get('seen_comments', {})
            new_seen = state.get('seen_comments', {})
            if set(old_seen.keys()) == set(new_seen.keys()):
                # No new comments — don't save, don't trigger a commit.
                # We print last_check for the log, but the file on disk
                # stays untouched.
                print(f'  No new comments since last run — state file unchanged (no commit).')
                return False
        except (FileNotFoundError, json.JSONDecodeError):
            # State file doesn't exist or is corrupt — save it.
            pass

    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    state['last_check'] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)
    print(f'  State saved to {STATE_FILE} (will trigger commit)')
    return True


# ═══════════════════════════════════════════════════════════════════════════
# Email notification
# ═══════════════════════════════════════════════════════════════════════════

def strip_html(text):
    """Remove HTML tags for plain text email."""
    import re
    clean = re.sub(r'<[^>]+>', '', text)
    return clean.strip()


def send_email(new_comments, total_articles, total_comments):
    """Send email notification about new comments."""
    if not SMTP_PASS:
        print('  ⚠ SMTP_PASS not set — cannot send email. Printing report instead.')
        print_report(new_comments, total_articles, total_comments)
        return False

    subject = f'[{len(new_comments)} new] dev.to activity on your posts'

    # Build plain text body
    text_body = f"""MarketNow — dev.to Activity Report
Generated: {datetime.now(timezone.utc).isoformat()}

Summary:
- Articles monitored: {total_articles}
- Total comments across all articles: {total_comments}
- NEW comments since last check: {len(new_comments)}

═══ NEW COMMENTS ═══

"""
    for i, c in enumerate(new_comments, 1):
        text_body += f"""{i}. Comment by @{c['username']}
   Article: {c['article_title']}
   Posted: {c['created_at']}
   Article URL: {c['article_url']}
   Comment excerpt: {c['body_excerpt']}

"""

    text_body += f"""
═══ ACTIONS ═══

To reply to these comments:
1. Click the article URL above
2. Scroll to the comments section
3. Find the comment by @{c['username'] if new_comments else 'username'}
4. Click "Reply"

Or go to: https://dev.to/dashboard/comments

═══ ABOUT THIS EMAIL ═══

This email was sent by the MarketNow dev.to Monitor (GitHub Actions).
The monitor runs every hour. You only receive an email when there's new activity.

To stop these emails: disable the workflow at
https://github.com/edgarfloresguerra2011-a11y/marketnow/actions/workflows/devto-monitor.yml

— MarketNow Bot
info@alicelabs.site
"""

    # Build HTML body
    html_body = f"""<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
<h2 style="color: #0f172a;">📈 dev.to Activity Report</h2>
<p style="color: #64748b; font-size: 13px;">Generated: {datetime.now(timezone.utc).isoformat()}</p>

<div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 4px 0;"><strong>Articles monitored:</strong> {total_articles}</p>
  <p style="margin: 4px 0;"><strong>Total comments:</strong> {total_comments}</p>
  <p style="margin: 4px 0;"><strong>🆕 New comments since last check:</strong> {len(new_comments)}</p>
</div>

<h3 style="color: #0f172a;">═══ NEW COMMENTS ═══</h3>
"""
    for i, c in enumerate(new_comments, 1):
        html_body += f"""
<div style="border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; background: #f8fafc;">
  <p style="margin: 0 0 8px 0;"><strong>{i}. Comment by @{c['username']}</strong></p>
  <p style="margin: 4px 0; font-size: 14px; color: #475569;">
    <strong>Article:</strong> {c['article_title']}<br>
    <strong>Posted:</strong> {c['created_at']}<br>
    <strong>Excerpt:</strong> <em>{c['body_excerpt']}</em>
  </p>
  <p style="margin: 8px 0 0 0;">
    <a href="{c['article_url']}" style="color: #3b82f6; text-decoration: none;">→ Reply on dev.to →</a>
  </p>
</div>
"""

    html_body += f"""
<h3 style="color: #0f172a;">═══ ACTIONS ═══</h3>
<p>To reply to these comments:</p>
<ol>
  <li>Click the article link above</li>
  <li>Scroll to the comments section</li>
  <li>Find the comment and click "Reply"</li>
</ol>
<p>Or go to: <a href="https://dev.to/dashboard/comments">dev.to Dashboard → Comments</a></p>

<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
<p style="font-size: 12px; color: #94a3b8;">
This email was sent by the MarketNow dev.to Monitor (GitHub Actions).<br>
The monitor runs every hour. You only receive an email when there's new activity.<br><br>
— MarketNow Bot (info@alicelabs.site)
</p>
</body></html>"""

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'MarketNow Bot <{SMTP_USER}>'
    msg['To'] = NOTIFY_EMAIL
    msg.attach(MIMEText(text_body, 'plain'))
    msg.attach(MIMEText(html_body, 'html'))

    try:
        # Gmail SMTP
        with smtplib.SMTP('smtp.gmail.com', 587, timeout=30) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, NOTIFY_EMAIL, msg.as_string())
        print(f'  ✓ Email sent to {NOTIFY_EMAIL}')
        return True
    except Exception as e:
        print(f'  ✗ Email failed: {e}', file=sys.stderr)
        print_report(new_comments, total_articles, total_comments)
        return False


def print_report(new_comments, total_articles, total_comments):
    """Print report to stdout (fallback when email fails)."""
    print('')
    print('═══ ACTIVITY REPORT ═══')
    print(f'  Articles monitored: {total_articles}')
    print(f'  Total comments: {total_comments}')
    print(f'  NEW comments: {len(new_comments)}')
    print('')
    if new_comments:
        print('═══ NEW COMMENTS (need reply) ═══')
        for i, c in enumerate(new_comments, 1):
            print(f'  {i}. @{c["username"]} on "{c["article_title"][:50]}"')
            print(f'     Posted: {c["created_at"]}')
            print(f'     URL: {c["article_url"]}')
            print(f'     Excerpt: {c["body_excerpt"][:120]}')
            print('')
    else:
        print('  (no new comments since last check)')


# ═══════════════════════════════════════════════════════════════════════════
# Main monitoring logic
# ═══════════════════════════════════════════════════════════════════════════

def main():
    global AUTHOR_USERNAME

    if not DEVTO_API_KEY:
        print('::error::DEVTO_API_KEY env var required', file=sys.stderr)
        sys.exit(1)

    print('=== MarketNow dev.to Monitor ===')
    print(f'  Time: {datetime.now(timezone.utc).isoformat()}')
    print(f'  Notify: {NOTIFY_EMAIL}')
    print('')

    # 1. Get the authenticated user
    me = api_get('/users/me')
    if not me:
        print('::error::Failed to authenticate with dev.to API. Check DEVTO_API_KEY.', file=sys.stderr)
        sys.exit(1)
    AUTHOR_USERNAME = me['username']
    print(f'  Authenticated as: @{AUTHOR_USERNAME} (id={me["id"]})')
    print('')

    # 2. Load state
    state = load_state()
    seen = state.get('seen_comments', {})
    print(f'  Previously seen comments: {len(seen)}')
    print('')

    # 3. Fetch all articles
    articles = api_get('/articles/me/all?per_page=50')
    if not articles:
        print('::error::No articles found or API error.', file=sys.stderr)
        sys.exit(1)
    print(f'  Found {len(articles)} articles')

    # 4. For each article, fetch comments
    new_comments = []
    total_comments = 0

    for article in articles:
        article_id = article['id']
        article_title = article['title']
        article_url = article['url']
        comment_count = article.get('comments_count', 0)

        if comment_count == 0:
            continue

        print(f'  Checking: "{article_title[:50]}" ({comment_count} comments)')

        comments = api_get(f'/comments?a_id={article_id}')
        if not comments or not isinstance(comments, list):
            print(f'    ⚠ Could not fetch comments for article {article_id}')
            continue

        total_comments += len(comments)

        for comment in comments:
            comment_id = comment.get('id_code', '')
            username = comment.get('user', {}).get('username', 'unknown')
            created_at = comment.get('created_at', '')

            # Skip our own comments
            if username == AUTHOR_USERNAME:
                continue

            # Check if we've seen this comment before
            if comment_id in seen:
                continue

            # NEW comment!
            body_html = comment.get('body_html', '')
            body_text = strip_html(body_html)
            excerpt = body_text[:200] + ('...' if len(body_text) > 200 else '')

            new_comments.append({
                'comment_id': comment_id,
                'username': username,
                'created_at': created_at,
                'article_id': article_id,
                'article_title': article_title,
                'article_url': article_url,
                'body_excerpt': excerpt,
            })

            # Mark as seen
            seen[comment_id] = {
                'article_id': article_id,
                'article_title': article_title,
                'username': username,
                'created_at': created_at,
            }

            print(f'    🆕 NEW: @{username} said: {excerpt[:80]}...')

    print('')
    print(f'  Total comments across all articles: {total_comments}')
    print(f'  NEW comments needing attention: {len(new_comments)}')

    # 5. Save state — only if new comments were seen (BUG FIX above).
    # The function returns True if state was actually written to disk,
    # which the GitHub Actions workflow uses to decide whether to commit.
    state['seen_comments'] = seen
    state_written = save_state(state, force=bool(new_comments))

    # 6. Send email if there are new comments
    if new_comments:
        print('')
        print(f'  → Sending email notification to {NOTIFY_EMAIL}...')
        send_email(new_comments, len(articles), total_comments)
    else:
        print('')
        print('  ✓ No new comments. No email sent.')

    print('')
    print('=== Monitor complete ===')
    return 0


if __name__ == '__main__':
    sys.exit(main())
