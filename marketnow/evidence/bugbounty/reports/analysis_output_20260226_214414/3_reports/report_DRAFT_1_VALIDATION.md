# [VALIDATION] Missing Input Validation on [extract endpoint] — RequestBody/PathVariable Parameter

**Status**: ⚠️ NEEDS DYNAMIC PoC
**Confidence**: POSSIBLE → POSSIBLE
**File**: `e-voting\control-component\src\main\java\ch\post\it\evoting\controlcomponent\process\tally\disputeresolver\DisputeResolverController.java`
**Line**: 64

## Description
@PathVariable sin @Valid visible en ±3 líneas

## Code Evidence
```java
    62 | 	@GetMapping("tenants/{tenantId}/electionevents/{electionEventId}/verificationcards")
    63 | 	public ControlComponentExtractedVerificationCardsPayload extractVerificationCards(
>>>   64 | 			@PathVariable
    65 | 			final String tenantId,
    66 | 			@PathVariable
```

## Falsification Analysis
La validación puede existir en interceptor/filtro/global DTO. Rastrear cadena completa.

Automatic verification: Requiere PoC dinámico en endpoint real.

## Impact Template
Endpoint [extract endpoint] at e-voting\control-component\src\main\java\ch\post\it\evoting\controlcomponent\process\tally\disputeresolver\DisputeResolverController.java:64 accepts RequestBody/PathVariable without explicit @Valid. Requires concrete exploit and reachable attack path.

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
