# Exception/Response Trace (in-scope static evidence)
Date: 2026-02-26 21:56 GMT-5

## Objective
Validate how idempotence payload-mismatch is surfaced at HTTP level.

## Trace
1. `IdempotenceService.execute(...)` throws `IllegalStateException` when same execution key is reused with different payload hash:
   - file: `e-voting/voting-server/src/main/java/ch/post/it/evoting/votingserver/idempotence/IdempotenceService.java`
   - condition: `if (!payloadHash.equals(executedPayloadHash)) { throw new IllegalStateException(...) }`

2. `ConfirmVoteController.retrieveShortVoteCastReturnCode(...)` calls `idempotenceService.execute(...)` in request path:
   - file: `e-voting/voting-server/src/main/java/ch/post/it/evoting/votingserver/process/voting/confirmvote/ConfirmVoteController.java`

3. Global advice maps `IllegalStateException` to HTTP 412 (Precondition Failed):
   - file: `e-voting/voting-server/src/main/java/ch/post/it/evoting/votingserver/process/VotingServerControllerAdvice.java`
   - handler: `@ExceptionHandler(IllegalStateException.class, ...)` -> `HttpStatus.PRECONDITION_FAILED`

## Security relevance
- This creates a deterministic error-class response path for idempotence payload mismatch.
- It may act as an oracle depending on whether attacker can control/replay execution keys.

## Status
- Static evidence: CONFIRMED.
- Exploitability: NEEDS_DYNAMIC (local runtime reproduction required).
