#!/usr/bin/env node
/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * This file is part of the Sentinel Security Audit Engine.
 * DO NOT COPY, REDISTRIBUTE, OR BUILD COMPETING PRODUCTS.
 * See SENTINEL-LICENSE for full terms.
 *
 * "Sentinel" is a trademark of AliceLabs LLC.
 * Patent pending on the 3-layer audit pipeline (L1.5 → L1.6 → L2).
 *
 * For licensing: legal@alicelabs.site
 * For verification: https://marketnow.site/verify
 */

/**
 * MarketNow — Generate Sentinel Certified SVG Badges
 * =====================================================
 *
 * Generates SVG badges like:
 *   🛡️ Sentinel Certified 8/10
 *
 * Used by skill authors to embed in their READMEs:
 *   [![Sentinel Certified](https://marketnow.site/badges/sentinel-certified.svg?skillId=mn-gen-00003)](https://marketnow.site/skill/mn-gen-00003)
 *
 * This script pre-generates badges for all 8582 skills and writes
 * them to public/badges/sentinel-certified-{skillId}.svg.
 *
 * Usage: node scripts/generate-badges.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.join(__dirname, '..');
const CERTS_DIR = path.join(REPO_ROOT, '_data', 'sentinel_certificates');
const BADGES_DIR = path.join(REPO_ROOT, 'aep-marketplace', 'public', 'badges');

// Color by risk level
const RISK_COLORS = {
  low: { left: '#00F299', right: '#0d4f3a' },
  medium: { left: '#facc15', right: '#854d0e' },
  high: { left: '#fb923c', right: '#7c2d12' },
  critical: { left: '#f87171', right: '#7f1d1d' },
  unknown: { left: '#a1a1aa', right: '#3f3f46' },
};

function generateSVG(skillId, score, riskLevel) {
  const colors = RISK_COLORS[riskLevel] || RISK_COLORS.unknown;
  const scoreText = `${score}/10`;
  const leftText = '🛡️ SENTINEL';
  const rightText = `CERTIFIED ${scoreText}`;

  // SVG dimensions (calculated based on text length)
  const leftWidth = 85;
  const rightWidth = 115;
  const totalWidth = leftWidth + rightWidth;
  const height = 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="${height}" fill="#1a1a2e"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${colors.left}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="9" font-weight="bold">
    <text x="${leftWidth / 2}" y="13.5">${leftText}</text>
    <text x="${leftWidth + rightWidth / 2}" y="13.5" fill="#000">${rightText}</text>
  </g>
</svg>`;
}

// ─── Main ────────────────────────────────────────────────────────────────
console.log('MarketNow — Sentinel Badge Generator');
console.log('=====================================\n');

// Ensure badges directory exists
fs.mkdirSync(BADGES_DIR, { recursive: true });

// Read all certificates
const certFiles = fs.readdirSync(CERTS_DIR).filter(f => f.endsWith('.json') && f !== '_summary.json');
console.log(`Found ${certFiles.length} certificates.`);

let generated = 0;
let skipped = 0;

for (const certFile of certFiles) {
  try {
    const cert = JSON.parse(fs.readFileSync(path.join(CERTS_DIR, certFile), 'utf8'));
    const skillId = cert.skill_id;
    if (!skillId) {
      skipped++;
      continue;
    }

    const svg = generateSVG(skillId, cert.overall_score, cert.risk_level);
    const badgePath = path.join(BADGES_DIR, `sentinel-certified-${skillId}.svg`);
    fs.writeFileSync(badgePath, svg);
    generated++;
  } catch (e) {
    skipped++;
  }
}

// Generate a generic badge for skills without a specific one
const genericSVG = generateSVG('generic', '?', 'unknown');
fs.writeFileSync(path.join(BADGES_DIR, 'sentinel-certified.svg'), genericSVG);

console.log(`\n✅ Generated ${generated} skill-specific badges`);
console.log(`   Skipped: ${skipped}`);
console.log(`   Generic badge: public/badges/sentinel-certified.svg`);
console.log(`\nUsage in README:`);
console.log(`  [![Sentinel Certified](https://marketnow.site/badges/sentinel-certified-{skillId}.svg)](https://marketnow.site/skill/{skillId})`);
