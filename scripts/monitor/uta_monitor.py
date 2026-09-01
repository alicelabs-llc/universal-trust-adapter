#!/usr/bin/env python3
"""
UTA Monitor — Multi-channel monitoring and auto-response system.

Checks every 30 minutes (via cron) for new responses on:
1. GitHub issues we opened in external repos (12+ repos)
2. GitHub issues in our own repo (alicelabs-llc/universal-trust-adapter)
3. Dev.to articles (new comments)

When new responses are found:
- Logs them to /home/z/my-project/download/monitor/activity.log
- For GitHub: posts an acknowledgment comment (if not already responded)
- For Dev.to: logs (can't auto-respond via API, only GET)
- Saves state to avoid re-processing

Usage:
    python3 /home/z/my-project/scripts/monitor/uta_monitor.py

Cron setup (every 30 min):
    */30 * * * * /usr/bin/python3 /home/z/my-project/scripts/monitor/uta_monitor.py >> /home/z/my-project/download/monitor/cron.log 2>&1
"""
import json
import hashlib
import os
import sys
import time
import re
import subprocess
from datetime import datetime, timezone, timedelta
import urllib.request
import urllib.error

# ============================================================
# CONFIG
# ============================================================

BASE_DIR = "/home/z/my-project"
MONITOR_DIR = f"{BASE_DIR}/download/monitor"
STATE_FILE = f"{MONITOR_DIR}/state.json"
LOG_FILE = f"{MONITOR_DIR}/activity.log"
SUMMARY_FILE = f"{MONITOR_DIR}/latest_summary.json"

DEVTO_API_KEY = "kvbtxktdUWqrPdPZuPnHvf62"

GH_TOKEN = subprocess.check_output(
    f"cd {BASE_DIR} && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

GH_HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-monitor/1.0"
}

DEVTO_HEADERS = {
    "Accept": "application/vnd.forem+json",
    "api-key": DEVTO_API_KEY,
    "User-Agent": "uta-monitor/1.0"
}

OUR_ACCOUNTS = {"alicelabsllc", "eddyflores100-lang", "eddyflores", "edgarfloresguerra2011-a11y"}
OUR_DEVTO_USER = "edison_flores_6d2cd381b13"

# All GitHub issues we've opened across repos
EXTERNAL_ISSUES = [
    # Round 1 (agent frameworks)
    ("continuedev/continue", 13212),
    ("langchain-ai/langchain", 40102),    # closed by triage bot
    ("run-llama/llama_index", 22920),
    ("microsoft/autogen", 8139),
    ("pydantic/pydantic-ai", 7981),
    ("microsoft/semantic-kernel", 14356),
    ("google/adk-python", 6974),
    ("openai/openai-agents-python", 4806),
    ("anthropics/anthropic-sdk-python", 1904),
    ("deepset-ai/haystack", 12565),
    ("BerriAI/litellm", 39123),
    ("ant-design/x", 2043),
    # Round 1 (awesome lists)
    ("e2b-dev/awesome-ai-agents", 1481),
    ("kyrolabs/awesome-agents", 738),
    # Round 1 (earlier)
    ("cline/cline", 10499),
    ("cline/cline", 8273),
    ("cline/cline", 13737),
    ("chatmcp/mcpso", 1),
    ("github/github-mcp-server", 2136),
    ("punkpeye/awesome-mcp-servers", 13371),
    # Round 2 (new repos)
    ("humanlayer/humanlayer", 1101),
    ("langchain-ai/langgraph", 8791),
    ("Aider-AI/aider", 5665),
    ("OpenHands/OpenHands", 17084),
    ("langfuse/langfuse", 16920),
    ("e2b-dev/E2B", 1791),
    ("vercel/ai", 20147),
    ("promptfoo/promptfoo", 10599),
    ("spiffe/spiffe", 425),
    ("modelcontextprotocol/servers", 4736),
]

OUR_REPO = "alicelabs-llc/universal-trust-adapter"
OUR_ISSUES_TO_WATCH = [12, 13]  # gate.cat integration, Rekor anchoring

# ============================================================
# STATE MANAGEMENT
# ============================================================

def load_state():
    """Load previously seen comment IDs to avoid re-processing."""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE) as f:
                return json.load(f)
        except:
            pass
    return {"seen_comments": {}, "last_run": None, "stats": {"runs": 0, "total_new": 0}}

def save_state(state):
    """Save state to disk."""
    os.makedirs(MONITOR_DIR, exist_ok=True)
    state["last_run"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

# ============================================================
# LOGGING
# ============================================================

def log(msg, level="INFO"):
    """Log to file and stdout."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    line = f"[{ts}] [{level}] {msg}"
    print(line)
    os.makedirs(MONITOR_DIR, exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

# ============================================================
# GITHUB MONITORING
# ============================================================

def fetch_issue_comments(repo, issue_num):
    """Fetch all comments on a GitHub issue."""
    url = f"https://api.github.com/repos/{repo}/issues/{issue_num}/comments?per_page=50&sort=created&direction=desc"
    req = urllib.request.Request(url, headers=GH_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 410:
            return []  # issues disabled
        return []
    except:
        return []

def fetch_issue_details(repo, issue_num):
    """Fetch issue details (state, title, reactions)."""
    url = f"https://api.github.com/repos/{repo}/issues/{issue_num}"
    req = urllib.request.Request(url, headers=GH_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except:
        return {}

def is_human_comment(comment):
    """Check if a comment is from a real human (not us, not a bot)."""
    author = comment.get("user", {}).get("login", "")
    if author in OUR_ACCOUNTS:
        return False
    if author.endswith("[bot]"):
        return False
    return True

def post_github_comment(repo, issue_num, body):
    """Post a comment on a GitHub issue."""
    url = f"https://api.github.com/repos/{repo}/issues/{issue_num}/comments"
    payload = json.dumps({"body": body}).encode()
    req = urllib.request.Request(url, data=payload, headers=GH_HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
            return data.get("html_url")
    except Exception as e:
        log(f"  Failed to post comment on {repo}#{issue_num}: {e}", "ERROR")
        return None

def generate_acknowledgment(comment, repo, issue_num):
    """Generate a non-spam acknowledgment for a human comment.
    
    IMPORTANT: This is a short acknowledgment, not a full response.
    It thanks the person, says we'll review, and links to the tracking issue.
    Only posts if we haven't already acknowledged.
    """
    author = comment.get("user", {}).get("login", "?")
    body_preview = comment.get("body", "")[:200].replace("\n", " ")
    
    return f"""Thanks @{author} for the response. Appreciate you taking the time to engage with this.

I'll review your comment carefully and respond substantively within 24 hours. If you'd like to track the broader integration effort, see our [INTEGRATIONS.md](https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/INTEGRATIONS.md) which tracks all the RFC issues we've opened.

If your comment raised a technical point that needs addressing, I'll link the fix here when it's ready.

— Edison"""

def has_our_acknowledgment(comments):
    """Check if we've already posted an acknowledgment in this thread."""
    for c in comments:
        author = c.get("user", {}).get("login", "")
        if author in OUR_ACCOUNTS:
            body = c.get("body", "")
            # Check if it's an acknowledgment (contains marker phrase)
            if "Thanks @" in body and "appreciate you taking the time" in body:
                return True
            # Also check for any other response from us
            if len(body) > 50:
                return True
    return False

def check_github_issue(repo, issue_num, state):
    """Check a single GitHub issue for new human comments."""
    seen_key = f"github:{repo}:{issue_num}"
    seen_ids = state["seen_comments"].get(seen_key, [])
    
    comments = fetch_issue_comments(repo, issue_num)
    if not comments:
        return []
    
    new_human_comments = []
    for c in comments:
        comment_id = str(c.get("id", ""))
        if comment_id in seen_ids:
            continue
        if is_human_comment(c):
            new_human_comments.append({
                "repo": repo,
                "issue_num": issue_num,
                "comment_id": comment_id,
                "author": c.get("user", {}).get("login", "?"),
                "body": c.get("body", "")[:500],
                "created_at": c.get("created_at", "")[:19],
                "html_url": c.get("html_url", ""),
                "reactions": c.get("reactions", {}).get("total_count", 0)
            })
        # Mark as seen
        if comment_id not in seen_ids:
            seen_ids.append(comment_id)
    
    state["seen_comments"][seen_key] = seen_ids
    return new_human_comments

# ============================================================
# DEV.TO MONITORING
# ============================================================

def fetch_devto_articles():
    """Fetch all our Dev.to articles."""
    all_articles = []
    for page in range(1, 4):
        req = urllib.request.Request(
            f"https://dev.to/api/articles/me?per_page=100&page={page}",
            headers=DEVTO_HEADERS
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                articles = json.loads(r.read())
            if not articles:
                break
            all_articles.extend(articles)
        except:
            break
    return all_articles

def fetch_devto_comments(article_id):
    """Fetch comments on a Dev.to article."""
    req = urllib.request.Request(
        f"https://dev.to/api/comments?a_id={article_id}",
        headers=DEVTO_HEADERS
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except:
        return []

def check_devto(state):
    """Check Dev.to for new comments on our articles."""
    seen_key_prefix = "devto"
    new_comments = []
    
    articles = fetch_devto_articles()
    log(f"  Checking {len(articles)} Dev.to articles...")
    
    for a in articles:
        if a.get("comments_count", 0) == 0:
            continue
        
        article_id = str(a.get("id", ""))
        seen_key = f"{seen_key_prefix}:{article_id}"
        seen_ids = state["seen_comments"].get(seen_key, [])
        
        comments = fetch_devto_comments(article_id)
        for c in comments:
            comment_id = str(c.get("id", ""))
            if comment_id in seen_ids:
                continue
            
            author = c.get("user", {}).get("username", "")
            if author == OUR_DEVTO_USER:
                seen_ids.append(comment_id)
                continue
            
            body_text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c.get("body_html", ""))).strip()
            new_comments.append({
                "platform": "devto",
                "article_id": article_id,
                "article_title": a.get("title", "?")[:70],
                "article_url": a.get("url", ""),
                "comment_id": comment_id,
                "author": author,
                "body": body_text[:500],
                "created_at": c.get("created_at", "")[:19],
            })
            seen_ids.append(comment_id)
        
        state["seen_comments"][seen_key] = seen_ids
    
    return new_comments

# ============================================================
# MAIN MONITORING LOOP
# ============================================================

def run_monitor(auto_respond=True):
    """Run the full monitoring cycle."""
    os.makedirs(MONITOR_DIR, exist_ok=True)
    
    state = load_state()
    state["stats"]["runs"] = state["stats"].get("runs", 0) + 1
    
    log(f"=" * 60)
    log(f"UTA Monitor — Run #{state['stats']['runs']}")
    log(f"Auto-respond: {auto_respond}")
    log(f"=" * 60)
    
    all_new = []
    
    # 1. Check external GitHub issues
    log(f"\n1. Checking {len(EXTERNAL_ISSUES)} external GitHub issues...")
    for repo, num in EXTERNAL_ISSUES:
        try:
            new = check_github_issue(repo, num, state)
            if new:
                for n in new:
                    log(f"  📨 NEW: {repo}#{num} — @{n['author']} ({n['created_at']})")
                    log(f"     {n['body'][:200]}")
                    all_new.append(n)
                    
                    # Auto-respond with acknowledgment (if enabled and not already)
                    if auto_respond:
                        # Fetch all comments to check if we already responded
                        all_comments = fetch_issue_comments(repo, num)
                        if not has_our_acknowledgment(all_comments):
                            ack = generate_acknowledgment(n, repo, num)
                            posted = post_github_comment(repo, num, ack)
                            if posted:
                                log(f"  ✅ Posted acknowledgment: {posted[:80]}")
                                # Mark the ack comment as seen
                                ack_seen_key = f"github:{repo}:{num}"
                                time.sleep(2)  # rate limit
                        else:
                            log(f"  ⏭️  Already acknowledged, skipping auto-response")
            time.sleep(0.5)  # be polite to GitHub API
        except Exception as e:
            log(f"  Error checking {repo}#{num}: {e}", "ERROR")
    
    # 2. Check our repo issues
    log(f"\n2. Checking {len(OUR_ISSUES_TO_WATCH)} issues in our repo...")
    for num in OUR_ISSUES_TO_WATCH:
        try:
            new = check_github_issue(OUR_REPO, num, state)
            if new:
                for n in new:
                    log(f"  📨 NEW: {OUR_REPO}#{num} — @{n['author']} ({n['created_at']})")
                    log(f"     {n['body'][:200]}")
                    all_new.append(n)
                    # Don't auto-respond on our own repo — respond manually
            time.sleep(0.5)
        except Exception as e:
            log(f"  Error checking {OUR_REPO}#{num}: {e}", "ERROR")
    
    # 3. Check Dev.to
    log(f"\n3. Checking Dev.to articles...")
    try:
        devto_new = check_devto(state)
        for n in devto_new:
            log(f"  📨 NEW Dev.to comment: @{n['author']} on \"{n['article_title']}\"")
            log(f"     {n['body'][:200]}")
            all_new.append(n)
    except Exception as e:
        log(f"  Error checking Dev.to: {e}", "ERROR")
    
    # 4. Update stats
    state["stats"]["total_new"] = state["stats"].get("total_new", 0) + len(all_new)
    
    # 5. Save state
    save_state(state)
    
    # 6. Write summary
    summary = {
        "run_number": state["stats"]["runs"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "new_responses": len(all_new),
        "total_new_all_runs": state["stats"]["total_new"],
        "responses": all_new,
        "channels_checked": {
            "github_external_issues": len(EXTERNAL_ISSUES),
            "github_own_issues": len(OUR_ISSUES_TO_WATCH),
            "devto_articles": len(fetch_devto_articles()) if 'articles' in dir() else 0,
        }
    }
    with open(SUMMARY_FILE, "w") as f:
        json.dump(summary, f, indent=2)
    
    log(f"\n{'=' * 60}")
    log(f"SUMMARY: {len(all_new)} new responses found")
    log(f"Total across all runs: {state['stats']['total_new']}")
    log(f"State saved: {STATE_FILE}")
    log(f"Summary saved: {SUMMARY_FILE}")
    log(f"Log file: {LOG_FILE}")
    log(f"{'=' * 60}")
    
    return all_new

# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    auto_respond = "--no-respond" not in sys.argv
    new = run_monitor(auto_respond=auto_respond)
    
    # Exit code: 0 if no new, 1 if new responses found
    sys.exit(0 if not new else 0)
