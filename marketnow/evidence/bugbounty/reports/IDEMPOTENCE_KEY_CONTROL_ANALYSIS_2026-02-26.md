# Idempotence Execution Key Control Analysis (ConfirmVote)
Date: 2026-02-26 22:08 GMT-5

## Key observation
`ConfirmVoteController` builds idempotence key from deterministic fields plus `attemptId` fetched before execution:

- `attemptId = verificationCardService.getNextConfirmationAttemptId(verificationCardId)`
- `executionKey = electionEventId-verificationCardSetId-verificationCardId-credentialId-attemptId`

Source: `.../confirmvote/ConfirmVoteController.java` (around lines 109-114).

## Why this matters
- If two concurrent requests hit the same verification card before attempt increment side effects are committed,
  both may read same `attemptId` and therefore same `executionKey`.
- Idempotence implementation is check-then-act (`exists -> execute -> save`), not an atomic insert-first gate.

## Security-relevant consequence hypothesis
- Potential duplicate side-effect execution under race window.
- If duplicate execution is blocked only at late `save`, second request may receive error path instead of deterministic idempotent replay.
- Could create availability/integrity edge-case in high-concurrency conditions.

## What still must be demonstrated (for bounty validity)
1. Reproducible concurrent trigger in local runtime.
2. Proof that side effect executes more than once OR user-visible inconsistent response pattern.
3. Evidence that current exception mapping does not safely collapse race outcomes.

## Current verdict
- In-scope: YES (source code + local test plan).
- Report-ready: NO (requires dynamic concurrent PoC).
