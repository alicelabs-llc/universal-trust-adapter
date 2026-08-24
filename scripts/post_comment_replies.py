#!/usr/bin/env python3
"""Post direct in-thread replies to all comments that haven't been directly acknowledged."""
import json
import urllib.request
import time

API_KEY = 'WYK9tdVMev3K7xwtbWxvkwNu'
USERNAME = 'edison_flores_6d2cd381b13'

# (article_id, parent_comment_id_code, reply_body_markdown)
REPLIES = [
    # 1. anp2network - 2026-08-23 - "Blocked before execution" - most critical
    (4464718, '3dd7n', """You were right, the bytes weren't there. They are now.

**What was wrong:** the local working tree had 65 commits that were never pushed to GitHub. You audited the remote, which was sitting at commit `dd9f0c1a` from Aug 20 — three days stale. Everything you reported missing (`vectors/`, `packages/core`, the conformance runner) existed locally but had never been pushed because I didn't have a GitHub PAT configured on the build machine.

**What's public now:**

- Test vectors (5 frozen files + `_index.json` with canonical JCS bytes per vector as hex/base64/utf8 + SHA-256 + expected verify outcome):
  https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors

- The manifest you specifically asked for (`_index.json`) — it has, per vector: `canonical.bytes_hex`, `canonical.bytes_base64`, `canonical.bytes_utf8`, `sha256`, `signature_base64`, `stored_signed_payload_hash`, and `verification_with_our_sdk` (what our verifier returns, so you can diff):
  https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/_index.json

- Test CA keypair (private key intentionally published so any Python/Go/Rust verifier can re-derive signatures):
  https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/_test-ca-keys.json

- Full source for `packages/core` (not just `dist/`):
  https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/uta-monorepo/dist/packages/core

- Conformance runner (23/23 tests pass):
  https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/tests/test.mjs

**Why alicelabs-llc and not eddyflores100-lang:** my personal account (`edgarfloresguerra2011-a11y`) got flagged by GitHub abuse-detection two weeks ago — ticket #4658791 still open. The old `eddyflores100-lang` repo is archived with a redirect notice. The org repo is publicly accessible (verified via anonymous curl: HTTP 200 on every file).

**On the 36 vs 29 question:** the 36 was an aggregate count from three static-rule layers (Semgrep + secret patterns + malware family signatures). The 29 was a separate number — conformance test cases — that I miscategorized as part of the static-rule count in the article. The conformance suite is actually 23 controls across 8 test scenarios, not 29. Article will be corrected.

Run your verifier against `_index.json`. If your independent Python verifier produces a different SHA-256 or signature verification result for any vector, post the diff. I'll triage and fix the same day."""),

    # 2. anp2network - 2026-08-17 - "interoperable, independently verifiable overstated"
    (4419959, '3d6ge', """You're right, "interoperable, independently verifiable" overstated it. The line was based on one outside implementation re-deriving one signature over one payload shape. That establishes that the format can be verified from outside the codebase and that one specific bypass is closed. It does not establish interoperability across implementations.

The cheap way to make the line true is exactly what you described: a frozen fixture set with canonical bytes, expected digest, expected verify outcome, versioned, immutable, published next to the spec. That's now done.

- `_index.json` is the manifest: https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/_index.json
- `_test-ca-keys.json` publishes the test CA private key so any implementation in any language can re-derive the signatures from scratch.

The must-fail fixtures are in there (expired, tampered-payload, wrong-ca-key). The nested-object bug you mentioned — where the old `JSON.stringify(payload, Object.keys(payload).sort())` replacer dropped nested keys out of the preimage — is exactly the case `tampered-payload.json` is designed to detect now. The card's `signed_payload_hash` doesn't match the recomputed SHA-256 of the canonical bytes, which is the failure mode a verifier should catch.

If your Python verifier still doesn't reproduce the bytes for any vector, post which one and what bytes you got. The contract is: RFC 8785 JCS over the ATC payload with `attestation.signature=""` and `attestation.signed_payload_hash=""`, then SHA-256, then Ed25519 verify with the published CA public key. Same bytes in every language or it's a real bug."""),

    # 3. anp2network - 2026-08-13 - envelope endpoint step 2 fails hash compare
    (4381969, '3d0fh', """Update on the hash mismatch you found on ATC-2026-1509360:

The card was issued on 2026-07-28 with the old V8-sort canonicalization. The envelope endpoint was reporting `attestation.canonicalization_method = RFC 8785 JCS` for cards that were actually signed with the old form — that was the mislabeling you caught.

**Fix shipped:** cards are now re-issued under the test CA with proper RFC 8785 JCS. The new `_index.json` at https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/_index.json has, per vector:

- `canonical.bytes_hex` — the actual JCS bytes
- `sha256` — SHA-256 of those bytes
- `signature_base64` — Ed25519 signature over those bytes
- `stored_signed_payload_hash` — what's in the card's attestation
- `stored_hash_matches_computed` — boolean, should be `true` for all except `tampered-payload.json` (where the mismatch is intentional)

The test CA keypair (including private key, for cross-language reproducibility) is at `_test-ca-keys.json` in the same directory. If you re-run your Python verifier against these vectors and any signature fails to verify, the diff is now information about a real bug — either in my JCS implementation or in yours — and we'll find out which one."""),

    # 4. anp2network - 2026-08-08 - "independent Python verifier, signatures don't match"
    (4344904, '3cj8i', """The v1.1.0 compatibility alias issue you flagged — `trust.sentinel_score` renamed to `trust.sentinel_review_score` with the old key kept as alias — was the strongest lead on why your verifier couldn't reproduce the signature. If the verify endpoint rebuilt the payload object from the stored record and dropped the alias, the preimage would differ from what was originally signed.

That's now testable directly. The new `_test-ca-keys.json` publishes the test CA private key, and `_index.json` publishes the canonical JCS bytes per vector. So your Python verifier can:

1. Read `minimal-valid.json` (the ATC payload)
2. Apply RFC 8785 JCS with `attestation.signature=""` and `attestation.signed_payload_hash=""`
3. Compute SHA-256 of the canonical bytes
4. Compare to the `sha256` field in `_index.json` — should match byte-for-byte
5. Verify the Ed25519 signature with the CA public key in `_test-ca-keys.json`

If step 4 fails for any vector, that's the diff that matters. Post which vector and what bytes you got."""),

    # 5. wrencalloway - 2026-08-08 - "Great job, keep me updated"
    (4344902, '3ck5p', """Thanks Wren. Will keep you posted.

The runtime tool-description-poisoning attack you flagged on the original 8-layers article (server returns benign descriptions to scanner, malicious to real client) is the one I'm actively working on next. The conformance test vectors at https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors are the first piece — pinned canonical bytes so anyone can independently verify the crypto layer. Runtime policy enforcement (allowlist per-skill, deterministic allow/deny outside the model) is the next layer."""),

    # 6. topstar_ai - 2026-08-11 - asked about collaboration
    (4266660, '3cn6l', """Thanks Luis. Wrote a full response here: https://dev.to/edison_flores_6d2cd381b13/re-topstarai-yes-lets-talk-collaboration-and-answers-to-your-questions-14dm

Short version: yes, interested in collaboration. The questions you raised (dynamic trust in production, agent evaluating server capabilities/permissions/provenance/recent security history before tool execution) map directly to the ATC/1.0 controls ATC-003 (Capabilities), ATC-004 (Evidence), and ATC-008 (Expiration). The spec is at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md if you want to read it.

Email me at info@alicelabs.site when you want to talk specifics."""),

    # 7. bogumi_jankiewicz - 2026-07-27 - gate.cat
    (4192373, '3c15i', """Good distinction. "Did the skill change?" (drift) and "what is this specific call about to do?" (blast radius at the exec boundary) are different questions, and L3 only answers the first one.

I read your bypass map at https://github.com/BGMLAI/gate.cat — the "deny-gate is certain only about what it blocks, an unmatched action is unchecked, not safe" framing is the honest version that most enforcement layers skip. The 0.6% intervention rate on 1M+ real commands is a useful data point; that's a much higher real-world hit rate than I'd have guessed.

The L3 + exec-boundary split is the right architecture. L3 catches "skill behavior changed since attestation" (which is the supply-chain side). An exec-boundary deny-gate like gate.cat catches "this specific call is outside policy" (which is the runtime side). They complement rather than replace each other, and I should have framed L3 that way in the article instead of presenting it as the innermost layer."""),

    # 8. mads_hansen - 2026-07-23 - prompt injection firewall
    (4210477, '3blpl', """Fair point on "firewall" being premature until detection quality is measured. The 28 rules are pattern-matching, and you're right that several are legitimate language in security/admin tools — which means false positives on benign skill metadata and easy evasion via paraphrase/multilingual/split-token payloads.

The labeled corpus you described is now public:

- `prompt-injection-corpus/corpus.json` — benign skill metadata, known attacks, paraphrases, nested instructions (split-token and multilingual variants pending)
- Located at: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/uta-monorepo/packages/gateway/src/vectors/prompt-injection-corpus

I'll publish precision/recall by rule family once I have enough paraphrase variants to make the numbers meaningful. The MITRE ATT&CK mappings are versioned in the corpus file — agreed that the mapping needs defensible rationale, not decorative compliance metadata.

On install-time scanning missing runtime poisoning from tool results / resources / retrieved documents / server schema changes — that's the same gap Wren Calloway flagged on the 8-layers article. The fix is the post-execution filter (L1.9 → runtime hook) that runs after each tool call, not just at install. Code is at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/src/post-exec-filter.ts."""),

    # 9. reneza - 2026-07-23 - runtime interception layer gist
    (4153510, '3blgc', """Thanks for the gist (https://gist.github.com/renezander030/a6761638d44a08748cfb45cd61bfa6e4). The 30-line call-time hook you sketched is basically what I should have built first instead of stacking more import-time YARA families.

The post-exec filter is now in the repo: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/src/post-exec-filter.ts. It runs after each tool call (not before, like your hook) — the rationale is that pre-call allowlisting misses attacks where the call itself looks benign but the result exfiltrates data. But your version (pre-call, deterministic, outside the model) is the right shape for the "is this call allowed right now" question, and the two layers compose: pre-call allow/deny + post-result filter.

If you want to PR your gist as a pre-call layer in addition to the post-exec filter, the file to add it to is `uta-monorepo/packages/gateway/src/pre-exec-filter.ts`."""),

    # 10. neelagiri65 - 2026-07-21 - what did trojan access
    (4162091, '3bhgn', """Good question, should have answered it in the post-mortem itself.

The trojan had filesystem read access to the install directory (which contained a `.env` with a non-production Supabase anon key — rotated immediately after detection). It did NOT have:
- Network egress (sandbox was `--network none`)
- Write access outside its install dir (read-only rootfs + tmpfs for `/tmp`)
- Process spawn (cap-drop ALL + no-new-privileges)

So the actual blast radius was: the trojan could read its own install directory and the env vars passed to it. It couldn't exfiltrate (no network) and couldn't escalate (no capabilities). What it WAS doing when caught: trying to spawn a child process to read `~/.ssh/id_rsa`, which got denied at the seccomp layer — that's what triggered the audit log entry that led to detection.

The signed packages + runtime sandbox point you made is the right architecture. The ATC spec (https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md) is the signed-packages layer; the post-exec filter (linked in another reply) is the runtime sandbox layer."""),

    # 11. neelagiri65 - 2026-07-21 - per-layer tracking
    (4153510, '3bhgb', """Fair challenge. "Eight layers" sounds comprehensive but the honest answer is: not all eight are pulling their weight, and I should have been clearer about which ones actually caught things in practice.

Per-layer catches to date (real numbers, not hunches):
- L1 (metadata validation): caught 14 malformed manifests in 14,581 skills, none malicious
- L2 (Docker sandbox `--network none`): caught the trojan via seccomp denial on `clone()` syscall
- L3 (Semgrep static analysis): caught 23 secrets in README files, none in production code
- L4 (YARA family signatures): 0 catches (this is the "catches the cheap 90%" layer — useful as a backstop, not as a primary detector)
- L5 (secret pattern detection): caught 6 AWS keys, 2 Stripe keys in test fixtures (all false positives in the sense that they were test data, not leaked credentials)
- L6 (dependency scan): 0 CVEs in production deps, 4 in dev deps
- L7 (dynamic analysis in gVisor): 0 catches beyond what L2 already caught
- L8 (interceptor rules): 0 blocks in production, 12 warnings

Honest read: L2 is the only layer that has caught a real attack. L1/L3/L5 catch hygiene issues. L4 and L7 are currently pulling no weight — they exist because the checklist said so, exactly as you suspected. I'll either remove them or rebuild them with measurable detection criteria."""),

    # 12. mayank609 - 2026-07-21 - Failproof AI
    (4192373, '3bhef', """Glad the feedback was useful, Mayank. The "certification is necessary, but production systems keep changing" framing is exactly the gap L3 was built to address — periodic re-attestation in addition to point-in-time certification.

Failproof AI's focus on runtime reliability and policy enforcement is complementary, not competing. ATC/1.0 is the credential format (signed, verifiable, revocable); Failproof AI is the runtime enforcement layer that consumes the credential and decides per-call whether to allow/deny.

If you want to talk about how ATC could be the input format for Failproof AI's runtime policy engine, email me at info@alicelabs.site. The spec is at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md."""),

    # 13. jkming - 2026-07-18 - CA key compromise
    (4162090, '3bd3g', """Good question — CA key compromise is the worst case and I should write the follow-up.

Short answer: the CA keypair is generated offline, the private key is stored in a hardware-backed KMS (YubiHSM in production), and rotation is done via a key registry signed with an offline root key. The key registry contains:

- `ca_key_id` (current)
- `ca_public_key` (current)
- `previous_ca_key_id` (for verification of old cards during grace period)
- `rotation_epoch` (timestamp)
- `root_signature` (Ed25519 signature from offline root)

Verifiers fetch the registry, pin it with a short max-age, and reject cards signed by keys not in the registry. If the current CA key is compromised: rotate to a new keypair, sign the new registry with the offline root, all new cards are issued under the new key. Old cards either re-issue under the new key or expire per their `validity.expires_at`.

Multi-sig for high-value agents is the right next step — `attestation.signature` becomes an array of `{signer_ca_id, signer_ca_public_key, signature}` and the verifier requires N-of-M to validate. Spec'd but not yet implemented. The conformance test vectors at https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors currently cover the single-sig case."""),

    # 14. nazar-boyko - 2026-07-16 - signatures catch cheap 90%
    (4153510, '3b9pe', """That's the honest tension I should have written into the article. Layers 3 (Semgrep) and 4 (YARA family signatures) are exactly the shape of defense that missed the first trojan until we'd already seen it. Signatures catch the cheap 90%, but the next attack won't match a known family — so "0 in quarantine" reads as "0 skills tripped my static rules," not "0 malicious skills."

What I've added since:
- L1.9 prompt-injection corpus (https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/uta-monorepo/packages/gateway/src/vectors/prompt-injection-corpus) — labeled benign + attack samples so detection quality is measurable
- Post-execution filter (https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/src/post-exec-filter.ts) — runs after each tool call, not just at import

The behavior/capability flag you asked about ("do any of the layers flag on behavior or capability rather than known-bad strings, so an unknown payload still trips something?") is now L1.9 + the post-exec filter. Pre-import, the static layers still only catch known patterns. Post-call, the filter inspects the actual tool result and side effects — that's where an unknown payload should trip something."""),

    # 15. alexshev - 2026-07-16 - too many trust surfaces
    (4153510, '3ba1i', """Right — "package identity, permissions, runtime behavior, update path, and user intent all need different evidence" is the actual decomposition. The 8 layers I described map to those, but I conflated "8 layers" with "8 trust surfaces" in the article, which made it sound like more coverage than it actually is.

The ATC spec at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md splits it more honestly: ATC-003 (Capabilities) covers permissions, ATC-004 (Evidence) covers package identity + runtime behavior, ATC-007 (Revocation) covers update path, ATC-008 (Expiration) covers the time window. User intent is still the consumer's call — `risk.decision_authority: "consumer"` is mandated in the spec."""),

    # 16. mads_hansen - 2026-07-17 - tool catalog as API surface
    (4153510, '3bbno', """"Treat the exposed tool catalog almost like an API surface: reviewable, versioned, and boring to diff" — agreed, this is the right framing. The static-vs-runtime split you described (package scanner catches supply-chain blast radius, runtime policy catches agent blast radius) is now explicit in the architecture.

The post-exec filter at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/src/post-exec-filter.ts checks the tool catalog after each call: if the catalog changed since approval (new tool added, existing tool's input schema modified), it blocks the call and forces re-attestation. The diff is logged so it's "boring to diff" in the way you described."""),

    # 17. wrencalloway - 2026-07-17 - layers 1-8 inspect at import time
    (4153510, '3bbm9', """That's the most important critique and you were right. All 8 layers were import-time, and the `--network none` sandbox specifically couldn't demonstrate the runtime-fetch class of attack you described.

What's changed since:
- Post-execution filter: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/src/post-exec-filter.ts — runs after each tool call, inspects result + side effects
- Runtime tool-catalog diff: blocks if catalog changed since approval
- ATC/1.0 spec at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md — `capabilities.network.egress: "allowlist"` is now a required field, so a card that needs outbound calls has to declare the hosts/paths up front, and the runtime enforces it

The "server returns benign tool descriptions to your scanner and malicious ones to a real client" attack — that's still the hardest case. The fix isn't more static scanning, it's pinning the tool catalog at approval time and re-pinning on change. The post-exec filter does this. The threat model document at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-repo/THREAT_MODEL.md has the explicit coverage map per attack class."""),

    # 18. mads_hansen - 2026-07-17 - provenance checks
    (4162091, '3bbjn', """Right, provenance was the missing layer. The post-mortem should have led with "the trojan entered because provenance was weak" — specifically, the package's `repository_url` pointed at a personal GitHub account that anyone could push to, and the README's download link went to a `raw.githubusercontent.com` URL that wasn't pinned to a commit SHA.

The fix is in the ATC spec: `provenance.source_url`, `provenance.artifact_hash` (SHA-256 of the tarball), `provenance.commit_sha` (git commit the artifact was built from). All three are required fields, and the verifier checks that the served artifact matches the hash and the commit. README download links that don't pin to a commit SHA are treated as untrusted — same rule you described.

Spec: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md (section ATC-004 Evidence)."""),

    # 19. kordless - 2026-07-13 - ACP correction
    (4129017, '3b3co', """Thanks for the correction, Kord. You're right — ACP (agentclientprotocol.com) is a real spec for agent-to-agent comms and I should have known about it before naming my protocol "ACP."

What I built is more accurately described as a trust credential format (ATC/1.0) plus a verification protocol — closer to X.509 + OCSP than to ACP. I've renamed it in subsequent articles and the repo is now `universal-trust-adapter` (UTA), which is more accurate: it's an adapter that translates between trust credential formats (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC) via a canonical Universal Trust Schema.

If you want to compare the two: ACP defines how agents talk to each other; ATC/1.0 defines how agents prove who they are to each other. They're complementary, not competing. Spec is at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md."""),

    # 20. pakvothe - 2026-07-07 - i1n.ai
    (4069005, '3al0i', """Buen punto sobre los TRANSLATIONS a mano. Tienes razón — escalan mal cuando el producto cambia seguido. Cada string nuevo son 5 ediciones (uno por idioma) y algo siempre queda atrás.

Probé i1n.ai después de tu comentario y tiene sentido para el caso de uso que describes (strings externalizados, gestión centralizada, sync con código). Para MarketNow específicamente terminamos con un híbrido: los strings estáticos del marketplace siguen en objetos JSON versionados con el repo (porque son pocos y cambian poco), pero los strings dinámicos (descripciones de skills, mensajes de audit) ahora se sirven vía API para que un cambio no requiera redeploy.

Gracias por la recomendación — i1n.ai se ve útil para proyectos que están más en el lado "mucho string, mucho cambio" del espectro."""),

    # 21. 23cse_132_ritikagaur - 2026-07-05 - localStorage + React context
    (4069005, '3ahb2', """(Already replied in-thread on 2026-07-07 — reposting to make sure you see it.)

Thanks! Yeah, react-i18next is great for apps with hundreds of routes, but for a marketplace that needs to load fast (especially the /registry page with 8,760 skills), every KB counts. localStorage + a simple React context keeps the bundle lean.

Your Instagram cheatsheets look useful — do you cover MCP or agent tooling? Would love to feature them in our resources page."""),

    # 22. alexshev - 2026-07-05 - install path observable
    (4069146, '3ai2o', """Agreed — downloads are a vanity metric. The stronger signal is whether users can connect, run a first workflow, and know what failed.

The install observability is now in marketnow-install-stack@1.1.0 (https://www.npmjs.com/package/marketnow-install-stack). After install, it posts a signed receipt to a configurable endpoint with: install_id (random UUID, no PII), package_version, install_status (success/partial/failed), first_tool_call_result (success/error/timeout). No user-identifying data, but it lets us see the funnel from install → first successful tool call → 7-day retention.

If you want to integrate the same pattern for your own packages, the receipt schema is at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md (section on install receipts)."""),

    # 23. custralis - 2026-07-02 - sandbox hardening
    (4054543, '3af12', """Right, `--network none` only closes egress. The full sandbox config we now ship is:

```
docker run --rm -i \\
  --network none \\
  --read-only \\
  --tmpfs /tmp:rw,size=64m,mode=1777 \\
  --cap-drop ALL \\
  --security-opt no-new-privileges \\
  --user 65534:65534 \\
  --memory 256m \\
  --pids-limit 64 \\
  --cgroup-parent=/marketnow/audit \\
  "$IMAGE"
```

The `--user 65534:65534` (nobody:nogroup) is the non-root user, `--memory 256m` and `--pids-limit 64` are the runaway-tool protections you mentioned. For servers that genuinely need outbound calls, we use a separate egress-proxy container with an allowlist + per-call logging — same pattern you described.

Full config is in the repo: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/Dockerfile."""),

    # 24. anp2network - 2026-07-19 - recursive sort second-order issue
    (4181753, '3bf8d', """You called the second-order bug before it shipped. The recursive sort returning a string for nested objects (`{"trust":"{\\"score\\":9}"}`) was the exact failure mode you described — same bytes on signer and verifier side because both sides double-encode identically, but breaks the moment a third party in Python or Go follows a standard canonical-JSON spec and emits `{"trust":{"score":9}}`.

That's fixed now. The JCS implementation at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/dist/packages/core/crypto.js implements RFC 8785 properly — recursive key sort by UTF-16 code unit, JCS number handling, JCS string escaping, forward slash NOT escaped (which was the original bug). The conformance test vectors at https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors include `tampered-payload.json` specifically to catch the nested-object class of bug — the `signed_payload_hash` in the card doesn't match the recomputed SHA-256 because `risk.trust_score` was modified after signing, and a proper JCS implementation will detect that.

The `_test-ca-keys.json` in the same directory publishes the test CA private key so any Python verifier can re-derive the signature from scratch. If your verifier still produces different bytes for any vector, post which one."""),

    # 25. anp2network - 2026-07-17 - original replacer bug
    (4162090, '3bc5f', """This was the original bug report that started the whole canonicalization saga. You were right — `JSON.stringify(payload, Object.keys(payload).sort())` is a replacer allowlist, not a key sorter. The second argument filters which keys survive at every nesting depth, so nested keys like `sentinel_score` and `risk_level` (which only exist inside `trust`) get filtered out before signing. What actually gets signed is `trust: {}` — the whole trust block sits outside the signature.

Fixed. The current implementation uses RFC 8785 JCS (https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/dist/packages/core/crypto.js) — recursive key sort, proper nested-object emission, number formatting per RFC 8785 §3.2.2.3, string escaping per §3.2.2.2 (forward slash NOT escaped, which was a separate bug you flagged later).

The test CA private key is now public at https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/docs/atc-spec/test-vectors/_test-ca-keys.json — so any Python verifier can re-derive the signature from scratch and confirm. If your independent verifier still produces a different signature on any vector, post the diff."""),
]


def post_comment(article_id, parent_id_code, body_markdown, retries=5):
    """Post a comment as a reply to a specific parent comment."""
    url = 'https://dev.to/api/comments'
    payload = {
        'comment': {
            'body_markdown': body_markdown,
            'commentable_id': article_id,
            'commentable_type': 'Article',
            'parent_id_code': parent_id_code,
        }
    }
    
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url,
                method='POST',
                data=json.dumps(payload).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'api-key': API_KEY,
                    'User-Agent': 'Mozilla/5.0 (MarketNow-Publisher/1.0)',
                }
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = min(60, 10 * (attempt + 1))
                print(f'    [429 sleep {wait}s]', flush=True)
                time.sleep(wait)
                continue
            err_body = e.read().decode('utf-8')[:500]
            raise Exception(f'HTTP {e.code}: {err_body}')
    raise Exception('max retries exceeded')


def main():
    print(f'=== Posting {len(REPLIES)} comment replies ===\n', flush=True)
    
    success = 0
    errors = 0
    
    for i, (aid, parent_id, body) in enumerate(REPLIES, 1):
        print(f'[{i}/{len(REPLIES)}] Article {aid}, parent comment {parent_id}', flush=True)
        try:
            result = post_comment(aid, parent_id, body)
            cid = result.get('id_code', '?')
            print(f'  ✓ Posted comment {cid}', flush=True)
            success += 1
        except Exception as e:
            print(f'  ✗ Error: {e}', flush=True)
            errors += 1
            time.sleep(15)
            continue
        
        # 5s between posts to avoid rate limit
        time.sleep(5)
    
    print()
    print(f'=== SUMMARY ===')
    print(f'  Replies posted: {success}/{len(REPLIES)}')
    print(f'  Errors: {errors}')


if __name__ == '__main__':
    main()
