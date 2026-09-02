#!/usr/bin/env python3
"""Execute the schema SQL in Supabase via direct Postgres connection."""
import psycopg2
from pathlib import Path
import sys
import os

# Connection info from user-provided URL
# postgresql://postgres:[REDACTED-ROTATE-SUPABASE-PASSWORD]@db.pjhsgiblydnpsnjfbxzw.supabase.co:5432/postgres
HOST = 'db.pjhsgiblydnpsnjfbxzw.supabase.co'
PORT = '5432'
DBNAME = 'postgres'
USER = 'postgres'
PASSWORD = 'Not@ria23202500'  # URL-decoded

SCHEMA_FILE = Path('/home/z/my-project/marketnow/aep-marketplace/db/supabase_schema.sql')

print(f"Connecting to {HOST}:{PORT}/{DBNAME} as {USER}...")

try:
    conn = psycopg2.connect(
        host=HOST, port=PORT, dbname=DBNAME,
        user=USER, password=PASSWORD,
        sslmode='require', connect_timeout=15,
    )
    print("✅ Connected to Supabase Postgres")
except Exception as e:
    print(f"❌ Connection failed: {e}")
    sys.exit(1)

schema_sql = SCHEMA_FILE.read_text()
print(f"\nExecuting schema ({len(schema_sql)} bytes)...")

try:
    cur = conn.cursor()
    cur.execute(schema_sql)
    conn.commit()
    print("✅ Schema executed successfully")
    
    # Verify
    cur.execute("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('atc_cards', 'mandates', 'quarantine_decisions',
                           'licenses', 'skills', 'trust_decisions', 'sentinel_certificates')
        ORDER BY table_name;
    """)
    tables = [r[0] for r in cur.fetchall()]
    print(f"\n✅ Tables created: {len(tables)}")
    for t in tables:
        print(f"   - {t}")
    cur.close()
except Exception as e:
    print(f"❌ Schema execution failed: {e}")
    conn.rollback()
    sys.exit(1)
finally:
    conn.close()

print("\n✅ DONE — Supabase schema is now active")
