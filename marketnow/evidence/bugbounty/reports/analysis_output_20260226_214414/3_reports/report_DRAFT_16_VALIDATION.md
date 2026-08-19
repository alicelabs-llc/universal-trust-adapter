# [VALIDATION] Missing Input Validation on [extract endpoint] — RequestBody/PathVariable Parameter

**Status**: ⚠️ NEEDS DYNAMIC PoC
**Confidence**: POSSIBLE → POSSIBLE
**File**: `e-voting\tools\direct-trust-tool\direct-trust-tool-backend\src\main\java\ch\post\it\evoting\directtrusttool\backend\api\v1\PublicKeysSharingController.java`
**Line**: 74

## Description
@PathVariable sin @Valid visible en ±3 líneas

## Code Evidence
```java
    72 | 	@GetMapping(value = "fingerprints/{sessionId}", produces = "application/json")
    73 | 	public ImmutableMap<String, String> getFingerprints(
>>>   74 | 			@PathVariable
    75 | 			final String sessionId
    76 | 	) {
```

## Falsification Analysis
La validación puede existir en interceptor/filtro/global DTO. Rastrear cadena completa.

Automatic verification: Requiere PoC dinámico en endpoint real.

## Impact Template
Endpoint [extract endpoint] at e-voting\tools\direct-trust-tool\direct-trust-tool-backend\src\main\java\ch\post\it\evoting\directtrusttool\backend\api\v1\PublicKeysSharingController.java:74 accepts RequestBody/PathVariable without explicit @Valid. Requires concrete exploit and reachable attack path.

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
