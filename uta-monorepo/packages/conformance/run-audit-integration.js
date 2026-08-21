/**
 * P8-2: Audit log (Merkle tree) integration tests.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const KEYS = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'vectors', 'keys', 'manifest.json'), 'utf-8')
).keys;

const auditModule = require(path.join(ROOT, 'packages', 'audit', 'dist', 'index.js'));

let passed = 0, failed = 0;
const failures = [];

async function check(name, fn) {
  try {
    const r = await fn();
    if (r === true || (r && r.valid === true)) { passed++; console.log(`✅ ${name}`); }
    else {
      failed++;
      const reason = r?.reason || 'returned false';
      failures.push({ name, reason });
      console.log(`❌ ${name}: ${reason}`);
    }
  } catch (e) {
    failed++;
    failures.push({ name, reason: e.message });
    console.log(`❌ ${name}: ${e.message}`);
  }
}

async function main() {
  console.log('── Audit Log / Merkle Tree (P8-2) ──');

  const gwKey = {
    privateKeyPem: KEYS.gateway_ed25519.private_key_pem,
    publicKeyPem: KEYS.gateway_ed25519.public_key_pem,
    publicKeyRaw: KEYS.gateway_ed25519.public_key_raw_b64url,
    keyId: KEYS.gateway_ed25519.key_id,
  };

  await check('MerkleTree starts empty', () => {
    const tree = new auditModule.MerkleTree();
    return tree.getRoot() === null && tree.size() === 0;
  });

  await check('MerkleTree.add returns entry with sequence', () => {
    const tree = new auditModule.MerkleTree();
    const entry = tree.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: new Date().toISOString() });
    return entry.sequence === 0 && entry.receipt_id === 'r1';
  });

  await check('MerkleTree produces a root hash', () => {
    const tree = new auditModule.MerkleTree();
    tree.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: new Date().toISOString() });
    tree.add({ receipt_id: 'r2', receipt_hash: 'sha256:def', timestamp: new Date().toISOString() });
    const root = tree.getRoot();
    return root !== null && root.length === 64; // SHA-256 hex
  });

  await check('MerkleTree root changes when a leaf is modified', () => {
    const tree1 = new auditModule.MerkleTree();
    tree1.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: '2026-01-01' });
    tree1.add({ receipt_id: 'r2', receipt_hash: 'sha256:def', timestamp: '2026-01-02' });
    const root1 = tree1.getRoot();

    const tree2 = new auditModule.MerkleTree();
    tree2.add({ receipt_id: 'r1', receipt_hash: 'sha256:TAMPERED', timestamp: '2026-01-01' });
    tree2.add({ receipt_id: 'r2', receipt_hash: 'sha256:def', timestamp: '2026-01-02' });
    const root2 = tree2.getRoot();

    return root1 !== root2;
  });

  await check('MerkleTree.getProof generates proof for leaf', () => {
    const tree = new auditModule.MerkleTree();
    tree.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: '2026-01-01' });
    tree.add({ receipt_id: 'r2', receipt_hash: 'sha256:def', timestamp: '2026-01-02' });
    tree.add({ receipt_id: 'r3', receipt_hash: 'sha256:ghi', timestamp: '2026-01-03' });
    const proof = tree.getProof(1);
    return proof !== null && proof.leaf_index === 1 && proof.path.length > 0;
  });

  await check('MerkleTree.verifyProof accepts valid proof', () => {
    const tree = new auditModule.MerkleTree();
    tree.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: '2026-01-01' });
    tree.add({ receipt_id: 'r2', receipt_hash: 'sha256:def', timestamp: '2026-01-02' });
    tree.add({ receipt_id: 'r3', receipt_hash: 'sha256:ghi', timestamp: '2026-01-03' });
    tree.add({ receipt_id: 'r4', receipt_hash: 'sha256:jkl', timestamp: '2026-01-04' });
    const proof = tree.getProof(2);
    return auditModule.MerkleTree.verifyProof(proof);
  });

  await check('MerkleTree.verifyProof rejects tampered proof', () => {
    const tree = new auditModule.MerkleTree();
    tree.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: '2026-01-01' });
    tree.add({ receipt_id: 'r2', receipt_hash: 'sha256:def', timestamp: '2026-01-02' });
    const proof = tree.getProof(0);
    // Tamper with the leaf hash
    proof.leaf_hash = '0'.repeat(64);
    return !auditModule.MerkleTree.verifyProof(proof);
  });

  await check('MerkleTree.signRoot produces signed root', () => {
    const tree = new auditModule.MerkleTree();
    tree.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: '2026-01-01' });
    const signed = tree.signRoot(gwKey);
    return signed.root.length === 64 && signed.signature.value.length === 128;
  });

  await check('MerkleTree.verifySignedRoot accepts valid signature', () => {
    const tree = new auditModule.MerkleTree();
    tree.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: '2026-01-01' });
    const signed = tree.signRoot(gwKey);
    return auditModule.MerkleTree.verifySignedRoot(signed, gwKey.publicKeyPem);
  });

  await check('MerkleTree.verifySignedRoot rejects wrong key', () => {
    const tree = new auditModule.MerkleTree();
    tree.add({ receipt_id: 'r1', receipt_hash: 'sha256:abc', timestamp: '2026-01-01' });
    const signed = tree.signRoot(gwKey);
    return !auditModule.MerkleTree.verifySignedRoot(signed, KEYS.ca_ed25519.public_key_pem);
  });

  // ── AuditLog ──
  console.log('\n── AuditLog ──');

  await check('AuditLog.add stores receipt and computes hash', () => {
    const log = new auditModule.AuditLog();
    const entry = log.add({ receipt_id: 'r1', decision: 'ALLOW', agent_id: 'a1' });
    return entry.receipt_id === 'r1' && entry.receipt_hash.startsWith('sha256:');
  });

  await check('AuditLog.getRoot returns current root', () => {
    const log = new auditModule.AuditLog();
    log.add({ receipt_id: 'r1', decision: 'ALLOW' });
    log.add({ receipt_id: 'r2', decision: 'DENY' });
    return log.getRoot() !== null && log.size() === 2;
  });

  await check('AuditLog.verifyReceipt confirms inclusion', () => {
    const log = new auditModule.AuditLog();
    log.add({ receipt_id: 'r1', decision: 'ALLOW' });
    log.add({ receipt_id: 'r2', decision: 'DENY' });
    log.add({ receipt_id: 'r3', decision: 'ALLOW' });
    const result = log.verifyReceipt('r2');
    return result.included === true;
  });

  await check('AuditLog.verifyReceipt returns false for missing receipt', () => {
    const log = new auditModule.AuditLog();
    log.add({ receipt_id: 'r1', decision: 'ALLOW' });
    const result = log.verifyReceipt('r99');
    return !result.included;
  });

  await check('AuditLog.publishRoot signs the current root', () => {
    const log = new auditModule.AuditLog();
    log.add({ receipt_id: 'r1', decision: 'ALLOW' });
    log.add({ receipt_id: 'r2', decision: 'DENY' });
    const signed = log.publishRoot(gwKey);
    return signed.root === log.getRoot() && signed.signature.value.length === 128;
  });

  await check('AuditLog.verifyIntegrity returns valid=true when untampered', () => {
    const log = new auditModule.AuditLog();
    log.add({ receipt_id: 'r1', decision: 'ALLOW' });
    log.add({ receipt_id: 'r2', decision: 'DENY' });
    log.publishRoot(gwKey);
    const result = log.verifyIntegrity(gwKey.publicKeyPem);
    return result.valid === true;
  });

  await check('AuditLog tracks multiple signed roots', () => {
    const log = new auditModule.AuditLog();
    log.add({ receipt_id: 'r1', decision: 'ALLOW' });
    log.publishRoot(gwKey);
    log.add({ receipt_id: 'r2', decision: 'DENY' });
    log.publishRoot(gwKey);
    log.add({ receipt_id: 'r3', decision: 'ALLOW' });
    log.publishRoot(gwKey);
    return log.getSignedRoots().length === 3;
  });

  await check('AuditLog.getEntries returns all entries', () => {
    const log = new auditModule.AuditLog();
    log.add({ receipt_id: 'r1', decision: 'ALLOW' });
    log.add({ receipt_id: 'r2', decision: 'DENY' });
    log.add({ receipt_id: 'r3', decision: 'ALLOW' });
    const entries = log.getEntries();
    return entries.length === 3 && entries[0].sequence === 0 && entries[2].sequence === 2;
  });

  // ── Large tree test ──
  await check('MerkleTree handles 1000 entries', () => {
    const tree = new auditModule.MerkleTree();
    for (let i = 0; i < 1000; i++) {
      tree.add({ receipt_id: `r${i}`, receipt_hash: `sha256:${i}`, timestamp: new Date().toISOString() });
    }
    const root = tree.getRoot();
    const proof = tree.getProof(500);
    return tree.size() === 1000 && root !== null && proof !== null && auditModule.MerkleTree.verifyProof(proof);
  });

  // ── Summary ──
  console.log('\n' + '='.repeat(60));
  console.log(`UTA Audit Log Integration: ${passed}/${passed + failed} tests passed`);
  console.log(`Conformant: ${failed === 0 ? 'YES ✅' : 'NO ❌'}`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.reason}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
