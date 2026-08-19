# [VALIDATION] Missing Input Validation on [extract endpoint] — RequestBody/PathVariable Parameter

**Status**: ⚠️ NEEDS DYNAMIC PoC
**Confidence**: POSSIBLE → POSSIBLE
**File**: `e-voting\voting-server\src\main\java\ch\post\it\evoting\votingserver\process\voting\confirmvote\ConfirmVoteController.java`
**Line**: 74

## Description
@PathVariable sin @Valid visible en ±3 líneas

## Code Evidence
```java
    72 | 	@PostMapping("electionevent/{electionEventId}/verificationcardset/{verificationCardSetId}/credentialId/{credentialId}/verificationcard/{verificationCardId}")
    73 | 	public Mono<ConfirmVoteResponsePayload> retrieveShortVoteCastReturnCode(
>>>   74 | 			@PathVariable(Constants.PARAMETER_VALUE_ELECTION_EVENT_ID)
    75 | 			final String electionEventId,
    76 | 			@PathVariable(Constants.PARAMETER_VALUE_VERIFICATION_CARD_SET_ID)
```

## Falsification Analysis
La validación puede existir en interceptor/filtro/global DTO. Rastrear cadena completa.

Automatic verification: Requiere PoC dinámico en endpoint real.

## Impact Template
Endpoint [extract endpoint] at e-voting\voting-server\src\main\java\ch\post\it\evoting\votingserver\process\voting\confirmvote\ConfirmVoteController.java:74 accepts RequestBody/PathVariable without explicit @Valid. Requires concrete exploit and reachable attack path.

## Required PoC
- Show no global validation
- Working payload
- Concrete impact

## References
- OWASP Input Validation
- CWE-20
- Spring @Valid docs


## YesWeHack Submission Checklist
- [ ] Exact file + lines
- [ ] Protocol phase + spec section
- [ ] Threat model compatible
- [ ] Step-by-step exploit path
- [ ] Concrete impact
- [ ] PoC/logs/screenshots
- [ ] Not known issue
