#!/usr/bin/env python3
"""
Migrate _data/ to Supabase.

Reads all JSON files from _data/atc/, _data/mandates/, _data/quarantine_decisions/,
_data/sentinel_certificates/ and inserts them into the corresponding Supabase tables.

Usage:
  python3 scripts/migrate_to_supabase.py

Requires env vars:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
"""
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timezone

REPO = Path('/home/z/my-project/marketnow')

# Get env vars
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars required.")
    print("Set them first, then re-run this script.")
    sys.exit(1)

# Remove trailing slash
SUPABASE_URL = SUPABASE_URL.rstrip('/')

HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation,resolution=merge-duplicates',  # upsert
}


def supabase_insert(table, records):
    """Insert records into a Supabase table (upsert mode)."""
    if not records:
        return 0
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    body = json.dumps(records).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers=HEADERS, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
        return len(records)
    except urllib.error.HTTPError as e:
        err = e.read().decode('utf-8', errors='replace')[:300]
        print(f"  ❌ {table}: HTTP {e.code} - {err}")
        return 0
    except Exception as e:
        print(f"  ❌ {table}: {e}")
        return 0


def migrate_atc_cards():
    """Migrate _data/atc/*.json → atc_cards table."""
    print("\n=== Migrating ATC cards ===")
    atc_dir = REPO / '_data' / 'atc'
    if not atc_dir.exists():
        print(f"  SKIP: {atc_dir} does not exist")
        return 0

    files = sorted(atc_dir.glob('ATC-*.json'))
    print(f"  Found {len(files)} ATC card files")

    records = []
    for f in files:
        try:
            card = json.loads(f.read_text())
            payload = card.get('payload', {})
            signature = card.get('signature', {})
            trust = payload.get('trust', {})
            metadata = payload.get('metadata', {})

            records.append({
                'card_id': card.get('card_id'),
                'schema_version': payload.get('schema_version', '1.1.0'),
                'agent_id': payload.get('agent_id'),
                'agent_name': payload.get('agent_name'),
                'status': card.get('status', 'active'),
                'payload': payload,
                'signature': signature,
                'sentinel_review_score': trust.get('sentinel_review_score', 0),
                'sentinel_score': trust.get('sentinel_score', 0),
                'risk_level': trust.get('risk_level', 'not_audited'),
                'ca_key_id': signature.get('ca_key_id'),
                'canonicalization_method': signature.get('canonical_json'),
                'evidence_hash': signature.get('evidence_hash'),
                'policy_version': signature.get('policy_version'),
                'issued_at': metadata.get('issued_at'),
                'expires_at': metadata.get('expires_at'),
                'revoked_at': card.get('revoked_at'),
                'revocation_reason': card.get('revocation_reason'),
            })
        except Exception as e:
            print(f"  SKIP {f.name}: {e}")

    # Insert in batches of 50
    inserted = 0
    for i in range(0, len(records), 50):
        batch = records[i:i+50]
        inserted += supabase_insert('atc_cards', batch)
        print(f"  Batch {i//50 + 1}: {inserted}/{len(records)}")

    return inserted


def migrate_quarantine_decisions():
    """Migrate _data/quarantine_decisions/ → quarantine_decisions table."""
    print("\n=== Migrating quarantine decisions ===")
    qd_dir = REPO / '_data' / 'quarantine_decisions'
    if not qd_dir.exists():
        print(f"  SKIP: {qd_dir} does not exist")
        return 0

    files = sorted(qd_dir.rglob('*.json'))
    files = [f for f in files if f.name != 'MANIFEST.json']
    print(f"  Found {len(files)} quarantine decision files")

    records = []
    for f in files:
        try:
            d = json.loads(f.read_text())
            records.append({
                'decision_id': d.get('decision_id'),
                'decision_date': d.get('decision_date'),
                'skill_id': d.get('skill_id'),
                'skill_name': d.get('skill_name'),
                'skill_repo': d.get('skill_repo'),
                'sentinel_score': d.get('sentinel_score'),
                'sentinel_version': d.get('sentinel_version'),
                'layers_run': d.get('layers_run'),
                'layer_findings': d.get('layer_findings'),
                'decision': d.get('decision'),
                'decision_reason': d.get('decision_reason'),
                'decision_authority': d.get('decision_authority'),
                'sha256_artifact': d.get('sha256_artifact'),
                'record_sha256': d.get('record_sha256'),
                'appeal_status': d.get('appeal_status'),
                'appeal_decision': d.get('appeal_decision'),
                'appeal_decision_date': d.get('appeal_decision_date'),
                'appeal_reviewer': d.get('appeal_reviewer'),
                'appeal_reason': d.get('appeal_reason'),
            })
        except Exception as e:
            print(f"  SKIP {f.name}: {e}")

    inserted = supabase_insert('quarantine_decisions', records)
    return inserted


def migrate_sentinel_certificates():
    """Migrate _data/sentinel_certificates/*.json → sentinel_certificates table."""
    print("\n=== Migrating sentinel certificates ===")
    sc_dir = REPO / '_data' / 'sentinel_certificates'
    if not sc_dir.exists():
        print(f"  SKIP: {sc_dir} does not exist")
        return 0

    files = sorted(sc_dir.glob('*.json'))
    print(f"  Found {len(files)} sentinel certificate files")

    records = []
    for f in files:
        try:
            c = json.loads(f.read_text())
            records.append({
                'certificate_id': c.get('certificate_id') or c.get('skill_id'),
                'skill_id': c.get('skill_id'),
                'sentinel_score': c.get('sentinel_score', 0),
                'sentinel_version': c.get('sentinel_version', 'v2.5'),
                'layers_run': c.get('layers_run'),
                'layer_findings': c.get('layer_findings'),
                'issued_at': c.get('issued_at'),
                'expires_at': c.get('expires_at'),
                'signature': c.get('signature'),
                'ca_key_id': c.get('ca_key_id'),
                'evidence_hash': c.get('evidence_hash'),
                'artifact_sha256': c.get('artifact_sha256'),
                'metadata': c.get('metadata', {}),
            })
        except Exception as e:
            print(f"  SKIP {f.name}: {e}")

    inserted = supabase_insert('sentinel_certificates', records)
    return inserted


def main():
    print("=" * 70)
    print("MarketNow — Migrate _data/ to Supabase")
    print("=" * 70)
    print(f"Supabase URL: {SUPABASE_URL}")
    print(f"Started at: {datetime.now(timezone.utc).isoformat()}")

    # 1. Test connection
    print("\n=== Test connection ===")
    try:
        url = f"{SUPABASE_URL}/rest/v1/"
        req = urllib.request.Request(url, headers={'apikey': SUPABASE_SERVICE_KEY})
        with urllib.request.urlopen(req, timeout=10) as r:
            r.read()
        print("  ✅ Supabase reachable")
    except Exception as e:
        print(f"  ❌ Cannot connect: {e}")
        sys.exit(1)

    # 2. Migrate
    total_atc = migrate_atc_cards()
    total_qd = migrate_quarantine_decisions()
    total_sc = migrate_sentinel_certificates()

    # 3. Summary
    print("\n" + "=" * 70)
    print("MIGRATION SUMMARY")
    print("=" * 70)
    print(f"  ATC cards:               {total_atc}")
    print(f"  Quarantine decisions:    {total_qd}")
    print(f"  Sentinel certificates:   {total_sc}")
    print(f"  Total records migrated:  {total_atc + total_qd + total_sc}")
    print(f"\nNext: deploy to Vercel — the lambdas will now read from Supabase")
    print(f"instead of _data/ via the GitHub API.")


if __name__ == '__main__':
    main()
