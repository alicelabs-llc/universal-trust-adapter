#!/usr/bin/env node
/**
 * MarketNow — Deep Audit All Skills (One by One)
 * ===============================================
 *
 * Reviews every single skill in the catalog individually, running the
 * full 10-layer Sentinel audit. Takes as long as it takes — could be
 * hours. Designed to run in GitHub Actions with 120-minute timeout.
 *
 * What it does differently from the existing batch audit:
 *   - Runs L1.5-L1.9 (including L1.7 binary detection + L1.9 prompt injection)
 *   - For skills with GitHub repos: fetches the README and scans it
 *   - Generates individual certificates with per-layer findings
 *   - Moves quarantined skills to _data/quarantine/
 *
 * Usage:
 *   node scripts/deep-audit-all-skills.mjs              # audit all
 *   node scripts/deep-audit-all-skills.mjs --max 100     # first 100
 *   node scripts/deep-audit-all-skills.mjs --start 500   # start from #500
 *
 * Env:
 *   SENTINEL_CERT_SECRET — signing secret (required)
 *   GITHUB_TOKEN — for fetching READMEs from GitHub
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { runL16, SEMGREP_RULES, SECRET_PATTERNS } from '../aep-marketplace/lib/sentinel-l16.mjs';
import { runL17, MALWARE_PATTERNS } from '../aep-marketplace/lib/sentinel-l17.mjs';
import { runL18, MALWARE_FAMILIES } from '../aep-marketplace/lib/sentinel-l18.mjs';
import { runL19, INJECTION_RULES } from '../aep-marketplace/lib/sentinel-l19.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');

const SKILLS_PATH = path.join(REPO_ROOT, 'aep-marketplace', 'public', 'api', 'skills_index.json');
const CERTS_DIR = path.join(REPO_ROOT, '_data', 'sentinel_certificates');
const QUARANTINE_DIR = path.join(REPO_ROOT, '_data', 'quarantine');
const PROGRESS_FILE = path.join(REPO_ROOT, '_data', 'deep-audit-progress.json');

const CERT_SECRET = process.env.SENTINEL_CERT_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.MANDATES_GITHUB_TOKEN;

if (!CERT_SECRET) {
  console.error('✗ SENTINEL_CERT_SECRET env var is required');
  process.exit(1);
}

// Ensure dirs
fs.mkdirSync(CERTS_DIR, { recursive: true });
fs.mkdirSync(QUARANTINE_DIR, { recursive: true });

// CLI args
const args = process.argv.slice(2);
const MAX_ARG = args.indexOf('--max');
const START_ARG = args.indexOf('--start');
const MAX_SKILLS = MAX_ARG > -1 ? parseInt(args[MAX_ARG + 1], 10) : 0;
const START_INDEX = START_ARG > -1 ? parseInt(args[START_ARG + 1], 10) : 0;

// Load skills
const skills = JSON.parse(fs.readFileSync(SKILLS_PATH, 'utf8'));
console.log(`\nMarketNow — Deep Audit (One by One)`);
console.log(`====================================`);
console.log(`Total skills: ${skills.length}`);
console.log(`Starting from: ${START_INDEX}`);
console.log(`Max skills: ${MAX_SKILLS || 'ALL'}`);
console.log(``);

// Load progress (for resuming)
let progress = { last_index: START_INDEX, audited: 0, quarantined: 0, errors: 0, started_at: new Date().toISOString() };
if (fs.existsSync(PROGRESS_FILE)) {
  try {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    console.log(`Resuming from index ${progress.last_index} (previously audited: ${progress.audited})`);
  } catch {}
}

// Deduplicate
const seen = new Set();
const targets = [];
for (const s of skills) {
  if (seen.has(s.id)) continue;
  if (s.slug && seen.has(s.slug)) continue;
  seen.add(s.id);
  if (s.slug) seen.add(s.slug);
  targets.push(s);
}

const endIndex = MAX_SKILLS > 0 ? Math.min(progress.last_index + MAX_SKILLS, targets.length) : targets.length;
console.log(`Auditing skills ${progress.last_index} to ${endIndex} (${endIndex - progress.last_index} skills)\n`);

const startTime = Date.now();

// ─── Fetch README from GitHub ────────────────────────────────────────────
async function fetchReadme(repoUrl) {
  if (!repoUrl || !repoUrl.includes('github.com')) return null;
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  if (!match) return null;
  const repo = match[1].replace(/\.git$/, '');
  const url = `https://raw.githubusercontent.com/${repo}/main/README.md`;
  try {
    const headers = { 'User-Agent': 'marketnow-sentinel' };
    if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (res.status === 404) {
      // Try master branch
      const url2 = `https://raw.githubusercontent.com/${repo}/master/README.md`;
      const res2 = await fetch(url2, { headers, signal: AbortSignal.timeout(5000) });
      if (!res2.ok) return null;
      return await res2.text();
    }
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Generate certificate ──────────────────────────────────────────────
function generateCertificate(skill, auditResult) {
  const cert = {
    certificate_id: `MN-SC-2026-${String(Math.abs(crypto.createHash('md5').update(skill.id).digest('hex').slice(0, 7))).padStart(7, '0')}`,
    skill_id: skill.id,
    skill_name: skill.name,
    timestamp: new Date().toISOString(),
    auditor: 'Sentinel L1.5 + L1.6 + L1.7 + L1.8 + L1.9 (Deep Individual Audit)',
    overall_score: auditResult.overallScore,
    max_score: 10,
    risk_level: auditResult.riskLevel,
    risk_breakdown: auditResult.riskBreakdown,
    quarantine_recommended: auditResult.quarantineRecommended,
    layers_run: auditResult.layersRun,
    checks: auditResult.checks,
    source: skill.source,
    signature: {
      algorithm: 'SHA-256',
      value: crypto.createHmac('sha256', CERT_SECRET).update(JSON.stringify(auditResult)).digest('hex'),
      signed_by: 'Sentinel Deep Auditor',
    },
  };
  return cert;
}

// ─── Audit a single skill ──────────────────────────────────────────────
async function auditSkill(skill) {
  const caps = skill.capabilities || {};
  const setup = skill.doc?.setup || {};
  const sentinel = skill.sentinel || {};
  const prompt = skill.doc?.system_prompt || '';
  const tags = skill.tags || [];
  const desc = skill.description || '';
  const allText = `${skill.name} ${desc} ${tags.join(' ')} ${prompt}`.toLowerCase();

  let overallScore = 10;
  const checks = [];
  let criticalCount = 0, highCount = 0, mediumCount = 0;

  // ── L1.5: Metadata checks ──
  const requiredEnv = setup.required_env || [];
  if (requiredEnv.length > 0) {
    checks.push({ name: 'L1.5 AUTH', status: 'pass', risk: 'low', detail: `Requires ${requiredEnv.length} env var(s)` });
  } else {
    checks.push({ name: 'L1.5 AUTH', status: 'warning', risk: 'medium', detail: 'No auth required' });
    mediumCount++;
  }

  // ── L1.6: Semgrep + Secrets + OSV ──
  const l16 = await runL16(skill);
  checks.push({ name: 'L1.6 SEMGREP', status: l16.findings.semgrep.length > 0 ? 'fail' : 'pass', risk: l16.findings.total_critical > 0 ? 'critical' : 'low', detail: `${SEMGREP_RULES.length} rules, ${l16.findings.semgrep.length} findings` });
  checks.push({ name: 'L1.6 SECRETS', status: l16.findings.secrets.length > 0 ? 'fail' : 'pass', risk: l16.findings.total_critical > 0 ? 'critical' : 'low', detail: `${SECRET_PATTERNS.length} patterns, ${l16.findings.secrets.length} findings` });
  criticalCount += l16.findings.total_critical;
  highCount += l16.findings.total_high;
  mediumCount += l16.findings.total_medium;

  // ── L1.7: Binary & malware detection ──
  const l17 = await runL17(skill);
  if (l17.findings.binary_files.length > 0 || l17.findings.launcher_scripts.length > 0) {
    checks.push({ name: 'L1.7 BINARY', status: 'fail', risk: 'critical', detail: `${l17.findings.binary_files.length} binaries, ${l17.findings.launcher_scripts.length} launchers` });
    criticalCount += l17.findings.binary_files.length + l17.findings.launcher_scripts.length;
  } else {
    checks.push({ name: 'L1.7 BINARY', status: 'pass', risk: 'low', detail: 'No binaries or launchers detected' });
  }
  if (l17.findings.malware_patterns.length > 0) {
    checks.push({ name: 'L1.7 MALWARE', status: 'fail', risk: l17.findings.total_critical > 0 ? 'critical' : 'high', detail: `${l17.findings.malware_patterns.length} malware patterns` });
    criticalCount += l17.findings.total_critical;
    highCount += l17.findings.total_high;
  } else {
    checks.push({ name: 'L1.7 MALWARE', status: 'pass', risk: 'low', detail: `${MALWARE_PATTERNS.length} patterns checked, 0 findings` });
  }

  // ── L1.8: Malware family signatures ──
  // Fetch README for deeper scan
  const readme = await fetchReadme(skill.source?.url);
  const l18 = runL18(skill, { packageText: readme });
  if (l18.findings.matched_families.length > 0) {
    checks.push({ name: 'L1.8 FAMILIES', status: 'fail', risk: 'critical', detail: `${l18.findings.matched_families.length} malware families matched: ${l18.findings.matched_families.map(f => f.family).join(', ')}` });
    criticalCount += l18.findings.total_critical;
    highCount += l18.findings.total_high;
  } else {
    checks.push({ name: 'L1.8 FAMILIES', status: 'pass', risk: 'low', detail: `${MALWARE_FAMILIES.length} families checked, 0 matches${readme ? ' (README scanned)' : ''}` });
  }

  // ── L1.9: Prompt injection defense ──
  const l19 = runL19(skill);
  if (l19.findings.injections.length > 0) {
    checks.push({ name: 'L1.9 INJECTION', status: 'fail', risk: l19.findings.total_critical > 0 ? 'critical' : 'high', detail: `${l19.findings.injections.length} injection patterns: ${l19.findings.injections.map(i => i.category).join(', ')}` });
    criticalCount += l19.findings.total_critical;
    highCount += l19.findings.total_high;
    mediumCount += l19.findings.total_medium;
  } else {
    checks.push({ name: 'L1.9 INJECTION', status: 'pass', risk: 'low', detail: `${INJECTION_RULES.length} rules checked, 0 injections` });
  }

  // ── Calculate score ──
  overallScore -= criticalCount * 4;
  overallScore -= highCount * 2;
  overallScore -= mediumCount * 1;
  overallScore = Math.max(0, Math.min(10, overallScore));

  const riskLevel = criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : mediumCount > 0 ? 'medium' : 'low';
  const quarantineRecommended = criticalCount > 0 || highCount >= 2;

  return {
    overallScore,
    riskLevel,
    riskBreakdown: {
      l15_l16_l17_l18_l19: riskLevel,
      l2: skill.sentinel?.l2_score ? (skill.sentinel.l2_score >= 8 ? 'low' : 'medium') : 'not_available',
      final: riskLevel,
    },
    quarantineRecommended,
    layersRun: {
      l15: true, l16: true, l17: true, l18: true, l19: true,
      l2: !!skill.sentinel?.l2_score,
      l3: false,
    },
    checks,
  };
}

// ─── Main loop ─────────────────────────────────────────────────────────
(async () => {
  console.log(`Starting deep audit at ${new Date().toISOString()}\n`);

  for (let i = progress.last_index; i < endIndex; i++) {
    const skill = targets[i];
    if (!skill) continue;

    try {
      const auditResult = await auditSkill(skill);
      const cert = generateCertificate(skill, auditResult);

      // Write certificate
      if (cert.quarantine_recommended) {
        // Move to quarantine
        const qPath = path.join(QUARANTINE_DIR, `${skill.id}.json`);
        fs.writeFileSync(qPath, JSON.stringify(cert, null, 2));
        // Remove from certs if exists
        const certPath = path.join(CERTS_DIR, `${skill.id}.json`);
        if (fs.existsSync(certPath)) fs.unlinkSync(certPath);
        progress.quarantined++;
        console.log(`  🚨 QUARANTINE [${i}/${endIndex}] ${skill.id} (${skill.name}) — score ${cert.overall_score}, risk ${cert.risk_level}`);
      } else {
        const certPath = path.join(CERTS_DIR, `${skill.id}.json`);
        fs.writeFileSync(certPath, JSON.stringify(cert, null, 2));
        // Remove from quarantine if it was there
        const qPath = path.join(QUARANTINE_DIR, `${skill.id}.json`);
        if (fs.existsSync(qPath)) fs.unlinkSync(qPath);

        const marker = cert.overall_score === 10 ? '✓✓' : cert.overall_score >= 7 ? '✓ ' : '⚠ ';
        if (i % 50 === 0 || cert.overall_score < 5) {
          console.log(`  ${marker}[${i}/${endIndex}] ${skill.id} — score ${cert.overall_score}, risk ${cert.risk_level}`);
        }
      }

      progress.audited++;
    } catch (e) {
      progress.errors++;
      if (progress.errors % 10 === 0) {
        console.log(`  ✗ ERROR [${i}] ${skill.id}: ${e.message}`);
      }
    }

    progress.last_index = i + 1;

    // Save progress every 10 skills
    if (i % 10 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    }

    // Small delay to avoid overwhelming APIs
    if (i % 100 === 0 && i > 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (progress.audited / (elapsed / 60)).toFixed(1);
      const remaining = ((endIndex - i) / (rate * 60)).toFixed(0);
      console.log(`\n  Progress: ${i}/${endIndex} | ${elapsed}s elapsed | ${rate} skills/min | ~${remaining}s remaining\n`);
      await new Promise(r => setTimeout(r, 500)); // Brief pause every 100
    }
  }

  // Save final progress
  progress.completed_at = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

  // Summary
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`DEEP AUDIT COMPLETE`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Audited:     ${progress.audited}`);
  console.log(`Quarantined: ${progress.quarantined}`);
  console.log(`Errors:      ${progress.errors}`);
  console.log(`Elapsed:     ${totalElapsed}s`);
  console.log(`\nProgress file: _data/deep-audit-progress.json`);

  // Regenerate summary
  const allCerts = fs.readdirSync(CERTS_DIR).filter(f => f.endsWith('.json') && f !== '_summary.json');
  const summary = {
    generated_at: new Date().toISOString(),
    total_certified: allCerts.length,
    by_risk: { low: 0, medium: 0, high: 0, critical: 0 },
    by_score: {},
  };
  for (const f of allCerts) {
    try {
      const cert = JSON.parse(fs.readFileSync(path.join(CERTS_DIR, f), 'utf8'));
      summary.by_risk[cert.risk_level] = (summary.by_risk[cert.risk_level] || 0) + 1;
      summary.by_score[cert.overall_score] = (summary.by_score[cert.overall_score] || 0) + 1;
    } catch {}
  }
  fs.writeFileSync(path.join(CERTS_DIR, '_summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Summary: _data/sentinel_certificates/_summary.json`);
  console.log(`  Total certified: ${summary.total_certified}`);
  console.log(`  Low risk: ${summary.by_risk.low}`);
  console.log(`  Medium risk: ${summary.by_risk.medium}`);
  console.log(`  High risk: ${summary.by_risk.high}`);
  console.log(`  Critical risk: ${summary.by_risk.critical}`);
})();
