/**
 * MarketNow — Multi-Signature ATC Schema
 * =======================================
 *
 * Q4 2026 roadmap item: Multi-sig ATC (2+ CAs required for high-value agents)
 *
 * Design:
 *   A standard ATC is signed by 1 CA (MarketNow Sentinel CA).
 *   A multi-sig ATC is signed by 2+ CAs — e.g., MarketNow + an independent
 *   third-party auditor. This provides stronger trust guarantees for
 *   high-value agents (e.g., agents handling >$1000 per transaction).
 *
 * Schema:
 *   {
 *     card_id: "ATC-2026-XXXX",
 *     schema_version: "1.2.0",  // multi-sig starts at 1.2.0
 *     multi_sig: true,
 *     required_signatures: 2,
 *     signatures: [
 *       {
 *         ca: "MarketNow Sentinel CA",
 *         algorithm: "Ed25519 (RFC 8032)",
 *         value: "<hex>",
 *         signed_at: "2026-...",
 *         canonical_json: "RFC 8785 JCS"
 *       },
 *       {
 *         ca: "Independent Auditor CA",
 *         algorithm: "Ed25519 (RFC 8032)",
 *         value: "<hex>",
 *         signed_at: "2026-...",
 *         canonical_json: "RFC 8785 JCS"
 *       }
 *     ],
 *     payload: { ... same as v1.1.0 ... }
 *   }
 *
 * Verification:
 *   1. Verify each signature independently against its CA public key
 *   2. Check that the number of valid signatures >= required_signatures
 *   3. Check that at least 2 different CAs signed (no CA signs twice)
 */

/**
 * Verify a multi-sig ATC.
 * @param {Object} atc - the ATC record
 * @param {Map<string, crypto.KeyObject>} caKeys - map of CA name → public key
 * @returns {Object} { valid, valid_signatures, required, reason }
 */
export function verifyMultiSigATC(atc, caKeys) {
  if (!atc.multi_sig) {
    // Standard single-sig ATC — not our concern
    return { valid: true, reason: 'single_sig', skip: true };
  }

  const required = atc.required_signatures || 2;
  const signatures = atc.signatures || [];

  if (signatures.length < required) {
    return {
      valid: false,
      valid_signatures: signatures.length,
      required,
      reason: 'insufficient_signatures',
      message: `Multi-sig ATC requires ${required} signatures but has ${signatures.length}`,
    };
  }

  const validCAs = new Set();
  let validCount = 0;

  for (const sig of signatures) {
    const caKey = caKeys.get(sig.ca);
    if (!caKey) {
      continue; // Unknown CA — skip
    }

    // Verify the signature against the payload
    // (payload is everything except the signatures array)
    const { signatures: _, ...payload } = atc;
    
    try {
      const crypto = require('crypto');
      const data = Buffer.from(canonicalize(payload), 'utf8');
      const sigBytes = Buffer.from(sig.value, 'hex');
      
      if (crypto.verify(null, data, caKey, sigBytes)) {
        validCount++;
        validCAs.add(sig.ca);
      }
    } catch {
      // Signature verification failed — skip
    }
  }

  // Check: at least `required` valid signatures from different CAs
  if (validCount < required) {
    return {
      valid: false,
      valid_signatures: validCount,
      required,
      reason: 'insufficient_valid_signatures',
      message: `Only ${validCount} valid signatures, need ${required}`,
    };
  }

  if (validCAs.size < required) {
    return {
      valid: false,
      valid_signatures: validCount,
      required,
      reason: 'duplicate_ca',
      message: `Signatures must come from ${required} different CAs, got ${validCAs.size}`,
    };
  }

  return {
    valid: true,
    valid_signatures: validCount,
    required,
    cas: Array.from(validCAs),
    reason: 'multi_sig_verified',
    message: `Multi-sig ATC verified with ${validCount} signatures from ${validCAs.size} CAs`,
  };
}

// Minimal canonical JSON for this module
function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
    return '{' + keys.map(k => `"${k}":${canonicalize(value[k])}`).join(',') + '}';
  }
  return 'null';
}
