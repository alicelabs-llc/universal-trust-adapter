# ATC/1.0 Specification — Agent Trust Card Protocol

**Status**: Draft v1.0.0 — public for review
**Issued**: 2026-08-10
**Author**: Edison Flores, AliceLabs LLC
**License**: Reference implementation is MNNC-1.0 (AliceLabs LLC Proprietary). The specification itself is published for community contribution under W3C CG-FSA terms.

## What is this?

ATC/1.0 is a formal, versioned, testable specification for **Agent Trust Cards** — cryptographic credentials that let AI agents prove their identity, declare their capabilities, and carry their security audit evidence.

Think of it as **SSL certificates for AI agents**.

## Files in this directory

```
atc-spec/
├── SPEC.md                          # The full specification (10 controls)
├── PRIOR-ART-TIMELINE.md           # Public chronology of ATC and adjacent work
├── README.md                        # This file
├── schemas/
│   └── atc-1.0.json                 # JSON Schema for the ATC envelope
├── reference-impl/
│   └── atc-1.0.mjs                  # Node.js reference implementation
├── test-vectors/
│   ├── generate.mjs                 # Generates test vectors from reference impl
│   ├── minimal-valid.json          # A minimal ATC that verifies
│   ├── tampered-payload.json        # Tampered ATC (signature should fail)
│   ├── expired.json                 # Expired ATC
│   ├── wrong-ca-key.json            # Valid ATC + wrong CA key
│   └── capability-samples.json     # Sample capability manifests
└── conformance/
    └── README.md                    # Conformance test suite
```

## The 10 controls

| # | ID | Name | Status |
|---|----|------|--------|
| 1 | ATC-001 | Identity | Required |
| 2 | ATC-002 | Attestation | Required |
| 3 | ATC-003 | Capabilities | Required |
| 4 | ATC-004 | Evidence | Required |
| 5 | ATC-005 | Risk | Required |
| 6 | ATC-006 | Signature | Required |
| 7 | ATC-007 | Revocation | Required |
| 8 | ATC-008 | Expiration | Required |
| 9 | ATC-009 | Delegation | Optional |
| 10 | ATC-010 | Runtime Trust | Optional |

## Quick start

### Verify an ATC

```bash
# Install the reference implementation
npm install canonicalize

# Clone the repo
git clone https://marketnow.site/atc.git
cd marketnow/docs/atc-spec

# Verify the minimal test vector
node -e "
import { verifyATC } from './reference-impl/atc-1.0.mjs';
import { readFileSync } from 'node:fs';
const vec = JSON.parse(readFileSync('./test-vectors/minimal-valid.json', 'utf8'));
const result = verifyATC(vec.atc, vec.ca_public_key);
console.log(result);
"
```

Expected output:
```
{ valid: true, errors: [] }
```

### Issue your first ATC

```js
import {
  generateCAKeyPair,
  generateAgentKeyPair,
  issueATC,
  verifyATC,
} from './reference-impl/atc-1.0.mjs';

// 1. Generate keypairs
const caKeyPair = generateCAKeyPair();
const agentKeyPair = generateAgentKeyPair();

// 2. Build the payload (only the required controls)
const payload = {
  card_id: 'ATC-2026-0000001',
  identity: {
    agent_id: 'my-agent-001',
    agent_name: 'My First Agent',
    agent_owner: 'My Org',
  },
  capabilities: {
    filesystem: { read: 'own_dir', write: 'own_dir' },
    network: { egress: 'allowlist', ingress: 'none' },
    shell: { exec: 'sandboxed', spawn: 'none' },
    credentials: { read_env: 'none', read_files: 'none' },
    process: { subprocess: 'none', signals: 'own' },
  },
  evidence: { /* ... */ },
  risk: {
    trust_score: 8,
    risk_level: 'low',
    score_explanation: 'Clean audit',
    scored_at: new Date().toISOString(),
  },
};

// 3. Issue the ATC
const atc = issueATC(caKeyPair, agentKeyPair, payload);

// 4. Verify it
const result = verifyATC(atc, caKeyPair.publicKey);
console.log(result);  // { valid: true, errors: [] }
```

## Why ATC/1.0 exists

The market is converging on agent trust infrastructure from multiple directions:

- **A2A Agent Card** (Google, May 2026) — capability descriptor, no cryptographic trust
- **AgentCards** (academic, June 2026) — identity + capability credentials
- **OpenA2A AIP** (Internet-Draft, July 2026) — Ed25519 + behavioral trust + DID
- **OATI** (GitHub topic, July 2026) — broader scope: identity + authority + policy + receipts
- **ATC** (Edison Flores, July 13, 2026) — first public appearance of the specific name "Agent Trust Card" with CA + Ed25519 + trust score + revocation + capabilities

See [`PRIOR-ART-TIMELINE.md`](./PRIOR-ART-TIMELINE.md) for the full chronology with citations.

**The question is no longer "who thought of agent trust first" — multiple parties did.**

**The question is "who shipped a formal, versioned, testable specification first"** — and the answer is this document, dated 2026-08-10.

## How to contribute

PRs welcome at https://marketnow.site/atc.

### Contribution license

By contributing to ATC/1.0, you agree to release your contributions under the [W3C Community Group Final Specification Agreement](https://www.w3.org/community/about/agreements/final/) terms. This ensures the spec remains open and royalty-free.

### Areas needing contribution

- Reference implementation in Rust
- Reference implementation in Python
- Conformance test suite (currently Node.js only)
- Formal proof of the signature verification algorithm
- Integration with existing DID methods (did:key, did:web)

## Citation

```
AliceLabs LLC. "ATC/1.0 — Agent Trust Card Protocol Specification."
Version 1.0.0-draft. 2026-08-10.
https://marketnow.site/atc
```

## License

- **Specification** (`SPEC.md`, `PRIOR-ART-TIMELINE.md`, this `README.md`): W3C CG-FSA (open, royalty-free for contributors)
- **Reference implementation** (`reference-impl/atc-1.0.mjs`): MNNC-1.0 (AliceLabs LLC Proprietary)
- **JSON Schema** (`schemas/atc-1.0.json`): MNNC-1.0 (AliceLabs LLC Proprietary)
- **Test vectors** (`test-vectors/*.json`): Public domain (CC0)

This dual-licensing model ensures the spec stays open while the reference implementation remains under AliceLabs control. If you want to ship a competing implementation, you can read the spec and the test vectors for free — but you'll need to write your own implementation from scratch.

## Standards body alignment

ATC/1.0 is currently a vendor specification. The path to formal standardization is:

1. **v1.0** (this document, 2026-08-10): Vendor spec, reference implementation, test vectors
2. **v1.0 + adoption** (Q3-Q4 2026): At least 2 independent implementations pass conformance
3. **v1.1** (Q4 2026): Adds ML-DSA post-quantum, CA key rotation protocol
4. **W3C CG submission** (Q1 2027): Submit to a W3C Community Group for broader review
5. **IETF Internet-Draft** (Q2 2027): Submit as an IETF Individual Draft

We are not rushing to a standards body. Standards bodies reward implementations over ideas. ATC/1.0 ships first; standardization follows.
