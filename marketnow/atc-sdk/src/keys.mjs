/**
 * ATC/1.0 Key utilities — Ed25519 keypair generation and encoding
 *
 * Uses only Node.js built-in `node:crypto` (no external crypto deps).
 * Public keys are exported as full SPKI in base64 (44 DER bytes → 60 base64 chars).
 * Private keys are exported as full PKCS8 in base64 (48 DER bytes → 64 base64 chars).
 */

import {
  generateKeyPairSync,
  createPublicKey,
  createPrivateKey,
  sign as edSign,
  verify as edVerify,
} from 'node:crypto';

export const ATC_ALGORITHM = 'Ed25519';

/**
 * Generate a new Ed25519 keypair for use as a CA or an agent.
 *
 * @returns {{ publicKey: string, privateKey: string, rawPublicKey: import('node:crypto').KeyObject, rawPrivateKey: import('node:crypto').KeyObject }}
 */
export function generateKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    rawPublicKey: publicKey,
    rawPrivateKey: privateKey,
  };
}

/**
 * Load a private key from its base64 PKCS8 representation.
 * Useful for CAs that persist their key across sessions.
 *
 * @param {string} base64PrivateKey
 * @returns {{ publicKey: string, privateKey: string, rawPublicKey: import('node:crypto').KeyObject, rawPrivateKey: import('node:crypto').KeyObject }}
 */
export function loadKeyPairFromPrivate(base64PrivateKey) {
  const rawPrivateKey = createPrivateKey({
    key: Buffer.from(base64PrivateKey, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  // Node.js doesn't have a direct "derive public from private" for Ed25519,
  // but we can export to JWK and extract, or re-export as KeyObject and use
  // the asymmetric public key. The simplest approach: re-import and the
  // public KeyObject is accessible via createPublicKey(privateKey).
  const rawPublicKey = createPublicKey(rawPrivateKey);
  return {
    publicKey: rawPublicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    privateKey: base64PrivateKey,
    rawPublicKey,
    rawPrivateKey,
  };
}

/**
 * Sign a message with an Ed25519 private key.
 *
 * @param {string|Buffer} message
 * @param {import('node:crypto').KeyObject} rawPrivateKey
 * @returns {string} base64 signature
 */
export function signMessage(message, rawPrivateKey) {
  const buf = typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
  return edSign(null, buf, rawPrivateKey).toString('base64');
}

/**
 * Verify an Ed25519 signature.
 *
 * @param {string|Buffer} message
 * @param {string} base64Signature
 * @param {string} base64PublicKey — full SPKI base64
 * @returns {boolean}
 */
export function verifySignature(message, base64Signature, base64PublicKey) {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(base64PublicKey, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const buf = typeof message === 'string' ? Buffer.from(message, 'utf8') : message;
    return edVerify(null, buf, publicKey, Buffer.from(base64Signature, 'base64'));
  } catch {
    return false;
  }
}
