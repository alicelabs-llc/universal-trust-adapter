/**
 * ATC/1.0 SDK — Issue and verify Agent Trust Cards
 * ==================================================
 *
 * A tiny (~5KB), framework-agnostic SDK for working with ATC/1.0
 * (Agent Trust Card) documents. Works in any JavaScript runtime that
 * supports `node:crypto` (Node.js >=18, Bun, Deno). For browsers,
 * use the `atc-playground.html` which bundles a WebCrypto version.
 *
 * Public API:
 *
 *   import {
 *     generateKeyPair,    // → { publicKey, privateKey, rawPublicKey, rawPrivateKey }
 *     loadKeyPairFromPrivate,
 *     issueATC,           // (caKeyPair, agentKeyPair, payload) → signed ATC document
 *     verifyATC,          // (atc, options?) → { valid, controls_passed, ... }
 *     canonicalizeATC,    // (atc) → RFC 8785 JCS canonical string
 *     computePayloadHash, // (atc) → hex SHA-256
 *     ATC_SPEC_VERSION,
 *     ATC_ALGORITHM,
 *   } from 'atc-sdk';
 *
 * Quick start:
 *
 *   import { generateKeyPair, issueATC, verifyATC } from 'atc-sdk';
 *
 *   const ca = generateKeyPair();
 *   const agent = generateKeyPair();
 *
 *   const atc = issueATC(ca, agent, {
 *     card_id: 'ATC-2026-0000001',
 *     identity: { agent_id: 'my-bot', agent_name: 'My Bot', agent_owner: 'My Org' },
 *     capabilities: {
 *       filesystem: { read: 'own_dir', write: 'own_dir' },
 *       network: { egress: 'allowlist', ingress: 'none' },
 *       shell: { exec: 'sandboxed', spawn: 'none' },
 *       credentials: { read_env: 'none', read_files: 'none' },
 *       process: { subprocess: 'none', signals: 'own' },
 *     },
 *     evidence: { /* ... *\/ },
 *     risk: { trust_score: 9, risk_level: 'low', score_explanation: 'clean', scored_at: new Date().toISOString() },
 *   });
 *
 *   const result = verifyATC(atc);
 *   console.log(result.valid);  // → true
 *   console.log(result.controls_passed);  // → ['ATC-001', 'ATC-002', ..., 'ATC-008']
 *
 * Spec: https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/SPEC.md
 * License: MNNC-1.0 (AliceLabs LLC Proprietary)
 */

export { generateKeyPair, loadKeyPairFromPrivate, signMessage, verifySignature, ATC_ALGORITHM } from './keys.mjs';
export { issueATC, resignATC, canonicalizeATC, computePayloadHash, ATC_SPEC_VERSION, ATC_MAX_TTL_DAYS_DEFAULT } from './issue.mjs';
export { verifyATC, verifyATCSync } from './verify.mjs';
