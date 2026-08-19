#!/usr/bin/env node
/**
 * ATC CLI — issue, verify, and inspect Agent Trust Cards
 *
 * Usage:
 *   atc init                                              Generate a CA keypair + agent keypair (prints to stdout)
 *   atc issue --ca <ca-private-key.json> --agent <agent.json> --payload <payload.json>
 *   atc verify <card.json>                                Verify an ATC against the spec
 *   atc inspect <card.json>                               Pretty-print an ATC summary
 *
 * Examples:
 *   atc verify my-card.json
 *   atc inspect ATC-2026-0000001.json
 *
 * Spec: https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/SPEC.md
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  generateKeyPair,
  issueATC,
  verifyATC,
  verifyATCSync,
  canonicalizeATC,
  computePayloadHash,
  ATC_SPEC_VERSION,
} from '../src/index.mjs';

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function printHelp() {
  console.log(`
${BOLD}atc${RESET} — Agent Trust Card CLI (ATC/1.0)

${BOLD}USAGE${RESET}
  atc <command> [options]

${BOLD}COMMANDS${RESET}
  ${CYAN}init${RESET}                              Generate a new CA keypair + agent keypair (JSON to stdout)
  ${CYAN}issue${RESET}  --ca <key.json>             Issue (sign) an ATC
            --agent <key.json>
            --payload <payload.json>
            [--out <card.json>]
  ${CYAN}verify${RESET} <card.json>                 Verify an ATC against the ATC/1.0 spec
  ${CYAN}inspect${RESET} <card.json>                Pretty-print an ATC summary
  ${CYAN}canonical${RESET} <card.json>              Print the RFC 8785 JCS canonical form
  ${CYAN}hash${RESET} <card.json>                   Print the SHA-256 of the canonical payload
  ${CYAN}help${RESET}                               Show this message

${BOLD}EXAMPLES${RESET}
  ${DIM}# Generate keys${RESET}
  ${DIM}atc${RESET} init > keys.json

  ${DIM}# Issue a card${RESET}
  ${DIM}atc${RESET} issue --ca ca-key.json --agent agent-key.json --payload payload.json --out card.json

  ${DIM}# Verify a card${RESET}
  ${DIM}atc${RESET} verify card.json

  ${DIM}# Inspect a card${RESET}
  ${DIM}atc${RESET} inspect card.json

${BOLD}SPEC${RESET}
  ATC/${ATC_SPEC_VERSION.split('/')[1]} — https://github.com/edgarfloresguerra2011-a11y/marketnow/blob/master/docs/atc-spec/SPEC.md

${BOLD}VERSION${RESET}
  atc-sdk@1.0.0 — AliceLabs LLC (Wyoming, USA, 2026)
`);
}

function loadJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`${RED}Error reading ${path}: ${err.message}${RESET}`);
    process.exit(1);
  }
}

function loadKeyPair(path) {
  // Synchronous loader — kept for backward compat. Uses dynamic import()
  // under the hood via loadKeyPairAsync is preferred.
  // For ESM we can't `require`, so we delegate to the async loader and
  // return a promise. Callers using sync semantics should switch to loadKeyPairAsync.
  throw new Error('loadKeyPair (sync) is not supported in ESM. Use loadKeyPairAsync(path) instead.');
}

// ESM-friendly async loader (used by cmdIssue)
async function loadKeyPairAsync(path) {
  const json = loadJSON(path);
  if (!json.privateKey) {
    console.error(`${RED}Key file ${path} must include privateKey (base64 string)${RESET}`);
    process.exit(1);
  }
  const { loadKeyPairFromPrivate } = await import('../src/keys.mjs');
  return loadKeyPairFromPrivate(json.privateKey);
}

// ─── Commands ───────────────────────────────────────────────────────────────

async function cmdInit() {
  const ca = generateKeyPair();
  const agent = generateKeyPair();
  // Strip the KeyObject (which is not JSON-serializable) — keep only the base64 strings
  const out = {
    ca: { publicKey: ca.publicKey, privateKey: ca.privateKey },
    agent: { publicKey: agent.publicKey, privateKey: agent.privateKey },
    note: 'Keep the privateKey fields secret. The publicKey fields can be shared.',
  };
  console.log(JSON.stringify(out, null, 2));
}

async function cmdIssue(options) {
  const caKeyPair = await loadKeyPairAsync(options.ca);
  const agentKeyPair = await loadKeyPairAsync(options.agent);
  const payload = loadJSON(options.payload);
  const atc = issueATC(caKeyPair, agentKeyPair, payload);
  const out = options.out
    ? (writeFileSync(options.out, JSON.stringify(atc, null, 2)), console.log(`${GREEN}Wrote ${options.out}${RESET}`))
    : console.log(JSON.stringify(atc, null, 2));
  return out;
}

async function cmdVerify(cardPath) {
  const atc = loadJSON(cardPath);
  const result = verifyATCSync(atc);
  console.log('');
  if (result.valid) {
    console.log(`${BOLD}${GREEN}✓ ATC VALID${RESET}  ${DIM}(${result.controls_passed.length}/8 controls passed)${RESET}`);
  } else {
    console.log(`${BOLD}${RED}✗ ATC INVALID${RESET}  ${DIM}(${result.controls_passed.length}/8 controls passed, ${result.controls_failed.length} failed)${RESET}`);
  }
  console.log('');
  console.log(`${BOLD}Card${RESET}         ${result.card_id || '(none)'}`);
  console.log(`${BOLD}Spec version${RESET} ${result.spec_version || '(none)'}`);
  console.log(`${BOLD}CA ID${RESET}        ${result.issuer_ca_id || '(none)'}`);
  console.log(`${BOLD}Agent${RESET}       ${result.agent_id || '(none)'} (${result.agent_name || '?'})`);
  console.log(`${BOLD}Trust score${RESET}  ${result.trust_score ?? '?'}/10  ${DIM}(${result.risk_level || '?'})${RESET}`);
  console.log(`${BOLD}Expires${RESET}     ${result.expires_at || '(none)'}`);
  console.log('');
  console.log(`${BOLD}Controls${RESET}`);
  const allControls = ['ATC-001', 'ATC-002', 'ATC-003', 'ATC-004', 'ATC-005', 'ATC-006', 'ATC-007', 'ATC-008'];
  for (const c of allControls) {
    const passed = result.controls_passed.includes(c);
    console.log(`  ${passed ? GREEN + '✓' + RESET : RED + '✗' + RESET}  ${c}`);
  }
  if (result.errors.length > 0) {
    console.log('');
    console.log(`${BOLD}${RED}Errors${RESET}`);
    for (const e of result.errors) console.log(`  ${RED}-${RESET} ${e}`);
  }
  if (result.warnings.length > 0) {
    console.log('');
    console.log(`${BOLD}${YELLOW}Warnings${RESET}`);
    for (const w of result.warnings) console.log(`  ${YELLOW}!${RESET} ${w}`);
  }
  console.log('');
  process.exit(result.valid ? 0 : 1);
}

async function cmdInspect(cardPath) {
  const atc = loadJSON(cardPath);
  console.log('');
  console.log(`${BOLD}ATC/${ATC_SPEC_VERSION.split('/')[1]} Card${RESET}`);
  console.log(`${BOLD}════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}card_id${RESET}        ${atc.card_id || '(none)'}`);
  console.log(`${BOLD}spec_version${RESET}   ${atc.spec_version || '(none)'}`);
  console.log('');
  console.log(`${BOLD}Identity${RESET}`);
  console.log(`  agent_id:     ${atc.identity?.agent_id || '(none)'}`);
  console.log(`  agent_name:   ${atc.identity?.agent_name || '(none)'}`);
  console.log(`  agent_owner:  ${atc.identity?.agent_owner || '(none)'}`);
  console.log('');
  console.log(`${BOLD}Issuer${RESET}`);
  console.log(`  ca_id:        ${atc.issuer?.ca_id || '(none)'}`);
  console.log(`  ca_url:       ${atc.issuer?.ca_url || '(none)'}`);
  console.log(`  ca_algorithm: ${atc.issuer?.ca_algorithm || '(none)'}`);
  console.log(`  ca_public_key:${atc.issuer?.ca_public_key ? atc.issuer.ca_public_key.slice(0, 24) + '...' : '(none)'}`);
  console.log('');
  console.log(`${BOLD}Capabilities${RESET}`);
  const caps = atc.capabilities || {};
  for (const [cat, sub] of Object.entries(caps)) {
    console.log(`  ${cat}:`);
    for (const [k, v] of Object.entries(sub || {})) {
      console.log(`    ${k}: ${v}`);
    }
  }
  console.log('');
  console.log(`${BOLD}Risk${RESET}`);
  console.log(`  trust_score:      ${atc.risk?.trust_score ?? '?'}/10`);
  console.log(`  risk_level:       ${atc.risk?.risk_level || '(none)'}`);
  console.log(`  decision_authority: ${atc.risk?.decision_authority || '(none)'}`);
  console.log('');
  console.log(`${BOLD}Validity${RESET}`);
  console.log(`  issued_at:    ${atc.validity?.issued_at || '(none)'}`);
  console.log(`  expires_at:   ${atc.validity?.expires_at || '(none)'}`);
  console.log(`  max_ttl_days: ${atc.validity?.max_ttl_days ?? '?'}`);
  console.log('');
  console.log(`${BOLD}Attestation${RESET}`);
  console.log(`  subject_public_key:  ${atc.attestation?.subject_public_key ? atc.attestation.subject_public_key.slice(0, 24) + '...' : '(none)'}`);
  console.log(`  subject_algorithm:   ${atc.attestation?.subject_algorithm || '(none)'}`);
  console.log(`  signed_payload_hash: ${atc.attestation?.signed_payload_hash ? atc.attestation.signed_payload_hash.slice(0, 24) + '...' : '(none)'}`);
  console.log(`  signature:           ${atc.attestation?.signature ? atc.attestation.signature.slice(0, 24) + '...' : '(none)'}`);
  console.log('');
}

async function cmdCanonical(cardPath) {
  const atc = loadJSON(cardPath);
  console.log(canonicalizeATC(atc));
}

async function cmdHash(cardPath) {
  const atc = loadJSON(cardPath);
  console.log(computePayloadHash(atc));
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

const cmd = args[0];
const rest = args.slice(1);

try {
  switch (cmd) {
    case 'init':
      await cmdInit();
      break;
    case 'issue': {
      const { values } = parseArgs({
        args: rest,
        options: {
          ca: { type: 'string' },
          agent: { type: 'string' },
          payload: { type: 'string' },
          out: { type: 'string' },
        },
      });
      if (!values.ca || !values.agent || !values.payload) {
        console.error(`${RED}atc issue requires --ca, --agent, --payload${RESET}`);
        process.exit(1);
      }
      await cmdIssue(values);
      break;
    }
    case 'verify': {
      const cardPath = rest[0];
      if (!cardPath) {
        console.error(`${RED}atc verify requires a card path${RESET}`);
        process.exit(1);
      }
      await cmdVerify(cardPath);
      break;
    }
    case 'inspect': {
      const cardPath = rest[0];
      if (!cardPath) {
        console.error(`${RED}atc inspect requires a card path${RESET}`);
        process.exit(1);
      }
      await cmdInspect(cardPath);
      break;
    }
    case 'canonical': {
      const cardPath = rest[0];
      if (!cardPath) {
        console.error(`${RED}atc canonical requires a card path${RESET}`);
        process.exit(1);
      }
      await cmdCanonical(cardPath);
      break;
    }
    case 'hash': {
      const cardPath = rest[0];
      if (!cardPath) {
        console.error(`${RED}atc hash requires a card path${RESET}`);
        process.exit(1);
      }
      await cmdHash(cardPath);
      break;
    }
    default:
      console.error(`${RED}Unknown command: ${cmd}${RESET}\n`);
      printHelp();
      process.exit(1);
  }
} catch (err) {
  console.error(`${RED}Error: ${err.message}${RESET}`);
  process.exit(1);
}
