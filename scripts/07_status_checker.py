#!/usr/bin/env python3
"""
MarketNow status checker
========================
Hits each MarketNow endpoint every 5 minutes, records latency + status,
writes /home/z/my-project/download/status/status.json for the status page.

Services monitored:
  - Website     https://www.marketnow.site/                  (200 OK, <2s)
  - Skills API  https://www.marketnow.site/api/skills.json    (200 OK, returns list)
  - Categories  https://www.marketnow.site/api/categories.json (200 OK, returns list)
  - Manifest    https://www.marketnow.site/api/manifest.json   (200 OK, has version field)

Status thresholds:
  - operational: 200 OK, latency < 3000ms, valid JSON shape
  - degraded:    200 OK but slow (>3000ms), or shape wrong
  - down:        non-200, timeout, or connection error

History: 90 days of samples (1 per 5min = ~25,920 samples)
  We store 1 sample per hour for 90 days (2160 samples) to keep file size small.

Deploy:
  - Run with cron every 5 minutes:
    */5 * * * * python3 /home/z/my-project/scripts/07_status_checker.py

  - Or with systemd timer:
    [Timer]
    OnCalendar=*:0/5
    Persistent=true
"""
import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

STATUS_FILE = "/home/z/my-project/download/status/status.json"
HISTORY_FILE = "/home/z/my-project/download/status/history.json"

SERVICES = [
    {
        "id": "website",
        "name": "Website (marketnow.site)",
        "url": "https://www.marketnow.site/",
        "expected_status": 200,
        "shape_check": None,
    },
    {
        "id": "skills_api",
        "name": "Skills API (/api/skills.json)",
        "url": "https://www.marketnow.site/api/skills.json",
        "expected_status": 200,
        "shape_check": "list",
    },
    {
        "id": "categories",
        "name": "Categories API (/api/categories.json)",
        "url": "https://www.marketnow.site/api/categories.json",
        "expected_status": 200,
        "shape_check": "list",
    },
    {
        "id": "manifest",
        "name": "Manifest API (/api/manifest.json)",
        "url": "https://www.marketnow.site/api/manifest.json",
        "expected_status": 200,
        "shape_check": "dict_with_version",
    },
]

LATENCY_DEGRADED_MS = 3000
LATENCY_DOWN_MS = 10000
TIMEOUT_SECONDS = 15


def check_service(svc):
    """Returns dict: status, latency_ms, last_check_ago, error"""
    start = time.time()
    try:
        req = urllib.request.Request(
            svc["url"],
            headers={"User-Agent": "MarketNowStatusChecker/1.0"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as r:
            status_code = r.status
            body = r.read()
        latency_ms = int((time.time() - start) * 1000)

        # Status code check
        if status_code != svc["expected_status"]:
            return {
                "status": "down",
                "latency_ms": latency_ms,
                "error": f"HTTP {status_code}",
            }

        # Shape check
        shape = svc["shape_check"]
        if shape:
            try:
                parsed = json.loads(body)
            except Exception as e:
                return {
                    "status": "down",
                    "latency_ms": latency_ms,
                    "error": f"Invalid JSON: {e}",
                }
            if shape == "list" and not isinstance(parsed, list):
                return {
                    "status": "degraded",
                    "latency_ms": latency_ms,
                    "error": f"Expected list, got {type(parsed).__name__}",
                }
            if shape == "dict_with_version" and not (isinstance(parsed, dict) and "version" in parsed):
                return {
                    "status": "degraded",
                    "latency_ms": latency_ms,
                    "error": "Missing 'version' field in manifest",
                }

        # Latency thresholds
        if latency_ms >= LATENCY_DOWN_MS:
            return {"status": "down", "latency_ms": latency_ms, "error": f"Latency {latency_ms}ms"}
        if latency_ms >= LATENCY_DEGRADED_MS:
            return {"status": "degraded", "latency_ms": latency_ms, "error": f"Slow latency {latency_ms}ms"}

        return {"status": "operational", "latency_ms": latency_ms, "error": None}

    except urllib.error.HTTPError as e:
        latency_ms = int((time.time() - start) * 1000)
        return {"status": "down", "latency_ms": latency_ms, "error": f"HTTP {e.code}: {e.reason}"}
    except urllib.error.URLError as e:
        latency_ms = int((time.time() - start) * 1000)
        return {"status": "down", "latency_ms": latency_ms, "error": f"URL error: {e.reason}"}
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        return {"status": "down", "latency_ms": latency_ms, "error": str(e)}


def load_history():
    """Load hourly history samples (90 days max)."""
    if not os.path.exists(HISTORY_FILE):
        return {}
    try:
        with open(HISTORY_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


def save_history(history):
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    with open(HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


def compute_uptime_90d(history_for_service):
    """Compute % of samples that were operational in last 90 days."""
    if not history_for_service:
        return 100.0  # No history = assume 100% (don't lie about being down)
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    cutoff_iso = cutoff.isoformat()
    recent = [s for s in history_for_service if s["date"] >= cutoff_iso]
    if not recent:
        return 100.0
    ok_count = sum(1 for s in recent if s["status"] == "ok")
    return round((ok_count / len(recent)) * 100, 2)


def history_to_days(history_for_service):
    """Aggregate hourly samples into daily buckets for the 90-day bar."""
    by_day = {}
    for sample in history_for_service:
        day = sample["date"][:10]  # YYYY-MM-DD
        if day not in by_day:
            by_day[day] = []
        by_day[day].append(sample)

    days = []
    today = datetime.now(timezone.utc).date()
    for i in range(89, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        samples = by_day.get(day, [])
        if not samples:
            days.append({"date": day, "status": "no-data", "latency_ms": None})
            continue
        # Day status = worst status of any sample that day
        if any(s["status"] == "down" for s in samples):
            status = "down"
        elif any(s["status"] == "degraded" for s in samples):
            status = "degraded"
        else:
            status = "ok"
        avg_latency = int(sum(s.get("latency_ms", 0) or 0 for s in samples) / len(samples))
        days.append({"date": day, "status": status, "latency_ms": avg_latency})

    return days


def main():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Running status check...")
    history = load_history()

    services_out = []
    skill_count = 0

    for svc in SERVICES:
        result = check_service(svc)
        svc_id = svc["id"]

        # Update hourly history
        if svc_id not in history:
            history[svc_id] = []

        now = datetime.now(timezone.utc)
        # Status string used in history: ok/degraded/down (matches what compute_uptime_90d expects)
        status_str = (
            "ok" if result["status"] == "operational"
            else result["status"]
        )

        # Only keep 1 sample per hour (the latest)
        hour_key = now.strftime("%Y-%m-%dT%H")
        history[svc_id] = [s for s in history[svc_id] if not s["date"].startswith(hour_key)]
        history[svc_id].append({
            "date": now.isoformat(),
            "status": status_str,
            "latency_ms": result["latency_ms"],
        })

        # Trim to 90 days
        cutoff = (now - timedelta(days=90)).isoformat()
        history[svc_id] = [s for s in history[svc_id] if s["date"] >= cutoff]

        # Compute uptime for display
        uptime_90d = compute_uptime_90d(history[svc_id])
        days_history = history_to_days(history[svc_id])

        # Special: pull skill_count from skills_api response
        if svc_id == "skills_api" and result["status"] == "operational":
            try:
                # Re-fetch just to get count (could cache from check_service, but simpler)
                req = urllib.request.Request(svc["url"], headers={"User-Agent": "MarketNowStatusChecker/1.0"})
                with urllib.request.urlopen(req, timeout=15) as r:
                    skills = json.loads(r.read())
                if isinstance(skills, list):
                    skill_count = len(skills)
            except Exception:
                pass

        services_out.append({
            "id": svc_id,
            "name": svc["name"],
            "url": svc["url"],
            "status": result["status"],
            "latency_ms": result["latency_ms"],
            "uptime_90d": uptime_90d,
            "history": days_history,
            "last_check_ago": "just now",
            "error": result["error"],
        })

        print(f"  {svc['name']:45} {result['status']:12} {result['latency_ms']:5}ms  uptime_90d={uptime_90d}%")

    save_history(history)

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "services": services_out,
        "skill_count": skill_count,
        "last_incident": "none",
        "version": "1.0",
    }

    os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
    with open(STATUS_FILE, "w") as f:
        json.dump(out, f, indent=2)

    print(f"\n✅ Wrote {STATUS_FILE}")
    print(f"   Services: {len(services_out)}")
    print(f"   Skills indexed: {skill_count}")


if __name__ == "__main__":
    main()
