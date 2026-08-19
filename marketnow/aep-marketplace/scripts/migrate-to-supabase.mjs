#!/usr/bin/env node
/**
 * MarketNow — Phase 1 migration: GitHub `_data/` → Supabase
 * ========================================================
 *
 * Reads the existing JSON artifacts that are currently persisted to the
 * GitHub repo as files (the "database") and upserts them into Supabase
 * PostgreSQL so the API can serve reads from Supabase instead of the
 * GitHub Contents API.
 *
 * Sources (in priority order — first hit wins):
 *
 *   1. `_data/atc/*.json`                       → atc_cards
 *      fallback: `public/api/atc/*.json`       (local published mirror)
 *
 *   2. `_data/mandates/*.json`                 → mandates
 *      fallback: `public/api/mandates/*.json`  (if present)
 *
 *   3. `_data/quarantine_decisions/.../*.json`   → quarantine_decisions
 *      fallback: `public/_data/quarantine_decisions/.../*.json`
 *
 * Idempotent: every insert uses `.upsert()` on the natural primary key, so
 * re-running the script after fixing data simply overwrites the row.
 *
 * ---------------------------------------------------------------------------
 * Required environment variables
 * ---------------------------------------------------------------------------
 *   SUPABASE_URL           — e.g. https://abcdefghijklm.supabase.co
 *   SUPABASE_SERVICE_KEY    — service_role key (NOT anon) — needed for writes
 *                            with RLS enabled. NEVER expose this key to the
 *                            browser. The migration script runs locally /
 *                            in CI only.
 *
 * Optional:
 *   MIGRATION_DRY_RUN=1    — print what would be inserted, but skip the
 *                            actual upsert network calls.
 *   MIGRATION_BATCH_SIZE   — default 100. Supabase JS client has a soft
 *                            cap on per-request body size; batch to be safe.
 *
 * ---------------------------------------------------------------------------
 * Usage
 * ---------------------------------------------------------------------------
 *   # install dependency (one-time)
 *   npm install @supabase/supabase-js
 *
 *   # run
 *   node scripts/migrate-to-supabase.mjs
 *
 *   # dry run (no writes)
 *   MIGRATION_DRY_RUN=1 node scripts/migrate-to-supabase.mjs
 * ---------------------------------------------------------------------------
 */

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ─── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.env.MIGRATION_DRY_RUN === '1';
const BATCH_SIZE = parseInt(process.env.MIGRATION_BATCH_SIZE || '100', 10);

// Directories we look in. Order = priority; first hit wins.
const ATC_DIRS = [
  path.join(REPO_ROOT, '_data', 'atc'),
  path.join(REPO_ROOT, 'public', 'api', 'atc'),
];
const MANDATE_DIRS = [
  path.join(REPO_ROOT, '_data', 'mandates'),
  path.join(REPO_ROOT, 'public', 'api', 'mandates'),
];
const QUARANTINE_DIRS = [
  path.join(REPO_ROOT, '_data', 'quarantine_decisions'),
  path.join(REPO_ROOT, 'public', '_data', 'quarantine_decisions'),
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Recursively list every regular file in a directory. */
async function walkDir(dir) {
  let out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    if (err.code === 'ENOTDIR') return [];
    throw err;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out = out.concat(await walkDir(full));
    } else if (ent.isFile() && ent.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

/** Pick the first directory from candidates that exists and has files. */
async function resolveSource(candidates, label) {
  for (const dir of candidates) {
    const files = await walkDir(dir);
    if (files.length > 0) {
      console.log(`  [${label}] using ${dir} (${files.length} files)`);
      return files;
    }
  }
  console.log(`  [${label}] no source files found — skipping`);
  return [];
}

/** Read & parse a JSON file, returning null on failure (with warning). */
async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`    ! failed to parse ${path.relative(REPO_ROOT, filePath)}: ${err.message}`);
    return null;
  }
}

/** Upsert a batch of rows into a table. */
async function upsertBatch(supabase, table, rows) {
  if (rows.length === 0) return { inserted: 0, errors: [] };
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: Object.keys(rows[0])[0] });
  if (error) {
    return { inserted: 0, errors: [error] };
  }
  return { inserted: rows.length, errors: [] };
}

// ─── ATC card transformers ─────────────────────────────────────────────────

/**
 * Convert a v1 ATC JSON file (current shape on disk) into a row matching
 * the v2 `atc_cards` schema.
 *
 * v1 shape:
 *   { card_id, status, payload: { agent_id, agent_name, trust, metadata, ... },
 *     signature: { algorithm, value, signed_by, signed_at, ca_key_id, ... } }
 *
 * v2 row:
 *   signatures = [ signature ]   (wrapped in an array — multi-sig ready)
 *   issued_at  = payload.metadata.issued_at
 *   expires_at = payload.metadata.expires_at
 *   sentinel_review_score = payload.trust.sentinel_review_score ?? 0
 */
function atcFileToRow(file) {
  if (!file || !file.card_id || !file.payload) return null;

  const payload = file.payload || {};
  const meta = payload.metadata || {};
  const trust = payload.trust || {};

  // issued_at / expires_at are mandatory columns; skip if missing.
  const issuedAt = meta.issued_at || payload.issued_at;
  const expiresAt = meta.expires_at || payload.expires_at;
  if (!issuedAt || !expiresAt) {
    console.warn(`    ! ${file.card_id}: missing issued_at/expires_at — skipping`);
    return null;
  }

  // Wrap v1 single-signature block into a v2 signatures array.
  const signatures = file.signature
    ? [file.signature]
    : (Array.isArray(file.signatures) ? file.signatures : []);

  // Status: prefer top-level status, fall back to payload.status, default 'active'.
  const status = file.status || payload.status || 'active';

  const row = {
    card_id: file.card_id,
    spec_version: file.spec_version || payload.spec_version || 'ATC/2.0',
    schema_version: file.schema_version || payload.schema_version || '2.0.0',
    agent_id: payload.agent_id || file.agent_id || 'unknown',
    agent_name: payload.agent_name || file.agent_name || null,
    agent_owner: payload.agent_owner || file.agent_owner || null,
    status: ['active', 'revoked', 'expired', 'pending'].includes(status) ? status : 'active',
    payload: payload,
    signatures: signatures,
    evidence_chain: Array.isArray(file.evidence_chain) ? file.evidence_chain : [],
    delegation: file.delegation || payload.delegation || null,
    sentinel_review_score:
      typeof trust.sentinel_review_score === 'number'
        ? trust.sentinel_review_score
        : (typeof file.sentinel_review_score === 'number' ? file.sentinel_review_score : 0),
    issued_at: issuedAt,
    expires_at: expiresAt,
    revoked_at: status === 'revoked' ? (file.revoked_at || meta.revoked_at || null) : null,
    revocation_reason: status === 'revoked' ? (file.revocation_reason || meta.revocation_reason || null) : null,
  };
  return row;
}

// ─── Mandate transformer ───────────────────────────────────────────────────
function mandateFileToRow(file) {
  if (!file || !file.mandate_id) return null;
  return {
    mandate_id: file.mandate_id,
    wallet_address: file.wallet_address || file.wallet || '0xunknown',
    spending_limit_usd: Math.min(Number(file.spending_limit_usd ?? 0), 500),
    per_purchase_cap_usd: Math.min(Number(file.per_purchase_cap_usd ?? 0), 50),
    spent_usd: Number(file.spent_usd ?? 0),
    notification_mode: ['notify', 'notify_and_veto', 'silent'].includes(file.notification_mode)
      ? file.notification_mode
      : 'notify',
    expires_at: file.expires_at,
    created_at: file.created_at || undefined,
    revoked_at: file.revoked_at || null,
    revoked_by: file.revoked_by || null,
  };
}

// ─── Quarantine decision transformer ──────────────────────────────────────
function quarantineFileToRow(file) {
  if (!file || !file.decision_id) return null;
  return {
    decision_id: file.decision_id,
    decision_date: file.decision_date,
    skill_id: file.skill_id,
    skill_name: file.skill_name || null,
    skill_repo: file.skill_repo || null,
    sentinel_score: typeof file.sentinel_score === 'number' ? file.sentinel_score : null,
    sentinel_version: file.sentinel_version || null,
    layers_run: Array.isArray(file.layers_run) ? file.layers_run : [],
    layer_findings: Array.isArray(file.layer_findings) ? file.layer_findings : [],
    decision: file.decision,
    decision_reason: file.decision_reason || null,
    decision_authority: file.decision_authority || null,
    reviewer: file.reviewer || 'automated',
    record_sha256: file.record_sha256 || file.sha256_artifact || null,
    appealable: typeof file.appealable === 'boolean' ? file.appealable : true,
    appeal_status: file.appeal_status || null,
    appeal_decision: file.appeal_decision || null,
    appeal_decision_date: file.appeal_decision_date || null,
    appeal_reviewer: file.appeal_reviewer || null,
    appeal_reason: file.appeal_reason || null,
  };
}

// ─── Per-source migrators ──────────────────────────────────────────────────

async function migrateATCs(supabase) {
  console.log('\n— ATC cards —');
  const files = await resolveSource(ATC_DIRS, 'atc');
  const rows = [];
  for (const f of files) {
    // Skip the index file if present.
    const base = path.basename(f).toLowerCase();
    if (base === '_index.json' || base === 'index.json') continue;
    const parsed = await readJson(f);
    const row = atcFileToRow(parsed);
    if (row) rows.push(row);
  }
  console.log(`  prepared ${rows.length} rows`);

  if (DRY_RUN) {
    rows.slice(0, 3).forEach(r => console.log('  dry-run sample:', r.card_id, r.status));
    return { table: 'atc_cards', total: rows.length, inserted: 0, errors: [] };
  }

  const res = await upsertBatch(supabase, 'atc_cards', rows);
  console.log(`  upserted ${res.inserted} rows, ${res.errors.length} errors`);
  res.errors.forEach(e => console.error('    !', e.message));
  return { table: 'atc_cards', total: rows.length, ...res };
}

async function migrateMandates(supabase) {
  console.log('\n— Mandates —');
  const files = await resolveSource(MANDATE_DIRS, 'mandates');
  const rows = [];
  for (const f of files) {
    if (path.basename(f).toLowerCase() === 'mandates-info.json') continue;
    const parsed = await readJson(f);
    const row = mandateFileToRow(parsed);
    if (row) rows.push(row);
  }
  console.log(`  prepared ${rows.length} rows`);

  if (DRY_RUN) {
    rows.slice(0, 3).forEach(r => console.log('  dry-run sample:', r.mandate_id));
    return { table: 'mandates', total: rows.length, inserted: 0, errors: [] };
  }

  const res = await upsertBatch(supabase, 'mandates', rows);
  console.log(`  upserted ${res.inserted} rows, ${res.errors.length} errors`);
  res.errors.forEach(e => console.error('    !', e.message));
  return { table: 'mandates', total: rows.length, ...res };
}

async function migrateQuarantine(supabase) {
  console.log('\n— Quarantine decisions —');
  const files = await resolveSource(QUARANTINE_DIRS, 'quarantine');
  const rows = [];
  for (const f of files) {
    // Skip MANIFEST.json / README.md (already filtered by extension, but be safe).
    const base = path.basename(f).toLowerCase();
    if (base === 'manifest.json' || base === 'readme.md') continue;
    const parsed = await readJson(f);
    const row = quarantineFileToRow(parsed);
    if (row) rows.push(row);
  }
  console.log(`  prepared ${rows.length} rows`);

  if (DRY_RUN) {
    rows.slice(0, 3).forEach(r => console.log('  dry-run sample:', r.decision_id, r.decision));
    return { table: 'quarantine_decisions', total: rows.length, inserted: 0, errors: [] };
  }

  const res = await upsertBatch(supabase, 'quarantine_decisions', rows);
  console.log(`  upserted ${res.inserted} rows, ${res.errors.length} errors`);
  res.errors.forEach(e => console.error('    !', e.message));
  return { table: 'quarantine_decisions', total: rows.length, ...res };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=========================================');
  console.log(' MarketNow — Phase 1 migration to Supabase');
  console.log('=========================================');
  console.log(`  dry_run    : ${DRY_RUN}`);
  console.log(`  batch_size : ${BATCH_SIZE}`);
  console.log(`  repo_root  : ${REPO_ROOT}`);

  // In dry-run mode we skip the Supabase bootstrap entirely so the script
  // can be used as a "can the migration see my data?" smoke test even
  // before @supabase/supabase-js is installed and env vars are configured.
  let supabase = null;
  if (!DRY_RUN) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('\nERROR: Missing required env vars.');
      console.error('  SUPABASE_URL         =', SUPABASE_URL ? '<set>' : '<missing>');
      console.error('  SUPABASE_SERVICE_KEY =', SUPABASE_SERVICE_KEY ? '<set>' : '<missing>');
      console.error('\nSee docs/SUPABASE_SETUP.md for how to obtain them.');
      console.error('\n(Or run with MIGRATION_DRY_RUN=1 to validate without Supabase.)');
      process.exit(2);
    }

    let createClient;
    try {
      ({ createClient } = await import('@supabase/supabase-js'));
    } catch (err) {
      console.error('\nERROR: @supabase/supabase-js is not installed.');
      console.error('  Run:  npm install @supabase/supabase-js');
      process.exit(3);
    }

    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const results = [];
  results.push(await migrateATCs(supabase));
  results.push(await migrateMandates(supabase));
  results.push(await migrateQuarantine(supabase));

  console.log('\n=========================================');
  console.log(' Migration summary');
  console.log('=========================================');
  for (const r of results) {
    const status = DRY_RUN ? 'DRY-RUN' : `${r.inserted}/${r.total} upserted`;
    const errs = r.errors.length > 0 ? ` (${r.errors.length} errors)` : '';
    console.log(`  ${r.table.padEnd(22)} : ${status}${errs}`);
  }
  console.log('');

  const totalErrors = results.reduce((a, r) => a + r.errors.length, 0);
  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
