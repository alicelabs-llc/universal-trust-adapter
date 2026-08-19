# [VALIDATION] Missing Input Validation on [extract endpoint] — RequestBody/PathVariable Parameter

**Status**: ⚠️ NEEDS DYNAMIC PoC
**Confidence**: POSSIBLE → POSSIBLE
**File**: `e-voting\secure-data-manager\secure-data-manager-backend\src\main\java\ch\post\it\evoting\securedatamanager\tally\process\validateelectoralboard\ValidateElectoralBoardController.java`
**Line**: 57

## Description
@PathVariable sin @Valid visible en ±3 líneas

## Code Evidence
```java
    55 | 	@PutMapping("{memberIndex}")
    56 | 	public boolean validatePassword(
>>>   57 | 			@PathVariable
    58 | 			final int memberIndex,
    59 | 			@RequestBody
```

## Falsification Analysis
La validación puede existir en interceptor/filtro/global DTO. Rastrear cadena completa.

Automatic verification: SDM suele ser interno; demostrar vector real dentro del modelo de amenaza.

## Impact Template
Endpoint [extract endpoint] at e-voting\secure-data-manager\secure-data-manager-backend\src\main\java\ch\post\it\evoting\securedatamanager\tally\process\validateelectoralboard\ValidateElectoralBoardController.java:57 accepts RequestBody/PathVariable without explicit @Valid. Requires concrete exploit and reachable attack path.

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
