/**
 * Sentinel Chunked Scanner — Escanea skills en lotes de ~4600
 * 
 * Uso: node sentinel_chunked.cjs [startIndex] [endIndex]
 * Ej:  node sentinel_chunked.cjs 0 4600    # Chunk 1
 *      node sentinel_chunked.cjs 4600 9200  # Chunk 2
 *      node sentinel_chunked.cjs 9200 9248 # Chunk 3
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = 'D:\\skills git';
const ACCOUNT_ID = 'faf93cd2a0d373573de0859b1cc95328';
const KV_NS_ID = '7763872fdabf43ffb04307805214fe45';
const CF_TOKEN = 'CF_API_TOKEN_REMOVED';

// Patterns
const SECRET_PATTERNS = [
  /sk_live_[a-zA-Z0-9]{10,}/,
  /sk_test_[a-zA-Z0-9]{10,}/,
  /pk_live_[a-zA-Z0-9]{10,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /ghu_[a-zA-Z0-9]{36}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (RSA |EC |DSA |PGP |OPENSSH )?PRIVATE KEY-----/,
  /xox[baprs]-[0-9]{10,14}-[0-9]{10,14}-[a-zA-Z0-9]{20,40}/,
  /api[-_]?key['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}/i,
  /password['"]?\s*[:=]\s*['"][^'"]{6,}/i,
  /token['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-\.]{10,}/i,
  /secret['"]?\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}/i,
  /mongodb(?:\+srv)?:\/\/[^@]+@/,
  /postgresql:\/\/[^@]+@/,
  /redis:\/\/:[^@]+@/,
];

const MALICIOUS_PATTERNS = [
  /\beval\s*\(/i, /\bexec\s*\(/i, /\bsystem\s*\(/i, /\bspawn\s*\(/i,
  /\bexecSync\s*\(/i, /\bexecFileSync\s*\(/i, /\bchild_process\b/,
  /\brequire\(['"]child_process['"]\)/, /\bprocess\.env\b/,
  /base64_decode\s*\(/i, /atob\s*\(/i, /new Function\(/i,
  /setTimeout\s*\(\s*['"`]/i, /setInterval\s*\(\s*['"`]/i,
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
];

function readUpTo(filePath, maxBytes = 50000) {
  try { const fd = fs.openSync(filePath, 'r'); const buf = Buffer.alloc(maxBytes); const br = fs.readSync(fd, buf, 0, maxBytes, 0); fs.closeSync(fd); return buf.toString('utf8', 0, br); }
  catch { return ''; }
}

function checkHasReadme(dir) {
  for (const name of ['README.md', 'README', 'readme.md']) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) { const c = readUpTo(p, 200); if (c.trim().length > 20) return { pass: true, note: name }; }
  }
  return { pass: false, note: 'No README' };
}

function checkHasManifest(dir) {
  const files = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'pom.xml', 'composer.json'];
  for (const f of files) {
    if (fs.existsSync(path.join(dir, f))) return { pass: true, note: f };
  }
  return { pass: false, note: 'No manifest' };
}

function checkHasLicense(dir) {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
    if (fs.existsSync(path.join(dir, name))) return { pass: true, note: name };
  }
  return { pass: false, note: 'No LICENSE' };
}

function checkNoSecrets(dir) {
  const filesToCheck = ['README.md', 'package.json', '.env.example', 'config.js', '.env'];
  const findings = [];
  for (const fname of filesToCheck) {
    const p = path.join(dir, fname);
    if (!fs.existsSync(p)) continue;
    const content = readUpTo(p, 30000);
    for (const pattern of SECRET_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) findings.push(`${pattern.source.slice(0, 20)} in ${fname}`);
    }
  }
  return { pass: findings.length === 0, note: findings.length === 0 ? 'Clean' : `${findings.length} issues`, findings: findings.slice(0, 3) };
}

function checkNoMalicious(dir) {
  const exts = ['.js', '.ts', '.py', '.sh', '.rb', '.php', '.go', '.rs'];
  const findings = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!exts.includes(path.extname(entry.name).toLowerCase())) continue;
      const content = readUpTo(path.join(dir, entry.name), 50000);
      for (const pattern of MALICIOUS_PATTERNS) {
        const m = content.match(pattern);
        if (m) findings.push({ file: entry.name, match: m[0].slice(0, 30) });
      }
    }
  } catch {}
  return { pass: findings.length === 0, note: findings.length === 0 ? 'Clean' : `${findings.length} in ${findings[0].file}`, findings: findings.slice(0, 3) };
}

async function uploadToKV(batch) {
  // Dedup: keep last entry per key
  const deduped = new Map();
  for (const item of batch) deduped.set(item.key, item);
  const final = [...deduped.values()];
  if (final.length !== batch.length) {
    console.log(`   Dedup: ${batch.length} → ${final.length}`);
  }
  
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NS_ID}/bulk`;
  for (let i = 0; i < final.length; i += 10000) {
    const chunk = final.slice(i, i + 10000);
    console.log(`   Uploading ${chunk.length} keys (${(JSON.stringify(chunk).length/1024/1024).toFixed(1)} MB)...`);
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      const r = await res.json();
      if (r.success) console.log(`   ✅ Batch uploaded`);
      else console.error(`   ❌ Failed:`, JSON.stringify(r.errors).slice(0, 300));
    } catch (e) { console.error(`   ❌ Error:`, e.message); }
    if (i + 10000 < final.length) await new Promise(r => setTimeout(r, 2000));
  }
}

async function main() {
  const startIdx = parseInt(process.argv[2] || '0');
  const endIdx = parseInt(process.argv[3] || '9248');
  
  console.log(`=== SENTINEL CHUNKED SCANNER ===`);
  console.log(`Chunk: ${startIdx} → ${endIdx}`);
  
  const t0 = Date.now();
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('{'))
    .map(d => d.name);
  
  console.log(`Total: ${dirs.length} dirs`);
  
  const chunk = dirs.slice(startIdx, endIdx);
  console.log(`This chunk: ${chunk.length} skills\n`);
  
  const results = [];
  let passed = 0, failed = 0;
  
  for (let i = 0; i < chunk.length; i++) {
    const dirName = chunk[i];
    const dir = path.join(SKILLS_DIR, dirName);
    const slug = dirName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    try {
      const c1 = { pass: true, note: 'Exists' };
      const c2 = checkHasReadme(dir);
      const c3 = checkHasManifest(dir);
      const c4 = checkHasLicense(dir);
      const c5 = checkNoSecrets(dir);
      const c6 = checkNoMalicious(dir);
      
      const checks = [c1, c2, c3, c4, c5, c6];
      const score = checks.filter(c => c.pass).length;
      const issues = checks.filter(c => !c.pass).map(c => c.note);
      
      results.push({ slug, score, maxScore: 6, checks: checks.map(c => c.pass), issues, passed: issues.length === 0, timestamp: Date.now() });
      if (issues.length === 0) passed++; else failed++;
      
      if ((startIdx + i + 1) % 500 === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
        const totalDone = startIdx + i + 1;
        process.stdout.write(`\r   ${totalDone}/${dirs.length} scanned | ${passed} pass | ${failed} issues | ${elapsed}s`);
      }
    } catch (err) {
      const slug = dirName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      results.push({ slug, score: 1, maxScore: 6, checks: [true, false, false, false, false, false], issues: ['Error: ' + err.message.slice(0, 50)], passed: false, timestamp: Date.now() });
      failed++;
    }
  }
  
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n\n=== CHUNK DONE ===`);
  console.log(`Time: ${elapsed}s | Scanned: ${results.length} | Pass: ${passed} | Issues: ${failed}`);
  
  // Prepare KV batch
  console.log(`\nPreparing KV upload (${results.length + 1} keys)...`);
  const kvBatch = results.map(r => ({
    key: `sentinel:${r.slug}`,
    value: JSON.stringify(r),
    expiration_ttl: 2592000,
  }));
  
  // Update aggregate stats key at end
  kvBatch.push({
    key: 'sentinel:chunk_stats',
    value: JSON.stringify({
      chunk: `${startIdx}-${endIdx}`,
      scanned: results.length,
      passed,
      failed,
      avgScore: (results.reduce((a, r) => a + r.score, 0) / results.length).toFixed(1),
      lastUpdated: Date.now(),
    }),
    expiration_ttl: 2592000,
  });
  
  console.log(`Uploading ${kvBatch.length} keys...`);
  await uploadToKV(kvBatch);
  
  console.log(`\n✅ Chunk ${startIdx}-${endIdx} complete! ${((Date.now()-t0)/1000/60).toFixed(1)} min`);
}

main().catch(console.error);
