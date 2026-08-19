# [TIMING] Potential Timing Side-Channel in ConfigureVoterPortalService via Non-Constant-Time Comparison

**Status**: ⚠️ NEEDS DYNAMIC PoC
**Confidence**: POSSIBLE → POSSIBLE
**File**: `e-voting\secure-data-manager\secure-data-manager-backend\src\main\java\ch\post\it\evoting\securedatamanager\online\process\configurevoterportal\ConfigureVoterPortalService.java`
**Line**: 196

## Description
Posible comparación no constant-time: localPayloadContent.equals(remotePayloadContent) — tipos: [ImmutableByteArray] []

## Code Evidence
```java
   194 | 		if (localPayloadContent == null || localPayloadContent.isEmpty()) {
   195 | 			return VoterPortalConfigurationPayloadStatus.NOT_FOUND;
>>>  196 | 		} else if (localPayloadContent.equals(remotePayloadContent)) {
   197 | 			return VoterPortalConfigurationPayloadStatus.SYNCHRONIZED;
   198 | 		} else {
```

## Falsification Analysis
Requiere verificar si ImmutableByteArray.equals() internamente usa Arrays.equals() o MessageDigest.isEqual(). Si usa MessageDigest.isEqual() → mitigado.

Automatic verification: Comparación potencialmente no constant-time sobre tipo criptográfico.

## Impact Template
If comparison of ImmutableByteArray uses non-constant-time equality, an attacker with precise timing could infer [specify].

## Required PoC
- Real runtime measurements
- Statistical significance
- Reproducible scripts/logs

## References
- Kocher 1996 Timing Attacks
- https://codahale.com/a-lesson-in-timing-attacks/
- OWASP WSTG-CRYP-04
- Java MessageDigest.isEqual docs


## YesWeHack Submission Checklist
- [ ] Exact file + lines
- [ ] Protocol phase + spec section
- [ ] Threat model compatible
- [ ] Step-by-step exploit path
- [ ] Concrete impact
- [ ] PoC/logs/screenshots
- [ ] Not known issue
