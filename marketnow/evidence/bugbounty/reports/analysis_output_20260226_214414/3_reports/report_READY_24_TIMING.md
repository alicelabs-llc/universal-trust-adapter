# [TIMING] Potential Timing Side-Channel in IdempotenceService via Non-Constant-Time Comparison

**Status**: ✅ READY TO REVIEW
**Confidence**: PROBABLE → PROBABLE
**File**: `e-voting\voting-server\src\main\java\ch\post\it\evoting\votingserver\idempotence\IdempotenceService.java`
**Line**: 67

## Description
Posible comparación no constant-time: payloadHash.equals(executedPayloadHash) — tipos: [ImmutableByteArray] [ImmutableByteArray]

## Code Evidence
```java
    65 | 		} else {
    66 | 			final ImmutableByteArray executedPayloadHash = load(idempotentExecutionId);
>>>   67 | 			if (!payloadHash.equals(executedPayloadHash)) {
    68 | 				throw new IllegalStateException(
    69 | 						"Request already executed, but with different payload. [context: %s, executionKey: %s]".formatted(context.get(),
```

## Falsification Analysis
Verificar implementación de ImmutableByteArray.equals(). Si es constant-time internamente → no es vulnerable.

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
