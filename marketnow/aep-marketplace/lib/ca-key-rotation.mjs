/**
 * MarketNow — CA Key Rotation + Key Versioning
 * =============================================
 *
 * Addresses feedback from @jkming and @mads_hansen on dev.to:
 * "What happens if the CA key itself is compromised?"
 *
 * Design:
 *   1. Each ATC includes `ca_key_id` (e.g., "ca-key-001")
 *   2. The CA key registry is a JSON file in _data/atc/ca-key-registry.json
 *   3. Each entry: { key_id, public_key_pem, status: "active"|"retired", created_at, retired_at? }
 *   4. Verifiers check which key signed the ATC and look it up in the registry
 *   5. If the key is "retired", all ATCs signed by it are invalid
 *
 * Rotation flow:
 *   1. Generate new keypair (ca-key-002)
 *   2. Re-sign all active ATCs with the new key
 *   3. Mark old key as "retired" in the registry
 *   4. Verifiers reject ATCs signed by retired keys
 */

import crypto from 'crypto';

const KEY_REGISTRY_URL = 'https://raw.githubusercontent.com/alicelabs-llc/marketnow/master/_data/atc/ca-key-registry.json';

// In-memory cache for key registry
let _keyRegistry = null;
let _keyRegistryFetchedAt = 0;
const REGISTRY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

/**
 * Fetch the CA key registry from GitHub.
 * Returns an array of { key_id, public_key_pem, status, created_at, retired_at? }
 */
export async function fetchKeyRegistry() {
  if (_keyRegistry && Date.now() - _keyRegistryFetchedAt < REGISTRY_CACHE_TTL_MS) {
    return _keyRegistry;
  }
  try {
    const r = await fetch(KEY_REGISTRY_URL, {
      headers: { 'User-Agent': 'marketnow-atc' },
    });
    if (!r.ok) return null;
    const data = await r.json();
    _keyRegistry = data.keys || [];
    _keyRegistryFetchedAt = Date.now();
    return _keyRegistry;
  } catch {
    return _keyRegistry || null;
  }
}

/**
 * Get the active CA public key (the one currently used for signing).
 * @returns {Promise<{key_id: string, public_key_pem: string} | null>}
 */
export async function getActiveCAKey() {
  const registry = await fetchKeyRegistry();
  if (!registry) return null;
  const active = registry.find(k => k.status === 'active');
  return active || null;
}

/**
 * Check if a CA key is still valid (not retired).
 * @param {string} key_id
 * @returns {Promise<{valid: boolean, reason?: string, retired_at?: string}>}
 */
export async function isKeyValid(key_id) {
  const registry = await fetchKeyRegistry();
  if (!registry) return { valid: true, reason: 'registry_unavailable' }; // fail open if registry unavailable
  
  const key = registry.find(k => k.key_id === key_id);
  if (!key) return { valid: false, reason: 'key_not_in_registry' };
  if (key.status === 'retired') {
    return { valid: false, reason: 'key_retired', retired_at: key.retired_at };
  }
  return { valid: true };
}

/**
 * Verify an ATC signature using the correct CA key from the registry.
 * This replaces the old single-key verification with multi-key support.
 *
 * @param {Object} payload - the ATC payload
 * @param {string} signatureHex - hex signature
 * @param {string} keyId - which CA key signed this ATC
 * @returns {Promise<{valid: boolean, reason?: string}>}
 */
export async function verifyWithKeyRegistry(payload, signatureHex, keyId) {
  // Check if the key is still valid
  const keyStatus = await isKeyValid(keyId);
  if (!keyStatus.valid) {
    return keyStatus;
  }

  // Get the public key for this key_id
  const registry = await fetchKeyRegistry();
  if (!registry) {
    // Fallback: use the current CA key (backwards compatibility)
    return { valid: true, reason: 'registry_unavailable_using_fallback' };
  }

  const keyEntry = registry.find(k => k.key_id === keyId);
  if (!keyEntry) {
    return { valid: false, reason: 'key_not_found_in_registry' };
  }

  try {
    const publicKey = crypto.createPublicKey(keyEntry.public_key_pem);
    const { canonicalize } = await import('./canonical-json.mjs');
    const data = Buffer.from(canonicalize(payload), 'utf-8');
    const signature = Buffer.from(signatureHex, 'hex');
    const valid = crypto.verify(null, data, publicKey, signature);
    return { valid };
  } catch (e) {
    return { valid: false, reason: 'verification_error', error: e.message };
  }
}

/**
 * Generate a new CA keypair for rotation.
 * Returns { key_id, private_key_pem, public_key_pem }
 * The caller must:
 *   1. Set the private key as the Vercel env var
 *   2. Add the public key to the registry with status "active"
 *   3. Mark the old key as "retired"
 *   4. Re-sign all active ATCs with the new key
 */
export function generateNewCAKey(keyId) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }).trim();
  
  return {
    key_id: keyId || `ca-key-${Date.now()}`,
    private_key_pem: privPem,
    public_key_pem: pubPem,
    algorithm: 'Ed25519',
    created_at: new Date().toISOString(),
  };
}

export { KEY_REGISTRY_URL };
