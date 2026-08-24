#!/usr/bin/env python3
"""Comprehensive audit — find NEW comments that need responses."""

import json
import urllib.request
import re
from datetime import datetime, timezone

USERNAME = "edison_flores_6d2cd381b13"
API_BASE = "https://dev.to/api"


def fetch_json(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) MarketNow-Audit/1.0",
        "Accept": "application/json",
        "api-key": "WYK9tdVMev3K7xwtbWxvkwNu",
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.load(resp)


def strip_html(s):
    """Crude HTML to text."""
    s = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>[^<]*</a>', r'\1', s)
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'")
    s = re.sub(r'\n\s*\n', '\n\n', s)
    return s.strip()


def get_articles():
    """Get all our articles, paginated."""
    all_articles = []
    page = 1
    while True:
        url = f"{API_BASE}/articles?username={USERNAME}&per_page=100&page={page}"
        try:
            data = fetch_json(url)
        except Exception as e:
            print(f"Error fetching page {page}: {e}")
            break
        if not data:
            break
        all_articles.extend(data)
        if len(data) < 100:
            break
        page += 1
    return all_articles


def get_comments(article_id):
    url = f"{API_BASE}/comments?a_id={article_id}"
    try:
        return fetch_json(url)
    except Exception as e:
        return []


def main():
    print("=" * 80)
    print(" AUDITORÍA COMPLETA — COMENTARIOS DEV.TO")
    print("=" * 80)
    print()

    articles = get_articles()
    print(f"Total artículos publicados: {len(articles)}")

    articles_with_comments = [a for a in articles if a.get("comments_count", 0) > 0]
    print(f"Artículos con comentarios: {len(articles_with_comments)}")

    total_comments = sum(a.get("comments_count", 0) for a in articles)
    print(f"Total comentarios recibidos: {total_comments}")
    print()

    # Find the latest response article published_at
    response_articles = [a for a in articles if a.get("title", "").startswith(("Re:", "Replies to"))]
    if response_articles:
        last_response_date = max(a.get("published_at", "").replace("Z", "") for a in response_articles)
        print(f"Fecha último artículo de respuesta: {last_response_date}")
    print()

    # Collect ALL comments with body
    all_comments = []
    for a in sorted(articles_with_comments, key=lambda x: x.get("published_at", ""), reverse=True):
        art_id = a.get("id")
        art_title = a.get("title", "?")
        art_url = a.get("url", "")
        art_slug = a.get("slug", "")
        art_date = a.get("published_at", "?")[:10]

        comments = get_comments(art_id)
        for c in comments:
            body_html = c.get("body_html", "")
            body_text = strip_html(body_html)
            user = c.get("user", {}).get("username", "?")
            user_name = c.get("user", {}).get("name", "?")
            created = c.get("created_at", "?")
            cid = c.get("id_code", "?")

            all_comments.append({
                "article_id": art_id,
                "article_title": art_title,
                "article_url": art_url,
                "article_slug": art_slug,
                "article_published_at": art_date,
                "comment_id": cid,
                "user": user,
                "user_name": user_name,
                "created_at": created,
                "body_text": body_text,
            })

    # Sort by created_at desc
    all_comments.sort(key=lambda c: c["created_at"], reverse=True)

    print("=" * 80)
    print(" TODOS LOS COMENTARIOS — ORDENADOS POR FECHA (más reciente primero)")
    print("=" * 80)
    print()

    for c in all_comments:
        print(f"─" * 80)
        print(f"📅 {c['created_at'][:19]}  💬 @{c['user']}  ({c['user_name']})")
        print(f"   in: {c['article_title'][:70]}")
        print(f"   article URL: {c['article_url']}")
        print(f"   comment id: {c['comment_id']}")
        print()
        # Show body up to 1000 chars
        body = c["body_text"]
        if len(body) > 1500:
            body = body[:1500] + "...[truncated]"
        for line in body.split("\n"):
            if line.strip():
                print(f"   | {line}")
        print()

    # Save to JSON
    with open("/tmp/all_devto_comments.json", "w") as f:
        json.dump(all_comments, f, indent=2)
    print(f"[Saved {len(all_comments)} comments to /tmp/all_devto_comments.json]")

    # Find comments posted AFTER Aug 23 (our last response date)
    print()
    print("=" * 80)
    print(" 🚨 COMENTARIOS POSTERIORES A 23 AGO 2026 — POSIBLEMENTE SIN RESPUESTA")
    print("=" * 80)
    print()
    cutoff = "2026-08-23T00:00:00"
    new_comments = [c for c in all_comments if c["created_at"] > cutoff]
    if not new_comments:
        print("   No hay comentarios posteriores a 23-Ago.")
        print("   Todos los comentarios están respondidos.")
    else:
        for c in new_comments:
            print(f"📅 {c['created_at'][:19]}  💬 @{c['user']}  ({c['user_name']})")
            print(f"   in: {c['article_title'][:70]}")
            print(f"   url: {c['article_url']}#comment-{c['comment_id']}")
            print()
            body = c["body_text"]
            if len(body) > 800:
                body = body[:800] + "...[truncated]"
            for line in body.split("\n"):
                if line.strip():
                    print(f"   | {line}")
            print()

    # Find ANY comment we haven't responded to (by user not in our responded list)
    print()
    print("=" * 80)
    print(" 📋 COMENTARIOS DE USUARIOS NO RESPONDIDOS (según artículo-tipo)")
    print("=" * 80)
    print()
    responded_users = {"wrencalloway", "anp2network", "topstar_ai", "mads_hansen_27b33ebfee4c9", "mads_hansen"}
    unresponded = [c for c in all_comments if c["user"] not in responded_users]
    if not unresponded:
        print("   Todos los comentarios son de usuarios ya respondidos.")
    else:
        for c in unresponded[:20]:
            print(f"📅 {c['created_at'][:10]}  💬 @{c['user']} ({c['user_name']})")
            print(f"   en: {c['article_title'][:60]}")
            body = c["body_text"]
            if len(body) > 400:
                body = body[:400] + "..."
            for line in body.split("\n")[:5]:
                if line.strip():
                    print(f"   | {line}")
            print()


if __name__ == "__main__":
    main()
