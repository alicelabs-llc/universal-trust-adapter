/**
 * MarketNow — Sentinel L1.6 Security Audit (Enhanced)
 * ====================================================
 * 
 * This is the enhanced version of Sentinel that goes beyond metadata
 * analysis. It clones the actual repo and runs:
 * 1. Semgrep with MCP-specific rules (prompt injection, command injection, etc.)
 * 2. Gitleaks for secret detection (if available)
 * 3. OSV-Scanner / npm audit for dependency vulnerabilities (if available)
 * 4. Hygiene checks (license, manifest)
 * 
 * SCORING: Weighted 0-10 scale
 * - Secrets (40%): critical = instant 0
 * - Vulnerabilities (30%): -2 per CVE
 * - Static analysis (20%): -2.5 per ERROR, -1 per WARNING
 * - Hygiene (10%): -4 no license, -6 no manifest
 * 
 * STATUS: DESIGN PHASE — not yet integrated into production /api/audit-skill
 * The production endpoint still uses L1.5 (metadata-based).
 * This module is intended for GitHub Actions CI/CD or a backend worker.
 * 
 * PREREQUISITES (must be installed on the runner):
 * - git
 * - semgrep (pip install semgrep)
 * - gitleaks (optional, fallback to regex)
 * - osv-scanner (optional, fallback to npm audit)
 * 
 * USAGE:
 *   import { auditSkill } from './sentinel-l16.js';
 *   const report = await auditSkill('https://github.com/user/repo', '/tmp/audit');
 *   console.log(report.score); // 0-10
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Weighted scoring (0-10 scale)
const WEIGHTS = {
  secrets: 0.40,         // Credential leaks (Critical)
  vulnerabilities: 0.30, // Known CVEs in dependencies (High)
  staticAnalysis: 0.20,  // Insecure code patterns (Medium)
  hygiene: 0.10           // License, manifest, basic config (Low)
};

// Minimum score to be listed on MarketNow
const MIN_LISTING_SCORE = 4.0;

/**
 * Main audit orchestrator
 * @param {string} repoUrl - GitHub repo URL
 * @param {string} localWorkDir - Temp directory for cloning
 * @returns {Object} Audit report with score, categories, details
 */
export async function auditSkill(repoUrl, localWorkDir = '/tmp/sentinel-audit') {
  const auditReport = {
    version: 'L1.6',
    repoUrl,
    timestamp: new Date().toISOString(),
    success: false,
    score: 0.0,
    minRequired: MIN_LISTING_SCORE,
    listed: false,
    categories: {
      hygiene: { score: 10, details: [] },
      secrets: { score: 10, details: [] },
      vulnerabilities: { score: 10, details: [] },
      staticAnalysis: { score: 10, details: [] }
    },
    error: null
  };

  const tempRepoPath = path.join(localWorkDir, `audit-${Date.now()}`);

  try {
    // 1. Clone repo (shallow)
    await execAsync(`git clone --depth 1 ${repoUrl} ${tempRepoPath}`);

    // 2. Run modular audits
    await checkHygiene(tempRepoPath, auditReport.categories.hygiene);
    await scanSecrets(tempRepoPath, auditReport.categories.secrets);
    await scanDependencies(tempRepoPath, auditReport.categories.vulnerabilities);
    await runStaticAnalysis(tempRepoPath, auditReport.categories.staticAnalysis);

    // 3. Calculate weighted score
    calculateWeightedScore(auditReport);
    auditReport.success = true;
    auditReport.listed = auditReport.score >= MIN_LISTING_SCORE;

  } catch (error) {
    auditReport.error = error.message;
    auditReport.score = 0.0;
    auditReport.listed = false;
  } finally {
    await cleanUp(tempRepoPath);
  }

  return auditReport;
}

/**
 * Check 1: Repository hygiene (license, manifest)
 */
async function checkHygiene(repoPath, report) {
  try {
    const files = await fs.readdir(repoPath);
    
    // Check for license file
    const hasLicense = files.some(f => /license/i.test(f));
    if (!hasLicense) {
      report.score -= 4;
      report.details.push({
        severity: 'LOW',
        message: 'No license file found (MIT, Apache, etc.).'
      });
    }

    // Check for manifest (package.json, requirements.txt, etc.)
    const hasManifest = files.some(f => 
      ['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'Cargo.toml'].includes(f)
    );
    if (!hasManifest) {
      report.score -= 6;
      report.details.push({
        severity: 'MEDIUM',
        message: 'No standard manifest file for dependency resolution.'
      });
    }

    // Check for README
    const hasReadme = files.some(f => /readme/i.test(f));
    if (!hasReadme) {
      report.score -= 2;
      report.details.push({
        severity: 'LOW',
        message: 'No README file found.'
      });
    }

    report.score = Math.max(0, report.score);
  } catch (err) {
    report.score = 0;
    report.details.push({ severity: 'ERROR', message: `Hygiene audit failed: ${err.message}` });
  }
}

/**
 * Check 2: Secret detection (gitleaks if available, regex fallback)
 */
async function scanSecrets(repoPath, report) {
  try {
    // Try gitleaks first
    try {
      await execAsync(`gitleaks detect --source=${repoPath} --report-format=json --quiet`);
      // Exit code 0 = no leaks found
    } catch (gitleaksErr) {
      if (gitleaksErr.stdout) {
        const leaks = JSON.parse(gitleaksErr.stdout);
        if (leaks.length > 0) {
          const penalty = Math.min(10, leaks.length * 3);
          report.score -= penalty;
          leaks.forEach(leak => {
            report.details.push({
              severity: 'CRITICAL',
              message: `Secret exposed (${leak.RuleID}) in ${leak.File}:${leak.StartLine}`
            });
          });
        }
      }
    }
    report.score = Math.max(0, report.score);
  } catch (err) {
    // Fallback: basic regex patterns for common secrets
    report.score = 5;
    report.details.push({
      severity: 'WARNING',
      message: 'Gitleaks not available. Using basic regex fallback (lower confidence).'
    });
    
    // Basic regex fallback
    await regexSecretScan(repoPath, report);
  }
}

/**
 * Basic regex-based secret scan (fallback when gitleaks unavailable)
 */
async function regexSecretScan(repoPath, report) {
  const patterns = [
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'CRITICAL' },
    { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9]{36}/g, severity: 'CRITICAL' },
    { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: 'CRITICAL' },
    { name: 'Generic API Key', regex: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*["'][a-zA-Z0-9]{20,}["']/gi, severity: 'HIGH' },
  ];
  
  // Scan all text files (limited to common extensions)
  const extensions = ['.js', '.ts', '.py', '.json', '.yml', '.yaml', '.env', '.txt', '.md'];
  
  async function scanDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          for (const { name, regex, severity } of patterns) {
            const matches = content.match(regex);
            if (matches) {
              report.score -= 3;
              report.details.push({
                severity,
                message: `${name} detected in ${path.relative(repoPath, fullPath)}`
              });
            }
          }
        } catch {}
      }
    }
  }
  
  await scanDir(repoPath);
  report.score = Math.max(0, report.score);
}

/**
 * Check 3: Dependency vulnerabilities (osv-scanner or npm audit)
 */
async function scanDependencies(repoPath, report) {
  try {
    const files = await fs.readdir(repoPath);
    const isNode = files.includes('package.json');
    const isPython = files.includes('requirements.txt') || files.includes('pyproject.toml');

    if (isNode && files.includes('package-lock.json')) {
      try {
        const { stdout } = await execAsync(
          `osv-scanner --lockfile=${path.join(repoPath, 'package-lock.json')} --format=json`
        );
        const result = JSON.parse(stdout);
        
        if (result.results && result.results.length > 0) {
          let vulnCount = 0;
          result.results.forEach(res => {
            if (res.packages) {
              res.packages.forEach(pkg => {
                if (pkg.vulnerabilities) {
                  pkg.vulnerabilities.forEach(vuln => {
                    vulnCount++;
                    report.details.push({
                      severity: vuln.database_specific?.severity || 'HIGH',
                      message: `Vulnerable dependency: ${pkg.name} (${vuln.id})`
                    });
                  });
                }
              });
            }
          });
          report.score -= Math.min(10, vulnCount * 2);
        }
      } catch (osvErr) {
        // Fallback: npm audit
        try {
          const { stdout } = await execAsync(`npm audit --json`, { cwd: repoPath });
          const result = JSON.parse(stdout);
          const vulnCount = result.metadata?.vulnerabilities?.total || 0;
          if (vulnCount > 0) {
            report.score -= Math.min(10, vulnCount * 2);
            report.details.push({
              severity: 'HIGH',
              message: `${vulnCount} vulnerabilities found via npm audit`
            });
          }
        } catch {
          report.score -= 2;
          report.details.push({
            severity: 'MEDIUM',
            message: 'Dependency analysis failed (no lockfile or scanner available).'
          });
        }
      }
    } else if (isPython) {
      try {
        const { stdout } = await execAsync(
          `osv-scanner --lockfile=${path.join(repoPath, 'requirements.txt')} --format=json`
        );
        // Same parsing as Node
      } catch {
        report.details.push({
          severity: 'INFO',
          message: 'Python dependency scan not fully automated yet. Manual review recommended.'
        });
      }
    } else {
      report.details.push({
        severity: 'INFO',
        message: 'Dependency ecosystem not automated. Manual review recommended.'
      });
    }

    report.score = Math.max(0, report.score);
  } catch (err) {
    report.score = 0;
    report.details.push({ severity: 'ERROR', message: `Dependency scan failed: ${err.message}` });
  }
}

/**
 * Check 4: Static analysis with Semgrep + MCP-specific rules
 */
async function runStaticAnalysis(repoPath, report) {
  try {
    // Use our MCP-specific rules if available, fallback to auto
    const rulesPath = path.join(process.cwd(), 'sentinel-rules', 'semgrep-mcp-rules.yml');
    const configFlag = await fs.access(rulesPath).then(() => `--config=${rulesPath}`).catch(() => '--config=auto');
    
    const semgrepCommand = `semgrep scan ${configFlag} --json ${repoPath}`;
    
    try {
      const { stdout } = await execAsync(semgrepCommand, { maxBuffer: 10 * 1024 * 1024 });
      processSemgrepResults(JSON.parse(stdout), report);
    } catch (semgrepErr) {
      if (semgrepErr.stdout) {
        try {
          processSemgrepResults(JSON.parse(semgrepErr.stdout), report);
        } catch {}
      } else {
        report.score -= 3;
        report.details.push({
          severity: 'WARNING',
          message: `Semgrep not available or failed: ${semgrepErr.message}`
        });
      }
    }

    report.score = Math.max(0, report.score);
  } catch (err) {
    report.score = 0;
    report.details.push({ severity: 'ERROR', message: `Static analysis failed: ${err.message}` });
  }
}

/**
 * Process Semgrep results and apply penalties
 */
function processSemgrepResults(output, report) {
  if (!output.results || output.results.length === 0) return;
  
  output.results.forEach(finding => {
    const isCritical = finding.extra?.severity === 'ERROR';
    const penalty = isCritical ? 2.5 : 1.0;
    report.score -= penalty;
    
    report.details.push({
      severity: isCritical ? 'HIGH' : 'MEDIUM',
      message: `[${finding.check_id}] ${finding.extra?.message || 'Security finding'} in ${finding.path}:${finding.start?.line || '?'}`
    });
  });
}

/**
 * Calculate weighted final score (0-10)
 */
function calculateWeightedScore(report) {
  const sHygiene = report.categories.hygiene.score * WEIGHTS.hygiene;
  const sSecrets = report.categories.secrets.score * WEIGHTS.secrets;
  const sVulnerabilities = report.categories.vulnerabilities.score * WEIGHTS.vulnerabilities;
  const sStatic = report.categories.staticAnalysis.score * WEIGHTS.staticAnalysis;

  // Critical secret = instant 0
  const hasCriticalSecret = report.categories.secrets.details.some(d => d.severity === 'CRITICAL');
  
  if (hasCriticalSecret) {
    report.score = 0.0;
  } else {
    report.score = parseFloat((sHygiene + sSecrets + sVulnerabilities + sStatic).toFixed(2));
  }
}

/**
 * Clean up temp directory
 */
async function cleanUp(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to clean up ${dirPath}: ${err.message}`);
  }
}

// CLI entry point (for GitHub Actions or manual runs)
if (process.argv[1] && process.argv[1].endsWith('sentinel-l16.js')) {
  const repoUrl = process.argv[2];
  if (!repoUrl) {
    console.error('Usage: node sentinel-l16.js <github-repo-url>');
    process.exit(1);
  }
  auditSkill(repoUrl).then(report => {
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.listed ? 0 : 1);
  });
}

export { auditSkill, WEIGHTS, MIN_LISTING_SCORE };
