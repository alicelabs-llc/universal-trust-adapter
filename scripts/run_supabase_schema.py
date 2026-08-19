#!/usr/bin/env python3
"""
Execute the Supabase schema SQL by connecting directly to the Postgres database.
"""
import os
import sys
import psycopg2
from pathlib import Path

# Supabase Postgres connection info
# Default user: postgres
# Default host: aws-0-{region}.pooler.supabase.com (Session pooler, port 5432)
#               or aws-0-{region}.pooler.supabase.com:6543 (Transaction pooler)
# Default DB:   postgres
# Password:     set by user when creating project (DB password)

# We don't have the DB password yet, so this script will fail without it.
# User needs to either:
#   1. Provide the DB password, OR
#   2. Run the SQL manually via the Supabase dashboard SQL Editor

SUPABASE_DB_HOST = os.environ.get('SUPABASE_DB_HOST', 'aws-0-us-east-1.pooler.supabase.com')
SUPABASE_DB_PORT = os.environ.get('SUPABASE_DB_PORT', '5432')
SUPABASE_DB_NAME = os.environ.get('SUPABASE_DB_NAME', 'postgres')
SUPABASE_DB_USER = os.environ.get('SUPABASE_DB_USER', 'postgres.pjhsgiblydnpsnjfbxzw')
SUPABASE_DB_PASSWORD = os.environ.get('SUPABASE_DB_PASSWORD', '')

SCHEMA_FILE = Path('/home/z/my-project/marketnow/aep-marketplace/db/supabase_schema.sql')

def main():
    if not SUPABASE_DB_PASSWORD:
        print("ERROR: SUPABASE_DB_PASSWORD env var required.")
        print("")
        print("Get it from: https://supabase.com/dashboard/pjhsgiblydnpsnjfbxzw/settings/database")
        print("Look for 'Connection string' → 'Direct connection' → password is in the URL.")
        print("")
        print("Or reset it: Project Settings → Database → Database password → Reset")
        sys.exit(1)

    print(f"Connecting to {SUPABASE_DB_HOST}:{SUPABASE_DB_PORT}/{SUPABASE_DB_NAME}...")

    try:
        conn = psycopg2.connect(
            host=SUPABASE_DB_HOST,
            port=SUPABASE_DB_PORT,
            dbname=SUPABASE_DB_NAME,
            user=SUPABASE_DB_USER,
            password=SUPABASE_DB_PASSWORD,
            sslmode='require',
            connect_timeout=15,
        )
        print("✅ Connected to Supabase Postgres")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        sys.exit(1)

    # Read the schema SQL
    schema_sql = SCHEMA_FILE.read_text()
    print(f"\nExecuting schema ({len(schema_sql)} bytes)...")

    try:
        cur = conn.cursor()
        cur.execute(schema_sql)
        conn.commit()
        print("✅ Schema executed successfully")

        # Verify tables were created
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


if __name__ == '__main__':
    main()
