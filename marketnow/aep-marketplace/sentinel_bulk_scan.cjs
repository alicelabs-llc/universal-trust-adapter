/**
 * Sentinel Bulk Scanner — Escanea las 9,248 skills y sube scores a KV
 * 
 * 6 checks por skill:
 * 1. Repo Exists (directorio)
 * 2. Has README (README.md con contenido)
 * 3. Has Manifest (package.json / pyproject.toml / Cargo.toml / go.mod)
 * 4. Has License (LICENSE / LICENSE.md / LICENSE.txt)
 * 5. No Secrets (busca API keys, tokens, passwords hardcodeados)
 * 6. No Malicious Code (busca eval, exec, base64_decode, child_process)
 *
 * Uso: node sentinel_bulk_scan.cjs
 * Salida: sentinel_results.json + bulk upload a KV
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = 'D:\\skills git';
const ACCOUNT_ID = 'faf93cd2a0d373573de0859b1cc95328';
const KV_NS_ID = '7763872fdabf43ffb04307805214fe45';
const CF_TOKEN = 'CF_API_TOKEN_REMOVED'; // Solo KV bulk

// Patrones de secrets (check #5)
const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]{10,}/,
  /sk_test_[a-zA-Z0-9]{10,}/,
  /pk_live_[a-zA-Z0-9]{10,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /ghu_[a-zA-Z0-9]{36}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC |DSA |PGP |OPENSSH )?PRIVATE KEY-----/,
  /xox[baprs]-[0-9]{10,14}-[0-9]{10,14}-[a-zA-Z0-9]{20,40}/,  // Slack tokens
  /api[-_]?key['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}/i,
  /password['"]?\s*[:=]\s*['"][^'"]{6,}/i,
  /token['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{10,}/i,
  /secret['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}/i,
  /mongodb(?:\+srv)?:\/\/[^@]+@/,
  /postgresql:\/\/[^@]+@/,
  /redis:\/\/:[^@]+@/,
];

// Patrones maliciosos (check #6)
const MALICIOUS_PATTERNS = [
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /\bsystem\s*\(/i,
  /\bspawn\s*\(/i,
  /\bexecSync\s*\(/i,
  /\bexecFileSync\s*\(/i,
  /\bchild_process\b/,
  /\brequire\(['"]child_process['"]\)/,
  /\bprocess\.env\b/,
  /base64_decode\s*\(/i,
  /atob\s*\(/i,
  /new Function\(/i,
  /setTimeout\s*\(\s*['"`]/i,
  /setInterval\s*\(\s*['"`]/i,
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,  // hardcoded IP URLs
];

function readUpTo(filePath, maxBytes = 500000) {  // S4 FIX: 50KB → 500KB
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
    fs.closeSync(fd);
    return buf.toString('utf8', 0, bytesRead);
  } catch { return ''; }
}

function checkHasReadme(dir) {
  for (const name of ['README.md', 'README', 'readme.md', 'Readme.md']) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      const content = readUpTo(p, 200);
      if (content.trim().length > 20) return { pass: true, note: `${name} (${content.trim().length} chars)` };
    }
  }
  return { pass: false, note: 'No README.md found' };
}

function checkHasManifest(dir) {
  const checks = [
    ['package.json', 'npm'],
    ['pyproject.toml', 'python'],
    ['Cargo.toml', 'rust'],
    ['go.mod', 'go'],
    ['pom.xml', 'java'],
    ['composer.json', 'php'],
  ];
  for (const [name, type] of checks) {
    if (fs.existsSync(path.join(dir, name))) {
      return { pass: true, note: `${type} (${name})` };
    }
  }
  return { pass: false, note: 'No manifest found' };
}

function checkHasLicense(dir) {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'LICENSE-APACHE', 'LICENSE-MIT']) {
    if (fs.existsSync(path.join(dir, name))) {
      return { pass: true, note: name };
    }
  }
  return { pass: false, note: 'No LICENSE file' };
}

function checkNoSecrets(dir) {
  const filesToCheck = ['README.md', 'package.json', '.env.example', 'config.js', 'config.json', '.env'];
  const findings = [];
  
  for (const fname of filesToCheck) {
    const p = path.join(dir, fname);
    if (!fs.existsSync(p)) continue;
    
    // S3 FIX: Skip README files for secret scanning (false positives on docs)
      if (p.toLowerCase().includes('readme') || p.toLowerCase().endsWith('.md')) continue;
      const content = readUpTo(p, 30000);
    for (const pattern of SECRET_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        findings.push(`${pattern.source.slice(0, 30)}~ in ${fname}`);
      }
    }
  }

  return {
    pass: findings.length === 0,
    note: findings.length === 0 ? 'No secrets detected' : `Found ${findings.length}: ${findings.slice(0, 2).join('; ')}`,
    findings: findings.slice(0, 5),
  };
}

function checkNoMalicious(dir) {
  const exts = ['.js', '.ts', '.py', '.sh', '.rb', '.php', '.go', '.rs'];
  const findings = [];

  // Walk 1-level deep max
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!exts.includes(ext)) continue;

      const content = readUpTo(path.join(dir, entry.name), 50000);
      for (const pattern of MALICIOUS_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          findings.push({ file: entry.name, match: matches[0].slice(0, 40) });
        }
      }
    }
  } catch {}

  return {
    pass: findings.length === 0,
    note: findings.length === 0 ? 'No malicious patterns' : `Found ${findings.length} in ${findings[0].file}`,
    findings: findings.slice(0, 3),
  };
}

async function uploadToKV(batch) {
  // KV bulk put: max 10,000 keys per request
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS_ID}/bulk`;
  
  for (let i = 0; i < batch.length; i += 10000) {
    const chunk = batch.slice(i, i + 10000);
    const body = JSON.stringify(chunk);
    
    console.log(`   Uploading ${chunk.length} keys (${((body.length) / 1024 / 1024).toFixed(1)} MB)...`);
    
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${CF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body,
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`   ✅ Batch ${Math.floor(i/10000)+1}/${Math.ceil(batch.length/10000)} uploaded`);
      } else {
        console.error(`   ❌ Upload failed:`, JSON.stringify(result.errors).slice(0, 200));
      }
    } catch (err) {
      console.error(`   ❌ Upload error:`, err.message);
    }
    
    // Rate limit: max 1 write per second per key, but bulk is handled differently
    // Wait 2s between batches
    if (i + 10000 < batch.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

async function main() {
  console.log('=== SENTINEL BULK SCANNER ===');
  console.log(`Skills dir: ${SKILLS_DIR}`);
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log(`KV NS: ${KV_NS_ID}`);
  
  const t0 = Date.now();
  
  // Read all directories
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('{'))
    .map(d => d.name);
  
  console.log(`\nFound ${dirs.length} skill directories\n`);
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < dirs.length; i++) {
    const dirName = dirs[i];
    const dir = path.join(SKILLS_DIR, dirName);
    const slug = dirName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    try {
      // Check 1: Repo Exists - always true for dirs
      const c1 = { pass: true, note: 'Directory exists' };
      
      // Check 2: Has README
      const c2 = checkHasReadme(dir);
      
      // Check 3: Has Manifest
      const c3 = checkHasManifest(dir);
      
      // Check 4: Has License
      const c4 = checkHasLicense(dir);
      
      // Check 5: No Secrets
      const c5 = checkNoSecrets(dir);
      
      // Check 6: No Malicious Code
      const c6 = checkNoMalicious(dir);
      
      const checks = [c1, c2, c3, c4, c5, c6];
      const score = checks.filter(c => c.pass).length;
      const issues = checks.filter(c => !c.pass).map(c => c.note);
      
      results.push({
        slug,
        score,
        maxScore: 6,
        checks: checks.map(c => c.pass),
        issues,
        passed: issues.length === 0,
        timestamp: Date.now(),
      });
      
      if (issues.length === 0) passed++;
      else failed++;
      
      if (i % 500 === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        process.stdout.write(`\r   ${i}/${dirs.length} scanned | ${passed} passed | ${failed} with issues | ${elapsed}s`);
      }
    } catch (err) {
      results.push({
        slug,
        score: 0,
        maxScore: 6,
        checks: [true, false, false, false, false, false],
        issues: ['Error: ' + err.message.slice(0, 50)],
        passed: false,
        timestamp: Date.now(),
      });
      failed++;
    }
  }
  
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\n=== SCAN COMPLETE ===`);
  console.log(`Time: ${elapsed}s`);
  console.log(`Total: ${results.length}`);
  console.log(`Passed (6/6): ${passed}`);
  console.log(`With issues: ${failed}`);
  
  // Stats
  const scores = results.map(r => r.score);
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  const passRate = ((passed / results.length) * 100).toFixed(1);
  const criticalIssues = results.filter(r => r.score <= 3).length;
  
  console.log(`Average score: ${avg}/6`);
  console.log(`Pass rate: ${passRate}%`);
  console.log(`Critical (score ≤3): ${criticalIssues}`);
  
  // Score distribution
  const dist = {};
  for (let s = 0; s <= 6; s++) dist[s] = scores.filter(x => x === s).length;
  console.log(`\nDistribution:`);
  for (let s = 0; s <= 6; s++) {
    const bar = '#'.repeat(Math.ceil(dist[s] / Math.max(...Object.values(dist)) * 50));
    console.log(`  ${s}/6: ${String(dist[s]).padStart(5)} ${bar}`);
  }
  
  // Save results to file
  const outputFile = path.join(__dirname, 'sentinel_results.json');
  fs.writeFileSync(outputFile, JSON.stringify({
    stats: {
      totalSkills: results.length,
      totalScanned: results.length,
      avgScore: parseFloat(avg),
      passRate: parseFloat(passRate),
      criticalIssues,
      maxScore: 6,
      scoreDistribution: dist,
    },
    results,
    scanner: {
      name: 'Sentinel L1',
      version: '1.0',
      checks: ['Repo Exists', 'Has README', 'Has Manifest', 'Has License', 'No Secrets', 'No Malicious Code'],
      status: 'active',
    },
    lastUpdated: Date.now(),
  }));
  
  console.log(`\nResults saved to ${outputFile}`);
  
  // Prepare KV batch
  console.log(`\nPreparing KV batch upload (${results.length} keys)...`);
  const kvBatch = [];
  for (const r of results) {
    kvBatch.push({
      key: `sentinel:${r.slug}`,
      value: JSON.stringify(r),
      expiration_ttl: 2592000, // 30 days
    });
  }
  
  // Also write a summary key
  kvBatch.push({
    key: 'sentinel:stats',
    value: JSON.stringify({
      totalSkills: results.length,
      totalScanned: results.length,
      avgScore: parseFloat(avg),
      passRate: parseFloat(passRate),
      criticalIssues,
      maxScore: 6,
      scoreDistribution: dist,
      lastUpdated: Date.now(),
    }),
    expiration_ttl: 2592000,
  });
  
  console.log(`Uploading ${kvBatch.length} keys to KV...`);
  await uploadToKV(kvBatch);
  
  console.log(`\n✅ DONE! Total time: ${((Date.now() - t0) / 1000 / 60).toFixed(1)} minutes`);
}

main().catch(console.error);
