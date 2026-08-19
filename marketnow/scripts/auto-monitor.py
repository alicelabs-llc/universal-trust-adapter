#!/usr/bin/env python3
# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# MarketNow — Auto-Monitor & Responder
# =====================================
#
# This script runs every hour via GitHub Actions and:
# 1. Monitors dev.to for new comments → sends email
# 2. Monitors GitHub issues for new comments → auto-responds or emails
# 3. Monitors npm download trends → alerts on drops
# 4. Monitors GitHub stars → celebrates milestones
# 5. Monitors marketnow.site uptime → alerts on downtime
# 6. Generates a daily activity report
#
# All state is persisted to .github/monitor-state.json

import json
import os
import sys
import smtplib
import urllib.request
import urllib.error
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import re

# ═══ Configuration ═══
DEVTO_API_KEY = os.environ.get('DEVTO_API_KEY', '')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', os.environ.get('GH_TOKEN', ''))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')
NOTIFY_EMAIL = os.environ.get('NOTIFY_EMAIL', 'support@alicelabs.site')
STATE_FILE = os.environ.get('STATE_FILE', '.github/monitor-state.json')
GITHUB_USERNAME = 'edgarfloresguerra2011-a11y'
DEVTO_USERNAME = 'edison_flores_6d2cd381b13'
NPM_PACKAGE = 'marketnow-mcp'
SITE_URL = 'https://marketnow.site'

# ═══ HTTP helpers ═══
def api_get(url, headers=None):
    req = urllib.request.Request(url)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    req.add_header('User-Agent', 'MarketNow-Monitor/2.0 (mailto:info@alicelabs.site)')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f'  Error GET {url[:60]}: {e}', file=sys.stderr)
        return None

def api_post(url, data, headers=None):
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST')
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    req.add_header('Content-Type', 'application/json')
    req.add_header('User-Agent', 'MarketNow-Monitor/2.0 (mailto:info@alicelabs.site)')
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f'  Error POST {url[:60]}: {e}', file=sys.stderr)
        return None

# ═══ State management ═══
def load_state():
    try:
        with open(STATE_FILE, 'r') as f:
            return json.load(f)
    except:
        return {
            'devto_seen_comments': {},
            'github_seen_comments': {},
            'npm_last_downloads': 0,
            'github_last_stars': 0,
            'last_report': None,
            'initialized_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

def save_state(state, force=False):
    """Save the state file.

    BUG FIX (15 Jul 2026): previously this was called unconditionally,
    which updated last_check every run, which made the workflow commit
    every hour. Now: only write the file if state actually changed
    (new comments seen, new stars, new npm downloads count, etc.)
    OR if force=True (e.g. first run).
    """
    if not force:
        # Compare current state to what's on disk
        try:
            with open(STATE_FILE, 'r') as f:
                old_state = json.load(f)
            # Compare the fields that matter (not last_check)
            fields_to_compare = [
                'devto_seen_comments', 'github_seen_comments',
                'npm_last_downloads', 'github_last_stars'
            ]
            changed = False
            for field in fields_to_compare:
                if old_state.get(field) != state.get(field):
                    changed = True
                    break
            if not changed:
                print('  No state changes — file unchanged (no commit).')
                return False
        except (FileNotFoundError, json.JSONDecodeError):
            # File doesn't exist — save it (first run)
            pass

    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    state['last_check'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)
    print(f'  State saved (will trigger commit)')
    return True

# ═══ Email ═══
def send_email(subject, html_body):
    if not SMTP_PASS:
        print(f'  ⚠ No SMTP_PASS — printing instead. Subject: {subject}')
        return False
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f'MarketNow Monitor <{SMTP_USER}>'
    msg['To'] = NOTIFY_EMAIL
    msg.attach(MIMEText(subject, 'plain'))
    msg.attach(MIMEText(html_body, 'html'))
    try:
        with smtplib.SMTP('smtp.gmail.com', 587, timeout=30) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, NOTIFY_EMAIL, msg.as_string())
        print(f'  ✓ Email sent: {subject}')
        return True
    except Exception as e:
        print(f'  ✗ Email failed: {e}', file=sys.stderr)
        return False

# ═══ 1. dev.to Monitor ═══
def check_devto(state):
    print('=== dev.to Monitor ===')
    alerts = []
    articles = api_get('https://dev.to/api/articles/me/all?per_page=50',
        headers={'api-key': DEVTO_API_KEY, 'Accept': 'application/vnd.forem.api+json'})
    if not articles:
        return alerts
    seen = state.get('devto_seen_comments', {})
    for article in articles:
        if article.get('comments_count', 0) == 0:
            continue
        comments = api_get(f'https://dev.to/api/comments?a_id={article["id"]}',
            headers={'api-key': DEVTO_API_KEY, 'Accept': 'application/vnd.forem.api+json'})
        if not comments or not isinstance(comments, list):
            continue
        for c in comments:
            cid = c.get('id_code', '')
            user = c.get('user', {}).get('username', '')
            if user == DEVTO_USERNAME or cid in seen:
                continue
            body = re.sub(r'<[^>]+>', '', c.get('body_html', ''))
            alerts.append({
                'type': 'devto_comment',
                'article_title': article['title'],
                'article_url': article['url'],
                'commenter': user,
                'comment': body[:300],
            })
            seen[cid] = {'article_id': article['id'], 'username': user}
            print(f'  🆕 dev.to: @{user} on "{article["title"][:40]}"')
    state['devto_seen_comments'] = seen
    return alerts

# ═══ 2. GitHub Monitor ═══
def check_github(state):
    print('=== GitHub Monitor ===')
    alerts = []
    gh = {'Authorization': f'token {GITHUB_TOKEN}', 'Accept': 'application/vnd.github+json'}
    since = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=3)).strftime('%Y-%m-%d')
    data = api_get(f'https://api.github.com/search/issues?q=author:{GITHUB_USERNAME}+type:issue+updated:>{since}&per_page=30&sort=updated&order=desc', headers=gh)
    if not data or 'items' not in data:
        return alerts
    seen = state.get('github_seen_comments', {})
    for issue in data['items']:
        if issue['comments'] == 0:
            continue
        repo = '/'.join(issue['repository_url'].split('/')[-2:])
        comments = api_get(f'https://api.github.com/repos/{repo}/issues/{issue["number"]}/comments?per_page=50', headers=gh)
        if not comments:
            continue
        for c in comments:
            cid = str(c.get('id', ''))
            user = c.get('user', {}).get('login', '')
            if user == GITHUB_USERNAME or 'bot' in user.lower() or 'actions' in user.lower() or 'triage' in user.lower():
                continue
            if cid in seen:
                continue
            alerts.append({
                'type': 'github_comment',
                'repo': repo,
                'issue_num': issue['number'],
                'issue_title': issue['title'],
                'issue_url': issue['html_url'],
                'commenter': user,
                'comment': c['body'][:400],
            })
            seen[cid] = {'repo': repo, 'issue_num': issue['number'], 'username': user}
            print(f'  🆕 GitHub: @{user} on {repo}#{issue["number"]}')
    state['github_seen_comments'] = seen
    return alerts

# ═══ 3. npm Monitor ═══
def check_npm(state):
    print('=== npm Monitor ===')
    alerts = []
    data = api_get(f'https://api.npmjs.org/downloads/point/last-week/{NPM_PACKAGE}')
    if not data:
        return alerts
    current = data.get('downloads', 0)
    previous = state.get('npm_last_downloads', 0)
    state['npm_last_downloads'] = current
    print(f'  npm downloads (7d): {current}')
    if previous > 0:
        pct = ((current - previous) / previous) * 100
        if pct < -20:
            alerts.append({'type': 'npm_drop', 'current': current, 'previous': previous, 'change_pct': round(pct, 1)})
        elif pct > 20:
            alerts.append({'type': 'npm_growth', 'current': current, 'previous': previous, 'change_pct': round(pct, 1)})
    return alerts

# ═══ 4. Stars Monitor ═══
def check_stars(state):
    print('=== Stars Monitor ===')
    alerts = []
    gh = {'Authorization': f'token {GITHUB_TOKEN}', 'Accept': 'application/vnd.github+json'}
    data = api_get(f'https://api.github.com/repos/{GITHUB_USERNAME}/marketnow', headers=gh)
    if not data:
        return alerts
    current = data.get('stargazers_count', 0)
    forks = data.get('forks_count', 0)
    previous = state.get('github_last_stars', 0)
    state['github_last_stars'] = current
    print(f'  Stars: {current} (forks: {forks})')
    if current > previous:
        alerts.append({'type': 'star_gained', 'current': current, 'previous': previous, 'forks': forks})
    for m in [5, 10, 25, 50, 100]:
        if previous < m <= current:
            alerts.append({'type': 'star_milestone', 'milestone': m, 'current': current})
    return alerts

# ═══ 5. Site Uptime ═══
def check_site(state):
    print('=== Site Uptime ===')
    alerts = []
    try:
        req = urllib.request.Request(SITE_URL)
        req.add_header('User-Agent', 'MarketNow-Monitor/2.0')
        with urllib.request.urlopen(req, timeout=15) as resp:
            print(f'  Site: {resp.getcode()} ✓')
    except Exception as e:
        alerts.append({'type': 'site_down', 'error': str(e)})
        print(f'  ✗ Site down: {e}')
    return alerts

# ═══ Report ═══
def generate_report(alerts, state):
    now = datetime.datetime.now(datetime.timezone.utc)
    total = len(alerts)
    subject = f'✅ MarketNow — All quiet' if total == 0 else f'🔔 MarketNow — {total} alert(s)'

    html = f"""<html><body style="font-family: sans-serif; max-width: 700px; margin: 0 auto; padding: 20px;">
<h2>📊 MarketNow Activity Report</h2>
<p style="color: #64748b; font-size: 13px;">{now.strftime('%Y-%m-%d %H:%M UTC')}</p>
<div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 4px 0;"><strong>npm downloads (7d):</strong> {state.get('npm_last_downloads', '?')}</p>
  <p style="margin: 4px 0;"><strong>GitHub stars:</strong> {state.get('github_last_stars', '?')}</p>
  <p style="margin: 4px 0;"><strong>New alerts:</strong> {total}</p>
</div>"""

    for a in alerts:
        if a['type'] == 'devto_comment':
            html += f'<div style="border-left: 4px solid #3b82f6; padding: 12px; margin: 12px 0; background: #f8fafc;"><p><strong>@{a["commenter"]}</strong> on dev.to: <em>{a["article_title"]}</em></p><p style="font-size: 14px; color: #475569;">{a["comment"][:200]}</p><p><a href="{a["article_url"]}" style="color: #3b82f6;">→ Reply</a></p></div>'
        elif a['type'] == 'github_comment':
            html += f'<div style="border-left: 4px solid #22c553; padding: 12px; margin: 12px 0; background: #f8fafc;"><p><strong>@{a["commenter"]}</strong> on {a["repo"]}#{a["issue_num"]}</p><p style="font-size: 14px; color: #475569;">{a["comment"][:200]}</p><p><a href="{a["issue_url"]}" style="color: #3b82f6;">→ Reply</a></p></div>'
        elif a['type'] == 'npm_drop':
            html += f'<p style="color: #ef4444;">⚠ npm downloads dropped {a["change_pct"]}% (from {a["previous"]} to {a["current"]})</p>'
        elif a['type'] == 'npm_growth':
            html += f'<p style="color: #22c553;">📈 npm downloads grew {a["change_pct"]}% (from {a["previous"]} to {a["current"]})</p>'
        elif a['type'] == 'star_gained':
            html += f'<p>⭐ New star! {a["previous"]} → {a["current"]} (forks: {a["forks"]})</p>'
        elif a['type'] == 'star_milestone':
            html += f'<p style="color: #f59e0b; font-size: 18px;">🎉 Milestone: {a["milestone"]} stars!</p>'
        elif a['type'] == 'site_down':
            html += f'<p style="color: #ef4444;">❌ Site down: {a["error"]}</p>'

    if total == 0:
        html += '<p style="color: #22c553;">✅ Everything is quiet. No new comments, no issues, site is up.</p>'

    html += '<hr><p style="font-size: 12px; color: #94a3b8;">Auto-generated by MarketNow Monitor (GitHub Actions, hourly). — info@alicelabs.site</p></body></html>'
    return subject, html

# ═══ Main ═══
def main():
    print(f'═══ MarketNow Auto-Monitor — {datetime.datetime.now(datetime.timezone.utc).isoformat()} ═══')
    state = load_state()
    all_alerts = []
    all_alerts.extend(check_devto(state))
    all_alerts.extend(check_github(state))
    all_alerts.extend(check_npm(state))
    all_alerts.extend(check_stars(state))
    all_alerts.extend(check_site(state))
    save_state(state)
    subject, html = generate_report(all_alerts, state)
    print(f'\n═══ Summary ═══')
    print(f'  Alerts: {len(all_alerts)}')
    print(f'  npm: {state.get("npm_last_downloads", "?")}')
    print(f'  Stars: {state.get("github_last_stars", "?")}')
    if all_alerts:
        send_email(subject, html)
    else:
        print(f'  ✅ No alerts — no email sent.')
    print(f'═══ Monitor complete ═══')
    return 0

if __name__ == '__main__':
    sys.exit(main())
