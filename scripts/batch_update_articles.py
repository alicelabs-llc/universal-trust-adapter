#!/usr/bin/env python3
"""
Batch update all 62 Dev.to articles to replace broken GitHub URLs
with new working URLs in alicelabs-llc org.
"""
import json
import urllib.request
import time
import re

API_KEY = "WYK9tdVMev3K7xwtbWxvkwNu"
API_BASE = "https://dev.to/api"

# URL replacements (old → new)
REPLACEMENTS = [
    # Old flagged personal account → new org
    ("github.com/edgarfloresguerra2011-a11y/universal-trust-adapter",
     "github.com/alicelabs-llc/universal-trust-adapter"),
    ("github.com/edgarfloresguerra2011-a11y/marketnow",
     "github.com/alicelabs-llc/marketnow"),
    ("github.com/edgarfloresguerra2011-a11y/atc-verifier",
     "github.com/alicelabs-llc/atc-verifier"),
    ("github.com/edgarfloresguerra2011-a11y/atc-spec",
     "github.com/alicelabs-llc/atc-spec"),
    ("github.com/edgarfloresguerra2011-a11y/agent-trust-card",
     "github.com/alicelabs-llc/agent-trust-card"),
    ("github.com/edgarfloresguerra2011-a11y/marketnow-mcp-server",
     "github.com/alicelabs-llc/marketnow-mcp-server"),
    ("github.com/edgarfloresguerra2011-a11y/mcp-vault-server",
     "github.com/alicelabs-llc/mcp-vault-server"),
    ("github.com/edgarfloresguerra2011-a11y/ShieldMCP",
     "github.com/alicelabs-llc/ShieldMCP"),
    ("github.com/edgarfloresguerra2011-a11y/goldbean",
     "github.com/alicelabs-llc/goldbean"),
    ("github.com/edgarfloresguerra2011-a11y/OpenSAM",
     "github.com/alicelabs-llc/OpenSAM"),
    ("github.com/edgarfloresguerra2011-a11y/agentaffiliate-core",
     "github.com/alicelabs-llc/agentaffiliate-core"),
    ("github.com/edgarfloresguerra2011-a11y/awesome-mcp-servers",
     "github.com/alicelabs-llc/awesome-mcp-servers"),
    ("github.com/edgarfloresguerra2011-a11y/awesome-mcp",
     "github.com/alicelabs-llc/awesome-mcp"),
    # Old secondary account → new org
    ("github.com/eddyflores100-lang/universal-trust-adapter",
     "github.com/alicelabs-llc/universal-trust-adapter"),
    ("github.com/eddyflores100-lang/atc-verifier",
     "github.com/alicelabs-llc/atc-verifier"),
    ("github.com/eddyflores100-lang/atc-spec",
     "github.com/alicelabs-llc/atc-spec"),
    ("github.com/eddyflores100-lang/ai-profit-army",
     "github.com/alicelabs-llc/ai-profit-army"),
    ("github.com/eddyflores100-lang/NexusCold",
     "github.com/alicelabs-llc/NexusCold"),
    # raw.githubusercontent.com versions
    ("raw.githubusercontent.com/edgarfloresguerra2011-a11y",
     "raw.githubusercontent.com/alicelabs-llc"),
    ("raw.githubusercontent.com/eddyflores100-lang",
     "raw.githubusercontent.com/alicelabs-llc"),
]


def fetch_json(url, method="GET", data=None, max_retries=5):
    headers = {
        "User-Agent": "Mozilla/5.0 (MarketNow-Publisher/1.0)",
        "Accept": "application/json",
        "api-key": API_KEY,
        "Content-Type": "application/json",
    }
    last_err = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(url, method=method, headers=headers,
                                          data=json.dumps(data).encode() if data else None)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                # Rate limited — wait progressively longer
                wait = min(30, 5 * (attempt + 1))
                print(f"    [429 rate-limited, sleeping {wait}s...]")
                time.sleep(wait)
                continue
            else:
                raise
    raise last_err


def apply_replacements(body):
    """Apply all URL replacements to article body."""
    total_replacements = 0
    for old, new in REPLACEMENTS:
        count = body.count(old)
        if count > 0:
            body = body.replace(old, new)
            total_replacements += count
    return body, total_replacements


def update_article(article_id):
    """Fetch, transform, and update one article."""
    # Fetch full article as owner
    article = fetch_json(f"{API_BASE}/articles/{article_id}")
    body = article.get("body_markdown", "") or ""
    title = article.get("title", "")
    
    # Apply replacements
    new_body, n_replaced = apply_replacements(body)
    
    if n_replaced == 0:
        return {"id": article_id, "title": title, "status": "no_changes", "replacements": 0}
    
    # Update via PUT
    try:
        result = fetch_json(
            f"{API_BASE}/articles/{article_id}",
            method="PUT",
            data={"article": {"body_markdown": new_body}}
        )
        return {
            "id": article_id,
            "title": title[:70],
            "status": "updated",
            "replacements": n_replaced,
            "url": result.get("url"),
            "edited_at": result.get("edited_at")
        }
    except Exception as e:
        return {"id": article_id, "title": title[:70], "status": "error", "error": str(e)}


def main():
    # Load list of articles to update
    with open("/tmp/articles_to_update.json") as f:
        articles = json.load(f)
    
    print(f"=== Batch update {len(articles)} Dev.to articles ===\n")
    
    success = 0
    errors = 0
    total_replacements = 0
    
    for i, art in enumerate(articles, 1):
        aid = art["id"]
        title = art["title"]
        print(f"[{i}/{len(articles)}] Updating article {aid}: {title[:60]}")
        
        # Skip already-updated articles
        if aid <= 4181753:
            print(f"  → Skipping (already processed)")
            continue
        
        try:
            result = update_article(aid)
        except Exception as e:
            print(f"  ✗ FATAL Error: {e}")
            errors += 1
            # Long sleep after error
            time.sleep(30)
            continue
        
        if result["status"] == "updated":
            print(f"  ✓ Updated ({result['replacements']} replacements)")
            success += 1
            total_replacements += result["replacements"]
        elif result["status"] == "no_changes":
            print(f"  → No changes needed")
        else:
            print(f"  ✗ Error: {result.get('error','unknown')}")
            errors += 1
        
        # Sleep to respect rate limit (2s between requests)
        time.sleep(2)
    
    print()
    print(f"=== SUMMARY ===")
    print(f"  Articles updated: {success}/{len(articles)}")
    print(f"  Total URL replacements: {total_replacements}")
    print(f"  Errors: {errors}")


if __name__ == "__main__":
    main()
