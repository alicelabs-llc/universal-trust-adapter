// /api/atc.js
// MarketNow ATC (Agent Trust Card) public endpoint — restored 2026-09-08.
//
// History: this endpoint was removed during the 2026-09-07 lambda cleanup (Hobby
// 12-function limit). That broke external verification: the CA key was no longer
// published and the verify action disappeared. This restore implements the fixes
// requested in @anp2network's dev.to review:
//   1. verify consumes the SERVED bytes (self-fetch over HTTP), the same bytes a
//      stranger downloads — not a reconstructed internal object.
//   2. cards carry a real ca_key_id; the endpoint maps it to the published key.
//   3. ca-key/spec document the actual canonicalization (RFC 8785 JCS); the stale
//      JSON.stringify(payload, sorted-keys) doc is retired.
//   4. unknown or missing action -> HTTP 400 (fail-closed). A verifier that asks
//      a slightly wrong question gets an explicit error, not a success-shaped
//      default listing.
//
// CA rotation 2026-09-08: mn-ca-002 is RETIRED-COMPROMISED (private key material
// was found committed to a public repository). All 57 ledger cards were re-signed
// under mn-ca-003. Only mn-ca-003 verifies current cards.

import { createPublicKey, verify as edVerify, createHash } from 'node:crypto';

const CA_KEY_ID = 'mn-ca-003';
const CA_SPKI_B64 = 'MCowBQYDK2VwAyEAUWJgyMWp9oKIGwN9EG8ayz/mYYp1lcQBI58rtpOs8CM=';
const CA_RAW_HEX = '516260c8c5a9f682881b037d106f1acb3fe6618a7595c401239f2bb693acf023';
const CA_FP = 'f2c8d4a885a70da9';
const CA_PEM =
  '-----BEGIN PUBLIC KEY-----\n' + CA_SPKI_B64 + '\n-----END PUBLIC KEY-----';
const CA_ACTIVE_SINCE = '2026-09-08';
const SAMPLE_CARD_ID = 'ATC-2026-1509360';

const caPublicKey = createPublicKey({ key: CA_PEM, format: 'pem' });

const CARD_ID_RE = /^ATC-\d{4}-\d{4,10}$/;

const VALID_ACTIONS = ['ca-key', 'spec', 'ledger', 'verify', 'envelope'];

// ---------------------------------------------------------------------------
// RFC 8785 JCS (JSON Canonicalization Scheme) — inline, no dependencies.
// JS semantics give exactly the RFC behaviour: default string comparison sorts
// by UTF-16 code units, String(n) is ECMAScript number serialization, and
// JSON.stringify(s) produces the minimal escaping required by RFC 8785 §3.2.2.2.
// ---------------------------------------------------------------------------
function jcs(o) {
  if (o === null) return 'null';
  switch (typeof o) {
    case 'boolean':
      return o ? 'true' : 'false';
    case 'number':
      return Number.isFinite(o) ? String(o) : 'null';
    case 'string':
      return JSON.stringify(o);
  }
  if (Array.isArray(o)) return '[' + o.map(jcs).join(',') + ']';
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return (
    '{' + keys.map((k) => JSON.stringify(k) + ':' + jcs(o[k])).join(',') + '}'
  );
}

function baseUrl(req) {
  const host = (req.headers && req.headers.host) || 'www.marketnow.site';
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return proto + '://' + host;
}

// Fetch the exact bytes a stranger would download from this deployment.
async function fetchServed(req, path) {
  const url = baseUrl(req) + path;
  const r = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': 'marketnow-atc-verifier/1.0 (self-check)' },
  });
  const text = await r.text();
  return { url, status: r.status, text };
}

function verifyCard(card) {
  const canonical = jcs(card.payload);
  const canonicalBytes = Buffer.from(canonical, 'utf8');
  const hash = createHash('sha256').update(canonicalBytes).digest('hex');
  const hashValid = hash === card.signature.signed_payload_hash;
  let signatureValid = false;
  let signatureError = null;
  try {
    signatureValid = edVerify(
      null,
      canonicalBytes,
      caPublicKey,
      Buffer.from(card.signature.value, 'hex')
    );
  } catch (e) {
    signatureError = String(e && e.message ? e.message : e);
  }
  const now = Date.now();
  const expiresAt = card.payload && card.payload.metadata && card.payload.metadata.expires_at;
  const expired = expiresAt ? Date.parse(expiresAt) < now : null;
  return { canonical, canonicalBytes, hash, hashValid, signatureValid, signatureError, expired, expiresAt };
}

function caKeyPayload() {
  return {
    action: 'ca-key',
    ca_key_id: CA_KEY_ID,
    algorithm: 'Ed25519 (RFC 8032)',
    status: 'active',
    active_since: CA_ACTIVE_SINCE,
    fingerprint_sha256_prefix: CA_FP,
    public_key_spki_base64: CA_SPKI_B64,
    public_key_raw_hex: CA_RAW_HEX,
    public_key_pem: CA_PEM,
    canonicalization: 'RFC 8785 JCS (JSON Canonicalization Scheme)',
    rotation_history: [
      { key_id: 'ca-key-001', status: 'retired', note: 'Initial key, rotated 2026-08-12 during RFC 8785 migration.' },
      { key_id: 'mn-ca-002', status: 'retired-compromised', note: 'Private key material was found committed to a public repository. DO NOT verify against this key.' },
      { key_id: CA_KEY_ID, status: 'active', note: 'Current CA key. Authoritative publication is this endpoint.' },
    ],
    verification: {
      steps: [
        '1. GET the card, e.g. /api/atc/' + SAMPLE_CARD_ID + '.json (the served bytes).',
        '2. Parse the JSON and canonicalize ONLY the payload object with RFC 8785 JCS (recursive key sort by UTF-16 code units, ECMAScript number serialization, minimal string escaping, forward slash NOT escaped).',
        '3. sha256(UTF-8 canonical bytes) must equal signature.signed_payload_hash.',
        '4. Ed25519-verify the canonical bytes against this public key and signature.value (64-byte hex).',
      ],
      sample: {
        card_url: '/api/atc/' + SAMPLE_CARD_ID + '.json',
        canonical_bytes_url: '/api/atc?action=envelope&card_id=' + SAMPLE_CARD_ID,
        verify_url: '/api/atc?action=verify&card_id=' + SAMPLE_CARD_ID,
      },
      node_snippet:
        "const c = jcs(card.payload); // RFC 8785\n" +
        "crypto.verify(null, Buffer.from(c, 'utf8'), caPublicKey, Buffer.from(card.signature.value, 'hex'));",
    },
    registry: 'https://github.com/alicelabs-llc/universal-trust-adapter — marketnow/_data/atc/ca-key-registry.json (public keys only)',
  };
}

function specPayload() {
  return {
    action: 'spec',
    spec: 'ATC/1.3 (Agent Trust Card)',
    signature: {
      covers: 'RFC 8785 JCS canonicalization of the payload object, UTF-8 encoded',
      algorithm: 'Ed25519 (RFC 8032)',
      ca_key_id_field: 'signature.ca_key_id — identifies the signing CA key; resolve it against GET /api/atc?action=ca-key. A mismatch means rotated/unknown key, not broken canonicalization.',
      hash_field: 'signature.signed_payload_hash — sha256 hex of the canonical bytes; use it to diff your canonicalization against ours byte-for-byte.',
    },
    fail_closed: 'Unknown or missing action returns HTTP 400. Verification failures return HTTP 200 with signature_valid:false and a machine-readable reason — never a success-shaped default response.',
    issuer_self_check: 'GET /api/atc?action=verify re-downloads the card over HTTP from this deployment (the same bytes a stranger gets) and verifies those bytes. It does not verify a reconstructed internal object.',
    envelope: 'GET /api/atc?action=envelope&card_id=... returns the exact canonical byte string the signature covers, for external diffing.',
    notes: [
      'All cards in the ledger were re-signed 2026-09-08 under ' + CA_KEY_ID + ' (CA rotation; mn-ca-002 is retired-compromised).',
      'The pre-2026-08-12 canonicalization (JSON.stringify with a sorted-keys replacer) was broken and is fully retired; no card signed under it remains in the ledger.',
    ],
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed', allowed: ['GET'] });
  }

  const action = (req.query.action || '').toLowerCase().trim();

  // Fail-closed: an unrecognized or missing action is an explicit error,
  // never a default success-shaped listing.
  if (!VALID_ACTIONS.includes(action)) {
    return res.status(400).json({
      error: 'unknown_or_missing_action',
      action: action || null,
      valid_actions: VALID_ACTIONS,
      note: 'This endpoint fails closed. Ask for one of valid_actions explicitly.',
    });
  }

  if (action === 'ca-key') {
    return res.status(200).json(caKeyPayload());
  }

  if (action === 'spec') {
    return res.status(200).json(specPayload());
  }

  if (action === 'ledger') {
    const served = await fetchServed(req, '/api/atc-index.json');
    if (served.status !== 200) {
      return res.status(502).json({
        error: 'ledger_unavailable',
        fetched_url: served.url,
        http_status: served.status,
      });
    }
    let index;
    try {
      index = JSON.parse(served.text);
    } catch (e) {
      return res.status(502).json({ error: 'ledger_parse_error', fetched_url: served.url });
    }
    return res.status(200).json({
      action: 'ledger',
      fetched_url: served.url,
      schema_version: index.schema_version,
      ca_key_id: index.ca_key_id,
      ca_public_key: index.ca_public_key,
      cards: index.cards,
    });
  }

  // verify / envelope — both consume the served bytes
  const cardId = (req.query.card_id || '').trim();
  if (!CARD_ID_RE.test(cardId)) {
    return res.status(400).json({
      error: 'invalid_card_id',
      card_id: cardId || null,
      expected: 'ATC-<digits>',
    });
  }

  const served = await fetchServed(req, '/api/atc/' + cardId + '.json');
  if (served.status !== 200) {
    return res.status(404).json({
      error: 'card_not_found',
      card_id: cardId,
      fetched_url: served.url,
      http_status: served.status,
    });
  }

  let card;
  try {
    card = JSON.parse(served.text);
  } catch (e) {
    return res.status(502).json({
      error: 'card_parse_error',
      card_id: cardId,
      fetched_url: served.url,
    });
  }

  let v;
  try {
    v = verifyCard(card);
  } catch (e) {
    return res.status(502).json({
      error: 'verification_internal_error',
      card_id: cardId,
      detail: String(e && e.message ? e.message : e),
    });
  }

  if (action === 'envelope') {
    return res.status(200).json({
      action: 'envelope',
      card_id: cardId,
      fetched_url: served.url,
      http_status: served.status,
      ca_key_id: CA_KEY_ID,
      canonical_bytes: v.canonical,
      canonical_sha256: v.hash,
      signature_hex: card.signature.value,
      signature_algorithm: card.signature.algorithm,
      note: 'canonical_bytes is the exact UTF-8 string the signature covers. Diff it against your verifier input to settle any canonicalization disagreement.',
    });
  }

  // action === 'verify'
  return res.status(200).json({
    action: 'verify',
    card_id: cardId,
    verified_over: 'served_bytes',
    fetched_url: served.url,
    http_status: served.status,
    ca_key_id: CA_KEY_ID,
    canonicalization: 'RFC 8785 JCS',
    canonical_sha256: v.hash,
    hash_valid: v.hashValid,
    signature_valid: v.signatureValid,
    signature_error: v.signatureError,
    expires_at: v.expiresAt,
    expired: v.expired,
    status: card.status,
    valid: v.hashValid && v.signatureValid,
  });
}
