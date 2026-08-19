# Candidate Finding: Idempotence Check-Then-Act Race
Date: 2026-02-26 22:02 GMT-5
Status: NEEDS_DYNAMIC (in-scope)

## Hypothesis
`IdempotenceService.execute(...)` performs `existsById` then executes side effects, then persists idempotence marker.
Under concurrency, two requests with same `(context, executionKey)` could both pass `existsById == false` and both execute side effects before one save fails.

## Code evidence
1) Check-then-act sequence:
- file: `e-voting/voting-server/src/main/java/ch/post/it/evoting/votingserver/idempotence/IdempotenceService.java`
- flow:
  - `if (!exists(idempotentExecutionId)) {`
  - `result = execution.get();`
  - `save(idempotentExecutionId, payloadHash);`

2) Repository operations are simple CRUD (no explicit locking):
- file: `.../IdempotentExecutionRepository.java`
- extends `CrudRepository<IdempotentExecution, IdempotentExecutionId>`

3) Unique key exists (`context`, `executionKey`) at entity/id level:
- files: `IdempotentExecution.java`, `IdempotentExecutionId.java`
- this may prevent duplicate row persistence, but does NOT by itself prove side effects were single-executed.

4) Network path example using idempotence:
- `ConfirmVoteController` calls `idempotenceService.execute(...)`
- file: `.../process/voting/confirmvote/ConfirmVoteController.java`

## Why interesting
If side effects are non-idempotent (or expensive/protocol-significant), duplicate execution in race window could impact integrity/consistency.

## What must be proven before reporting
- Concurrent requests with same execution key actually run `execution` twice.
- Observable impact (double action / inconsistent state / protocol impact).
- Mitigations absent (DB lock, unique-constraint rollback before side effects, upstream serialization).

## Dynamic PoC plan (local only, in-scope)
1. Spin local service and DB.
2. Fire N concurrent requests with same endpoint path and same idempotence key components.
3. Capture:
   - request/response logs,
   - DB writes,
   - side-effect counter/events,
   - transaction exceptions.
4. Determine if side effect ran once or more than once.

## Current verdict
- Static confidence: PROBABLE design weakness.
- Report readiness: NOT READY (requires dynamic proof).
