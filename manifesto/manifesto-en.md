# The Stranger Manifesto
### Manifiesto del Desconocido · 未知者のマニフェスト · 陌生者宣言 · 낯선 이의 선언 · Манифест незнакомца · Manifeste de l'inconnu · Manifesto dello sconosciuto · Manifiest ng Taga-labas · غريب · अजनबी का घोषणापत्र

**Trust that requires membership is not trust. It's a guest list.**

When agents negotiate with the world — buy, sell, call tools, sign intents — someone will always try to sell you the answer to one question: *can I trust this?*

We refuse to sell it. We publish the evidence instead. These are the rules we build by:

**1. A stranger must be able to verify.**
If proof requires being inside the network — a membership, a key, a relationship — it is permission, not proof. Permission is fine. Don't call it trust.

**2. Fail closed.**
When evidence is missing, stale, or unverifiable, the answer is *no*. Absence of evidence is not evidence of innocence; it is an unanswered question, and unanswered questions do not authorize money.

**3. Test the tester.**
The verifier is part of the claim. A scoring engine that nobody probes is an unproven proof. We run our own runner against mutants that try to defeat it — and publish the results.

**4. Truth derives from bytes.**
Metadata can lie. Sidecars can lie. Dashboards can lie. Signatures over canonical bytes cannot be talked out of position. Ground truth is derived, never declared.

**5. Freshness is two-sided.**
A credential dated in the future is as broken as one from the past. A window has a lower bound and an upper bound. Check both, or check nothing.

**6. Revocation is part of issuance.**
Publishing proof without publishing how to un-publish it is publishing half a promise. Keys, runners and policies must be revocable — and a disconnected verifier must be able to catch up with one signed note.

**7. Anchors live outside the anchor's control.**
The record of what was published must live where the publisher cannot rewrite it. We anchor every release into a public transparency log (Rekor / Sigstore) whose inclusion proofs verify against keys we do not hold.

**8. No key, no gate.**
Verification that demands an API key is verification that can be switched off, priced up, or logged. Verification must run offline, keyless, in milliseconds, on any device.

**9. Reproducible or it didn't happen.**
If a stranger cannot rebuild the artifact from public source and get the same bytes, the artifact is an article of faith. We rebuild ours byte-for-byte and prove it.

**10. Receipts over roadmaps.**
A promise is marketing. A receipt is a checksum in a log nobody can edit. Show the commands, not the slide.

Anyone can audit us. Here are the commands.

— **AliceLabs / MarketNow**, 2026-09-09

**Verify everything in this manifesto:**
- Conformance suite (14 vectors, 24 checks, 10 mutants): https://www.marketnow.site/uta/conformance/
- Rekor anchors (append-only, third-party): https://www.marketnow.site/uta/conformance/anchors/
- Reproducible build: https://www.marketnow.site/uta/conformance/repro/
- Source: https://github.com/alicelabs-llc/universal-trust-adapter
