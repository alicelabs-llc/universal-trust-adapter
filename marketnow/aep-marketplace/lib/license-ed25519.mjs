/**
 * MarketNow — Ed25519-Signed Licenses (JWT-like compact serialization)
 * ====================================================================
 *
 * REPLACES the legacy `MN-GEN-08561-...` random-string license keys, which
 * had two problems:
 *
 *   1. Could not be verified offline — clients had to call our API on every
 *      install to check the key existed. Public RPCs / GitHub API got
 *      hammered on traffic spikes.
 *   2. Had no cryptographic binding to {skill_id, buyer_wallet, expires_at,
 *      features}. A typo or a malicious reseller could "reassign" a key to
 *      a different skill by simply editing our database row.
 *
 * SOLUTION: a JWT-like compact-serialization license signed with the same
 * Ed25519 CA private key we already use for ATC cards
 * (`MARKETNOW_ATC_CA_PRIVATE_KEY`). This means:
 *
 *   - Clients (MCP runtimes, install CLIs, the `vibe` action-ref system)
 *     fetch the CA public key ONCE, pin it, and then verify every license
 *     offline. Zero network calls per install after the first.
 *   - A license cryptographically binds {skill_id, buyer_wallet, expires_at,
 *      features}. Tampering with any field invalidates the signature.
 *   - Revocation is handled by the existing signed-revocation-list flow
 *     (lib/revocation-list.mjs) — a single 60s-cached fetch gives clients
 *     the full list of revoked license_ids.
 *
 * FORMAT
 * ------
 *   MN-LIC-{base64url(header)}.{base64url(payload)}.{base64url(signature)}
 *
 * Header (object, JSON → base64url):
 *   {
 *     "alg": "Ed25519",
 *     "typ": "MN-LICENSE",
 *     "kid": "<base64url(SPKI DER of CA public key)>",
 *     "version": 1
 *   }
 *
 * Payload (object, JSON → base64url):
 *   {
 *     "skill_id": "mn-gen-00001",
 *     "buyer_wallet": "0xabc...",
 *     "issued_at": "2026-08-19T00:00:00Z",
 *     "expires_at": "2027-08-19T00:00:00Z",
 *     "features": ["install", "verify", "execute"],
 *     "issuer": "MarketNow",
 *     "license_id": "MN-LIC-2026-0000001"
 *   }
 *
 * Signature: Ed25519 over the ASCII bytes of
 *   `{base64url(header)}.{base64url(payload)}`
 * (identical to JWT compact serialization — RFC 7519 §3.1).
 *
 * The signature is detached (NOT inside the payload). Verification re-derives
 * the signing input from the header+payload segments and checks the signature
 * against the CA public key.
 *
 * Cryptography
 * ------------
 *   - Algorithm: Ed25519 (RFC 8032), via Node.js built-in `crypto`.
 *   - No external crypto deps (no `@noble/ed25519`, no `tweetnacl`).
 *   - CA private key: PKCS8 PEM in `MARKETNOW_ATC_CA_PRIVATE_KEY` (same
 *     env var as ATC issuance — single rotation event rotates both).
 *   - CA public key: derived from the private key, exported as SPKI PEM
 *     and as SPKI DER (the DER bytes form the `kid`).
 *
 * Versioning
 * ----------
 *   `header.version = 1`. Future formats (e.g. adding `max_invocations`
 *   or `scopes`) bump the version and add a new field — old verifiers
 *   continue to work because they only check the fields they know.
 */

import crypto from 'crypto';

// ─── Constants ────────────────────────────────────────────────────────────

const LICENSE_PREFIX = 'MN-LIC-';
const HEADER_TYP = 'MN-LICENSE';
const HEADER_ALG = 'Ed25519';
const LICENSE_VERSION = 1;
const ISSUER = 'MarketNow';
const DEFAULT_FEATURES = ['install', 'verify', 'execute'];
const DEFAULT_TTL_DAYS = 365;

// ─── CA key cache (per warm instance — same pattern as action-receipt.mjs) ─

let _caPrivateKey = null;
let _caPublicKey = null;
let _caPublicKeyPem = null;
let _caPublicKeyDerB64url = null; // also serves as the `kid`

/**
 * Load the MarketNow CA Ed25519 keys from the env var.
 *
 * The SAME key is used for ATC card issuance (api/atc.js) and license
 * issuance (this module). This is intentional: a single rotation event
 * (replacing MARKETNOW_ATC_CA_PRIVATE_KEY) rotates BOTH signing domains
 * at once, and clients only need to pin ONE public key.
 *
 * @returns {{privateKey: crypto.KeyObject, publicKey: crypto.KeyObject, publicKeyPem: string, kid: string}}
 * @throws {Error} if `MARKETNOW_ATC_CA_PRIVATE_KEY` is unset or invalid.
 */
export function loadCAKeys() {
  if (_caPrivateKey) {
    return {
      privateKey: _caPrivateKey,
      publicKey: _caPublicKey,
      publicKeyPem: _caPublicKeyPem,
      kid: _caPublicKeyDerB64url,
    };
  }

  const pem = process.env.MARKETNOW_ATC_CA_PRIVATE_KEY;
  if (!pem) {
    throw new Error(
      'CA private key not configured. Set MARKETNOW_ATC_CA_PRIVATE_KEY env var ' +
      '(same key used for ATC issuance).'
    );
  }

  _caPrivateKey = crypto.createPrivateKey(pem);
  if (_caPrivateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(
      `MARKETNOW_ATC_CA_PRIVATE_KEY is not an Ed25519 key ` +
      `(got: ${_caPrivateKey.asymmetricKeyType}). ` +
      `Generate one with: openssl genpkey -algorithm Ed25519 -out ca.key && ` +
      `openssl pkcs8 -topk8 -in ca.key -out ca.pem -nocrypt`
    );
  }

  _caPublicKey = crypto.createPublicKey(_caPrivateKey);
  _caPublicKeyPem = _caPublicKey.export({ type: 'spki', format: 'pem' }).trim();

  // kid = base64url(SPKI DER bytes). This is the same approach as RFC 7517
  // §3.1 (JWK `kid` parameter is an opaque string). We use the SPKI DER
  // (the full public key encoding including the algorithm OID prefix) so
  // that a key rotation produces a different kid and clients can detect
  // rotation. The first 8 bytes of an Ed25519 SPKI are always
  // `30 2a 30 05 06 03 2b 65 70 03 21 00` (which base64url-encodes to
  // `MCowBQYDK2VwAyEA`), giving a stable prefix for visual identification.
  const spkiDer = _caPublicKey.export({ type: 'spki', format: 'der' });
  _caPublicKeyDerB64url = base64url(spkiDer);

  return {
    privateKey: _caPrivateKey,
    publicKey: _caPublicKey,
    publicKeyPem: _caPublicKeyPem,
    kid: _caPublicKeyDerB64url,
  };
}

// ─── base64url helpers ─────────────────────────────────────────────────────

/**
 * Encode a Buffer (or Uint8Array) as base64url (RFC 4648 §5, no padding).
 * @param {Buffer|Uint8Array} buf
 * @returns {string}
 */
function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

/**
 * Decode a base64url string to a Buffer. Tolerates base64 (with padding)
 * input too, since some external issuers use base64 instead of base64url.
 * @param {string} str
 * @returns {Buffer}
 */
function base64urlDecode(str) {
  // Convert base64url → base64, add padding if needed.
  let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4 !== 0) s += '=';
  return Buffer.from(s, 'base64');
}

/**
 * JSON-encode an object and return its base64url encoding.
 * Uses JSON.stringify with no whitespace (compact) — the signature is over
 * the BASE64URL bytes, NOT over the JSON, so we don't need canonical JSON
 * here (unlike ATC, where we sign the raw JSON bytes and need RFC 8785).
 *
 * The wire format is identical to JWT: the verifier base64url-decodes the
 * segment to get the JSON, then JSON.parses it. As long as the bytes are
 * stable from sign-time to verify-time (which they are — we sign the
 * base64url-encoded segment), the JSON canonicalization question doesn't
 * arise.
 *
 * @param {Object} obj
 * @returns {string} base64url-encoded compact JSON
 */
function segmentFromObject(obj) {
  const json = JSON.stringify(obj);
  return base64url(Buffer.from(json, 'utf8'));
}

/**
 * Parse a base64url-encoded JSON segment.
 * @param {string} seg
 * @returns {Object}
 * @throws {Error} if the segment is not valid base64url or not valid JSON.
 */
function objectFromSegment(seg) {
  const buf = base64urlDecode(seg);
  return JSON.parse(buf.toString('utf8'));
}

// ─── License ID generation ────────────────────────────────────────────────

/**
 * Generate a human-readable license ID: `MN-LIC-{YYYY}-{10-char-base36}`.
 *
 * We don't use a monotonic counter (would require a database or GitHub-backed
 * sequence, adding latency and a failure mode). Instead we use a random
 * 10-character base36 suffix drawn from crypto.randomBytes — collision
 * probability is 36^10 ≈ 3.6 × 10^15, far below the threshold for a 1-million-
 * license deployment. If we ever issue more than 1M licenses, we'll add a
 * GitHub-backed counter and migrate the format to `MN-LIC-{YYYY}-{counter:07d}`.
 *
 * @returns {string} e.g. "MN-LIC-2026-4f8a2b9c1d"
 */
function newLicenseId() {
  const year = new Date().getUTCFullYear();
  const rand = crypto.randomBytes(8).readBigUInt64BE(0);
  // base36, take the last 10 chars (pad with leading zeros if needed)
  const suffix = rand.toString(36).slice(-10).padStart(10, '0');
  return `MN-LIC-${year}-${suffix}`;
}

// ─── Issuance ─────────────────────────────────────────────────────────────

/**
 * Issue a new Ed25519-signed license.
 *
 * @param {Object} params
 * @param {string} params.skill_id           e.g. "mn-gen-00001"
 * @param {string} params.buyer_wallet        e.g. "0xabc..." (Ethereum address)
 * @param {string} [params.expires_at]        ISO 8601, defaults to +365 days
 * @param {string[]} [params.features]        e.g. ["install","verify","execute"]
 * @param {string} [params.license_id]        override (normally auto-generated)
 * @param {string} [params.issued_at]         override (normally now)
 * @param {string} [params.issuer]            override (normally "MarketNow")
 * @returns {{license: string, header: Object, payload: Object, signature: string, license_id: string}}
 * @throws {Error} if the CA private key is unset or invalid.
 */
export function issueLicense({
  skill_id,
  buyer_wallet,
  expires_at,
  features,
  license_id,
  issued_at,
  issuer,
}) {
  if (!skill_id) throw new Error('issueLicense: skill_id is required');
  if (!buyer_wallet) throw new Error('issueLicense: buyer_wallet is required');

  const { privateKey, kid } = loadCAKeys();

  const now = new Date();
  const issuedAtIso = issued_at || now.toISOString();
  const expiresAtIso =
    expires_at ||
    new Date(now.getTime() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    skill_id,
    buyer_wallet: buyer_wallet.toLowerCase(),
    issued_at: issuedAtIso,
    expires_at: expiresAtIso,
    features: Array.isArray(features) && features.length > 0
      ? features
      : DEFAULT_FEATURES,
    issuer: issuer || ISSUER,
    license_id: license_id || newLicenseId(),
  };

  const header = {
    alg: HEADER_ALG,
    typ: HEADER_TYP,
    kid,
    version: LICENSE_VERSION,
  };

  const headerSeg = segmentFromObject(header);
  const payloadSeg = segmentFromObject(payload);
  const signingInput = `${headerSeg}.${payloadSeg}`;

  // Ed25519 has no algorithm parameter — pass null to crypto.sign.
  const signatureBuf = crypto.sign(
    null,
    Buffer.from(signingInput, 'utf8'),
    privateKey
  );
  const signatureSeg = base64url(signatureBuf);

  const license = `${LICENSE_PREFIX}${headerSeg}.${payloadSeg}.${signatureSeg}`;

  return {
    license,
    header,
    payload,
    signature: signatureBuf.toString('hex'),
    license_id: payload.license_id,
  };
}

// ─── Decoding (no verification) ───────────────────────────────────────────

/**
 * Decode a license string into {header, payload, signature} WITHOUT
 * verifying the signature.
 *
 * Use this only for inspection (e.g. showing the user what's in their license
 * before they decide to trust it). For any security-relevant decision, use
 * `verifyLicense()` instead.
 *
 * @param {string} licenseString
 * @returns {{header: Object, payload: Object, signature_hex: string, signature_bytes: Buffer, signing_input: string}}
 * @throws {Error} if the format is malformed (doesn't throw on bad signature).
 */
export function decodeLicense(licenseString) {
  if (typeof licenseString !== 'string' || !licenseString) {
    throw new Error('decodeLicense: licenseString must be a non-empty string');
  }
  const stripped = licenseString.startsWith(LICENSE_PREFIX)
    ? licenseString.slice(LICENSE_PREFIX.length)
    : licenseString;

  const parts = stripped.split('.');
  if (parts.length !== 3) {
    throw new Error(
      `decodeLicense: expected 3 segments separated by '.', got ${parts.length}`
    );
  }
  const [headerSeg, payloadSeg, signatureSeg] = parts;

  let header, payload;
  try {
    header = objectFromSegment(headerSeg);
  } catch (e) {
    throw new Error(`decodeLicense: invalid header segment (${e.message})`);
  }
  try {
    payload = objectFromSegment(payloadSeg);
  } catch (e) {
    throw new Error(`decodeLicense: invalid payload segment (${e.message})`);
  }

  let signatureBytes;
  try {
    signatureBytes = base64urlDecode(signatureSeg);
  } catch (e) {
    throw new Error(`decodeLicense: invalid signature segment (${e.message})`);
  }

  return {
    header,
    payload,
    signature_hex: signatureBytes.toString('hex'),
    signature_bytes: signatureBytes,
    signing_input: `${headerSeg}.${payloadSeg}`,
  };
}

// ─── Verification ──────────────────────────────────────────────────────────

/**
 * Verify a license string against the CA public key.
 *
 * @param {string} licenseString
 * @param {string|crypto.KeyObject} caPublicKeyPem
 *   Either a SPKI PEM string (recommended — fetch from
 *   `GET /api/atc?action=ca-key` once and cache), or a crypto.KeyObject
 *   loaded from the same PEM.
 * @param {Object} [opts]
 * @param {Date} [opts.now=new Date()] — override for testing
 * @param {boolean} [opts.checkExpiry=true] — set false to skip expiry check
 * @returns {{valid: boolean, payload: Object|null, header: Object|null, error: string|null, license_id: string|null}}
 */
export function verifyLicense(licenseString, caPublicKeyPem, opts = {}) {
  const now = opts.now || new Date();
  const checkExpiry = opts.checkExpiry !== false;

  const fail = (error, partial = {}) => ({
    valid: false,
    payload: partial.payload || null,
    header: partial.header || null,
    error,
    license_id: partial.payload?.license_id || null,
  });

  // 1. Decode (without verifying signature yet).
  let decoded;
  try {
    decoded = decodeLicense(licenseString);
  } catch (e) {
    return fail(e.message);
  }
  const { header, payload, signature_bytes, signing_input } = decoded;

  // 2. Validate header.typ — defense-in-depth against accidentally
  //    feeding an ATC or receipt string into this verifier.
  if (header.typ !== HEADER_TYP) {
    return fail(`header.typ must be "${HEADER_TYP}", got "${header.typ}"`, { header, payload });
  }
  if (header.alg !== HEADER_ALG) {
    return fail(`header.alg must be "${HEADER_ALG}", got "${header.alg}"`, { header, payload });
  }

  // 3. Required payload fields.
  if (!payload.skill_id) {
    return fail('payload.skill_id is missing', { header, payload });
  }
  if (!payload.license_id) {
    return fail('payload.license_id is missing', { header, payload });
  }
  if (!payload.issued_at) {
    return fail('payload.issued_at is missing', { header, payload });
  }

  // 4. Verify signature against the CA public key.
  let publicKey;
  try {
    publicKey = typeof caPublicKeyPem === 'string'
      ? crypto.createPublicKey(caPublicKeyPem)
      : caPublicKeyPem;
  } catch (e) {
    return fail(`invalid CA public key: ${e.message}`, { header, payload });
  }

  if (publicKey.asymmetricKeyType !== 'ed25519') {
    return fail(
      `CA public key must be Ed25519, got ${publicKey.asymmetricKeyType}`,
      { header, payload }
    );
  }

  let sigOk;
  try {
    sigOk = crypto.verify(
      null,
      Buffer.from(signing_input, 'utf8'),
      publicKey,
      signature_bytes
    );
  } catch (e) {
    return fail(`signature verification threw: ${e.message}`, { header, payload });
  }
  if (!sigOk) {
    return fail('signature_invalid', { header, payload });
  }

  // 5. Expiry check (optional — callers may skip if they want to inspect
  //    expired licenses for audit purposes).
  if (checkExpiry && payload.expires_at) {
    let expiry;
    try {
      expiry = new Date(payload.expires_at);
    } catch {
      return fail(`invalid expires_at: ${payload.expires_at}`, { header, payload });
    }
    if (isNaN(expiry.getTime())) {
      return fail(`invalid expires_at: ${payload.expires_at}`, { header, payload });
    }
    if (expiry.getTime() < now.getTime()) {
      return fail(`license_expired at ${payload.expires_at}`, { header, payload });
    }
  }

  // 6. kid match (informational only — we already verified with the caller's
  //    public key. But if the kid in the license doesn't match the public
  //    key the caller passed, we warn so callers can detect a CA rotation).
  let kidMismatch = false;
  if (header.kid) {
    const expectedKid = base64url(
      publicKey.export({ type: 'spki', format: 'der' })
    );
    if (header.kid !== expectedKid) {
      kidMismatch = true;
    }
  }

  return {
    valid: true,
    payload,
    header,
    error: null,
    license_id: payload.license_id,
    kid_mismatch: kidMismatch,
  };
}

// ─── Quick helpers for clients ────────────────────────────────────────────

/**
 * Extract the CA key ID (`kid`) from a license string without verifying.
 *
 * Useful for clients that need to fetch the correct CA public key from a
 * list of pinned keys (the typical case: pin MarketNow's CA, but support
 * a rotation by having two PEMs cached).
 *
 * @param {string} licenseString
 * @returns {string|null} the kid, or null if the license is malformed
 */
export function getKidFromLicense(licenseString) {
  try {
    return decodeLicense(licenseString).header.kid || null;
  } catch {
    return null;
  }
}

/**
 * Extract the license_id from a license string without verifying.
 *
 * @param {string} licenseString
 * @returns {string|null}
 */
export function getLicenseId(licenseString) {
  try {
    return decodeLicense(licenseString).payload.license_id || null;
  } catch {
    return null;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────

export {
  LICENSE_PREFIX,
  HEADER_TYP,
  HEADER_ALG,
  LICENSE_VERSION,
  DEFAULT_FEATURES,
  DEFAULT_TTL_DAYS,
  newLicenseId,
  base64url,
  base64urlDecode,
};
