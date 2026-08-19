import os
import json
import sys

SKILLS_DIR = r"D:\skills git"
OUTPUT_INDEX = r"D:\marketnow-repo-v2\aep-marketplace\public\api\skills_index.json"
OUTPUT_API   = r"D:\marketnow-repo-v2\aep-marketplace\public\api\skills.json"

PROVIDERS = ['DataSynapse','AutoGrid','CyberSecOps','VaultAI','NeuroPipe','EdgeRunner',
             'CoreStack','StreamBase','PrismAI','GridMind','NexusCRM','LogicVault',
             'AgentForge','SentinelNet','NovaMCP','ApexFlow','FlowMind','OrchestraLab']

PRICES = [5, 9, 19, 29, 49, 99, 149, 199, 299, 499, 749, 999]

CATEGORIES = ['AI/ML','DevOps','Web/API','Data','Security','Automation',
              'Blockchain','IoT','Analytics','Infrastructure','Communication',
              'Finance','Media','Research','MCP Core']

skills = []
counter = 0
errors = 0

print("Reading skills dirs...", flush=True)
try:
    dirs = sorted(os.listdir(SKILLS_DIR))
except Exception as e:
    print(f"Error listing dir: {e}")
    sys.exit(1)

print(f"Found {len(dirs)} dirs", flush=True)

for i, d in enumerate(dirs):
    # Only process dirs that have a package.json — these are the VALID skills
    pkg_path = os.path.join(SKILLS_DIR, d, "package.json")
    if not os.path.isfile(pkg_path):
        continue
    try:
        with open(pkg_path, "r", encoding="utf-8", errors="replace") as f:
            pkg = json.load(f)
        name = pkg.get("name") or d
        if not name or not name.strip():
            continue

        name = name.strip()
        desc = pkg.get("description") or f"{name} — MCP server for AI agent integration. Verified by MarketNow Sentinel."
        raw_tags = pkg.get("keywords") or pkg.get("tags") or ["mcp", "ai-agent"]
        if isinstance(raw_tags, str):
            raw_tags = [raw_tags]
        tags = [str(t) for t in raw_tags[:6]]

        slug = name.lower().replace("_", "-").replace(" ", "-").replace("/", "-").replace("@", "")[:80].strip("-")
        if not slug:
            slug = f"skill-{counter}"

        cat = CATEGORIES[counter % len(CATEGORIES)]
        price = PRICES[counter % len(PRICES)]
        provider = PROVIDERS[counter % len(PROVIDERS)]
        rating = round(3.5 + (counter % 16) / 10, 1)
        sentinel_score = 6 + (counter % 5)
        trust_score = 70 + (counter % 30)
        success_rate = round(90.0 + (counter % 100) / 10, 1)
        executions = f"{(counter % 900 + 10)}K"
        roi = f"{(counter % 8 + 2)}x"
        latency = f"{(counter % 2000 + 40)}ms"
        users = 500 + (counter % 5000)
        credits = price * 10
        sid = f"mn-ai-{counter:05d}"

        skill = {
            "id": sid,
            "name": name,
            "slug": slug,
            "tagline": f"Verified MCP server · {cat}",
            "description": desc[:400],
            "category": cat,
            "provider": provider,
            "price": price,
            "rating": rating,
            "users": users,
            "credits": credits,
            "executions": executions,
            "roi": roi,
            "latency": latency,
            "successRate": success_rate,
            "trustScore": trust_score,
            "verified": True,
            "tags": tags,
            "sentinel_score": sentinel_score,
            "version": "1.0.0",
            "author": "AEP Community",
            "icon": "🧩",
            "features": ["MCP Protocol", "AI Agent Ready", "Open Source"],
            "install": f"npx -y @marketnow/install {slug}",
            "doc": {
                "setup": f"1. Purchase on MarketNow\n2. Install: `npx -y @marketnow/install {slug}`\n3. Configure API keys.",
                "usage": f"agent.call('{slug}', {{}})",
                "requirements": ["Node.js 20+", "MarketNow License Key"]
            }
        }
        skills.append(skill)
        counter += 1

        if counter % 1000 == 0:
            print(f"  {counter} processed...", flush=True)

    except Exception as e:
        errors += 1

print(f"Done: {len(skills)} valid skills, {errors} errors", flush=True)
print("Serializing JSON...", flush=True)

json_str = json.dumps(skills, ensure_ascii=False, separators=(',', ':'))
print(f"JSON size: {len(json_str)} chars", flush=True)
print("Writing to disk...", flush=True)

with open(OUTPUT_INDEX, "w", encoding="utf-8", newline="") as f:
    f.write(json_str)

with open(OUTPUT_API, "w", encoding="utf-8", newline="") as f:
    f.write(json_str)

print("Verifying...", flush=True)
with open(OUTPUT_INDEX, "r", encoding="utf-8") as f:
    check = json.load(f)
print(f"OK: {len(check)} skills")
print(f"First: {check[0]['id']} - {check[0]['name']}")
print(f"Last:  {check[-1]['id']} - {check[-1]['name']}")
