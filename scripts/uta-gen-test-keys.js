#!/usr/bin/env node
/**
 * Generate fixed test keypairs for UTA conformance vectors.
 *
 * These keys are NOT secret — they are committed to the repo so that:
 *   1. Test vectors are reproducible across runs.
 *   2. Cross-language implementations (Python, Rust, Go) can verify the
 *      same vectors against the same keys without anyone needing to share
 *      secrets out-of-band.
 *
 * DO NOT use these keys in production. They exist solely as fixtures.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const VECTORS_KEY_DIR = path.join(
  __dirname,
  '..',
  'uta-monorepo',
  'vectors',
  'keys'
);

function makeEd25519() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const raw = der.subarray(der.length - 32).toString('base64url');
  const keyId = crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
  return { public_key_pem: pubPem, private_key_pem: privPem, public_key_raw_b64url: raw, key_id: keyId, algorithm: 'Ed25519' };
}

function makeRSA() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    hashAlgorithm: 'sha256',
  });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const keyId = crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
  return { public_key_pem: pubPem, private_key_pem: privPem, key_id: keyId, algorithm: 'RS256' };
}

function makeECDSA() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const keyId = crypto.createHash('sha256').update(der).digest('hex').slice(0, 16);
  return { public_key_pem: pubPem, private_key_pem: privPem, key_id: keyId, algorithm: 'ES256' };
}

const keys = {
  ca_ed25519: makeEd25519(),
  agent_ed25519: makeEd25519(),
  ca_rsa: makeRSA(),
  ca_ecdsa: makeECDSA(),
  gateway_ed25519: makeEd25519(),
};

const manifest = {
  generated_at: new Date().toISOString(),
  note: 'FIXED TEST KEYS — committed to repo for reproducible vectors. DO NOT USE IN PRODUCTION.',
  keys,
};

fs.mkdirSync(VECTORS_KEY_DIR, { recursive: true });
fs.writeFileSync(
  path.join(VECTORS_KEY_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
  'utf-8'
);

// Also write individual PEM files for easy inspection / cross-language loading
for (const [name, key] of Object.entries(keys)) {
  fs.writeFileSync(path.join(VECTORS_KEY_DIR, `${name}.pub.pem`), key.public_key_pem);
  fs.writeFileSync(path.join(VECTORS_KEY_DIR, `${name}.priv.pem`), key.private_key_pem);
}

console.log(`✅ Wrote ${Object.keys(keys).length * 2 + 1} files to ${VECTORS_KEY_DIR}`);
console.log('   manifest.json + {pub,priv}.pem for each key:');
for (const [name, key] of Object.entries(keys)) {
  console.log(`   - ${name}: ${key.algorithm}, key_id=${key.key_id}`);
}
