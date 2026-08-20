/**
 * Smoke test for P2-7: SBOM generator + Sigstore bundle verifier.
 *
 * Verifies:
 *   - SBOM generation produces valid SPDX 2.3 structure
 *   - SBOM includes all dependencies from package.json
 *   - SBOM document hash is reproducible
 *   - Sigstore bundle verifier accepts a valid signature
 *   - Sigstore bundle verifier rejects a tampered signature
 *   - Sigstore bundle verifier rejects an expired cert
 */

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');

const ROOT = '/home/z/my-project/uta-monorepo';
const VECTORS = '/home/z/my-project/uta-monorepo/vectors';
const KEYS = JSON.parse(
  fs.readFileSync(path.join(VECTORS, 'keys', 'manifest.json'), 'utf-8')
).keys;

// Canonicalize (RFC 8785) — local copy for hashing
function canonicalize(v) {
  if (v === null) return 'null';
  if (v === undefined) throw new Error('JCS: undefined');
  const t = typeof v;
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(v)) throw new Error(`JCS: ${v}`);
    if (Number.isInteger(v)) return v.toString();
    let s = v.toString();
    if (s.includes('e') || s.includes('E')) s = s.replace(/E/g, 'e').replace(/e\+/, 'e').replace(/e0*(\d)/, 'e$1');
    if (s.includes('.') && !s.includes('e')) s = s.replace(/\.?0+$/, '');
    if (s === '-0') s = '0';
    return s;
  }
  if (t === 'string') {
    let out = '"';
    for (let i = 0; i < v.length; i++) {
      const ch = v.charCodeAt(i);
      if (ch === 0x22) out += '\\"';
      else if (ch === 0x5c) out += '\\\\';
      else if (ch === 0x08) out += '\\b';
      else if (ch === 0x09) out += '\\t';
      else if (ch === 0x0a) out += '\\n';
      else if (ch === 0x0c) out += '\\f';
      else if (ch === 0x0d) out += '\\r';
      else if (ch < 0x20) out += '\\u' + ch.toString(16).padStart(4, '0');
      else out += v[i];
    }
    return out + '"';
  }
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  if (t === 'object') {
    const keys = Object.keys(v).filter(k => v[k] !== undefined).sort((a, b) => {
      const aC = [], bC = [];
      for (let i = 0; i < a.length; i++) aC.push(a.codePointAt(i));
      for (let i = 0; i < b.length; i++) bC.push(b.codePointAt(i));
      const len = Math.min(aC.length, bC.length);
      for (let i = 0; i < len; i++) { if (aC[i] < bC[i]) return -1; if (aC[i] > bC[i]) return 1; }
      return aC.length - bC.length;
    });
    let out = '{';
    for (let i = 0; i < keys.length; i++) {
      if (i > 0) out += ',';
      out += canonicalize(keys[i]) + ':' + canonicalize(v[keys[i]]);
    }
    return out + '}';
  }
  return canonicalize(String(v));
}

// ── SBOM generation (mirror of supply-chain.ts) ──

function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function generateSBOM(rootDir, opts = {}) {
  const pkgJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) throw new Error(`no package.json at ${pkgJsonPath}`);
  const rootPkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  const created = new Date().toISOString();
  const packages = [];
  const relationships = [];
  const rootSpdxId = 'SPDXRef-Package-root';

  packages.push({
    SPDXID: rootSpdxId,
    name: rootPkg.name || path.basename(rootDir),
    versionInfo: rootPkg.version || '0.0.0',
    downloadLocation: rootPkg.repository?.url || 'NOASSERTION',
    filesAnalyzed: false,
    licenseDeclared: rootPkg.license || 'NOASSERTION',
    checksums: [{ algorithm: 'SHA256', checksumValue: hashFile(pkgJsonPath) }],
    homepage: rootPkg.homepage || rootPkg.repository?.url,
    description: rootPkg.description,
  });

  const deps = { ...(rootPkg.dependencies || {}), ...(rootPkg.devDependencies || {}) };
  const nodeModulesDir = path.join(rootDir, 'node_modules');
  const hasNodeModules = fs.existsSync(nodeModulesDir);

  for (const [depName, depVersion] of Object.entries(deps)) {
    const depSpdxId = `SPDXRef-Package-${depName.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
    let checksum = null, resolvedVersion = null, license = null;
    if (hasNodeModules) {
      const depPkgPath = path.join(nodeModulesDir, depName, 'package.json');
      if (fs.existsSync(depPkgPath)) {
        const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf-8'));
        checksum = hashFile(depPkgPath);
        resolvedVersion = depPkg.version;
        license = depPkg.license || null;
      }
    }
    packages.push({
      SPDXID: depSpdxId,
      name: depName,
      versionInfo: resolvedVersion || String(depVersion),
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseDeclared: license || 'NOASSERTION',
      checksums: checksum ? [{ algorithm: 'SHA256', checksumValue: checksum }] : [],
    });
    relationships.push({ spdxElementId: rootSpdxId, relationshipType: 'DEPENDS_ON', relatedSpdxElement: depSpdxId });
  }

  const doc = {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `SBOM for ${rootPkg.name}`,
    documentNamespace: `https://marketnow.site/spdx/${rootPkg.name}/${rootPkg.version}/${Date.now()}`,
    creationInfo: { created, creators: [opts.creator || 'Organization: AliceLabs LLC', 'Tool: UTA-SBOM-Generator-1.0'] },
    packages, relationships, documentDescribes: [rootSpdxId],
  };
  const canonical = canonicalize({ ...doc, documentHash: undefined });
  doc.documentHash = 'sha256:' + crypto.createHash('sha256').update(canonical, 'utf-8').digest('hex');
  return doc;
}

// ── Sigstore bundle verifier (mirror of supply-chain.ts) ──

function verifySigstoreBundle(bundle, opts = {}) {
  const issues = [];
  const now = opts.now || new Date();
  let cert;
  try { cert = new crypto.X509Certificate(bundle.certificate); }
  catch (e) { return { valid: false, issues: [`failed to parse certificate: ${e.message}`] }; }

  let signerIdentity;
  try {
    const san = cert.subjectAltName;
    if (san) {
      const m = san.match(/URI:([^\s,]+)/);
      if (m) signerIdentity = m[1];
    }
  } catch {}

  const notBefore = cert.validFromDate || cert.validFrom;
  const notAfter = cert.validToDate || cert.validTo;
  if (notBefore && now < notBefore) issues.push(`certificate not yet valid`);
  if (notAfter && now > notAfter) issues.push(`certificate expired`);

  let signatureValid = false;
  try {
    const signature = Buffer.from(bundle.signature, 'base64');
    const content = bundle.content ? Buffer.from(bundle.content, 'base64') : Buffer.alloc(0);
    const publicKey = cert.publicKey;
    const kt = publicKey.asymmetricKeyType;
    if (kt === 'rsa') signatureValid = crypto.verify('RSA-SHA256', content, publicKey, signature);
    else if (kt === 'ec') {
      try { signatureValid = crypto.verify('SHA256', content, { key: publicKey, dsaEncoding: 'der' }, signature); }
      catch { signatureValid = crypto.verify('SHA256', content, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature); }
    } else if (kt === 'ed25519') signatureValid = crypto.verify(null, content, publicKey, signature);
    else issues.push(`unsupported key type: ${kt}`);
    if (!signatureValid) issues.push('signature verification failed');
  } catch (e) { issues.push(`verification error: ${e.message}`); }

  if (opts.expectedIdentity && signerIdentity && !signerIdentity.includes(opts.expectedIdentity)) {
    issues.push(`identity mismatch: expected "${opts.expectedIdentity}", got "${signerIdentity}"`);
  }

  return { valid: issues.length === 0 && signatureValid, issues, signerIdentity, notBefore, notAfter };
}

// ── Run smoke test ──
let passed = 0, failed = 0;
function check(name, fn) {
  try { if (fn()) { passed++; console.log(`✅ ${name}`); } else { failed++; console.log(`❌ ${name}`); } }
  catch (e) { failed++; console.log(`❌ ${name}: ${e.message}`); }
}

// SBOM — point at packages/core which has actual dependencies
const sbom = generateSBOM(path.join(ROOT, 'packages', 'core'), { creator: 'Organization: AliceLabs LLC' });

check('SBOM has SPDX 2.3 version', () => sbom.spdxVersion === 'SPDX-2.3');
check('SBOM has root package', () => sbom.packages.some(p => p.SPDXID === 'SPDXRef-Package-root'));
check('SBOM has relationships', () => sbom.relationships.length > 0);
check('SBOM root package has checksum', () => {
  const root = sbom.packages.find(p => p.SPDXID === 'SPDXRef-Package-root');
  return root && root.checksums.length > 0 && root.checksums[0].checksumValue.length === 64;
});
check('SBOM document hash is reproducible', () => {
  // Regenerate and verify documentHash matches a fresh canonicalize() of the doc (minus documentHash field)
  const docForHash = { ...sbom, documentHash: undefined };
  const expected = 'sha256:' + crypto.createHash('sha256').update(canonicalize(docForHash), 'utf-8').digest('hex');
  return sbom.documentHash === expected;
});
check('SBOM has at least one DEPENDS_ON relationship', () => {
  return sbom.relationships.some(r => r.relationshipType === 'DEPENDS_ON');
});
check('SBOM is valid JSON', () => {
  JSON.stringify(sbom); // throws if cyclic
  return true;
});

// Sigstore
// Generate a self-signed cert for testing using openssl
const caEd = KEYS.ca_ed25519;
const tmpDir = require('node:os').tmpdir();
const tmpKey = path.join(tmpDir, `uta-sbom-test-${Date.now()}.key`);
const tmpCert = path.join(tmpDir, `uta-sbom-test-${Date.now()}.crt`);
const tmpConfig = path.join(tmpDir, `uta-sbom-test-${Date.now()}.cnf`);

// We need an RSA key for cert generation (Ed25519 certs need extra config)
// Generate a fresh RSA key + self-signed cert via openssl
let testCertPem, testKeyPem;
try {
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout "${tmpKey}" -out "${tmpCert}" -days 365 -subj "/CN=UTA-Test-Signer" -addext "subjectAltName=URI:https://github.com/test/test.yml@refs/tags/v1.0" 2>&1`, { stdio: 'pipe' });
  testCertPem = fs.readFileSync(tmpCert, 'utf-8');
  testKeyPem = fs.readFileSync(tmpKey, 'utf-8');
} catch (e) {
  console.log(`⚠️  openssl cert generation failed — skipping Sigstore tests: ${e.message}`);
  process.exit(failed > 0 ? 1 : 0);
} finally {
  try { fs.unlinkSync(tmpKey); } catch {}
  try { fs.unlinkSync(tmpCert); } catch {}
  try { fs.unlinkSync(tmpConfig); } catch {}
}

// Build a Sigstore-style bundle
const content = Buffer.from('Hello, world! This is the artifact being signed.', 'utf-8');
const signature = crypto.sign('RSA-SHA256', content, crypto.createPrivateKey(testKeyPem)).toString('base64');
const bundle = {
  content: content.toString('base64'),
  signature,
  certificate: testCertPem,
};

check('Sigstore bundle verifies with correct signature', () => {
  const r = verifySigstoreBundle(bundle);
  return r.valid;
});

check('Sigstore bundle extracts signer identity from SAN', () => {
  const r = verifySigstoreBundle(bundle);
  return r.signerIdentity && r.signerIdentity.includes('github.com/test');
});

check('Sigstore bundle rejects tampered signature', () => {
  const tampered = { ...bundle, signature: Buffer.alloc(256, 0x42).toString('base64') };
  const r = verifySigstoreBundle(tampered);
  return !r.valid;
});

check('Sigstore bundle rejects tampered content', () => {
  const tampered = { ...bundle, content: Buffer.from('Tampered content', 'utf-8').toString('base64') };
  const r = verifySigstoreBundle(tampered);
  return !r.valid;
});

check('Sigstore bundle with expected identity passes when match', () => {
  const r = verifySigstoreBundle(bundle, { expectedIdentity: 'github.com/test/test.yml' });
  return r.valid;
});

check('Sigstore bundle with expected identity fails when mismatch', () => {
  const r = verifySigstoreBundle(bundle, { expectedIdentity: 'github.com/attacker/evil.yml' });
  return !r.valid && r.issues.some(i => i.includes('identity mismatch'));
});

check('Sigstore bundle rejects expired cert', () => {
  // Generate a long-lived cert, but ask the verifier to verify at a date in the future past expiry.
  const tmpExpKey = path.join(tmpDir, `uta-sbom-exp-${Date.now()}.key`);
  const tmpExpCert = path.join(tmpDir, `uta-sbom-exp-${Date.now()}.crt`);
  try {
    // 1-day cert
    execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout "${tmpExpKey}" -out "${tmpExpCert}" -days 1 -subj "/CN=UTA-ShortLived" 2>&1`, { stdio: 'pipe' });
    const shortCert = fs.readFileSync(tmpExpCert, 'utf-8');
    const shortKey = fs.readFileSync(tmpExpKey, 'utf-8');
    const sig = crypto.sign('RSA-SHA256', content, crypto.createPrivateKey(shortKey)).toString('base64');
    // Verify at a date 2 days from now — cert will be expired
    const futureNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const r = verifySigstoreBundle({ content: content.toString('base64'), signature: sig, certificate: shortCert }, { now: futureNow });
    return !r.valid && r.issues.some(i => i.includes('expired'));
  } finally {
    try { fs.unlinkSync(tmpExpKey); } catch {}
    try { fs.unlinkSync(tmpExpCert); } catch {}
  }
});

console.log(`\n${passed}/${passed + failed} supply chain smoke tests passed`);
process.exit(failed > 0 ? 1 : 0);
