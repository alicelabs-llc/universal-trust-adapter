# Response to @anp2network — Article #4419959

**Article**: MarketNow is now Trust Infrastructure for AI Agents — unified Trust API live
**URL**: https://dev.to/edison_flores_6d2cd381b13/marketnow-is-now-trust-infrastructure-for-ai-agents-unified-trust-api-live-5e64
**Comment ID**: 3d6ge by @anp2network on 2026-08-17

---

## Draft response (to post as reply on dev.to)

@anp2network — you are right on all four counts, and you are right about the order. I'll address each one and commit to specific actions.

**1. "Interoperable, independently verifiable" was overstated.**

You are correct. What we have is: one outside implementation re-derived a signature, found a real defect, and re-verified after the fix. That establishes that the format is verifiable from outside our codebase, and that the bypass is closed. It does not establish interoperability. With one implementation, "interoperable" is a claim we are making, not a property we have measured.

I will edit the checklist line. "Interoperable, independently verifiable" becomes "externally verifiable — one independent implementation has re-derived signatures and re-verified post-fix." That is what the evidence supports.

**2. Frozen fixture set — agreed, going first.**

You are right that this is the cheap, high-leverage move, and that the must-fail fixtures are the ones that matter. The nested-object bug you describe is the canonical example: JSON.stringify(payload, Object.keys(payload).sort()) dropped nested objects out of the preimage, so an altered trust.sentinel_score produced signed bytes identical to the honest card, and verify returned true. Every "valid signature verifies" test stayed green through it.

I'll publish the fixture set at `marketnow.site/atc/spec/fixtures/` with the following structure:

```
fixtures/
  v1/
    must-pass/
      01-minimal-card.json
      02-with-sentinel-score.json
      03-with-nested-trust-block.json
      ...
    must-fail/
      01-tampered-nested-field.json        # the bug you found
      02-rotated-key.json                  # signed with old CA key
      03-revoked-card.json                 # valid sig, but card is in CRL
      04-canonicalization-mismatch.json     # bytes not RFC 8785 JCS
      05-expired-card.json
    expected/
      <fixture-id>.digest                  # expected SHA-256 of canonical bytes
      <fixture-id>.verify.json             # expected verify() outcome
    MANIFEST.json                          # versioned, immutable, signed
```

Each fixture ships with: the input card, the expected canonical bytes, the expected digest, and the expected verify outcome (true/false + reason). The MANIFEST is signed with the CA key so any third party can confirm the fixtures themselves are not tampered with.

The must-fail set will include the exact nested-field mutation vector you described, the rotated-key case, and the revoked-key case. I'm explicitly carrying the bug-forward as a regression test — if a future implementation passes that must-fail fixture, it has the same bug.

ETA: fixtures published by 2026-08-26 (one week). I'll announce it in a follow-up article.

**3. /api/trust returning ALLOW/BLOCK is too thin.**

You are correct that this is the Interceptor's failure mode moved one layer up. A bare verdict with no reasoning means the caller cannot distinguish a correct BLOCK from a stale rule, a lookup miss, or a transient error. That is exactly the shape we built the Interceptor to stop.

The fix is small and I'll ship it in the next version bump:

```json
{
  "decision": "BLOCK",
  "rule_id": "BLOCK_SECRET_FILES/v1.2.0",
  "rule_fired_at": "2026-08-19T14:23:01Z",
  "inputs": [
    {
      "name": "tool_name",
      "value": "read_file",
      "content_address": "sha256:abc..."
    },
    {
      "name": "args.path",
      "value": ".env",
      "content_address": "sha256:def..."
    },
    {
      "name": "agent_id",
      "value": "ATC-2026-1509360",
      "content_address": "sha256:ghi..."
    }
  ],
  "policy_version": "2026-08-19",
  "evidence_url": "https://marketnow.site/api/trust/evidence/<decision_id>"
}
```

Each input is content-addressed, so a caller can re-run the policy locally with the same inputs and disagree with a named step instead of with the verdict. The `evidence_url` points to a tamper-evident record of the decision.

This does not break the simple `if (!decision.allowed) throw` pattern, but it makes the rich pattern possible for agents that need to second-guess.

**4. Quarantine decisions as signed, ordered records.**

You are right that "1.2M checks, 80 quarantined" is a strong business asset and a weak trust claim, and that the two are easy to conflate. The fix you propose — publishing quarantine decisions as signed, ordered records — is the right one.

We already publish the mandate ledger as a git-backed public record at `_data/mandates/`. I'll extend the same pattern to quarantine decisions:

```
_data/quarantine_decisions/
  2026/08/
    2026-08-15-mn-sub-57794.json      # signed decision record
    2026-08-16-mn-sub-57801.json
    ...
```

Each record contains: skill_id, sentinel_score, layers_run, layer_findings, decision (quarantine/allow/warn), decision_reason, signed_at, signature. The directory is git-committed (so it has a commit history) and the records are signed with the CA key.

A third party can then derive false positive rate (how many quarantined items were later un-quarantined) and false negative rate (how many allowed items were later found malicious). That is the audit you are asking for.

ETA: quarantine record publication by 2026-09-02 (two weeks). Some historical decisions need to be backfilled.

**On order:**

You are right that fixtures go first. They cost close to nothing, they don't touch the API contract, and they turn the interoperability line from a claim into a re-runnable test. The trust-response change rides the next version bump.

I'll publish the fixtures, then the quarantine records, then the trust-response enrichment, in that order. Each ships with a follow-up article so you (and anyone else) can verify independently.

Thank you for the rigor. The nested-object bug and the forward-slash escaping bug were both found by your verifier — that is two bugs that would have shipped silently without an outside implementation. The fixture set exists precisely so the next outside implementer doesn't have to find bugs the same way.

---

## After posting, also update:

1. **The article itself**: Edit the checklist line "interoperable, independently verifiable" → "externally verifiable — one independent implementation has re-derived signatures and re-verified post-fix."

2. **Worklog entry**: Document this as a public commitment with ETAs.

3. **Follow-up article** (1 week later, when fixtures ship): "ATC/1.0 conformance fixtures — frozen must-pass and must-fail vectors, signed by the CA, re-runnable by anyone."

---

## Action items summary

| # | Action | ETA | Status |
|---|--------|-----|--------|
| 1 | Edit article to soften "interoperable" claim | Today | Pending |
| 2 | Publish ATC/1.0 conformance fixtures (must-pass + must-fail) | 2026-08-26 (1 week) | Committed |
| 3 | Enrich /api/trust response with inputs + rule + evidence URL | Next version bump | Committed |
| 4 | Publish quarantine decisions as signed git-backed records | 2026-09-02 (2 weeks) | Committed |
| 5 | Follow-up article announcing fixtures | 2026-08-26 | Committed |
