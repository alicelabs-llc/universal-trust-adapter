-- ===========================================================================
-- MarketNow — Supabase schema (Phase 1 migration)
-- ===========================================================================
-- Replaces GitHub `_data/{atc,mandates,quarantine_decisions}` as the durable
-- store. Run this ENTIRE file once in the Supabase SQL Editor.
--
-- Conventions
--  * All tables use TEXT primary keys (natural keys from the existing JSON).
--  * JSONB columns mirror the v2 ATC structure (signatures array, evidence).
--  * Timestamps are TIMESTAMPTZ (UTC) for portability across Vercel regions.
--  * RLS is enabled on every table. Public read is granted only to the
--    inherently-public data (ATC cards + quarantine decisions). All writes
--    go through the service_role key server-side (RLS bypasses service_role
--    automatically, so no INSERT/UPDATE/DELETE policies are needed).
--  * Idempotent — `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- ATC cards (replaces _data/atc/*.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS atc_cards (
  card_id TEXT PRIMARY KEY,
  spec_version TEXT DEFAULT 'ATC/2.0',
  schema_version TEXT DEFAULT '2.0.0',
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  agent_owner TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'pending')),
  payload JSONB NOT NULL,
  signatures JSONB NOT NULL, -- v2: array of signatures (multi-sig)
  evidence_chain JSONB DEFAULT '[]'::jsonb, -- v2: tamper-evident evidence
  delegation JSONB, -- v2: optional delegation block
  sentinel_review_score INT DEFAULT 0,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atc_cards_agent_id ON atc_cards(agent_id);
CREATE INDEX IF NOT EXISTS idx_atc_cards_status ON atc_cards(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_atc_cards_expires_at ON atc_cards(expires_at);
CREATE INDEX IF NOT EXISTS idx_atc_cards_payload_gin ON atc_cards USING GIN(payload);

-- ---------------------------------------------------------------------------
-- Mandates (replaces _data/mandates/*.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mandates (
  mandate_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  spending_limit_usd INT NOT NULL CHECK (spending_limit_usd <= 500),
  per_purchase_cap_usd INT NOT NULL CHECK (per_purchase_cap_usd <= 50),
  spent_usd INT DEFAULT 0,
  notification_mode TEXT DEFAULT 'notify' CHECK (notification_mode IN ('notify', 'notify_and_veto', 'silent')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_mandates_wallet ON mandates(wallet_address);
CREATE INDEX IF NOT EXISTS idx_mandates_status ON mandates(expires_at) WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- Quarantine decisions (replaces _data/quarantine_decisions/)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quarantine_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_date TIMESTAMPTZ NOT NULL,
  skill_id TEXT NOT NULL,
  skill_name TEXT,
  skill_repo TEXT,
  sentinel_score INT,
  sentinel_version TEXT,
  layers_run JSONB DEFAULT '[]'::jsonb,
  layer_findings JSONB DEFAULT '[]'::jsonb,
  decision TEXT NOT NULL CHECK (decision IN ('quarantine', 'allow', 'warn')),
  decision_reason TEXT,
  decision_authority TEXT,
  reviewer TEXT DEFAULT 'automated',
  record_sha256 TEXT,
  appealable BOOLEAN DEFAULT TRUE,
  appeal_status TEXT,
  appeal_decision TEXT CHECK (appeal_decision IN ('approved', 'denied', 'pending') ),
  appeal_decision_date TIMESTAMPTZ,
  appeal_reviewer TEXT,
  appeal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qd_date ON quarantine_decisions(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_qd_skill ON quarantine_decisions(skill_id);
CREATE INDEX IF NOT EXISTS idx_qd_appeal ON quarantine_decisions(appeal_status) WHERE appeal_status IS NOT NULL;

-- ---------------------------------------------------------------------------
-- License keys (new — for Ed25519-signed offline licenses)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licenses (
  license_key TEXT PRIMARY KEY, -- format: MN-LIC-{base64url(header).base64url(payload).base64url(signature)}
  skill_id TEXT NOT NULL,
  buyer_wallet TEXT NOT NULL,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  license_payload JSONB NOT NULL,
  signature TEXT NOT NULL,
  algorithm TEXT DEFAULT 'Ed25519',
  ca_key_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_licenses_skill ON licenses(skill_id);
CREATE INDEX IF NOT EXISTS idx_licenses_buyer ON licenses(buyer_wallet);

-- ---------------------------------------------------------------------------
-- Trust decisions (audit log of every /api/trust call)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trust_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_date TIMESTAMPTZ DEFAULT NOW(),
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'BLOCK')),
  rule_id TEXT,
  policy_version TEXT,
  inputs JSONB NOT NULL, -- array of {name, value, content_address}
  reasons JSONB DEFAULT '[]'::jsonb,
  violations JSONB DEFAULT '[]'::jsonb,
  evidence_hash TEXT,
  caller_ip TEXT,
  caller_agent_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_td_date ON trust_decisions(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_td_decision ON trust_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_td_agent ON trust_decisions(caller_agent_id);

-- ---------------------------------------------------------------------------
-- Rate limit counters (mirror of Upstash Redis for fallback)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  counter_key TEXT PRIMARY KEY, -- e.g. "atc_issue:192.168.1.1:2026-08-19T15"
  count INT DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rl_expires ON rate_limit_counters(expires_at);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
-- Public read for ATC cards (they're public anyway) and quarantine decisions.
-- Writes only via service role key (server-side only). service_role bypasses
-- RLS automatically, so no INSERT/UPDATE/DELETE policies are required.
-- ===========================================================================

ALTER TABLE atc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Public read policies (anon role can SELECT from atc_cards and quarantine_decisions)
CREATE POLICY "atc_cards_public_read"
  ON atc_cards
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "quarantine_public_read"
  ON quarantine_decisions
  FOR SELECT
  TO anon
  USING (true);

-- All writes go through service_role (server-side only, no RLS check needed
-- for service_role — it bypasses RLS by default in Supabase).

-- ===========================================================================
-- updated_at trigger for atc_cards
-- ===========================================================================
-- Keeps the updated_at column in sync whenever a row changes, so we can
-- detect drift between Supabase and the legacy GitHub `_data/` mirror.
-- ===========================================================================

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_atc_cards_touch ON atc_cards;
CREATE TRIGGER trg_atc_cards_touch
  BEFORE UPDATE ON atc_cards
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

-- ===========================================================================
-- Done. Verify with:
--   \dt                              -- list tables
--   SELECT * FROM pg_policies;       -- list RLS policies
-- ===========================================================================
