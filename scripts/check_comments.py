#!/usr/bin/env python3
"""Comprehensive audit of Dev.to comments — find NEW comments that need responses."""

import json
import urllib.request
import urllib.parse
from datetime import datetime

USERNAME = "edison_flores_6d2cd381b13"
API_BASE = "https://dev.to/api"

# Articles we've already responded to (by slug prefix or title prefix)
ALREADY_RESPONDED_PREFIXES = [
    "re-anp2network",
    "re-wrencalloway",
    "re-topstarai",
    "re-madshansen",
    "re-atc-verification",
    "replies-to-atc-feedback",
    "replies-to-security-architecture",
    "replies-to-community-feedback",
    "replies-to-ecosystem-feedback",
    "re-community-feedback",
    "re-acp-already-exists",
    "re-downloads-are-vanity",
    "re-translations-a-mano",
    "re-network-none",
]


def fetch_json(url):
    """Fetch JSON with proper User-Agent (Dev.to blocks default urllib)."""
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) MarketNow-Audit/1.0",
        "Accept": "application/json",
        "api-key": "WYK9tdVMev3K7xwtbWxvkwNu",
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def get_articles():
    """Get all our articles."""
    url = f"{API_BASE}/articles?username={USERNAME}&per_page=100"
    return fetch_json(url)


def get_comments(article_id):
    """Get all comments for an article."""
    url = f"{API_BASE}/comments?a_id={article_id}"
    try:
        return fetch_json(url)
    except Exception as e:
        return [{"error": str(e)}]


def get_article_by_slug(slug):
    """Get article details."""
    url = f"{API_BASE}/articles/{USERNAME}/{slug}"
    return fetch_json(url)


def main():
    print("=" * 80)
    print(" AUDITORÍA COMPLETA — DEV.TO COMMENTS + ESTADO COMUNIDAD")
    print("=" * 80)
    print()

    articles = get_articles()
    print(f"Total artículos publicados: {len(articles)}")
    print()

    # Group by published month
    print("Publicaciones por mes:")
    by_month = {}
    for a in articles:
        m = a.get("published_at", "?")[:7]
        by_month[m] = by_month.get(m, 0) + 1
    for m in sorted(by_month, reverse=True):
        print(f"  {m}: {by_month[m]} articles")
    print()

    # Find articles with comments
    articles_with_comments = [a for a in articles if a.get("comments_count", 0) > 0]
    print(f"Artículos con comentarios: {len(articles_with_comments)}")
    total_comments = sum(a.get("comments_count", 0) for a in articles)
    print(f"Total comentarios recibidos: {total_comments}")
    print()

    # For each article with comments, fetch them
    print("=" * 80)
    print("COMENTARIOS RECIENTES — ¿QUIÉN ESCRIBIÓ Y QUÉ DIJERON?")
    print("=" * 80)
    print()

    all_comments_data = []
    for a in sorted(articles_with_comments, key=lambda x: x.get("published_at", ""), reverse=True):
        art_id = a.get("id")
        art_title = a.get("title", "?")
        art_slug = a.get("slug", "")
        art_url = a.get("url", "")
        art_date = a.get("published_at", "?")[:10]

        comments = get_comments(art_id)
        if not comments or (len(comments) == 1 and "error" in comments[0]):
            continue

        print(f"─" * 80)
        print(f"📝 [{a.get('comments_count', 0)}c] {art_title[:75]}")
        print(f"   {art_url}")
        print(f"   publicado: {art_date}")
        print()

        for c in comments:
            user = c.get("user", {}).get("username", "?")
            created = c.get("created_at", "?")[:19]
            body = c.get("body_markdown", "").strip()
            cid = c.get("id_code", "?")
            # Truncate body
            body_short = body[:600]
            if len(body) > 600:
                body_short += "...[truncated]"

            print(f"  💬 @{user} wrote on {created} (id: {cid}):")
            # Indent each line of body
            for line in body_short.split("\n"):
                print(f"     {line}")
            print()

            all_comments_data.append({
                "article_id": art_id,
                "article_title": art_title,
                "article_url": art_url,
                "comment_id": cid,
                "user": user,
                "created_at": created,
                "body": body,
            })

    # Save all comments to JSON for analysis
    with open("/tmp/all_devto_comments.json", "w") as f:
        json.dump(all_comments_data, f, indent=2)
    print()
    print(f"[Saved {len(all_comments_data)} comments to /tmp/all_devto_comments.json]")

    # Find comments NOT YET responded to
    print()
    print("=" * 80)
    print("COMENTARIOS SIN RESPUESTA — NEED ATTENTION")
    print("=" * 80)
    print()

    # Our response articles (titles start with Re: or Replies to)
    response_articles = [a for a in articles if a.get("title", "").startswith(("Re:", "Replies to"))]
    print(f"Hemos publicado {len(response_articles)} artículos de respuesta.")
    print()

    # Get our response articles users
    responded_users = set()
    for r in response_articles:
        title = r.get("title", "")
        # Extract username from "Re: @username — ..."
        if "@" in title:
            user_part = title.split("@")[1].split(" ")[0].rstrip("—-:,")
            responded_users.add(user_part.lower())
    print(f"Usuarios a quienes ya respondimos: {responded_users}")
    print()

    # NEW comments in last 14 days that may need response
    print("─" * 80)
    print("Comentarios en últimos 14 días (pueden necesitar respuesta):")
    print("─" * 80)
    print()
    now = datetime.utcnow()
    for c in all_comments_data:
        try:
            cdate = datetime.fromisoformat(c["created_at"].replace("Z", "+00:00").replace("+00:00", ""))
            cdate = cdate.replace(tzinfo=None)
            days_ago = (now - cdate).days
        except:
            days_ago = 999
        if days_ago < 14:
            print(f"  [{days_ago}d ago] @{c['user']} on '{c['article_title'][:50]}'")
            print(f"     {c['body'][:200]}")
            print()


if __name__ == "__main__":
    main()
