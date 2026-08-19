---
title: ATC/1.0 — shipping a formal spec for Agent Trust Cards instead of arguing about who invented them
published: true
description: The market is converging on agent trust infrastructure from multiple directions. ATC/1.0 is our contribution — a formal, versioned, testable specification with 10 controls, JSON Schema, Ed25519 + RFC 8785 JCS, and a reference implementation with test vectors.
tags: mcp, ai, security, standards
cover_image: https://marketnow.site/og-image.png
date: 2026-08-10T11:00:00Z
---

A few weeks ago I noticed something uncomfortable. After I published my ATC (Agent Trust Card) concept on dev.to on July 13, 2026 — the first public use I can find of that exact name with the CA + Ed25519 + trust score architecture — proposals with the same name started showing up in Microsoft AutoGen, OpenAI Cookbook, Continue, and other places. I am not going to accuse anyone of copying — coincidental convergence on agent trust infrastructure is plausible, because the problem is real and obvious.

But here is the thing: **it does not matter who thought of it first.** What matters is who ships a formal, versioned, testable specification first.

So today I am publishing [ATC/1.0](https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/SPEC.md) — an open specification for Agent Trust Cards with:

- **10 controls** (8 required, 2 optional)
- **JSON Schema** for the envelope
- **Reference implementation** in Node.js (using `node:crypto` + `canonicalize`)
- **5 test vectors** (minimal valid, tampered, expired, wrong CA, capability samples)
- **RFC 8032 Ed25519** signatures
- **RFC 8785 JCS** canonical JSON

It is published under a dual license: the specification itself is open (W3C CG-FSA terms for contributors), the reference implementation is MNNC-1.0 (AliceLabs proprietary), and the test vectors are public domain (CC0).

If you are building an agent runtime, an MCP server, an A2A client, or an agent marketplace — implement ATC/1.0. Conformance tests are in the repo. The reference implementation passes all of them.

---

## Why publish a spec instead of just defending priority

Three reasons.

### 1. Priority debates are unwinnable in public

I can prove my July 13 publication is the earliest public use of "Agent Trust Card (ATC)" with the full architecture. I cannot prove whether anyone who later published similar work saw my article first. The Internet does not log intent. So a priority claim becomes a game of "I said / they said" — and that game is unwinnable in public.

A spec, on the other hand, is a fact. It exists, it is versioned, it has test vectors. **You can run it.** That is much harder to argue with than a chronological claim.

### 2. Standards win by adoption, not by priority

SSL did not win because Netscape invented HTTPS. SSL won because every browser implemented it. The TLS working group did not argue about who thought of certificate pinning first — they shipped RFC 7469 and let adoption decide.

If ATC/1.0 becomes the spec that Microsoft AutoGen, OpenAI, Cline, Continue, and independent agent runtimes implement, the priority question becomes irrelevant. The spec is the answer.

### 3. The market is converging — somebody has to ship first

In the past month I have seen:

- **A2A Agent Card** (Google, May 2026) — capability descriptor, no cryptographic trust
- **AgentCards** (academic, June 2026) — identity + capability credentials
- **OpenA2A AIP** (Internet-Draft, July 22, 2026) — Ed25519 + behavioral trust + DID + transparency log
- **OATI** (GitHub topic, July 29, 2026) — broader scope: identity + delegated authority + policy + signed receipts
- **ATC** (Edison Flores, July 13, 2026) — first public use of the name with CA + Ed25519 + revocation + capabilities + payment

All of these are converging on the same problem from different angles. That is not a threat — that is **market validation**. The window is open. Somebody has to ship the formal spec.

---

## What ATC/1.0 specifies

### The 10 controls

| # | ID | Name | Required? |
|---|----|------|-----------|
| 1 | ATC-001 | Identity | ✅ Required |
| 2 | ATC-002 | Attestation (Ed25519 + CA binding) | ✅ Required |
| 3 | ATC-003 | Capabilities (filesystem / network / shell / credentials / process) | ✅ Required |
| 4 | ATC-004 | Evidence (audit pipeline output) | ✅ Required |
| 5 | ATC-005 | Risk (trust score 0-10 + risk level + decision authority) | ✅ Required |
| 6 | ATC-006 | Signature (Ed25519 over RFC 8785 JCS canonical form) | ✅ Required |
| 7 | ATC-007 | Revocation (OCSP / CRL / simple_json list) | ✅ Required |
| 8 | ATC-008 | Expiration (issued_at + expires_at + max_ttl_days) | ✅ Required |
| 9 | ATC-009 | Delegation (parent card → child card capability narrowing) | Optional |
| 10 | ATC-010 | Runtime Trust (behavioral signals, drift detection) | Optional |

### The cryptographic core

ATC/1.0 mandates:

- **Ed25519** (RFC 8032) for signatures — fast, deterministic, well-supported in every language's standard library
- **RFC 8785 JCS** for canonical JSON — the only real standard for deterministic JSON encoding
- **SHA-256** for the payload hash (recorded in `signed_payload_hash` so verifiers can detect tampering before checking the signature)

The signature process is a bit subtle because of a chicken-and-egg: the `signed_payload_hash` field is part of the envelope but cannot be part of the signed payload (you can't hash something that includes its own hash). The spec solves this by setting both `signature = ""` AND `signed_payload_hash = ""` before canonicalizing — then computing the hash, then signing, then storing both values.

### The capability manifest

ATC-003 declares what an agent is allowed to do across 5 categories:

- **Filesystem** (read: none/own_dir/temp_dir/home_dir/system/all; write: same enum)
- **Network** (egress: none/allowlist/all; ingress: none/bound_ports/all)
- **Shell** (exec: none/sandboxed/unrestricted; spawn: same)
- **Credentials** (read_env: none/allowlist/all; read_files: same)
- **Process** (subprocess: none/sandboxed/unrestricted; signals: none/own/all)

This maps directly to what the OWASP MCP Cheat Sheet calls for in capability declarations. ATC/1.0 is the concrete format for that.

### Trust score semantics

ATC-005 carries a `trust_score` from 0 (untrusted) to 10 (highly trusted), plus a derived `risk_level`:

- 8-10 → `low`
- 5-7 → `medium`
- 2-4 → `high`
- 0-1 → `critical`

Crucially, ATC-005 mandates `decision_authority: "consumer"` — meaning **the ATC carries a recommendation, but the runtime that hosts the consuming agent makes the final trust decision**. This is a deliberate design choice. The CA does not override the runtime's security policy.

### Revocation

ATC-007 supports three revocation check methods:

- `ocsp` — RFC 6960 OCSP, for high-security deployments
- `crl` — RFC 5280 Certificate Revocation List
- `simple_json` — a JSON list signed by the CA, for low-friction deployments (this is what MarketNow uses today)

The revocation list itself is signed by the CA using the same Ed25519 + JCS process as ATC-006.

### Offline verification

A conformant verifier can verify an ATC without any network call, as long as it has the CA's public key cached. The ATC carries its own evidence (audit score, sandbox results, malware scan findings) so the verifier does not need to re-audit.

If `revocation_check_required: true`, the verifier MUST fetch the revocation list before trusting — and MUST reject if the list is unreachable.

---

## The reference implementation

The Node.js reference implementation is ~200 lines and uses only the standard library plus `canonicalize` (RFC 8785 JCS):

```js
import { generateKeyPairSync, sign, verify, createHash, createPublicKey } from 'node:crypto';
import canonicalize from 'canonicalize';

export function issueATC(caKeyPair, agentKeyPair, partialPayload) {
  const atc = { /* ... build the envelope ... */ };
  // Set signature="" AND signed_payload_hash="" before canonicalizing
  const canonical = canonicalize({ ...atc, attestation: { ...atc.attestation, signature: '', signed_payload_hash: '' } });
  atc.attestation.signed_payload_hash = createHash('sha256').update(canonical).digest('hex');
  atc.attestation.signature = sign(null, Buffer.from(canonical), caKeyPair.rawPrivateKey).toString('base64');
  return atc;
}

export function verifyATC(atc, caPublicKeyBase64) {
  // Re-canonicalize with signature="" AND signed_payload_hash=""
  const canonical = canonicalize({ ...atc, attestation: { ...atc.attestation, signature: '', signed_payload_hash: '' } });
  // Check the hash
  const computedHash = createHash('sha256').update(canonical).digest('hex');
  if (computedHash !== atc.attestation.signed_payload_hash) return { valid: false, errors: ['hash mismatch'] };
  // Verify the signature
  const caPublicKey = createPublicKey({ key: Buffer.from(caPublicKeyBase64, 'base64'), format: 'der', type: 'spki' });
  const valid = verify(null, Buffer.from(canonical), caPublicKey, Buffer.from(atc.attestation.signature, 'base64'));
  return { valid, errors: valid ? [] : ['signature verification failed'] };
}
```

That's the whole cryptographic core.

---

## Test vectors (you can run them right now)

The repo ships with 5 test vectors that exercise the full spec:

```bash
git clone https://github.com/alicelabs-llc/marketnow.git
cd marketnow/docs/atc-spec
npm install canonicalize
node ./test-vectors/generate.mjs
```

Expected output:

```
=== ATC/1.0 Test Vectors Generator ===

CA public key: MCowBQYDK2VwAyEA...
Agent public key: MCowBQYDK2VwAyEA...

Issued minimal ATC: ATC-2026-0000001
  signature: CQnixwP9zmqQGrtMp6JjVBJHmgWYQVLo...
  signed_payload_hash: 7ccfc2081c5b94a6d2a9bfd4adc6c92f899aa9968fa605d71ccdba3cf3b02551

Verification (minimal valid): { valid: true, errors: [] }
Verification (tampered):       { valid: false, errors: ['signed_payload_hash mismatch', 'Ed25519 signature verification failed'] }
Verification (expired):        { valid: false, errors: [..., 'ATC expired'] }
Verification (wrong CA):       { valid: false, errors: ['CA public key mismatch', ...] }

=== All test vectors generated and verified ===
```

If you implement ATC/1.0 in Rust or Python, you can use these same test vectors to verify your implementation produces byte-identical signatures. That is what conformance means.

---

## Prior art and the public record

I want to be honest about what existed before ATC and what appeared after.

### Before ATC

- **A2A Agent Card** (Google, May 22, 2026) — capability descriptor, no cryptographic trust, no CA, no revocation. This is prior art for agent metadata, not for trust.
- **AgentCards** (academic / Emergent Mind, July 2, 2026) — machine-verifiable identity + capability credentials. Conceptual only — no CA, no Ed25519 mandate, no runtime enforcement.

I do **not** claim to have invented agent identity or agent credentials. A2A and AgentCards predate ATC and address overlapping problem space.

### ATC origin (July 13, 2026)

My dev.to article ["AI agents need SSL certificates too — so I built ATC (Agent Trust Card)"](https://dev.to/edison_flores_6d2cd381b13/ai-agents-need-ssl-certificates-too-so-i-built-atc-agent-trust-card-5017) is, to the best of my research, the earliest public use of the specific name "Agent Trust Card (ATC)" combined with: CA + Ed25519 + Sentinel trust score + verify + revoke + capabilities + payment integration + Agent A → ATC → Agent B flow.

### After ATC

| Date | Artifact | Author |
|------|----------|--------|
| July 16, 2026 | Microsoft AutoGen issue #7965 — "Agent Trust Cards (ATC) — cryptographic trust for multi-agent systems" | (page 404 at time of writing — indexed-only) |
| July 17, 2026 | Edison — "ATC is now real" with Ed25519 + verify + revoke | Edison Flores |
| July 18, 2026 | OpenAI Cookbook issue #2865 — ATC proposal | Edison Flores |
| July 18, 2026 | OpenAI Cookbook issue #2867 — ATC proposal (same title, same day) | jj5419952-stack |
| July 18, 2026 | Cline issue #12376 — ATC proposal (Edison bringing ATC to Cline) | Edison Flores |
| July 19, 2026 | Edison — runtime trust + CA key rotation + RFC 8785 JCS migration | Edison Flores |
| July 22, 2026 | OpenA2A Agent Identity Protocol (AIP) — Internet-Draft | FANE |
| July 23, 2026 | Edison — MarketNow + ATC + Sentinel in OpenAI Cookbook #2875 | Edison Flores |
| July 29, 2026 | OATI (Open Agent Trust Infrastructure) — broader scope | Community |

I do **not** claim Microsoft, OpenAI, or Continue copied Edison. Coincidental convergence is plausible and the problem is real. I assert only chronological ordering.

The full chronology with citations is in [`PRIOR-ART-TIMELINE.md`](https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/PRIOR-ART-TIMELINE.md).

---

## What I am asking for

Three things.

### 1. Implement ATC/1.0

If you build an agent runtime (Claude Desktop plugin, Cursor extension, Cline plugin, Continue plugin, LangChain tool, LlamaIndex tool, AutoGen extension), implement ATC/1.0 verification. The reference implementation is ~200 lines. The test vectors are public domain.

If you are not sure whether to trust an agent that hands you an ATC, **don't trust it** — that's what `decision_authority: "consumer"` means. The ATC is evidence, not a verdict.

### 2. Challenge the prior art timeline

If you find a publicly verifiable artifact that pre-dates July 13, 2026 and describes the specific ATC architecture (CA + Ed25519 + trust score + revocation + capabilities), open a PR against [`PRIOR-ART-TIMELINE.md`](https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/PRIOR-ART-TIMELINE.md). I will update the timeline and credit you.

I will not remove entries that contradict my narrative. The purpose of that document is truth, not advocacy.

### 3. Compete on the spec, not on priority

If you have a competing proposal (OpenA2A AIP, OATI, your own) — let's talk interop. Standards win by adoption. If your spec is better and gets adopted, you win. If ATC/1.0 is better and gets adopted, I win. The market decides. Priority doesn't.

---

## What's next

ATC/1.0 is the v1.x floor. The roadmap is:

- **ATC/1.0** (this document, August 10, 2026): Vendor spec, reference impl, test vectors
- **ATC/1.0 + adoption** (Q3-Q4 2026): At least 2 independent implementations pass conformance
- **ATC/1.1** (Q4 2026): ML-DSA post-quantum signatures, CA key rotation protocol, delegation chains
- **W3C CG submission** (Q1 2027): Submit to a W3C Community Group for broader review
- **IETF Internet-Draft** (Q2 2027): Submit as an IETF Individual Draft
- **ATC/2.0** (2027): Transparency log (Merkle), DID integration, capability revocation (vs. card revocation)

We are not rushing to a standards body. Standards bodies reward implementations over ideas. ATC/1.0 ships first; standardization follows.

---

## Try it

```bash
npx -y marketnow-mcp@1.9.0
```

Then ask Claude Desktop: *"Verify the ATC for card_id ATC-2026-7777670"* — Claude will call `marketnow_verify_trust` with the `card_id`, which hits the live MarketNow ATC API and returns the verification result.

Or read the spec directly:
- **Spec**: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/SPEC.md
- **JSON Schema**: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/schemas/atc-1.0.json
- **Reference implementation**: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/reference-impl/atc-1.0.mjs
- **Test vectors**: https://github.com/alicelabs-llc/marketnow/tree/master/docs/atc-spec/test-vectors
- **Prior art timeline**: https://github.com/alicelabs-llc/marketnow/blob/master/docs/atc-spec/PRIOR-ART-TIMELINE.md

PRs welcome. Issues welcome. Competing specs welcome.

The market is converging. Let's ship the spec.

---

*MarketNow is security infrastructure for AI agents, built by AliceLabs LLC (Wyoming, USA). Founder: Edison Flores. The Sentinel audit pipeline has performed 1,211,488 security checks and quarantined 80 malicious skills. Audit report: [marketnow.site/api/audit-report.json](https://marketnow.site/api/audit-report.json). ATC/1.0 spec: [github.com/alicelabs-llc/marketnow/tree/master/docs/atc-spec](https://github.com/alicelabs-llc/marketnow/tree/master/docs/atc-spec).*
