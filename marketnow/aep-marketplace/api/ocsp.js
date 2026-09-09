// /api/ocsp.js — MarketNow per-subject revocation status responder (MNR-OCSP-1.0)
// Roadmap v5.1 item 5 — makes the previously PROMISED (404) OCSP responder REAL.
//
// Semantics (roadmap v5.1.5): VALID | EXPIRED | REVOKED | SUSPENDED | SUPERSEDED | UNKNOWN
// Fail-closed: anything we cannot positively resolve answers UNKNOWN + recommendation DENY.
//
// Resolution order:
//   1. Signed CRL (api/revocations-data.mjs — Ed25519/MNR-CRL-1.0, verifiable by anyone)
//   2. Live ledger  (/api/atc-index.json — freshness: expiry computed at response time)
//
// What is signed vs live:
//   - SIGNED (offline, committed): the revocation registry entries + CA key statuses.
//   - LIVE (per-request): produced_at, nonce echo, expiry evaluation, subject resolution.
// The response embeds the registry's signature + hash so any client can re-verify the
// signed layer independently (stranger test friendly).
//
// Usage:
//   GET  /api/ocsp?card_id=ATC-2026-5837752
//   GET  /api/ocsp?kid=mn-ca-002
//   POST /api/ocsp  {"card_id":"ATC-2026-1509360","nonce":"random-client-nonce"}

import { CRL, REGISTRY_KEY } from './revocations-data.mjs';

const LEDGER_URL = 'https://www.marketnow.site/api/atc-index.json';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();

  let subject = null;      // { type: 'atc'|'ca_key', id }
  let nonce = null;
  if (req.method === 'GET') {
    if (req.query.card_id) subject = { type: 'atc', id: String(req.query.card_id) };
    else if (req.query.kid) subject = { type: 'ca_key', id: String(req.query.kid) };
    else if (req.query.subject) {
      const s = String(req.query.subject);
      subject = /^mn-ca|^ca-key/.test(s) ? { type: 'ca_key', id: s } : { type: 'atc', id: s };
    }
    nonce = req.query.nonce || null;
  } else if (req.method === 'POST') {
    const b = req.body || {};
    if (b.card_id) subject = { type: 'atc', id: String(b.card_id) };
    else if (b.kid) subject = { type: 'ca_key', id: String(b.kid) };
    nonce = b.nonce || null;
  }

  if (!subject) {
    return res.status(400).json({
      protocol: 'MNR-OCSP-1.0',
      error: 'INVALID_REQUEST',
      message: 'Provide card_id (ATC) or kid (CA key). GET ?card_id=… | ?kid=… or POST {card_id|kid, nonce}',
      usage: {
        check_card: 'GET /api/ocsp?card_id=ATC-2026-1509360',
        check_ca_key: 'GET /api/ocsp?kid=mn-ca-002',
        with_nonce: 'POST /api/ocsp {"card_id":"ATC-2026-1509360","nonce":"client-random"}',
      },
      crl: '/api/crl',
      registry_key: '/uta/revocations/registry-key.json',
    });
  }

  const producedAt = new Date().toISOString();
  const entry = CRL.entries.find((e) => e.subject === subject.id && (subject.type === 'ca_key' ? e.entry_type === 'ca_key' : e.entry_type === 'atc'));

  // ---------- 1. Signed CRL layer ----------
  if (entry) {
    return res.status(200).json({
      protocol: 'MNR-OCSP-1.0',
      produced_at: producedAt,
      nonce: nonce || undefined,
      subject: { type: subject.type, id: subject.id },
      status: entry.substatus || 'REVOKED',
      recommendation: 'DENY',
      evidence: {
        source: 'signed-crl',
        crl_format: CRL.format,
        crl_this_update: CRL.this_update,
        crl_next_update: CRL.next_update,
        revoked_at: entry.revoked_at,
        reason: entry.reason,
        agent_name: entry.agent_name || undefined,
      },
      registry: {
        key_id: REGISTRY_KEY.key_id,
        algorithm: CRL.signature.algorithm,
        canonicalization: CRL.signature.canonicalization,
        signed_payload_hash: CRL.signature.signed_payload_hash,
        signature_hex: CRL.signature.value,
        verify_instructions: CRL.signature.verify_with,
        authoritative_crl: '/uta/revocations/crl.json',
      },
      fail_closed: true,
    });
  }

  // ---------- 2. CA-key resolution (not revoked → check registry status) ----------
  if (subject.type === 'ca_key') {
    const k = CRL.ca_key_status.find((c) => c.key_id === subject.id);
    if (k) {
      const status = k.status === 'active' ? 'VALID' : k.status === 'retired' ? 'SUPERSEDED' : 'REVOKED';
      return res.status(200).json({
        protocol: 'MNR-OCSP-1.0',
        produced_at: producedAt,
        nonce: nonce || undefined,
        subject: { type: subject.type, id: subject.id },
        status,
        recommendation: status === 'VALID' ? 'PERMIT' : 'DENY',
        evidence: { source: 'signed-crl-ca-key-status', registry_status: k.status, active_since: k.active_since, retired_at: k.retired_at || undefined },
        registry: {
          key_id: REGISTRY_KEY.key_id,
          signed_payload_hash: CRL.signature.signed_payload_hash,
          signature_hex: CRL.signature.value,
          verify_instructions: CRL.signature.verify_with,
        },
        fail_closed: true,
      });
    }
    return res.status(200).json({
      protocol: 'MNR-OCSP-1.0',
      produced_at: producedAt,
      nonce: nonce || undefined,
      subject: { type: subject.type, id: subject.id },
      status: 'UNKNOWN',
      recommendation: 'DENY',
      evidence: { source: 'signed-crl', note: 'CA key not present in the registry — fail-closed.' },
      fail_closed: true,
    });
  }

  // ---------- 3. ATC resolution → live ledger (expiry freshness) ----------
  try {
    const resp = await fetch(LEDGER_URL, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new Error(`ledger HTTP ${resp.status}`);
    const ledger = await resp.json();
    const card = (ledger.cards || []).find((c) => c.card_id === subject.id);
    if (card) {
      const expired = card.expires_at ? new Date(card.expires_at).getTime() < Date.now() : null;
      const status = expired === true ? 'EXPIRED' : expired === null ? 'UNKNOWN' : card.status === 'active' ? 'VALID' : String(card.status).toUpperCase();
      return res.status(200).json({
        protocol: 'MNR-OCSP-1.0',
        produced_at: producedAt,
        nonce: nonce || undefined,
        subject: { type: subject.type, id: subject.id },
        status,
        recommendation: status === 'VALID' ? 'PERMIT' : 'DENY',
        evidence: {
          source: 'live-ledger + signed-crl',
          ledger_url: LEDGER_URL,
          ledger_status: card.status,
          issued_at: card.issued_at,
          expires_at: card.expires_at,
          expired: expired,
          not_in_crl: true,
          crl_checked_until: CRL.this_update,
        },
        registry: {
          key_id: REGISTRY_KEY.key_id,
          signed_payload_hash: CRL.signature.signed_payload_hash,
          signature_hex: CRL.signature.value,
          verify_instructions: CRL.signature.verify_with,
        },
        fail_closed: true,
      });
    }
    return res.status(200).json({
      protocol: 'MNR-OCSP-1.0',
      produced_at: producedAt,
      nonce: nonce || undefined,
      subject: { type: subject.type, id: subject.id },
      status: 'UNKNOWN',
      recommendation: 'DENY',
      evidence: { source: 'live-ledger + signed-crl', note: 'Subject not in CRL and not in ledger — fail-closed.' },
      fail_closed: true,
    });
  } catch (e) {
    return res.status(200).json({
      protocol: 'MNR-OCSP-1.0',
      produced_at: producedAt,
      nonce: nonce || undefined,
      subject: { type: subject.type, id: subject.id },
      status: 'UNKNOWN',
      recommendation: 'DENY',
      evidence: { source: 'signed-crl', error: `ledger unreachable: ${String(e.message || e)}`, note: 'Fail-closed: cannot positively confirm status.' },
      fail_closed: true,
    });
  }
}
