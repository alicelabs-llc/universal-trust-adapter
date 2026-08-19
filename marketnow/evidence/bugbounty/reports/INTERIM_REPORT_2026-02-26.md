# Interim Bug Bounty Evidence Report (Swiss Post E-Voting)
Date: 2026-02-26

## Scope worked
- Static traceability from network endpoint to cryptographic byte comparison.
- Objective: verify whether `ImmutableByteArray.equals()` is reachable from attacker-controlled request paths.

## Confirmed code path (with file/line evidence)
1. HTTP entrypoint in voting server
   - `ConfirmVoteController` exposes `@PostMapping(...)` for confirm-vote flow.
   - File evidence: `timing_path/01_confirmvote_controller_hits.txt`

2. Endpoint invokes idempotence check with request payload
   - `idempotenceService.execute(..., confirmVotePayload, ...)`
   - File evidence: `timing_path/01_confirmvote_controller_hits.txt`

3. Idempotence computes payload hash and compares with stored hash
   - `payloadHash = hash.recursiveHash(payload)`
   - `if (!payloadHash.equals(executedPayloadHash)) ...`
   - File evidence: `timing_path/02_idempotence_hits.txt`

4. `ImmutableByteArray.equals` delegates to `Arrays.equals`
   - `return Arrays.equals(elements, that.elements);`
   - File evidence: `timing_path/03_immutablebytearray_hits.txt`

## Important methodological correction
- Previous Python-only timing simulation is **not sufficient** for bounty-grade exploit evidence.
- This report therefore does **not** claim remote exploitability yet.

## Current claim status
- ✅ Proven: network-reachable call chain exists up to `ImmutableByteArray.equals`.
- ❌ Not yet proven: practical remote timing exploit against running JVM service under realistic noise.

## Required next evidence (in progress)
1. JVM-level benchmark harness against the real classpath/build.
2. Local service timing measurements with repeated requests and statistical significance.
3. Endpoint-specific reproducibility script + raw logs + plots/screenshots.
4. False-positive controls (constant-time comparator baseline).

## Artifacts generated
- `evidence/bugbounty/timing_path/01_confirmvote_controller_hits.txt`
- `evidence/bugbounty/timing_path/02_idempotence_hits.txt`
- `evidence/bugbounty/timing_path/03_immutablebytearray_hits.txt`
- `evidence/bugbounty/logs/extract_path_status.txt`

## Submission readiness
- Not ready for final submission yet.
- Needs dynamic exploit-quality evidence before CVSS/AV assertions.
