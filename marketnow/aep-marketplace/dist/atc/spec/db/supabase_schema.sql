-- ============================================================================
-- MarketNow — Supabase PostgreSQL Schema
-- ============================================================================
-- Replaces the _data/ directory (GitHub-backed JSON files) with a real
-- relational database. Eliminates the 5,000 req/hour GitHub API limit and
-- the race conditions (HTTP 409) on concurrent commits.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ATC Cards (replaces _data/atc/*.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS atc_cards (
  card_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL DEFAULT '2.0.0',
  agent_id TEXT NOT NULL,
  agent_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'pending')),
  payload JSONB NOT NULL,
  signature JSONB NOT NULL,
  sentinel_review_score INTEGER DEFAULT 0,
  sentinel_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'not_audited',
  ca_key_id TEXT,
  canonicalization_method TEXT DEFAULT 'RFC_8785_JCS',
  evidence_hash TEXT,
  policy_version TEXT,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atc_cards_agent_id ON atc_cards(agent_id);
CREATE INDEX IF NOT EXISTS idx_atc_cards_status ON atc_cards(status);
CREATE INDEX IF NOT EXISTS idx_atc_cards_expires_at ON atc_cards(expires_at);
CREATE INDEX IF NOT EXISTS idx_atc_cards_ca_key_id ON atc_cards(ca_key_id);

-- ============================================================================
-- Mandates (replaces _data/mandates/*.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS mandates (
  mandate_id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  principal_email TEXT,
  spending_limit_usd INTEGER NOT NULL CHECK (spending_limit_usd <= 500),
  per_purchase_cap_usd INTEGER NOT NULL CHECK (per_purchase_cap_usd <= 50),
  spent_usd INTEGER DEFAULT 0,
  notification_mode TEXT NOT NULL DEFAULT 'notify' CHECK (notification_mode IN ('notify', 'notify_and_veto', 'silent')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  tx_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_mandates_wallet ON mandates(wallet_address);
CREATE INDEX IF NOT EXISTS idx_mandates_expires_at ON mandates(expires_at);
CREATE INDEX IF NOT EXISTS idx_mandates_status ON mandates(
  CASE WHEN revoked_at IS NULL AND expires_at > NOW() THEN 'active'
       WHEN revoked_at IS NOT NULL THEN 'revoked'
       ELSE 'expired'
  END
);

-- ============================================================================
-- Quarantine Decisions (replaces _data/quarantine_decisions/)
-- ============================================================================
CREATE TABLE IF NOT EXISTS quarantine_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_date TIMESTAMPTZ NOT NULL,
  skill_id TEXT NOT NULL,
  skill_name TEXT,
  skill_repo TEXT,
  sentinel_score INTEGER,
  sentinel_version TEXT,
  layers_run JSONB,
  layer_findings JSONB,
  decision TEXT NOT NULL CHECK (decision IN ('quarantine', 'allow', 'warn')),
  decision_reason TEXT,
  decision_authority TEXT,
  reviewer TEXT DEFAULT 'automated',
  sha256_artifact TEXT,
  record_sha256 TEXT,
  appealable BOOLEAN DEFAULT TRUE,
  appeal_status TEXT CHECK (appeal_status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  appeal_decision TEXT CHECK (appeal_decision IN ('false_positive', 'confirmed', 'insufficient_evidence')),
  appeal_decision_date TIMESTAMPTZ,
  appeal_reviewer TEXT,
  appeal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quarantine_date ON quarantine_decisions(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_quarantine_skill ON quarantine_decisions(skill_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_decision ON quarantine_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_quarantine_appeal ON quarantine_decisions(appeal_status);

-- ============================================================================
-- License Keys (new — replaces the random-string license system)
-- ============================================================================
CREATE TABLE IF NOT EXISTS licenses (
  license_id TEXT PRIMARY KEY,
  license_token TEXT UNIQUE NOT NULL,  -- the Ed25519-signed JWT-like token
  skill_id TEXT NOT NULL,
  buyer_wallet TEXT NOT NULL,
  buyer_email TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  signature_algorithm TEXT DEFAULT 'Ed25519 (RFC 8032)',
  signature_value TEXT NOT NULL,
  ca_key_id TEXT NOT NULL,
  evidence_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_licenses_token ON licenses(license_token);
CREATE INDEX IF NOT EXISTS idx_licenses_skill ON licenses(skill_id);
CREATE INDEX IF NOT EXISTS idx_licenses_buyer ON licenses(buyer_wallet);

-- ============================================================================
-- Skills (the catalog — replaces _data/skills.json + skills-lite.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS skills (
  skill_id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  subcategory TEXT,
  author TEXT,
  author_wallet TEXT,
  repo_url TEXT,
  install_command TEXT,
  sentinel_score INTEGER DEFAULT 0,
  sentinel_version TEXT,
  review_status TEXT DEFAULT 'auto-scanned' CHECK (review_status IN ('auto-scanned', 'human-reviewed', 'maintainer-verified', 'quarantined')),
  risk_level TEXT DEFAULT 'not_audited',
  price_usd DECIMAL(10, 2) DEFAULT 0,
  free BOOLEAN DEFAULT TRUE,
  version TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_slug ON skills(slug);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_sentinel_score ON skills(sentinel_score DESC);
CREATE INDEX IF NOT EXISTS idx_skills_free ON skills(free);

-- ============================================================================
-- Trust Decisions (logs of /api/trust calls — for audit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust_decisions (
  decision_id TEXT PRIMARY KEY,
  decision_date TIMESTAMPTZ DEFAULT NOW(),
  decision TEXT NOT NULL CHECK (decision IN ('ALLOW', 'BLOCK', 'WARN')),
  rule_id TEXT,
  rule_fired_at TIMESTAMPTZ,
  policy_version TEXT,
  agent_id TEXT,
  skill_id TEXT,
  action TEXT,
  atc_card_id TEXT,
  inputs JSONB,
  reasons TEXT[],
  violations JSONB,
  evidence_hash TEXT,
  caller_ip TEXT,
  caller_user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_trust_decisions_date ON trust_decisions(decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_trust_decisions_agent ON trust_decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_trust_decisions_skill ON trust_decisions(skill_id);
CREATE INDEX IF NOT EXISTS idx_trust_decisions_decision ON trust_decisions(decision);

-- ============================================================================
-- Sentinel Certificates (replaces _data/sentinel_certificates/*.json)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sentinel_certificates (
  certificate_id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL,
  sentinel_score INTEGER NOT NULL,
  sentinel_version TEXT NOT NULL,
  layers_run JSONB,
  layer_findings JSONB,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  signature JSONB,
  ca_key_id TEXT,
  evidence_hash TEXT,
  artifact_sha256 TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sentinel_skill ON sentinel_certificates(skill_id);
CREATE INDEX IF NOT EXISTS idx_sentinel_score ON sentinel_certificates(sentinel_score DESC);

-- ============================================================================
-- Row Level Security (RLS) — public read, authenticated write
-- ============================================================================
ALTER TABLE atc_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_certificates ENABLE ROW LEVEL SECURITY;

-- Public can read non-sensitive data (anon role)
CREATE POLICY "public_read_atc_cards" ON atc_cards FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_skills" ON skills FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_quarantine" ON quarantine_decisions FOR SELECT TO anon USING (true);
CREATE POLICY "public_read_sentinel_certs" ON sentinel_certificates FOR SELECT TO anon USING (true);

-- Only authenticated (service role) can write
CREATE POLICY "service_write_atc_cards" ON atc_cards FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_mandates" ON mandates FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_quarantine" ON quarantine_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_licenses" ON licenses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_skills" ON skills FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_trust_decisions" ON trust_decisions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_write_sentinel_certs" ON sentinel_certificates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Mandates: owner can read their own mandates (via wallet_address match)
CREATE POLICY "owner_read_mandates" ON mandates FOR SELECT TO anon USING (
  wallet_address = current_setting('request.jwt.claim.wallet', true)
);

-- ============================================================================
-- Auto-update updated_at trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_atc_cards_updated_at BEFORE UPDATE ON atc_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_skills_updated_at BEFORE UPDATE ON skills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Auto-expire mandates (cron job — Supabase pg_cron)
-- ============================================================================
-- Requires: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('expire-mandates', '0 * * * *', 'UPDATE mandates SET revoked_at = NOW() WHERE expires_at < NOW() AND revoked_at IS NULL;');

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE atc_cards IS 'Agent Trust Cards (ATC v2.0) — replaces _data/atc/*.json. Ed25519-signed identity cards for AI agents.';
COMMENT ON TABLE mandates IS 'Delegated spending mandates — replaces _data/mandates/*.json. Caps spending at $500/mandate, $50/purchase.';
COMMENT ON TABLE quarantine_decisions IS 'Sentinel quarantine decisions — replaces _data/quarantine_decisions/. Tamper-evident, signed, auditable.';
COMMENT ON TABLE licenses IS 'Ed25519-signed license tokens — replaces random-string licenses. Offline-verifiable.';
COMMENT ON TABLE skills IS 'MCP skill catalog — replaces _data/skills.json. 9,248 skills indexed.';
COMMENT ON TABLE trust_decisions IS 'Audit log of /api/trust calls — replaces evidence records.';
COMMENT ON TABLE sentinel_certificates IS 'Sentinel audit certificates — replaces _data/sentinel_certificates/*.json.';
