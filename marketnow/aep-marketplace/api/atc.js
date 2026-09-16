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

// CA key registry (public keys only) — registry-aware receipt verification:
// receipts issued 2026-07/08 were signed under ca-key-001 (routine rotation
// history, not compromise), so a stranger must be able to learn WHICH key
// verified and that key's lifecycle status instead of a binary pass/fail.
const CA_KEY_REGISTRY = [
  { key_id: 'ca-key-001', spki_b64: 'MCowBQYDK2VwAyEA8p1XlAnt5QRCGbyDRi8+U9MCvt8Xyzq36Rar45JHszM=', status: 'retired', note: 'Routine RFC 8785-migration rotation (2026-08-12). Signatures under it are historical evidence, still cryptographically checkable.' },
  { key_id: 'mn-ca-002', spki_b64: 'MCowBQYDK2VwAyEATlD16v6Fy/+GM4je2SxwCz7yFEeo9d8LwqZf0yN8oFY=', status: 'retired-compromised', note: 'DO NOT trust. Key material was once public.' },
  { key_id: 'mn-ca-003', spki_b64: CA_SPKI_B64, status: 'active', note: 'Current CA key.' },
];

const CARD_ID_RE = /^ATC-\d{4}-\d{4,10}$/;
const RECEIPT_ID_RE = /^rcpt_[a-z0-9]{16,64}$/i;
const REF_CODE_RE = /^ref_[a-z0-9]{6,32}$/i;
const AGENT_ID_RE = /^[a-zA-Z0-9_-]{3,64}$/;

// ATC/3.0 (unified credential profile) — one version, one verification path. The production
// envelope (card_id + payload + signature) is ATC/3.0-core, the canonical shape every
// verifier MUST accept; the signature block carries ca_key_id + canonicalization_method +
// signed_payload_hash. The RFC-ATC-v3-Draft-00 multi-sig shape is ATC/3.0-extended.
// The interim "ATC/1.4" label (2026-09-17) was re-versioned to 3.0-core the same day.
const ATC_SPEC_VERSION = 'ATC/3.0';
const ATC_PROFILE = 'core';

const VALID_ACTIONS = ['ca-key', 'spec', 'ledger', 'verify', 'envelope', 'verify-receipt', 'lookup', 'lookup-referral'];

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
    spec: ATC_SPEC_VERSION + ' (Agent Trust Card — Unified Credential Profile, profile: ' + ATC_PROFILE + ')',
    unified_format: {
      what: 'One Agent Trust Card version, one verification path, everywhere. ATC/3.0-core = the production envelope (single Ed25519 signature — the RFC v3 minimum). ATC/3.0-extended = the multi-sig signatures[] shape from RFC-ATC-v3-Draft-00 (atc-ed25519 + optional eat-cwt / w3c-vc, TEE-ready). Every verifier MUST accept core; extended is opt-in.',
      envelope: {
        card_id: 'ATC-<year>-<digits>',
        status: 'active | revoked | superseded',
        payload: {
          card_id: 'mirrors envelope card_id',
          schema_version: '"1.1.0" (production payload schema — unchanged by ATC/3.0-core)',
          decision_authority: '"consumer" — the card is evidence; the consumer decides',
          agent_id: 'subject identifier',
          identity: '{ public_key, key_algorithm }',
          trust: '{ sentinel_review_score, sentinel_score, audit_layers_passed, composite_trust, risk_level, certificate_id }',
          capabilities: '{ provides, protocol_language, translate }',
          payment: '{ method, wallet_address }',
          metadata: '{ issued_at, expires_at, issuer, revocation_url }',
        },
        signature: {
          algorithm: '"Ed25519 (RFC 8032)"',
          value: '64-byte hex over JCS(payload) — NO domain prefix (historical; v2 cards may add domain separation)',
          signed_payload_hash: 'sha256 hex of the canonical bytes',
          ca_key_id: 'resolve against action=ca-key / CA key registry',
          canonicalization_method: '"RFC_8785_JCS"',
        },
      },
      verification_paths: [
        'GET /api/atc?action=verify&card_id=… — served bytes, real Ed25519 (this endpoint)',
        'POST /api/trust {action:"verify", payload:<card>} — same crypto; the envelope is detected and reported as ATC/3.0-core',
        'npm agent-trust-card (atc verify card.json) — verifyATCSync auto-detects both ATC/1.0 spec cards and ATC/3.0-core envelopes (agent-trust-card >= 1.3.0)',
        'npm marketnow-mcp (marketnow_verify_atc_spec) — self-contained verifier, both formats (marketnow-mcp >= 1.13.0)',
      ],
      profiles: {
        core: 'The envelope in this spec — one Ed25519 (RFC 8032) signature over JCS(payload). The 57 production ledger cards conform as-is; no re-issuance required. Schema: https://marketnow.site/atc/schema-3.0',
        extended: 'RFC-ATC-v3-Draft-00 shape — atc_version "3.0.0" + signatures[] (atc-ed25519 required, eat-cwt / w3c-vc optional) + artifact binding + UTA-ATC-V3-CREDENTIAL domain separation. Implemented in atc-sdk/src/v3, verified by /api/trust.',
      },
      legacy_compatibility: [
        'ATC/1.0 spec cards (issueATC from agent-trust-card SDK): still verify — controls ATC-001..008, with a legacy-shape warning.',
        'atc-v3 draft envelopes (atc_version 3.x + signatures[]): verified as ATC/3.0-extended; first signature verified, envelope semantics preserved.',
        'Detection is structural (card_id+payload+signature | atc_version 3.x + signatures[] | spec_version ATC/1.0) — never heuristic trust.',
        'The interim ATC/1.4 label (issued earlier on 2026-09-17) is withdrawn — same envelope, same crypto, re-versioned as ATC/3.0-core.',
      ],
    },
    signature: {
      covers: 'RFC 8785 JCS canonicalization of the payload object, UTF-8 encoded',
      algorithm: 'Ed25519 (RFC 8032)',
      ca_key_id_field: 'signature.ca_key_id — identifies the signing CA key; resolve it against GET /api/atc?action=ca-key. A mismatch means rotated/unknown key, not broken canonicalization.',
      hash_field: 'signature.signed_payload_hash — sha256 hex of the canonical bytes; use it to diff your canonicalization against ours byte-for-byte.',
    },
    fail_closed: 'Unknown or missing action returns HTTP 400. Verification failures return HTTP 200 with signature_valid:false and a machine-readable reason — never a success-shaped default response.',
    issuer_self_check: 'GET /api/atc?action=verify re-downloads the card over HTTP from this deployment (the same bytes a stranger gets) and verifies those bytes. It does not verify a reconstructed internal object.',
    envelope_action: 'GET /api/atc?action=envelope&card_id=... returns the exact canonical byte string the signature covers, for external diffing.',
    receipts: 'GET /api/atc?action=verify-receipt&receipt_id=rcpt_... — verifies a signed delivery proof against the CA key registry (reports which key verified + its lifecycle status).',
    referrals: 'GET /api/atc?action=lookup&ref_code=ref_... reads the public referral registry; POST /api/referrals {action:"mint", agent_id} derives a deterministic, self-certifying referral code (MNR-REF-1.0).',
    notes: [
      'All cards in the ledger were re-signed 2026-09-08 under ' + CA_KEY_ID + ' (CA rotation; mn-ca-002 is retired-compromised).',
      'The pre-2026-08-12 canonicalization (JSON.stringify with a sorted-keys replacer) was broken and is fully retired; no card signed under it remains in the ledger.',
      'ATC/3.0 (Unified Credential Profile) closes the fragmentation found in audit 2026-09-17 (spec 1.0 / v2 envelope / v3 multi-sig / schema 1.1.0 all coexisted): the production envelope is ATC/3.0-core, the canonical wire format every public verifier accepts; the RFC-ATC-v3-Draft-00 multi-sig shape is ATC/3.0-extended; the ATC/2.0 draft (content-addressed multi-sig, never implemented) is superseded and withdrawn. One current version: ATC/3.0.',
      'Version ladder: ATC/1.0 (legacy, still verifies) -> ATC/2.0 (draft, withdrawn, never shipped) -> ATC/3.0 (current: core + extended). The interim ATC/1.4 label published earlier today was re-versioned to 3.0-core — same envelope, same crypto.',
    ],
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ── POST /api/referrals → rewrite → here. Body: {action:"mint", agent_id} ──
  // Deterministic, self-certifying referral codes (MNR-REF-1.0): the code is a
  // truncated sha256 of the agent_id under a fixed derivation string — no
  // server-side write is needed, anyone can re-derive and confirm ownership,
  // and minting is idempotent. Attribution settles through the public
  // referral registry (batch), so the code is useful even before settlement.
  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.action !== 'mint') {
      return res.status(400).json({
        error: 'unknown_or_missing_action',
        action: body.action || null,
        valid_actions: ['mint'],
        note: 'POST body must be {action:"mint", agent_id}.',
      });
    }
    const agentId = String(body.agent_id || '');
    if (!AGENT_ID_RE.test(agentId)) {
      return res.status(400).json({
        error: 'invalid_agent_id',
        agent_id: agentId || null,
        expected: '3-64 chars: letters, digits, underscore, hyphen',
      });
    }
    const refCode = 'ref_' + createHash('sha256')
      .update('MNR-REF-1.0:' + agentId, 'utf8')
      .digest('hex')
      .slice(0, 8);
    return res.status(200).json({
      success: true,
      action: 'mint',
      ref_code: refCode,
      agent_id: agentId,
      derivation: {
        format: 'MNR-REF-1.0',
        formula: 'ref_code = "ref_" + sha256("MNR-REF-1.0:" + agent_id).slice(0, 8)',
        properties: ['deterministic', 'idempotent', 'self-certifying', 'no server-side state required'],
      },
      commission: '5% of purchases made with your code',
      share: `https://marketnow.site/?ref=${refCode}`,
      lookup: `GET /api/atc?action=lookup&ref_code=${refCode} (or /api/referrals?action=lookup&ref_code=${refCode})`,
      registry_note: 'Codes and their stats settle into the public referral registry in batch; deterministic derivation guarantees attribution from the moment you share the code.',
    });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed', allowed: ['GET', 'POST'] });
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

  // ── verify-receipt: signed delivery proof, registry-aware ──────────────
  // Self-fetches the served bytes from /api/receipts/<id>.json and verifies
  // the Ed25519 signature over JCS(receipt minus signature) against the CA
  // key registry, reporting WHICH key verified and its lifecycle status.
  // Fail-closed: unknown receipt → 404; signature that matches no registered
  // key → valid:false (a stranger should not trust it).
  if (action === 'verify-receipt') {
    const receiptId = String(req.query.receipt_id || '').trim();
    if (!RECEIPT_ID_RE.test(receiptId)) {
      return res.status(400).json({
        error: 'invalid_receipt_id',
        receipt_id: receiptId || null,
        expected: 'rcpt_ followed by 16+ alphanumeric chars',
      });
    }
    const served = await fetchServed(req, '/api/receipts/' + receiptId + '.json');
    if (served.status !== 200) {
      return res.status(404).json({
        error: 'receipt_not_found',
        receipt_id: receiptId,
        fetched_url: served.url,
        http_status: served.status,
      });
    }
    let receipt;
    try {
      receipt = JSON.parse(served.text);
    } catch (e) {
      return res.status(502).json({ error: 'receipt_parse_error', receipt_id: receiptId, fetched_url: served.url });
    }
    const { signature, ...receiptPayload } = receipt;
    const canonical = jcs(receiptPayload);
    const canonicalBytes = Buffer.from(canonical, 'utf8');
    const hash = createHash('sha256').update(canonicalBytes).digest('hex');
    let verifiedUnder = null;
    let keyStatus = null;
    for (const k of CA_KEY_REGISTRY) {
      let ok = false;
      try {
        const pub = createPublicKey({ key: Buffer.from(k.spki_b64, 'base64'), format: 'der', type: 'spki' });
        ok = edVerify(null, canonicalBytes, pub, Buffer.from(signature.value, 'hex'));
      } catch { ok = false; }
      if (ok) { verifiedUnder = k.key_id; keyStatus = k.status; break; }
    }
    const signatureValid = verifiedUnder !== null && keyStatus !== 'retired-compromised';
    const reasons = [];
    if (verifiedUnder === null) reasons.push('signature does not verify under any registered CA key');
    if (keyStatus === 'retired-compromised') reasons.push('signature verifies under mn-ca-002, which is retired-compromised — do not trust');
    if (receipt.receipt_id !== receiptId) reasons.push('receipt_id mismatch between URL and payload');
    return res.status(200).json({
      action: 'verify-receipt',
      receipt_id: receiptId,
      verified_over: 'served_bytes',
      fetched_url: served.url,
      valid: signatureValid && reasons.length === 0,
      signature_valid: verifiedUnder !== null,
      verified_under: verifiedUnder,
      verified_under_key_status: keyStatus,
      canonicalization: 'RFC 8785 JCS',
      canonical_sha256: hash,
      issued_at: receipt.issued_at || null,
      mandate_id: receipt.mandate_id || null,
      settle_txhash: receipt.settle_txhash || null,
      atc_card_id: receipt.atc_card_id || null,
      delivered: receipt.delivered || null,
      amount_usd: receipt.amount_usd ?? null,
      network: receipt.network || null,
      reasons,
      advisory: verifiedUnder && keyStatus === 'retired'
        ? 'Signature is genuine historical evidence issued under a since-retired CA key (routine rotation). Cryptographically verifiable; not issued by the current CA.'
        : null,
    });
  }

  // ── lookup / lookup-referral: public referral registry (read-only) ────
  if (action === 'lookup' || action === 'lookup-referral') {
    const refCode = String(req.query.ref_code || '').trim();
    if (!REF_CODE_RE.test(refCode)) {
      return res.status(400).json({
        error: 'invalid_ref_code',
        ref_code: refCode || null,
        expected: 'ref_ followed by 6-32 alphanumeric chars',
      });
    }
    const served = await fetchServed(req, '/api/referrals.json');
    if (served.status !== 200) {
      return res.status(502).json({ error: 'referral_registry_unavailable', fetched_url: served.url, http_status: served.status });
    }
    let registry;
    try {
      registry = JSON.parse(served.text);
    } catch (e) {
      return res.status(502).json({ error: 'referral_registry_parse_error', fetched_url: served.url });
    }
    const list = Array.isArray(registry) ? registry : registry.referrals || [];
    const record = list.find((r) => r && r.ref_code === refCode);
    if (!record) {
      return res.status(404).json({
        found: false,
        ref_code: refCode,
        message: `No referral with code ${refCode} exists in the public registry yet. Codes minted via POST /api/referrals {action:"mint"} are deterministically attributed and settle into the registry in batch.`,
        mint: 'POST /api/referrals {"action":"mint","agent_id":"..."}',
      });
    }
    return res.status(200).json({
      found: true,
      success: true,
      ...record,
      registry_url: served.url,
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
