/**
 * MarketNow ATC (Agent Trust Card) — JavaScript/Node.js verification example.
 *
 * Verifies an ATC signature independently using the CA public key.
 * No MarketNow SDK needed — just Node.js built-in crypto.
 *
 * Usage: node verify-javascript.js ATC-2026-XXXXXXX
 */
const crypto = require('crypto');

async function verifyATC(cardId) {
  // 1. Fetch the CA public key
  const caRes = await fetch('https://marketnow.site/api/atc?action=ca-key');
  const caData = await caRes.json();
  const caPublicKey = crypto.createPublicKey(caData.public_key_pem);

  // 2. Fetch the ATC verify summary
  const verifyRes = await fetch(`https://marketnow.site/api/atc?action=verify&card_id=${cardId}`);
  const result = await verifyRes.json();

  if (!result.valid) {
    return { valid: false, reason: result.reason };
  }

  // 3. Fetch the full ATC record from GitHub for independent signature check
  const rawUrl = `https://raw.githubusercontent.com/alicelabs-llc/marketnow/master/_data/atc/${cardId}.json`;
  const rawRes = await fetch(rawUrl);
  if (!rawRes.ok) {
    return { valid: false, reason: 'could_not_fetch_record' };
  }

  const atcRecord = await rawRes.json();
  const { payload, signature } = atcRecord;

  // 4. Canonical JSON (sorted keys, no whitespace)
  const canonical = Buffer.from(
    JSON.stringify(payload, Object.keys(payload).sort()),
    'utf-8'
  );

  // 5. Verify the Ed25519 signature
  const sigBytes = Buffer.from(signature.value, 'hex');
  const signatureValid = crypto.verify(null, canonical, caPublicKey, sigBytes);

  return {
    valid: result.valid,
    card_id: cardId,
    agent_id: result.agent_id,
    sentinel_score: result.sentinel_score,
    risk_level: result.risk_level,
    signature_valid: signatureValid,
    expires_at: result.expires_at,
  };
}

// CLI
const cardId = process.argv[2] || 'ATC-2026-00001';
verifyATC(cardId).then(r => console.log(JSON.stringify(r, null, 2)));
