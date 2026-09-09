#!/usr/bin/env node
/**
 * MarketNow Security Audit CLI v1.0.0
 * ====================================
 *
 * Free security intelligence for the agent economy, powered by the LIVE
 * MarketNow endpoints (https://www.marketnow.site):
 *
 *   marketnow-audit <domain>            — domain scam-check (URL shorteners,
 *                                         suspicious TLDs, typosquatting, more)
 *   marketnow-audit --atc <card_id>     — Agent Trust Card verification
 *                                         (Ed25519 + RFC 8785 JCS over served
 *                                         bytes) + OCSP revocation status
 *   marketnow-audit --kid <kid>         — OCSP revocation status for a CA key
 *                                         (e.g. mn-ca-002, mn-ca-003)
 *   marketnow-audit --catalog [cat]     — browse catalog skills with risk
 *                                         levels and Sentinel scores
 *   marketnow-audit --help              — usage
 *
 * Exit codes: 0 = PERMIT / verified / ALLOW
 *             2 = CAUTION / UNKNOWN (fail-closed review needed)
 *             1 = DENY / revoked / failed verification
 */

const API = 'https://www.marketnow.site';

const args = process.argv.slice(2);

function usage() {
  console.log(`MarketNow Security Audit CLI v1.0.0 — free security intelligence for agents

Usage:
  marketnow-audit <domain>              scam-check a domain (live)
  marketnow-audit --atc <card_id>       verify an Agent Trust Card + revocation
  marketnow-audit --kid <kid>           OCSP status for a CA key (e.g. mn-ca-002)
  marketnow-audit --catalog [category]  list skills with risk levels
  marketnow-audit --help                this help

Examples:
  marketnow-audit bit.ly
  marketnow-audit --atc ATC-2026-1509360
  marketnow-audit --kid mn-ca-002
  marketnow-audit --catalog Security

Endpoints used (all live):
  GET ${API}/api/scam-check?domain=...
  GET ${API}/api/atc?action=verify&card_id=...
  GET ${API}/api/ocsp?card_id=... | ?kid=...
  GET ${API}/api/skills?category=...`);
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'marketnow-audit/1.0.0 (+https://marketnow.site)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).pathname}`);
  return res.json();
}

function exitForDecision(decision) {
  const d = String(decision || '').toUpperCase();
  if (d === 'ALLOW' || d === 'PERMIT' || d === 'SAFE') process.exit(0);
  if (d === 'CAUTION' || d === 'UNKNOWN') process.exit(2);
  process.exit(1); // DENY / BLOCK / DANGEROUS
}

// ─── Domain scam-check ─────────────────────────────────────────────────────
async function auditDomain(domain) {
  const clean = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  console.log(`MarketNow Domain Scam-Check`);
  console.log(`===========================`);
  console.log(`Domain: ${clean}`);
  console.log();
  const d = await getJson(`${API}/api/scam-check?domain=${encodeURIComponent(clean)}`);
  console.log(`Decision:    ${d.decision}`);
  console.log(`Risk score:  ${d.risk_score}/100`);
  if (d.first_party) console.log(`First-party: yes (operated by AliceLabs LLC)`);
  console.log();
  if (d.reasons && d.reasons.length) {
    console.log(`Reasons:`);
    for (const r of d.reasons) console.log(`  • ${r}`);
    console.log();
  }
  const triggered = Object.entries(d.checks || {}).filter(([, c]) => c && c.triggered);
  if (triggered.length) {
    console.log(`Triggered checks (${triggered.length}):`);
    for (const [name, c] of triggered) {
      console.log(`  • ${name} (weight ${c.weight})${c.detail ? ' — ' + c.detail : ''}`);
    }
    console.log();
  }
  if (d.honest_disclaimer) console.log(`${d.honest_disclaimer}`);
  exitForDecision(d.decision);
}

// ─── ATC verification + revocation ─────────────────────────────────────────
async function auditAtc(cardId) {
  console.log(`MarketNow ATC Verification`);
  console.log(`==========================`);
  console.log(`Card: ${cardId}`);
  console.log();
  let verifiedOk = null;
  try {
    const v = await getJson(`${API}/api/atc?action=verify&card_id=${encodeURIComponent(cardId)}`);
    verifiedOk = v.valid === true;
    console.log(`Verified:      ${v.valid} (over ${v.verified_over})`);
    console.log(`Signature:     ${v.signature_valid ? 'valid (Ed25519)' : 'INVALID'}`);
    console.log(`Hash:          ${v.hash_valid ? 'valid' : 'INVALID'}`);
    console.log(`CA key:        ${v.ca_key_id}`);
    console.log(`Canonicalization: ${v.canonicalization}`);
    console.log(`Canonical SHA-256: ${String(v.canonical_sha256).slice(0, 32)}…`);
    console.log(`Expires:       ${v.expires_at}${v.expired ? ' — EXPIRED' : ''}`);
    if (v.valid !== true && (v.signature_error || v.reason)) {
      console.log(`Reason:        ${v.signature_error || v.reason}`);
    }
  } catch (e) {
    console.log(`Verification:  FAILED (${e.message})`);
  }
  console.log();
  try {
    const o = await getJson(`${API}/api/ocsp?card_id=${encodeURIComponent(cardId)}`);
    console.log(`OCSP status:   ${o.status} (${o.protocol})`);
    console.log(`Recommendation: ${o.recommendation}`);
    if (o.status !== 'VALID') {
      const ev = o.evidence || {};
      if (ev.reason) console.log(`Reason:        ${ev.reason}`);
    }
    if (verifiedOk === false) process.exit(1);
    exitForDecision(o.recommendation);
  } catch (e) {
    console.log(`OCSP:          unreachable (${e.message}) — failing closed`);
    process.exit(2);
  }
}

// ─── CA key OCSP status ─────────────────────────────────────────────────────
async function auditKid(kid) {
  console.log(`MarketNow OCSP — CA Key Status`);
  console.log(`==============================`);
  console.log(`Key: ${kid}`);
  console.log();
  const o = await getJson(`${API}/api/ocsp?kid=${encodeURIComponent(kid)}`);
  console.log(`Status:         ${o.status} (${o.protocol})`);
  console.log(`Recommendation: ${o.recommendation}`);
  const ev = o.evidence || {};
  if (ev.source) console.log(`Evidence:       ${ev.source}`);
  if (ev.reason) console.log(`Reason:         ${ev.reason}`);
  if (o.registry && o.registry.revoked_at) console.log(`Revoked at:     ${o.registry.revoked_at}`);
  console.log();
  exitForDecision(o.recommendation);
}

// ─── Catalog browser ────────────────────────────────────────────────────────
async function auditCatalog(category) {
  const q = category ? `category=${encodeURIComponent(category)}&` : '';
  const d = await getJson(`${API}/api/skills?${q}limit=20&filter=free`);
  console.log(`MarketNow Catalog${category ? ' — ' + category : ''}`);
  console.log('='.repeat(40));
  console.log(`Total skills: ${d.total}${category ? ' in this category' : ' (all)'}`);
  console.log();
  const riskIcon = { red: '●', yellow: '◐', green: '○', unknown: '?' };
  for (const s of d.skills || []) {
    const icon = riskIcon[String(s.risk_level).toLowerCase()] || '?';
    const score = String(s.sentinel_score ?? '-').padStart(2);
    console.log(`${icon} ${String(s.name).padEnd(34)} score ${score}/10  risk=${s.risk_level}  ${String(s.install || '').split(' ')[0] === 'npx' ? 'npm' : 'pip'}`);
  }
  console.log();
  console.log(`Browse live: https://marketnow.site`);
  process.exit(0);
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!args.length || args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    usage();
    process.exit(0);
  }
  const flag = args[0];
  try {
    if (flag === '--atc') {
      if (!args[1]) { console.error('✗ --atc requires a card_id (e.g. ATC-2026-1509360)'); process.exit(1); }
      await auditAtc(args[1]);
    } else if (flag === '--kid') {
      if (!args[1]) { console.error('✗ --kid requires a key id (e.g. mn-ca-002)'); process.exit(1); }
      await auditKid(args[1]);
    } else if (flag === '--catalog') {
      await auditCatalog(args[1]);
    } else if (flag.startsWith('--')) {
      console.error(`✗ Unknown flag ${flag}. Try --help.`);
      process.exit(1);
    } else {
      await auditDomain(flag);
    }
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(2); // fail-closed
  }
}

main();
