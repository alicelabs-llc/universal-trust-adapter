#!/usr/bin/env python3
"""
UTA (Universal Trust Adapter) status checker
=============================================
Hits UTA's actual deployed endpoints on marketnow.site to verify the trust
translation API is alive and responding correctly.

Services monitored:
  - MarketNow Website     https://www.marketnow.site/                  (landing)
  - UTA API Root          https://www.marketnow.site/api/trust         (service info)
  - UTA Formats Endpoint  https://www.marketnow.site/api/trust?action=formats  (returns 5 formats)
  - MarketNow Skills API  https://www.marketnow.site/api/skills.json  (9k+ skills indexed, used by UTA for verification)
  - ATC Verify Endpoint   https://www.marketnow.site/api/atc          (Agent Trust Card verifier)

Status thresholds:
  - operational: 200 OK, latency < 3000ms, valid JSON shape
  - degraded:    200 OK but slow (>3000ms), or shape wrong
  - down:        non-200, timeout, or connection error
"""
import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

# Allow override via env vars for portability (GitHub Actions, local, etc.)
_DEFAULT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "download", "status")
_STATUS_DIR = os.environ.get("STATUS_DIR", _DEFAULT_DIR)
STATUS_FILE = os.path.join(_STATUS_DIR, "status.json")
HISTORY_FILE = os.path.join(_STATUS_DIR, "history.json")

SERVICES = [
    {
        "id": "website",
        "name": "MarketNow Website (landing)",
        "url": "https://www.marketnow.site/",
        "expected_status": 200,
        "shape_check": None,
    },
    {
        "id": "uta_root",
        "name": "UTA API — Root (/api/trust)",
        "url": "https://www.marketnow.site/api/trust",
        "expected_status": 200,
        "shape_check": "dict_with_service",
    },
    {
        "id": "uta_formats",
        "name": "UTA API — Formats (/api/trust?action=formats)",
        "url": "https://www.marketnow.site/api/trust?action=formats",
        "expected_status": 200,
        "shape_check": "dict_with_formats",
    },
    {
        "id": "skills_api",
        "name": "MarketNow Skills API (UTA verification source)",
        "url": "https://www.marketnow.site/api/skills.json",
        "expected_status": 200,
        "shape_check": "list",
    },
    {
        "id": "uta_pipeline",
        "name": "UTA API — Pipeline (/api/trust?action=pipeline)",
        "url": "https://www.marketnow.site/api/trust?action=pipeline",
        "expected_status": 200,
        "shape_check": "dict_with_pipeline",
    },
    {
        "id": "uta_revocation",
        "name": "UTA API — Revocation (/api/trust?action=revocation)",
        "url": "https://www.marketnow.site/api/trust?action=revocation",
        "expected_status": 200,
        "shape_check": "dict",
    },
]

LATENCY_DEGRADED_MS = 3000
LATENCY_DOWN_MS = 10000
TIMEOUT_SECONDS = 15


def check_service(svc):
    """Returns dict: status, latency_ms, error"""
    start = time.time()
    try:
        req = urllib.request.Request(
            svc["url"],
            headers={"User-Agent": "UTA-StatusChecker/1.0"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as r:
            status_code = r.status
            body = r.read()
        latency_ms = int((time.time() - start) * 1000)

        if status_code != svc["expected_status"]:
            return {
                "status": "down",
                "latency_ms": latency_ms,
                "error": f"HTTP {status_code}",
            }

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
            if shape == "dict" and not isinstance(parsed, dict):
                return {
                    "status": "degraded",
                    "latency_ms": latency_ms,
                    "error": f"Expected dict, got {type(parsed).__name__}",
                }
            if shape == "dict_with_service" and not (isinstance(parsed, dict) and "service" in parsed):
                return {
                    "status": "degraded",
                    "latency_ms": latency_ms,
                    "error": "Missing 'service' field in UTA root response",
                }
            if shape == "dict_with_formats" and not (isinstance(parsed, dict) and "formats" in parsed and isinstance(parsed["formats"], list)):
                return {
                    "status": "degraded",
                    "latency_ms": latency_ms,
                    "error": "Missing 'formats' list in UTA formats response",
                }
            if shape == "dict_with_pipeline" and not (isinstance(parsed, dict) and "pipeline" in parsed):
                return {
                    "status": "degraded",
                    "latency_ms": latency_ms,
                    "error": "Missing 'pipeline' field in UTA pipeline response",
                }

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
    if not history_for_service:
        return 100.0
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    cutoff_iso = cutoff.isoformat()
    recent = [s for s in history_for_service if s["date"] >= cutoff_iso]
    if not recent:
        return 100.0
    ok_count = sum(1 for s in recent if s["status"] == "ok")
    return round((ok_count / len(recent)) * 100, 2)


def history_to_days(history_for_service):
    by_day = {}
    for sample in history_for_service:
        day = sample["date"][:10]
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
    print(f"[{datetime.now(timezone.utc).isoformat()}] Running UTA status check...")
    history = load_history()

    services_out = []
    skill_count = 0
    formats_count = 0

    for svc in SERVICES:
        result = check_service(svc)
        svc_id = svc["id"]

        if svc_id not in history:
            history[svc_id] = []

        now = datetime.now(timezone.utc)
        status_str = (
            "ok" if result["status"] == "operational"
            else result["status"]
        )

        hour_key = now.strftime("%Y-%m-%dT%H")
        history[svc_id] = [s for s in history[svc_id] if not s["date"].startswith(hour_key)]
        history[svc_id].append({
            "date": now.isoformat(),
            "status": status_str,
            "latency_ms": result["latency_ms"],
        })

        cutoff = (now - timedelta(days=90)).isoformat()
        history[svc_id] = [s for s in history[svc_id] if s["date"] >= cutoff]

        uptime_90d = compute_uptime_90d(history[svc_id])
        days_history = history_to_days(history[svc_id])

        # Pull live data from specific endpoints
        if svc_id == "skills_api" and result["status"] == "operational":
            try:
                req = urllib.request.Request(svc["url"], headers={"User-Agent": "UTA-StatusChecker/1.0"})
                with urllib.request.urlopen(req, timeout=15) as r:
                    skills = json.loads(r.read())
                if isinstance(skills, list):
                    skill_count = len(skills)
            except Exception:
                pass

        if svc_id == "uta_formats" and result["status"] == "operational":
            try:
                req = urllib.request.Request(svc["url"], headers={"User-Agent": "UTA-StatusChecker/1.0"})
                with urllib.request.urlopen(req, timeout=15) as r:
                    data = json.loads(r.read())
                if isinstance(data, dict) and "formats" in data:
                    formats_count = len(data["formats"])
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

        print(f"  {svc['name']:55} {result['status']:12} {result['latency_ms']:5}ms  uptime_90d={uptime_90d}%")

    save_history(history)

    out = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "product": "Universal Trust Adapter (UTA) — by MarketNow",
        "ph_launch_url": "https://www.producthunt.com/products/uta-universal-trust-adapter?launch=uta-universal-trust-adapter",
        "services": services_out,
        "skill_count": skill_count,
        "formats_supported": formats_count,
        "last_incident": "none",
        "version": "1.0",
    }

    os.makedirs(os.path.dirname(STATUS_FILE), exist_ok=True)
    with open(STATUS_FILE, "w") as f:
        json.dump(out, f, indent=2)

    print(f"\n✅ Wrote {STATUS_FILE}")
    print(f"   Services: {len(services_out)}")
    print(f"   Skills indexed: {skill_count}")
    print(f"   UTA formats supported: {formats_count}")


if __name__ == "__main__":
    main()
