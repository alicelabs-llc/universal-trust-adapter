# [VALIDATION] Missing Input Validation on [extract endpoint] — RequestBody/PathVariable Parameter

**Status**: ⚠️ NEEDS DYNAMIC PoC
**Confidence**: POSSIBLE → POSSIBLE
**File**: `e-voting\voting-server\src\main\java\ch\post\it\evoting\votingserver\process\configuration\compute\ComputeEncryptedLongReturnCodeSharesController.java`
**Line**: 78

## Description
@PathVariable sin @Valid visible en ±3 líneas

## Code Evidence
```java
    76 | 	@GetMapping(value = "/electionevent/{electionEventId}/verificationcardset/{verificationCardSetId}/chunkcount/{chunkCount}/status", produces = MediaType.APPLICATION_JSON_VALUE)
    77 | 	public ResponseEntity<ComputingStatus> getComputingStatus(
>>>   78 | 			@PathVariable
    79 | 			final String electionEventId,
    80 | 			@PathVariable
```

## Falsification Analysis
La validación puede existir en interceptor/filtro/global DTO. Rastrear cadena completa.

Automatic verification: Requiere PoC dinámico en endpoint real.

## Impact Template
Endpoint [extract endpoint] at e-voting\voting-server\src\main\java\ch\post\it\evoting\votingserver\process\configuration\compute\ComputeEncryptedLongReturnCodeSharesController.java:78 accepts RequestBody/PathVariable without explicit @Valid. Requires concrete exploit and reachable attack path.

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
