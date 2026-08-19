# [CRYPTO_MISUSE] Cryptographic Misuse: [specify] in SessionService

**Status**: ✅ READY TO REVIEW
**Confidence**: PROBABLE → PROBABLE
**File**: `e-voting\tools\direct-trust-tool\direct-trust-tool-backend\src\main\java\ch\post\it\evoting\directtrusttool\backend\session\SessionService.java`
**Line**: 43

## Description
Posible secreto hardcodeado.

## Code Evidence
```java
    42 | 
>>>   43 | 	private static final String SESSION_PHASE_KEY = "phase";
    44 | 	private static final String PROPERTY_FILE = "session.properties";
```

## Falsification Analysis
Puede ser test/demo.

Automatic verification: Verificar contexto de uso antes de reportar.

## Impact Template
Use of [specify] at e-voting\tools\direct-trust-tool\direct-trust-tool-backend\src\main\java\ch\post\it\evoting\directtrusttool\backend\session\SessionService.java:43 does not meet required crypto guarantees.

## Required PoC
- Security-relevant context
- Demonstrated weakness
- Threat-model compatible scenario

## References
- NIST SP 800-131A
- CWE-327
- Swiss Post protocol requirements


## YesWeHack Submission Checklist
- [ ] Exact file + lines
- [ ] Protocol phase + spec section
- [ ] Threat model compatible
- [ ] Step-by-step exploit path
- [ ] Concrete impact
- [ ] PoC/logs/screenshots
- [ ] Not known issue
