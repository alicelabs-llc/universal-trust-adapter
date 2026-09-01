#!/usr/bin/env python3
"""Investigate gate.cat and BGMLAI fully."""
import json
import urllib.request
import subprocess
import base64
import re

GH_TOKEN = subprocess.check_output(
    "cd /home/z/my-project && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-investigator"
}

print("=" * 70)
print("INVESTIGACIÓN COMPLETA — gate.cat / BGMLAI / bogumi_jankiewicz")
print("=" * 70)

# 1. BGMLAI user info
print("\n=== 1. BGMLAI (user account) ===")
req = urllib.request.Request("https://api.github.com/users/BGMLAI", headers=HEADERS)
with urllib.request.urlopen(req, timeout=15) as r:
    d = json.loads(r.read())
print(f"  Login: @{d.get('login')}")
print(f"  Name: {d.get('name')}")
print(f"  Type: {d.get('type')}")
print(f"  Bio: {d.get('bio')}")
print(f"  Company: {d.get('company')}")
print(f"  Location: {d.get('location')}")
print(f"  Blog: {d.get('blog')}")
print(f"  Email: {d.get('email')}")
print(f"  Public repos: {d.get('public_repos')}")
print(f"  Followers: {d.get('followers')}")
print(f"  Following: {d.get('following')}")
print(f"  Created: {d.get('created_at','')[:19]}")
print(f"  Updated: {d.get('updated_at','')[:19]}")

# 2. All BGMLAI repos
print("\n=== 2. BGMLAI repos (all) ===")
req = urllib.request.Request(
    "https://api.github.com/users/BGMLAI/repos?per_page=100&sort=updated",
    headers=HEADERS
)
with urllib.request.urlopen(req, timeout=15) as r:
    repos = json.loads(r.read())
print(f"  Total: {len(repos)} repos")
for repo in repos:
    desc = (repo.get('description') or '')[:90]
    print(f"\n  {repo['full_name']}")
    print(f"    Stars: {repo.get('stargazers_count',0)}  Forks: {repo.get('forks_count',0)}  Lang: {repo.get('language','?')}")
    print(f"    Updated: {repo.get('updated_at','')[:19]}")
    print(f"    License: {repo.get('license',{}).get('name','?') if repo.get('license') else '?'}")
    if desc: print(f"    Desc: {desc}")
    print(f"    URL: {repo.get('html_url')}")

# 3. gate.cat commits
print("\n=== 3. gate.cat — commits recientes ===")
req = urllib.request.Request(
    "https://api.github.com/repos/BGMLAI/gate.cat/commits?per_page=10",
    headers=HEADERS
)
with urllib.request.urlopen(req, timeout=15) as r:
    commits = json.loads(r.read())
print(f"  Last {len(commits)} commits:")
for c in commits[:10]:
    msg = c.get('commit',{}).get('message','?').split('\n')[0][:80]
    date = c.get('commit',{}).get('author',{}).get('date','?')[:19]
    author = c.get('commit',{}).get('author',{}).get('name','?')
    print(f"  [{date}] {msg}")
    print(f"    by {author}")

# 4. gate.cat OBJECTIONS.md
print("\n=== 4. gate.cat — OBJECTIONS.md (bypass map) ===")
try:
    req = urllib.request.Request(
        "https://api.github.com/repos/BGMLAI/gate.cat/contents/OBJECTIONS.md",
        headers=HEADERS
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        d = json.loads(r.read())
    if 'content' in d:
        content = base64.b64decode(d['content']).decode('utf-8', errors='replace')
        print(content[:6000])
except Exception as e:
    print(f"  Error: {e}")

# 5. gate.cat pricing
print("\n=== 5. gate.cat — Pricing page ===")
try:
    req = urllib.request.Request("https://gate.cat/teams.html", headers={"User-Agent": "uta-checker"})
    with urllib.request.urlopen(req, timeout=15) as r:
        html = r.read().decode('utf-8', errors='replace')
    
    title = re.search(r'<title>(.*?)</title>', html)
    if title: print(f"  Title: {title.group(1)}")
    
    prices = re.findall(r'\$\d+(?:\.\d+)?(?:/mo|/month|/year)?', html)
    if prices: print(f"  Prices found: {prices[:8]}")
    
    plans = re.findall(r'<h[1-3][^>]*>(.*?)</h[1-3]>', html)
    if plans:
        print(f"  Headings:")
        for p in plans[:15]:
            clean = re.sub(r'<[^>]+>', '', p).strip()
            if clean: print(f"    {clean[:80]}")
except Exception as e:
    print(f"  Error: {e}")

# 6. gate.cat homepage
print("\n=== 6. gate.cat — Homepage ===")
try:
    req = urllib.request.Request("https://gate.cat", headers={"User-Agent": "uta-checker"})
    with urllib.request.urlopen(req, timeout=15) as r:
        html = r.read().decode('utf-8', errors='replace')
    
    title = re.search(r'<title>(.*?)</title>', html)
    if title: print(f"  Title: {title.group(1)}")
    
    # Extract meta description
    meta = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)', html)
    if meta: print(f"  Description: {meta.group(1)[:200]}")
    
    # Extract main headings
    plans = re.findall(r'<h[1-2][^>]*>(.*?)</h[1-2]>', html)
    if plans:
        print(f"  Main headings:")
        for p in plans[:10]:
            clean = re.sub(r'<[^>]+>', '', p).strip()
            if clean and len(clean) > 3: print(f"    {clean[:80]}")
except Exception as e:
    print(f"  Error: {e}")

# 7. PyPI stats
print("\n=== 7. gate.cat — PyPI download stats ===")
try:
    req = urllib.request.Request("https://pypistats.org/api/packages/gate.cat/recent")
    with urllib.request.urlopen(req, timeout=15) as r:
        d = json.loads(r.read())
    data = d.get('data',{})
    print(f"  Last 7 days: {data.get('last_week',0)} downloads")
    print(f"  Last 30 days: {data.get('last_month',0)} downloads")
except Exception as e:
    print(f"  Error: {e}")

# 8. gate.cat issues
print("\n=== 8. gate.cat — Issues abiertos ===")
req = urllib.request.Request(
    "https://api.github.com/repos/BGMLAI/gate.cat/issues?state=open&per_page=10",
    headers=HEADERS
)
with urllib.request.urlopen(req, timeout=15) as r:
    issues = json.loads(r.read())
print(f"  Open issues ({len(issues)}):")
for i in issues:
    author = i.get('user',{}).get('login','?')
    is_pr = 'PR' if i.get('pull_request') else 'ISSUE'
    print(f"  #{i['number']} [{is_pr}] by @{author}: {i['title'][:70]}")
    print(f"    {i.get('html_url','?')[:100]}")
    print(f"    Created: {i.get('created_at','?')[:19]}  Comments: {i.get('comments',0)}")

print("\n" + "=" * 70)
print("RESUMEN")
print("=" * 70)
