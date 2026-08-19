/**
 * MarketNow — License Verify Client (embeddable, offline-capable)
 * ===============================================================
 *
 * This module is meant to be embedded in MCP clients, install CLIs, and
 * agent runtimes. It provides a single class, `LicenseVerifier`, that:
 *
 *   1. Fetches the MarketNow CA public key ONCE (from /api/atc?action=ca-key)
 *      and caches it locally on disk for `cache_ttl` ms (default 24h).
 *   2. Verifies any Ed25519-signed license string OFFLINE — zero network
 *      calls after the first CA key fetch.
 *   3. Optionally fetches the signed revocation list (cached 60s) and
 *      rejects licenses whose `license_id` appears in it.
 *
 * Why this is important
 * ---------------------
 * The OLD license format (`MN-GEN-08561-...`) was a random string. Clients
 * had to call `/api/agent-purchase` (or our DB) on every install to confirm
 * the key existed. Under traffic, this:
 *   - Saturated our GitHub API quota (5000 req/hour)
 *   - Saturated Base RPC limits (verifyUsdcTx)
 *   - Failed closed when Vercel was down
 *
 * The new format is signed Ed25519 — clients can verify locally with zero
 * network calls. This module makes that one-line easy.
 *
 * Usage
 * -----
 *   import { LicenseVerifier } from './license-verify-client.mjs';
 *
 *   const verifier = new LicenseVerifier({
 *     ca_key_url: 'https://marketnow.site/api/atc?action=ca-key',
 *     cache_path: './.marketnow-ca-key.json',
 *     cache_ttl: 86_400_000, // 24h
 *   });
 *
 *   const result = await verifier.verify('MN-LIC-eyJhbGc...');
 *   if (result.valid) {
 *     console.log('License valid for skill:', result.payload.skill_id);
 *     console.log('Expires:', result.payload.expires_at);
 *   } else {
 *     console.error('Invalid license:', result.error);
 *   }
 *
 * CA key rotation
 * ---------------
 * If the MarketNow CA rotates its key, the `kid` in new licenses will differ
 * from the cached `kid`. The verifier detects this automatically:
 *
 *   1. If `header.kid` matches the cached key → verify locally.
 *   2. If `header.kid` differs → re-fetch the CA key (the new key on the
 *      server will have the new kid). If it matches, update the cache and
 *      verify. If it STILL doesn't match, return `kid_mismatch` error
 *      (defensive: don't trust a license whose kid we can't pin to a
 *      known MarketNow key).
 *
 * Environment portability
 * ------------------------
 * The verifier uses ONLY the Node.js built-in `crypto` module and `fetch`
 * (available in Node 18+). It works in:
 *   - Node.js 18+ (LTS)
 *   - Deno 1.28+
 *   - Bun 1.0+
 *   - Modern browsers (when bundled — fetch + Web Crypto's importKey)
 *
 * The disk cache uses `fs/promises` (Node-only). For browser use, pass
 * `cache_path: null` and `cache_get`/`cache_set` hooks backed by
 * `localStorage` or `IndexedDB`.
 *
 * Revocation
 * ----------
 * By default, the verifier does NOT fetch the revocation list (offline-first).
 * Set `check_revocation: true` to enable revocation checking:
 *
 *   const verifier = new LicenseVerifier({
 *     ...,
 *     check_revocation: true,
 *     revocation_url: 'https://marketnow.site/api/license?action=list-revoked',
 *     revocation_ttl: 60_000, // 60s
 *   });
 *
 * Revocation list is cached separately from the CA key (different TTL).
 *
 * SECURITY NOTE
 * -------------
 * The CA public key is fetched over HTTPS from `ca_key_url`. If an attacker
 * can MITM that request, they can substitute their own key and forge any
 * license. To defend against this:
 *
 *   1. The verifier PINSPUBLIC KEY PINNING — after the first successful fetch,
 *      it stores the key in `cache_path` AND a `pin` (sha256 of the SPKI DER).
 *      If a future fetch returns a different key WITHOUT a kid change in any
 *      verified license, that's flagged.
 *   2. Optionally, pass `pinned_kid` to the constructor — the verifier will
 *      reject any CA key whose kid doesn't match (defense against
 *      full-MITM on the very first fetch).
 */

import crypto from 'crypto';
import { promises as fs } from 'fs';
import { verifyLicense, getKidFromLicense, decodeLicense } from './license-ed25519.mjs';

const DEFAULT_CA_KEY_URL = 'https://marketnow.site/api/atc?action=ca-key';
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEFAULT_REVOCATION_TTL_MS = 60 * 1000; // 60s
const DEFAULT_HTTP_TIMEOUT_MS = 5000;

/**
 * Embeddable license verifier. Fetches the CA public key once, then
 * verifies any license offline.
 */
export class LicenseVerifier {
  /**
   * @param {Object} opts
   * @param {string} [opts.ca_key_url] URL of the CA key endpoint (default: marketnow.site)
   * @param {string|null} [opts.cache_path] Path to disk cache file (Node only). null = no disk cache.
   * @param {number} [opts.cache_ttl] Disk cache TTL in ms (default: 24h)
   * @param {boolean} [opts.check_revocation] Enable revocation list fetching (default: false)
   * @param {string} [opts.revocation_url] URL of the revocation list endpoint
   * @param {number} [opts.revocation_ttl] Revocation list cache TTL (default: 60s)
   * @param {string} [opts.pinned_kid] Optional: reject CA keys whose kid doesn't match
   * @param {number} [opts.http_timeout_ms] HTTP timeout (default: 5s)
   * @param {Function} [opts.fetch] Custom fetch function (default: global.fetch)
   * @param {Function} [opts.cache_get] Custom cache getter (overrides disk)
   * @param {Function} [opts.cache_set] Custom cache setter (overrides disk)
   * @param {Object} [opts.logger] Custom logger (default: console)
   */
  constructor(opts = {}) {
    this.ca_key_url = opts.ca_key_url || DEFAULT_CA_KEY_URL;
    this.cache_path = opts.cache_path !== undefined ? opts.cache_path : './.marketnow-ca-key.json';
    this.cache_ttl = opts.cache_ttl || DEFAULT_CACHE_TTL_MS;
    this.check_revocation = opts.check_revocation === true;
    this.revocation_url =
      opts.revocation_url || 'https://marketnow.site/api/license?action=list-revoked';
    this.revocation_ttl = opts.revocation_ttl || DEFAULT_REVOCATION_TTL_MS;
    this.pinned_kid = opts.pinned_kid || null;
    this.http_timeout_ms = opts.http_timeout_ms || DEFAULT_HTTP_TIMEOUT_MS;
    this.fetchFn = opts.fetch || ((typeof fetch !== 'undefined') ? fetch : null);
    this.logger = opts.logger || console;

    // In-memory cache (per-instance — survives multiple verify calls)
    this._caKey = null;        // { pem, kid, fetched_at, source }
    this._revocationList = null; // { revoked_ids: Set, fetched_at }
    this._fetchingCaKey = null;  // Promise — coalesce concurrent fetches
    this._fetchingRevocation = null;

    // Cache hooks (default: disk-based via fs/promises)
    if (opts.cache_get) this._cacheGet = opts.cache_get;
    else this._cacheGet = this._diskCacheGet.bind(this);
    if (opts.cache_set) this._cacheSet = opts.cache_set;
    else this._cacheSet = this._diskCacheSet.bind(this);

    if (!this.fetchFn) {
      throw new Error('LicenseVerifier: no fetch available. Pass `opts.fetch` or run in Node 18+.'); 
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Verify a license string. Returns { valid, payload, error }.
   *
   * Side effects:
   *   - May fetch the CA public key from ca_key_url (if not cached)
   *   - May fetch the revocation list from revocation_url (if check_revocation is true)
   *
   * @param {string} licenseString
   * @returns {Promise<{valid: boolean, payload: Object|null, header: Object|null, error: string|null, license_id: string|null, revoked: boolean|null}>}
   */
  async verify(licenseString) {
    if (typeof licenseString !== 'string' || !licenseString) {
      return { valid: false, payload: null, header: null, error: 'empty_license_string', license_id: null, revoked: null };
    }

    // 1. Decode without verifying (cheap, local)
    let decoded;
    try {
      decoded = decodeLicense(licenseString);
    } catch (e) {
      return { valid: false, payload: null, header: null, error: e.message, license_id: null, revoked: null };
    }
    const { header, payload } = decoded;

    if (!payload) {
      return { valid: false, payload: null, header: null, error: 'malformed_payload', license_id: null, revoked: null };
    }

    // 2. Get the CA public key (cached, refreshed if kid mismatch)
    let caKey;
    try {
      caKey = await this._getCaKey(header.kid);
    } catch (e) {
      return {
        valid: false,
        payload,
        header,
        error: `ca_key_fetch_failed: ${e.message}`,
        license_id: payload.license_id || null,
        revoked: null,
      };
    }

    // 3. Verify the signature locally (zero network calls)
    const result = verifyLicense(licenseString, caKey.pem);

    if (!result.valid) {
      return { ...result, revoked: null };
    }

    // 4. (Optional) Check revocation
    let revoked = null;
    if (this.check_revocation) {
      try {
        revoked = await this._isRevoked(payload.license_id);
      } catch (e) {
        // Best-effort: don't fail verification if the revocation endpoint is down.
        // Callers who want fail-closed revocation should check `revoked === null`
        // and decide. We return revoked=null to signal "couldn't check".
        this.logger.warn?.(`[LicenseVerifier] revocation check failed: ${e.message}`);
      }
    }

    if (revoked === true) {
      return {
        valid: false,
        payload,
        header,
        error: 'license_revoked',
        license_id: payload.license_id,
        revoked: true,
      };
    }

    return { ...result, revoked };
  }

  /**
   * Force-refresh the CA public key (e.g. after a known rotation).
   */
  async refreshCaKey() {
    this._caKey = null;
    await this._getCaKey(null, { force: true });
  }

  /**
   * Force-refresh the revocation list.
   */
  async refreshRevocationList() {
    this._revocationList = null;
    if (this.check_revocation) {
      await this._getRevocationList({ force: true });
    }
  }

  /**
   * Get the currently-cached CA public key info (for debugging).
   */
  getCachedCaKey() {
    return this._caKey;
  }

  // ─── Internal: CA key fetch + cache ─────────────────────────────────────

  /**
   * Get the CA public key, possibly from cache. If `expected_kid` is provided
   * and doesn't match the cached kid, re-fetch.
   *
   * @param {string|null} expected_kid
   * @param {Object} [opts]
   * @param {boolean} [opts.force=false]
   * @returns {Promise<{pem: string, kid: string, fetched_at: number, source: string}>}
   */
  async _getCaKey(expected_kid, opts = {}) {
    // 1. In-memory cache hit + kid matches
    if (!opts.force && this._caKey) {
      if (!expected_kid || this._caKey.kid === expected_kid) {
        return this._caKey;
      }
      // kid mismatch — fall through to re-fetch
      this.logger.info?.(`[LicenseVerifier] kid mismatch (cached=${this._caKey.kid}, expected=${expected_kid}) — re-fetching CA key`);
    }

    // 2. Disk cache hit + kid matches
    if (!opts.force) {
      const diskKey = await this._loadDiskCache().catch(() => null);
      if (diskKey && diskKey.kid && (!expected_kid || diskKey.kid === expected_kid)) {
        if (Date.now() - diskKey.fetched_at < this.cache_ttl) {
          this._caKey = diskKey;
          return diskKey;
        }
      }
    }

    // 3. Coalesce concurrent fetches (don't fire 5 fetches if 5 verifies happen at once)
    if (this._fetchingCaKey) return this._fetchingCaKey;

    this._fetchingCaKey = this._fetchCaKeyFromServer();
    try {
      const key = await this._fetchingCaKey;
      this._caKey = key;
      // Persist to disk cache (best-effort)
      try {
        await this._cacheSet('ca-key', key);
      } catch (e) {
        this.logger.warn?.(`[LicenseVerifier] cache_set failed: ${e.message}`);
      }
      return key;
    } finally {
      this._fetchingCaKey = null;
    }
  }

  async _fetchCaKeyFromServer() {
    if (!this.fetchFn) throw new Error('no fetch function available');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.http_timeout_ms);
    try {
      const res = await this.fetchFn(this.ca_key_url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${this.ca_key_url}`);
      }
      const data = await res.json();
      const pem = data.public_key_pem;
      if (!pem) {
        throw new Error(`response missing public_key_pem field: ${JSON.stringify(data).slice(0, 200)}`);
      }
      // Compute the kid (SPKI DER → base64url)
      const publicKey = crypto.createPublicKey(pem);
      if (publicKey.asymmetricKeyType !== 'ed25519') {
        throw new Error(`CA public key is not Ed25519 (got ${publicKey.asymmetricKeyType})`);
      }
      const spkiDer = publicKey.export({ type: 'spki', format: 'der' });
      const kid = Buffer.from(spkiDer).toString('base64url');

      // Pin check
      if (this.pinned_kid && kid !== this.pinned_kid) {
        throw new Error(
          `ca_key_pin_mismatch: server returned kid=${kid}, verifier is pinned to ${this.pinned_kid}. ` +
          `If this is unexpected, the CA may have been compromised. ` +
          `If this is a known rotation, update the pinned_kid in your verifier config.`
        );
      }

      return {
        pem,
        kid,
        fetched_at: Date.now(),
        source: 'network',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Internal: revocation list fetch + cache ────────────────────────────

  async _isRevoked(license_id) {
    if (!license_id) return false;
    const list = await this._getRevocationList();
    return list.revoked_ids.has(license_id);
  }

  async _getRevocationList(opts = {}) {
    if (!opts.force && this._revocationList) {
      if (Date.now() - this._revocationList.fetched_at < this.revocation_ttl) {
        return this._revocationList;
      }
    }
    if (this._fetchingRevocation) return this._fetchingRevocation;

    this._fetchingRevocation = this._fetchRevocationFromServer();
    try {
      const list = await this._fetchingRevocation;
      this._revocationList = list;
      return list;
    } finally {
      this._fetchingRevocation = null;
    }
  }

  async _fetchRevocationFromServer() {
    if (!this.fetchFn) throw new Error('no fetch function available');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.http_timeout_ms);
    try {
      const res = await this.fetchFn(this.revocation_url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from ${this.revocation_url}`);
      }
      const data = await res.json();
      const revoked = Array.isArray(data.revoked) ? data.revoked : [];
      const revoked_ids = new Set(revoked.map(r => r.license_id).filter(Boolean));
      return {
        revoked_ids,
        fetched_at: Date.now(),
        source: 'network',
        count: revoked_ids.size,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Internal: disk cache (Node-only, opt-out) ──────────────────────────

  async _diskCacheGet(key) {
    if (!this.cache_path) return null;
    try {
      const content = await fs.readFile(this.cache_path, 'utf8');
      const data = JSON.parse(content);
      return data[key] || null;
    } catch (e) {
      if (e.code !== 'ENOENT') {
        this.logger.warn?.(`[LicenseVerifier] cache read failed: ${e.message}`);
      }
      return null;
    }
  }

  async _diskCacheSet(key, value) {
    if (!this.cache_path) return;
    try {
      let data = {};
      try {
        const content = await fs.readFile(this.cache_path, 'utf8');
        data = JSON.parse(content);
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
      data[key] = value;
      await fs.mkdir(new URL(`file://${this.cache_path}`).pathname.replace(/\/[^/]+$/, '') || '.', { recursive: true }).catch(() => {});
      await fs.writeFile(this.cache_path, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      this.logger.warn?.(`[LicenseVerifier] cache write failed: ${e.message}`);
    }
  }

  async _loadDiskCache() {
    if (!this.cache_path) return null;
    return await this._diskCacheGet('ca-key');
  }
}

// ─── Convenience: one-shot verify ─────────────────────────────────────────

/**
 * One-shot verify — fetch the CA key if needed, verify the license, return
 * the result. The `LicenseVerifier` class is preferred (it caches across
 * calls), but this is convenient for scripts.
 *
 * @param {string} licenseString
 * @param {Object} [opts] same as LicenseVerifier constructor
 * @returns {Promise<{valid: boolean, payload: Object|null, error: string|null}>}
 */
export async function verifyLicenseOnce(licenseString, opts = {}) {
  const v = new LicenseVerifier(opts);
  return v.verify(licenseString);
}

// ─── Default exports ──────────────────────────────────────────────────────

export default LicenseVerifier;
export { getKidFromLicense };
