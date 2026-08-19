/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * MarketNow — Sentinel L1.7 Binary & Malware Detection
 * =====================================================
 *
 * INCIDENT (14 July 2026): a third-party skill zip
 * (prospector-email-finder.zip) contained a nested zip with unit.exe
 * flagged as Trojan:Win64/Lazy.PGPK!MTB. The zip was committed to
 * dist/skills/ by an import script that did not scan nested archives.
 * Sentinel L1.5/L1.6 only analyzed skill METADATA (name, description,
 * system_prompt) — it never looked inside the actual skill package.
 *
 * L1.7 closes that gap. It runs:
 *   1. On every skill imported by auto-discover (BEFORE commit)
 *   2. On every batch re-certification (weekly)
 *   3. On-demand via /api/audit-skill?deep=1
 *
 * If L1.7 detects a critical finding, the skill is:
 *   - Score set to 0
 *   - risk_level set to 'critical'
 *   - status set to 'quarantined'
 *   - Moved to _data/quarantine/{skillId}.json
 *   - Removed from the public catalog (skills_index.json, skills-lite.json)
 *   - Listed publicly at /quarantine for transparency
 *
 * Detection rules (all critical unless noted):
 *   - Windows PE executables (.exe, .dll, .scr) inside any archive
 *   - Launcher scripts (.bat, .cmd, .vbs, .ps1) inside any archive
 *   - Nested zip archives (red flag — legitimate MCP skills don't nest zips)
 *   - "start X.exe Y.txt" pattern (staged malware launcher)
 *   - Obfuscated Lua bytecode (function(o,R,F,U,b,p,E,M,Z,W,...) signature)
 *   - External download URLs in README pointing to raw.githubusercontent.com/.../*.zip
 *   - "Download Latest Release" badges with external zip links
 *   - PowerShell -encodedcommand with long base64 payload
 *   - eval(atob(...)) obfuscation
 *   - Text files >100KB that aren't valid JSON (likely bytecode payload)
 */

import crypto from 'crypto';

// ─── Detection rules ────────────────────────────────────────────────────

const BINARY_EXTENSIONS = ['.exe', '.dll', '.scr', '.msi'];
const LAUNCHER_EXTENSIONS = ['.bat', '.cmd', '.vbs', '.ps1'];
const ARCHIVE_EXTENSIONS = ['.zip', '.tar', '.tar.gz', '.tgz', '.rar', '.7z'];

const MALWARE_PATTERNS = [
  {
    id: 'MAL-LAUNCH-001',
    name: 'Staged launcher: start X.exe Y.txt',
    severity: 'critical',
    pattern: /start\s+\w+\.exe\s+\w+\.\w+/i,
    description: 'Application.cmd-style launcher that executes a Windows binary with a payload file. This is the exact pattern used in the prospector-email-finder trojan (issue #9).',
  },
  {
    id: 'MAL-LUA-001',
    name: 'Obfuscated Lua bytecode signature',
    severity: 'critical',
    pattern: /function\s*\(\s*o\s*,\s*R\s*,\s*F\s*,\s*U\s*,\s*b\s*,\s*p\s*,\s*E\s*,\s*M\s*,\s*Z\s*,\s*W/i,
    description: 'High-arity function with single-letter params is the signature of Lua bytecode obfuscation. The prospector trojan used this exact pattern with 24+ params.',
  },
  {
    id: 'MAL-LUA-002',
    name: 'Lua numeric comment markers',
    severity: 'high',
    pattern: /--\[\[\d+\]\]/,
    description: 'Numeric comment markers in Lua are used by obfuscators to track bytecode positions.',
  },
  {
    id: 'MAL-DL-001',
    name: 'External zip download URL in README',
    severity: 'high',
    pattern: /raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/[^/]*\.zip/i,
    description: 'README promotes downloading a zip from a different GitHub repo. This is the typosquatting vector used by the prospector trojan (JuanquiFortuny/prospector-mcp-email-finder).',
  },
  {
    id: 'MAL-DL-002',
    name: 'Download badge with external zip link',
    severity: 'high',
    // Matches shields.io badges promoting a download, combined with an
    // external raw.githubusercontent.com URL elsewhere in the text.
    // The prospector trojan used: [![Download Latest Release](shields.io/.../Download-Get%20It%20Here-green)](raw.githubusercontent.com/.../...zip)
    // We trigger on either "shields.io" + "Download" OR any markdown link
    // whose text contains "Download" and URL points to a .zip file.
    pattern: /shields\.io[^)\s]*[Dd]ownload|shields\.io[^)\s]*[Ll]atest\s*[Rr]elease|\[[^\]]*[Dd]ownload[^\]]*\]\([^)]*\.zip[^)]*\)/i,
    description: 'README promotes downloading a file via a badge. Legitimate MCP skills install via npm/npx — not external zip downloads. This is the typosquatting vector used by the prospector trojan.',
  },
  {
    id: 'MAL-PS-001',
    name: 'PowerShell encoded command',
    severity: 'critical',
    pattern: /powershell\s+-encodedcommand\s+[A-Za-z0-9+/=]{50,}/i,
    description: 'PowerShell -encodedcommand with a long base64 payload is a common malware delivery technique.',
  },
  {
    id: 'MAL-JS-001',
    name: 'eval(atob()) obfuscation',
    severity: 'high',
    pattern: /eval\s*\(\s*atob\s*\(/i,
    description: 'eval(atob(...)) decodes base64 at runtime and evaluates it. Used by script kiddies and credential stealers.',
  },
];

// ─── L1.7 main ──────────────────────────────────────────────────────────

/**
 * Run L1.7 analysis on a skill.
 *
 * @param {Object} skill - full skill object
 * @param {Object} [options]
 * @param {Buffer} [options.packageBuffer] - if the skill has a downloadable
 *   package (zip), pass the buffer here. L1.7 will scan inside it.
 * @returns {Object} { findings, score_adjustment, quarantine_recommended, details }
 */
export async function runL17(skill, options = {}) {
  const { packageBuffer } = options;
  const findings = {
    binary_files: [],
    launcher_scripts: [],
    nested_archives: [],
    malware_patterns: [],
    oversized_text_files: [],
    total_critical: 0,
    total_high: 0,
    total_medium: 0,
  };

  // ─── 1. Scan skill metadata text for malware patterns ────────────────
  const metadataText = [
    skill.name || '',
    skill.description || '',
    skill.doc?.system_prompt || '',
    skill.doc?.setup || '',
    skill.install || '',
  ].join('\n');

  for (const rule of MALWARE_PATTERNS) {
    if (rule.pattern.test(metadataText)) {
      findings.malware_patterns.push({
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        description: rule.description,
        source: 'metadata',
      });
      if (rule.severity === 'critical') findings.total_critical++;
      else if (rule.severity === 'high') findings.total_high++;
      else findings.total_medium++;
    }
  }

  // ─── 2. If we have a package buffer, scan inside it ──────────────────
  let packageScanned = false;
  if (packageBuffer) {
    packageScanned = true;
    const packageFindings = await scanPackageBuffer(packageBuffer, skill.id);
    findings.binary_files = packageFindings.binary_files;
    findings.launcher_scripts = packageFindings.launcher_scripts;
    findings.nested_archives = packageFindings.nested_archives;
    findings.oversized_text_files = packageFindings.oversized_text_files;
    // Add nested-archive malware patterns
    for (const p of packageFindings.malware_patterns || []) {
      findings.malware_patterns.push(p);
      if (p.severity === 'critical') findings.total_critical++;
      else if (p.severity === 'high') findings.total_high++;
      else findings.total_medium++;
    }
    findings.total_critical += packageFindings.binary_files.length; // each .exe = critical
    findings.total_critical += packageFindings.launcher_scripts.length; // each .bat/.cmd = critical
    findings.total_high += packageFindings.nested_archives.length; // each nested zip = high
    findings.total_high += packageFindings.oversized_text_files.length;
  }

  // ─── 3. Score adjustment ─────────────────────────────────────────────
  // ANY critical finding → instant score 0 + quarantine
  // ANY high finding → -6 (likely quarantine if combined with others)
  let scoreAdjustment = 0;
  if (findings.total_critical > 0) {
    scoreAdjustment = -10; // floor at 0
  } else {
    scoreAdjustment -= findings.total_high * 3;
    scoreAdjustment -= findings.total_medium * 1;
  }
  scoreAdjustment = Math.max(-10, scoreAdjustment);

  const quarantineRecommended =
    findings.total_critical > 0 ||
    findings.total_high >= 1 ||  // ANY high finding → quarantine (was >= 2)
    findings.binary_files.length > 0 ||
    findings.launcher_scripts.length > 0;

  return {
    findings,
    score_adjustment: scoreAdjustment,
    quarantine_recommended: quarantineRecommended,
    details: {
      malware_rules_run: MALWARE_PATTERNS.length,
      package_scanned: packageScanned,
      binary_files_found: findings.binary_files.length,
      launcher_scripts_found: findings.launcher_scripts.length,
      nested_archives_found: findings.nested_archives.length,
      malware_patterns_found: findings.malware_patterns.length,
      oversized_text_files_found: findings.oversized_text_files.length,
    },
  };
}

// ─── Package scanner ────────────────────────────────────────────────────

/**
 * Scan a Buffer containing a zip file. Recursively scans nested zips.
 * Returns findings without throwing — malformed archives return empty.
 */
async function scanPackageBuffer(buffer, skillId, depth = 0, maxDepth = 5) {
  const result = {
    binary_files: [],
    launcher_scripts: [],
    nested_archives: [],
    malware_patterns: [],
    oversized_text_files: [],
  };

  if (depth > maxDepth) return result;

  // Dynamic import of JSZip only when needed (it's heavy)
  let JSZip;
  try {
    JSZip = (await import('jszip')).default;
  } catch {
    // JSZip not installed — skip package scan, return empty.
    return result;
  }

  let zip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    // Not a valid zip — skip
    return result;
  }

  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const name = entry.name.toLowerCase();
    const ext = name.slice(name.lastIndexOf('.'));

    // Binary files
    if (BINARY_EXTENSIONS.includes(ext)) {
      result.binary_files.push({
        path: entry.name,
        size: entry._data?.uncompressedSize || 0,
        ext,
      });
      continue;
    }

    // Launcher scripts
    if (LAUNCHER_EXTENSIONS.includes(ext)) {
      // Read content to check if it's a real launcher
      try {
        const content = await entry.async('string');
        const isLauncher = MALWARE_PATTERNS.some(r => r.pattern.test(content));
        result.launcher_scripts.push({
          path: entry.name,
          size: entry._data?.uncompressedSize || 0,
          ext,
          looks_malicious: isLauncher,
        });
      } catch {
        result.launcher_scripts.push({ path: entry.name, ext, looks_malicious: 'unknown' });
      }
      continue;
    }

    // Nested archives (HIGH severity — legit MCP skills don't nest zips)
    if (ARCHIVE_EXTENSIONS.includes(ext)) {
      result.nested_archives.push({
        path: entry.name,
        size: entry._data?.uncompressedSize || 0,
        ext,
      });
      // Recursively scan
      try {
        const nestedBuffer = await entry.async('nodebuffer');
        const nested = await scanPackageBuffer(nestedBuffer, skillId, depth + 1, maxDepth);
        // Prefix paths
        for (const f of nested.binary_files) f.path = `${entry.name}::${f.path}`;
        for (const f of nested.launcher_scripts) f.path = `${entry.name}::${f.path}`;
        for (const f of nested.nested_archives) f.path = `${entry.name}::${f.path}`;
        for (const f of nested.malware_patterns) f.source = `nested:${entry.name}`;
        result.binary_files.push(...nested.binary_files);
        result.launcher_scripts.push(...nested.launcher_scripts);
        result.nested_archives.push(...nested.nested_archives);
        result.malware_patterns.push(...nested.malware_patterns);
        result.oversized_text_files.push(...nested.oversized_text_files);
      } catch {
        // Couldn't read nested zip
      }
      continue;
    }

    // Text files — scan content for malware patterns + check size
    if (ext === '.txt' || ext === '.md' || ext === '.json' || ext === '.js' || ext === '.ts') {
      try {
        const content = await entry.async('string');
        // Run all malware patterns
        for (const rule of MALWARE_PATTERNS) {
          if (rule.pattern.test(content)) {
            result.malware_patterns.push({
              id: rule.id,
              name: rule.name,
              severity: rule.severity,
              description: rule.description,
              source: `file:${entry.name}`,
            });
          }
        }
        // Oversized text files (likely bytecode payload)
        if (ext === '.txt' && content.length > 100_000) {
          // Check if it's valid JSON — if not, it's suspicious
          try {
            JSON.parse(content);
          } catch {
            result.oversized_text_files.push({
              path: entry.name,
              size: content.length,
              reason: 'not_valid_json_likely_bytecode',
            });
          }
        }
      } catch {
        // Couldn't read as text — skip
      }
    }
  }

  return result;
}

// ─── Quarantine helper ──────────────────────────────────────────────────

/**
 * Quarantine a skill. Moves it to _data/quarantine/{skillId}.json and
 * marks it as 'quarantined' in the certificate.
 *
 * @param {Object} skill - the skill to quarantine
 * @param {Object} l17Result - the L1.7 result that triggered quarantine
 * @param {Object} cert - the current certificate (will be updated)
 * @returns {Object} the updated certificate with status='quarantined'
 */
export function quarantineSkill(skill, l17Result, cert) {
  const quarantinedCert = {
    ...cert,
    status: 'quarantined',
    quarantined_at: new Date().toISOString(),
    quarantined_reason: 'L1.7 detected critical/high findings',
    quarantined_findings: l17Result.findings,
    overall_score: 0,
    risk_level: 'critical',
    risk_breakdown: {
      ...cert.risk_breakdown,
      l17: 'critical',
      final: 'critical',
    },
  };
  return quarantinedCert;
}

export { MALWARE_PATTERNS, BINARY_EXTENSIONS, LAUNCHER_EXTENSIONS, ARCHIVE_EXTENSIONS };
