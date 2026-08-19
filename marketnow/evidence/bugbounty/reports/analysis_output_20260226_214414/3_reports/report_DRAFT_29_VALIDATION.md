# [VALIDATION] Missing Input Validation on [extract endpoint] — RequestBody/PathVariable Parameter

**Status**: ⚠️ NEEDS DYNAMIC PoC
**Confidence**: POSSIBLE → POSSIBLE
**File**: `e-voting\voting-server\src\main\java\ch\post\it\evoting\votingserver\process\configuration\configurevoterportal\ConfigureVoterPortalController.java`
**Line**: 48

## Description
@PathVariable sin @Valid visible en ±3 líneas

## Code Evidence
```java
    46 | 	@GetMapping("electionevent/{electionEventId}")
    47 | 	public ResponseEntity<VoterPortalConfigPayload> getVoterPortalConfigPayload(
>>>   48 | 			@PathVariable
    49 | 			final String electionEventId) {
    50 | 		validateUUID(electionEventId);
```

## Falsification Analysis
La validación puede existir en interceptor/filtro/global DTO. Rastrear cadena completa.

Automatic verification: Requiere PoC dinámico en endpoint real.

## Impact Template
Endpoint [extract endpoint] at e-voting\voting-server\src\main\java\ch\post\it\evoting\votingserver\process\configuration\configurevoterportal\ConfigureVoterPortalController.java:48 accepts RequestBody/PathVariable without explicit @Valid. Requires concrete exploit and reachable attack path.

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
