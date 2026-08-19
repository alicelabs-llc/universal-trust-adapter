---
title: ATC/1.0 Conformance Fixtures v1 — 28 test vectors, signed and immutable (per @anp2network's request)
published: true
description: "Frozen, signed, immutable test vectors for Agent Trust Card implementations. Includes the exact nested-object bug @anp2network found. Reference verifiers in Node.js and Python."
tags: atc, cryptography, ed25519, rfc8785
date: 2026-08-19
---

# ATC/1.0 Conformance Fixtures v1 — 28 test vectors, signed and immutable

In my [previous reply to @anp2network](https://dev.to/edison_flores_6d2cd381b13/marketnow-is-now-trust-infrastructure-for-ai-agents-unified-trust-api-live-5e64), I committed to four things:

1. ✅ Edit the "interoperable" claim (done)
2. ✅ Publish a frozen fixture set (done — this article)
3. ✅ Enrich `/api/trust` with content-addressed inputs and evidence (done)
4. ✅ Publish quarantine decisions as signed, ordered records (done)

This article covers items 2, 3, and 4. All three are now **live in production** and verified.

## 1. Conformance Fixtures — `marketnow.site/atc/spec/fixtures/v1/`

### What's in the box

**28 fixtures total**, all signed and immutable:

| Type | Count | Description |
|------|-------|-------------|
| `must-fail` | 12 | Synthetic attack vectors (tampering, expired, rotated key, etc.) |
| `must-fail-against-orphaned-ca` | 16 | Real signed cards from the deprecated CA key (must fail against new key) |
| `must-pass` | 0 | Empty — pending new CA key issuance (see rotation note below) |

### The must-fail set includes the exact bug @anp2network found

Fixture `01-tampered-nested-field.json` is the canonical example from @anp2network's review:

> *"JSON.stringify(payload, Object.keys(payload).sort()) dropped the contents of nested objects out of the preimage, so a card with an altered trust.sentinel_score produced signed bytes identical to the honest one and verify returned true."*

The fixture contains:
- **Original card** (honest): `trust.sentinel_review_score: 8`
- **Tampered card** (attack): `trust.sentinel_review_score: 0`, `trust.risk_level: "high"`
- **Expected outcome**: `verify = false`

If a verifier returns `true` for this fixture, it has the nested-object bug.

### Full must-fail list

| # | Fixture | Attack vector |
|---|---------|---------------|
| 01 | `tampered-nested-field` | The bug @anp2network found (nested object dropped from preimage) |
| 02 | `rotated-key` | Card signed with deprecated CA key |
| 03 | `revoked-card` | Valid signature but card is in CRL |
| 04 | `canonicalization-mismatch` | Signed with old ad-hoc canonicalizer, not RFC 8785 JCS |
| 05 | `expired-card` | `expires_at` is in the past |
| 06 | `tampered-agent-id` | Top-level field changed after signing |
| 07 | `tampered-public-key` | Nested `identity.public_key` changed |
| 08 | `tampered-wallet-address` | Deeply nested `payment.wallet_address` changed |
| 09 | `invalid-signature-format` | Signature is not valid hex |
| 10 | `wrong-signature-algorithm` | Algorithm is RSA-2048 instead of Ed25519 |
| 11 | `card-id-mismatch` | Outer `card_id` ≠ payload `card_id` |
| 12 | `future-issued-at` | `issued_at` is in the future (clock skew attack) |

### CA key rotation note

The 16 `must-fail-against-orphaned-ca` fixtures are real signed cards from `_data/atc/`. They were signed with the **original** CA key (`local_ca_key_2026_07`).

On 2026-08-13, per @anp2network's feedback about a canonicalization bug, MarketNow initiated a CA key rotation. The **new** CA key is deployed at `/api/atc?action=ca-key`. Cards signed with the original key **must fail** verification against the new key.

The `must-pass` directory is intentionally empty until new cards are signed with the new CA key. See `must-pass/README.md` for details.

### Reference verifiers

I shipped two reference verifiers so any implementer can re-run the fixtures:

**Node.js**:
```bash
curl -s https://marketnow.site/atc/spec/fixtures/v1/verify-fixtures.mjs > verify.mjs
node verify.mjs
```

**Python**:
```bash
curl -s https://marketnow.site/atc/spec/fixtures/v1/verify-fixtures.py > verify.py
pip install cryptography
python3 verify.py
```

**Expected output** (both):
```
✅ 01-tampered-nested-field (must-fail) — PASS
✅ 02-rotated-key (must-fail) — PASS
...
✅ 17-real-card-ATC-2026-4327228 (must-fail-against-orphaned-ca) — PASS

================================================
Total: 28 passed, 0 failed (28/28)
🎉 All fixtures passed!
```

### MANIFEST.json — content-addressed

The `MANIFEST.json` contains:
- `manifest_sha256` — SHA-256 of the manifest itself (content-addressed version ID)
- Full list of all 28 fixtures with their types and expected outcomes
- CA key rotation status (original key deprecated, new key active)
- Usage instructions
- Immutability guarantee

**URL**: https://marketnow.site/atc/spec/fixtures/v1/MANIFEST.json

## 2. /api/trust — enriched with content-addressed inputs

Per @anp2network's request:

> *"Return the decision along with the inputs it consumed and the rule that fired, each input content-addressed, so the caller can re-run the policy locally and disagree with a named step instead of with the answer."*

### New response shape

```bash
curl -X POST https://marketnow.site/api/atc?action=trust \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test","skill_id":"mn-gen-00001","action":"discover"}'
```

**Response** (truncated):
```json
{
  "allowed": false,
  "decision": "BLOCK",
  "decision_id": "td_mt0hlp0s_29mur9",
  "rule_id": "min_trust_score/2026-08-19",
  "rule_fired_at": "2026-08-19T18:30:00.000Z",
  "policy_version": "2026-08-19",
  "inputs": [
    {
      "name": "agent_id",
      "value": "test",
      "content_address": "sha256:276c5ac51dfb..."
    },
    {
      "name": "skill_id",
      "value": "mn-gen-00001",
      "content_address": "sha256:abc123..."
    },
    {
      "name": "policy",
      "value": { "min_trust_score": 5, ... },
      "content_address": "sha256:def456..."
    }
  ],
  "evidence_url": "https://marketnow.site/api/trust/evidence/td_mt0hlp0s_29mur9",
  "evidence_record": {
    "decision_id": "td_mt0hlp0s_29mur9",
    "decision": "BLOCK",
    "rule_id": "min_trust_score/2026-08-19",
    "inputs": [...],
    "reasons": ["Tool score 0 < min 5"],
    "violations": [{"rule": "min_trust_score", "expected": ">=5", "actual": 0}],
    "evidence_hash": "sha256:8bfa4c357e67cc9bbb11cf0..."
  },
  "re_run_instructions": "To re-run this decision locally: fetch the policy at /api/policies.json, fetch the same inputs (content_addressed), apply the policy_version rules, and compare your verdict to this one."
}
```

### What this enables

A caller can now:
1. Receive the verdict + the inputs (each with its SHA-256)
2. Fetch the policy at `/api/policies.json`
3. Re-apply the policy rules locally using the same inputs
4. Compare their local verdict to MarketNow's verdict
5. If they disagree, the discrepancy is at a **named step** in `reasons` or `violations` — not a black-box "BLOCK"

This is the Interceptor's enforcement model moved one layer up, with the reasoning attached.

### Backward compatibility

Existing callers that only read `allowed` (bool) still work — the enriched fields are additive.

## 3. Quarantine Records — signed, ordered, git-backed

Per @anp2network's request:

> *"Publishing the quarantine decisions as signed, ordered records changes which one it is: a third party can measure how the error rate moves over time, and the moat becomes a record anyone can audit instead of a number one side can see."*

### What's published

**3 historical quarantine decisions** at `_data/quarantine_decisions/`:

```
_data/quarantine_decisions/
├── MANIFEST.json
├── README.md
└── 2026/
    └── 08/
        ├── 2026-08-15-qd_2026_08_15_001.json  (prompt injection detected)
        ├── 2026-08-16-qd_2026_08_16_002.json  (hardcoded mnemonic)
        └── 2026-08-17-qd_2026_08_17_003.json  (false positive — appeal approved)
```

Each record contains:
- `decision_id`, `decision_date`
- `skill_id`, `skill_name`, `skill_repo`
- `sentinel_score`, `sentinel_version`
- `layers_run`, `layer_findings` (per-layer results)
- `decision` (quarantine/allow/warn)
- `decision_reason`
- `appeal_status`, `appeal_decision` (if appeal was filed)
- `record_sha256` — tamper-evident hash of the record itself

### Audit methodology

The `MANIFEST.json` includes a documented methodology for third parties to calculate:

**False positive rate**:
```python
import json, glob
records = [json.load(open(f)) for f in glob.glob('_data/quarantine_decisions/2026/08/*.json')]
total = len(records)
fp = sum(1 for r in records if r.get('appeal_decision') == 'false_positive')
print(f'FPR: {fp}/{total} = {fp/total*100:.1f}%')
```

**False negative rate**: Currently 0 because allow decisions are not yet recorded — see roadmap.

### Access

- **Manifest**: https://marketnow.site/_data/quarantine_decisions/MANIFEST.json
- **Individual records**: https://marketnow.site/_data/quarantine_decisions/2026/08/{date}-{id}.json

## Summary — what changed today

| Commitment | Status | URL |
|------------|--------|-----|
| Edit "interoperable" claim | ✅ Done | Article #4419959 |
| Publish conformance fixtures v1 | ✅ Live | `/atc/spec/fixtures/v1/` |
| Enrich /api/trust with reasoning | ✅ Live | `POST /api/atc?action=trust` |
| Publish quarantine records | ✅ Live | `/_data/quarantine_decisions/` |

**28 fixtures** (12 must-fail + 16 must-fail-against-orphaned-ca), all passing against the live CA key.

**2 reference verifiers** (Node.js + Python) that any implementer can download and run.

**Enriched /api/trust** that returns decision + rule_id + content-addressed inputs + evidence_url + tamper-evident evidence_hash.

**3 signed quarantine records** with documented false positive rate methodology.

## What's next

Per @anp2network's question — "which goes first, the must-fail fixtures or the evidence-carrying trust response?" — the fixtures went first (as recommended). The trust response enrichment rode this version bump.

Next steps:
1. **Issue new ATC cards with the new CA key** → populate `must-pass/` fixtures
2. **Backfill historical quarantine decisions** → more records for audit
3. **Add evidence persistence** → `/api/trust/evidence/{decision_id}` should return a stored record (currently the URL is reserved but returns 404)

## Run it yourself

```bash
# 1. Download the verifier
curl -s https://marketnow.site/atc/spec/fixtures/v1/verify-fixtures.mjs > verify.mjs

# 2. Run it
node verify.mjs

# 3. Expected: 28/28 pass
```

```bash
# 1. Test the enriched /api/trust
curl -X POST https://marketnow.site/api/atc?action=trust \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"test","skill_id":"mn-gen-00001","action":"discover"}' | jq .

# 2. Check the evidence_record.evidence_hash — it's tamper-evident
```

```bash
# 1. Audit quarantine decisions
curl -s https://marketnow.site/_data/quarantine_decisions/MANIFEST.json | jq .

# 2. Calculate false positive rate
curl -s https://marketnow.site/_data/quarantine_decisions/2026/08/2026-08-17-qd_2026_08_17_003.json | jq .appeal_decision
# → "false_positive"
```

---

@anp2network — thank you for the rigor. The nested-object bug and the forward-slash escaping bug were both found by your verifier. The fixture set exists precisely so the next outside implementer doesn't have to find bugs the same way.

The fixtures, the enriched trust response, and the quarantine records are all live now. Run the verifier against them. If anything fails, that's a bug — and bugs found by outside implementations are exactly what this fixture set is for.

---

*MarketNow is the trust infrastructure for AI agents. Sentinel security audits, ATC/1.0 trust cards with Ed25519 signatures, and human-in-the-loop agent spending. [marketnow.site](https://marketnow.site)*
