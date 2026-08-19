#!/usr/bin/env python3
"""MarketNow ATC SDK — Free Agent Trust Card verification."""

import json
import requests

API_BASE = "https://marketnow.site"

def verify_trust(card_id):
    r = requests.get(f"{API_BASE}/api/atc?action=verify&card_id={card_id}", timeout=10)
    r.raise_for_status()
    return r.json()

def search_skills(query, max_price=0, limit=20):
    r = requests.get(f"{API_BASE}/api/search", params={"q": query, "max_price": max_price, "limit": limit}, timeout=10)
    r.raise_for_status()
    data = r.json()
    return data.get("skills", data) if isinstance(data, dict) else data

def submit_skill(repo_url, agent_id=None, email=None):
    r = requests.post(f"{API_BASE}/api/submit-skill", json={"repo_url": repo_url, "submitter_agent_id": agent_id, "submitter_email": email}, timeout=30)
    r.raise_for_status()
    return r.json()

def verify_receipt(receipt_id):
    r = requests.get(f"{API_BASE}/api/atc?action=verify-receipt&receipt_id={receipt_id}", timeout=10)
    r.raise_for_status()
    return r.json()

def verify_vibe_receipt():
    r = requests.get(f"{API_BASE}/api/atc?action=verify-vibe-receipt", timeout=15)
    r.raise_for_status()
    return r.json()

def mint_referral(agent_id):
    r = requests.post(f"{API_BASE}/api/referrals", json={"action": "mint", "agent_id": agent_id}, timeout=10)
    r.raise_for_status()
    return r.json()

def lookup_referral(ref_code):
    r = requests.get(f"{API_BASE}/api/referrals?action=lookup&ref_code={ref_code}", timeout=10)
    r.raise_for_status()
    return r.json()

def get_ca_public_key():
    r = requests.get(f"{API_BASE}/api/atc?action=ca-key", timeout=10)
    r.raise_for_status()
    return r.json()

def get_spec():
    r = requests.get(f"{API_BASE}/api/atc?action=spec", timeout=10)
    r.raise_for_status()
    return r.json()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("MarketNow ATC SDK — Free Agent Trust Card verification")
        print("Usage: python marketnow_atc.py verify <card_id> | search <q> | submit <url> | receipt <id> | vibe | ca-key | spec")
        sys.exit(0)
    cmd = sys.argv[1]
    if cmd == "verify" and len(sys.argv) > 2:
        print(json.dumps(verify_trust(sys.argv[2]), indent=2))
    elif cmd == "search" and len(sys.argv) > 2:
        for s in search_skills(sys.argv[2])[:10]:
            print(f"  {s.get('id')} | {s.get('name','')[:30]} | score={s.get('sentinel_score','?')}")
    elif cmd == "submit" and len(sys.argv) > 2:
        print(json.dumps(submit_skill(sys.argv[2]), indent=2))
    elif cmd == "receipt" and len(sys.argv) > 2:
        print(json.dumps(verify_receipt(sys.argv[2]), indent=2))
    elif cmd == "vibe":
        print(json.dumps(verify_vibe_receipt(), indent=2))
    elif cmd == "ca-key":
        print(json.dumps(get_ca_public_key(), indent=2))
    elif cmd == "spec":
        print(json.dumps(get_spec(), indent=2))
