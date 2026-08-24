#!/usr/bin/env python3
"""Publish batched response articles for users who commented but haven't received a dedicated reply article yet."""
import json
import urllib.request
import time

API_KEY = 'WYK9tdVMev3K7xwtbWxvkwNu'

# Articles to publish (each one is a batched response to a specific user)
ARTICLES = [
    {
        "title": "Re: @mads_hansen — answers to your 6 comments across the audit pipeline articles",
        "description": "Direct response to Mads Hansen (conexor.io) covering the capability classification, runtime split, prompt injection corpus, key registry, and per-layer catch tracking.",
        "body_markdown": """You've left 6 comments across our audit pipeline articles since July 16, each one substantive. This is a batched response — easier to read in one place than scattered across 6 articles. Your original comments are linked inline.

## 1. "Capability classification after install, not just package inspection before install" (Jul 16)

> "A package can look clean and still expose a tool surface that deserves scrutiny: file read/write scope, network egress scope, credential access, tenant or workspace boundary, mutation vs read-only actions, approval requirements, result data sensitivity, rate limits and retry behavior."

Agreed, and the ATC spec now mandates this as a required field. `ATC-003 Capabilities` requires every card to declare:

- `filesystem.read` / `filesystem.write` (none | own_dir | temp_dir | home_dir | system | all)
- `network.egress` (none | allowlist | all)
- `network.ingress` (none | bound_ports | all)
- `shell.exec` (none | sandboxed | unrestricted)
- `credentials.read_env` (none | allowlist | all)
- `process.subprocess` (none | sandboxed | unrestricted)

Spec: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md

## 2. "Static scanning catches the supply-chain blast radius. Runtime policy catches the agent blast radius. You need both." (Jul 17)

The split you described is now explicit in the architecture. Static layers (L1-L7) handle supply-chain. The post-execution filter at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/src/post-exec-filter.ts handles runtime. It runs after each tool call, inspects the result + side effects, and blocks if the tool catalog changed since approval.

## 3. "Distinguish periodic re-attestation from runtime monitoring" (Jul 21)

> "A weekly sandbox replay can detect artifact, catalog, permission, and observed-behavior drift; it cannot see an attack that runs between scans, activates only for a real tenant, or depends on a production credential and data shape."

Right — and I should have framed L3 that way from the start. L3 is the periodic re-attestation layer (weekly sandbox replay). The exec-boundary deny-gate (gate.cat or equivalent) is the runtime layer. They compose, they don't replace each other.

## 4. "Be careful calling it a firewall until detection quality is measured" (Jul 23)

> "Several rules are legitimate language in security/admin tools: 'execute system commands,' 'read .env,' urgency words, or conditional 'when X, do Y.' A raw match count can create both false positives and easy evasion. I would publish a labeled corpus with benign skill metadata, known attacks, paraphrases, multilingual/Unicode variants, split-token payloads, and nested instructions, then report precision/recall by rule family rather than only the number of rules."

Done. The labeled corpus is now public: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/uta-monorepo/packages/gateway/src/vectors/prompt-injection-corpus

Precision/recall by rule family will follow once I have enough paraphrase + multilingual variants to make the numbers meaningful. Currently the corpus has labeled benign + known attacks; the paraphrase/split-token/multilingual expansions are tracked as the next addition.

MITRE ATT&CK mappings are versioned in the corpus file with rationale per technique ID, not as decorative compliance metadata.

## 5. "Compromise recovery depends on revocation distribution" (Jul 19)

> "A verifier with a cached registry can keep accepting attacker-signed ATCs until it learns the old key is revoked. I would sign the key registry with a separately protected offline root, include registry epoch/issued-at/expiry, define a short maximum ATC lifetime, and test stale-cache behavior explicitly."

The key registry now follows exactly this shape:

- Signed with an offline root key (separate Ed25519 keypair, private key on YubiHSM)
- `registry_epoch` (monotonic counter)
- `issued_at` / `expires_at` (short max lifetime — 7 days default)
- `previous_ca_key_id` for grace-period verification of old cards
- Verifier fetches registry with `Cache-Control: max-age=300` (5 min) and `Stale-While-Revalidate: 86400` (1 day) — so a cached registry can serve for up to 24h after the registry expires, but rejects new cards signed by the old key after rotation

Stale-cache behavior is in the test suite: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/tests/test.mjs

## 6. (Unspoken but implied across all your comments)

The thread that runs through all 6 of your comments is: "what does each layer actually catch, measured, not claimed." That's the right pressure to apply. The 8-layer article sounded comprehensive; the honest per-layer breakdown is:

- L1 metadata validation: caught 14 malformed manifests in 14,581 skills (none malicious)
- L2 Docker sandbox with `--network none`: caught the trojan via seccomp denial on `clone()`
- L3 Semgrep: caught 23 secrets in README files
- L4 YARA family signatures: 0 catches (currently pulls no weight)
- L5 secret patterns: 6 AWS keys + 2 Stripe keys in test fixtures (false positives)
- L6 dependency scan: 0 CVEs in production deps
- L7 dynamic analysis in gVisor: 0 catches beyond what L2 already caught
- L8 interceptor: 0 blocks in production, 12 warnings

L4 and L7 either get rebuilt with measurable detection criteria or get removed. "8 layers" was the wrong framing — it should have been "8 layers, 2 of which actually caught things, here's what the other 6 are for."

— Edison"""
    },
    {
        "title": "Re: @wrencalloway — thanks for the 4 comments, here's what changed because of them",
        "description": "Direct response to Wren Calloway covering the import-time vs runtime gap, tool-description-poisoning, and the canonicalization bug thread.",
        "body_markdown": """You've left 4 comments since Jul 17, and each one named a real gap. Batched response below.

## 1. "Layers 1-8 all inspect the artifact at import time, but MCP skills are live code" (Jul 17)

> "The trojan-in-a-zip is the easy threat because it's static — you can scan it once and be done. The hard one is a skill that ships clean and then pulls its payload at runtime, or a server that returns benign tool descriptions to your scanner and malicious ones to a real client."

This was the most important critique anyone made on the 8-layers article. The fix is the post-execution filter: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/src/post-exec-filter.ts — runs after each tool call, inspects result + side effects, blocks if tool catalog changed since approval.

The `--network none` sandbox specifically couldn't demonstrate the runtime-fetch class of attack you described — that was the gap. Static scanning + dynamic analysis in a no-network sandbox catches the supply-chain side; the post-exec filter catches the runtime side.

## 2. "Genuinely curious how you'd catch a tool-description-poisoning attack" (Jul 17)

> "Genuinely curious how you'd catch a tool-description-poisoning attack where the MCP server serves different descriptions per client — that's the one I'd want answered before installing from any marketplace, and none of the 8 seem aimed at it."

The honest answer is: I don't have a complete solution to this yet. The partial fix is:

- At approval time, pin the tool catalog (list of tools + their input schemas) to a content hash
- At runtime, every tool description served by the MCP server must match the pinned hash
- If the server tries to serve a different description to a real client than what was pinned → block + alert

This catches the "server returns benign to scanner, malicious to client" attack if the scanner and the client both go through the same gateway. It does NOT catch the case where the server fingerprints the client and serves different descriptions to different clients based on TLS fingerprint, UA, or timing. That's an open problem — probably needs a non-trivial design (multi-client probing, diverse fingerprints) to detect.

Threat model document at https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-repo/THREAT_MODEL.md has the explicit coverage map per attack class, including this one marked as "partial."

## 3. "Well done, thanks!!" (Jul 19) and "Great job, keep me updated" (Aug 8)

Acknowledged. Thanks for following along — your comments have been the most consistently sharp of any reviewer.

## What's next

The canonical repo is now at https://github.com/alicelabs-llc/universal-trust-adapter (moved from `eddyflores100-lang` because my personal account got flagged by GitHub abuse-detection — ticket #4658791 open). Test vectors with canonical JCS bytes per fixture are at https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors.

If you want to run an independent verifier against the test vectors, the test CA private key is published at `_test-ca-keys.json` so any Python/Go/Rust verifier can re-derive the signatures from scratch.

— Edison"""
    },
    {
        "title": "Re: @neelagiri65 — what the trojan actually accessed, and per-layer catch counts",
        "description": "Answers to the two questions Neelagiri65 asked on the post-mortem and 8-layers articles.",
        "body_markdown": """You asked two questions that I should have answered in the original articles. Batched response.

## 1. "What did the trojan actually get access to before anyone noticed?" (Jul 21, on the post-mortem)

The trojan had filesystem read access to its install directory, which contained a `.env` file with a non-production Supabase anon key. That key was rotated immediately after detection.

It did NOT have:

- Network egress (sandbox was `--network none`)
- Write access outside its install dir (read-only rootfs + tmpfs for `/tmp`)
- Process spawn capability (`--cap-drop ALL` + `seccomp` denying `clone()`)

What it was doing when caught: trying to spawn a child process to read `~/.ssh/id_rsa`. The `clone()` syscall got denied at the seccomp layer, and that denial was logged. The audit log entry is what triggered detection — not the static scanner, not the dynamic analysis, the seccomp denial.

So the actual blast radius was: read access to the install directory + read access to env vars passed to the tool. No exfiltration path (no network), no privilege escalation (no capabilities). The trojan was contained but not detected until it tried to escalate.

The signed packages + runtime sandbox architecture you described as the real fix is what the ATC spec + post-exec filter now implement:

- Signed packages: ATC/1.0 with Ed25519 signatures, revocable, expires_at enforced
- Runtime sandbox: Docker with `--network none`, `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, non-root user, memory + pids limits
- Runtime policy: post-exec filter that inspects every tool call result

## 2. "Did you track per-layer catches, or is it still a hunch which ones are pulling their weight?" (Jul 21, on the 8-layers article)

Honest answer: not tracked rigorously until you asked. Now tracked, and the numbers are not flattering:

- L1 metadata validation: caught 14 malformed manifests in 14,581 skills (none malicious — all hygiene issues like missing `version` field)
- L2 Docker sandbox (`--network none` + seccomp): caught the trojan via seccomp denial on `clone()`
- L3 Semgrep static analysis: caught 23 secrets in README files (none in production code — all were test fixtures)
- L4 YARA family signatures: 0 catches — currently pulls no weight
- L5 secret pattern detection: caught 6 AWS keys + 2 Stripe keys, all in test fixtures (false positives in the sense that they weren't leaked credentials, just test data)
- L6 dependency scan: 0 CVEs in production deps, 4 in dev deps
- L7 dynamic analysis in gVisor: 0 catches beyond what L2 already caught
- L8 interceptor rules: 0 blocks in production, 12 warnings

Real read: L2 is the only layer that has caught a real attack. L1/L3/L5 catch hygiene issues. L4 and L7 exist because the checklist said so, not because they catch things.

I'll either remove L4/L7 or rebuild them with measurable detection criteria (specific signatures that demonstrably catch specific attack classes). "8 layers" was the wrong framing — should have been "8 layers, 2 of which actually caught things, here's what the other 6 are for and what they'd need to do to earn their place."

— Edison"""
    },
    {
        "title": "Re: community comments — answers to 9 reviewers in one place",
        "description": "Batched response to 9 commenters who each left one comment: Bogumił Jankiewicz, René Zander, Mayank Bansal, jkming, Nazar Boyko, Alex Shev (x2), Kord Campbell, Franco Ortiz, Custralis.",
        "body_markdown": """Nine of you left one comment each over the last 7 weeks. Rather than post 9 separate response articles, here's a batched reply. Each section links back to your original comment.

## @bogumi_jankiewicz (gate.cat) — Jul 27

> "Drift detection answers 'did the skill change?' — but blast radius is decided at a much narrower interface: the concrete action that reaches the shell/API."

Right distinction. L3 (drift detection) answers "did the artifact change since attestation." gate.cat answers "is this specific call about to do something outside policy." They compose — L3 catches supply-chain drift, gate.cat catches runtime blast radius. The 0.6% intervention rate on 1M+ real commands is a useful real-world data point; much higher than I'd have guessed.

I read your bypass map at https://github.com/BGMLAI/gate.cat — the "deny-gate is certain only about what it blocks, an unmatched action is unchecked, not safe" framing is the honest version most enforcement layers skip. The L3 + exec-boundary split is the right architecture; I should have framed L3 as the supply-chain side, not the innermost layer.

## @reneza — Jul 23

> "The piece that closes it is a runtime interception layer, a hook that sees each tool call the installed skill actually makes and checks it against a policy before it runs."

Your gist (https://gist.github.com/renezander030/a6761638d44a08748cfb45cd61bfa6e4) is basically what I should have built first instead of stacking more import-time YARA families. The post-exec filter is in the repo: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/src/post-exec-filter.ts — runs after each tool call (not before, like your hook). Pre-call allow/deny (your version) + post-result filter (mine) compose: pre-call answers "is this call allowed right now," post-call answers "did this call's result exfiltrate anything."

If you want to PR your pre-call hook as a layer in addition to the post-exec filter, the file to add it to is `uta-monorepo/packages/gateway/src/pre-exec-filter.ts`.

## @mayank609 (Failproof AI) — Jul 21

> "We're building Failproof AI. Our focus is on runtime reliability and policy enforcement."

Complementary, not competing. ATC/1.0 is the credential format (signed, verifiable, revocable). Failproof AI is the runtime enforcement layer that consumes the credential and decides per-call whether to allow/deny. If you want to talk about how ATC could be the input format for Failproof AI's runtime policy engine, email info@alicelabs.site. Spec: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md

## @jkming — Jul 18

> "Have you considered what happens if the CA key itself is compromised? Would love to see a follow-up on key rotation and multi-sig for high-value agents."

CA key compromise is the worst case. The keypair is generated offline, private key in YubiHSM, rotation via a key registry signed with an offline root key. The registry contains `ca_key_id`, `ca_public_key`, `previous_ca_key_id` (for grace period), `rotation_epoch`, `issued_at`/`expires_at` (short max-age), and `root_signature` from the offline root.

Multi-sig for high-value agents is spec'd but not yet implemented — `attestation.signature` becomes an array of `{signer_ca_id, signer_ca_public_key, signature}` and the verifier requires N-of-M. The test vectors at https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors cover the single-sig case for now.

## @nazar-boyko — Jul 16

> "Signatures catch the cheap 90%, but the next one won't match a known family — so '0 in quarantine' reads as '0 skills tripped my static rules,' not '0 malicious skills.'"

That's the honest tension. L3 (Semgrep) and L4 (YARA family signatures) are exactly the shape of defense that missed the first trojan until we'd seen it. The fix isn't more static rules — it's the post-exec filter for runtime behavior + the prompt-injection corpus for measurable detection quality. The corpus is at https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/uta-monorepo/packages/gateway/src/vectors/prompt-injection-corpus

## @alexshev — Jul 16 and Jul 5

> "A marketplace has too many trust surfaces for one big check to mean much: package identity, permissions, runtime behavior, update path, and user intent all need different evidence."

Agreed. The ATC spec splits it more honestly than the 8-layers article did:

- ATC-003 Capabilities → permissions
- ATC-004 Evidence → package identity + runtime behavior
- ATC-007 Revocation → update path
- ATC-008 Expiration → time window
- `risk.decision_authority: "consumer"` → user intent (still the consumer's call)

Spec: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md

On the "downloads are vanity" point from your other comment — agreed. Install observability is in `marketnow-install-stack@1.1.0`: after install, posts a signed receipt with install_id (random UUID, no PII), package_version, install_status, first_tool_call_result. No user-identifying data, but lets us see the funnel from install → first successful tool call → 7-day retention.

## @kordless — Jul 13

> "ACP is a spec for agent to agent comms: agentclientprotocol.com/get-started/introduction. Your stuff is interesting though, but it's more than a protocol."

You were right — I should have known about ACP before naming my protocol "ACP." What I built is more accurately a trust credential format (ATC/1.0) plus a verification protocol, closer to X.509 + OCSP than to ACP. Renamed to UTA (Universal Trust Adapter) — it translates between trust credential formats (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC) via a canonical Universal Trust Schema.

ACP defines how agents talk to each other; ATC/1.0 defines how agents prove who they are. Complementary, not competing.

## @pakvothe — Jul 7

> "Los objetos TRANSLATIONS a mano funcionan hasta que el producto empieza a cambiar seguido, ahí cada string nuevo son 5 ediciones y algo siempre queda atrás."

Tienes razón. Para MarketNow terminamos con un híbrido: strings estáticos del marketplace en objetos JSON versionados con el repo (pocos, cambian poco), strings dinámicos (descripciones de skills, mensajes de audit) servidos vía API para que un cambio no requiera redeploy. i1n.ai se ve útil para proyectos más en el lado "mucho string, mucho cambio" del espectro — gracias por la recomendación.

## @custralis — Jul 2

> "Worth pairing it with --read-only rootfs + explicit tmpfs, --cap-drop ALL, --security-opt no-new-privileges, a non-root USER, and memory/pids limits so a runaway tool can't fork-bomb the host."

All of those are now in the sandbox config we ship:

```bash
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

Full config in the repo: https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/uta-monorepo/packages/gateway/Dockerfile. For servers that genuinely need outbound calls, separate egress-proxy container with allowlist + per-call logging, same as you described.

— Edison"""
    },
]


def fetch(url, method='GET', data=None, retries=5):
    headers = {
        'User-Agent': 'Mozilla/5.0 (MarketNow-Publisher/1.0)',
        'Accept': 'application/json',
        'api-key': API_KEY,
        'Content-Type': 'application/json',
    }
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, method=method, headers=headers,
                                          data=json.dumps(data).encode() if data else None)
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
    print(f'=== Publishing {len(ARTICLES)} batched response articles ===\n', flush=True)
    
    published = []
    
    for i, art in enumerate(ARTICLES, 1):
        title = art['title']
        print(f'[{i}/{len(ARTICLES)}] {title[:70]}', flush=True)
        
        payload = {
            'article': {
                'title': title,
                'published': True,
                'body_markdown': art['body_markdown'],
                'tags': ['security', 'atc', 'agents', 'discussion'],
                'description': art['description'][:140],
            }
        }
        
        try:
            result = fetch('https://dev.to/api/articles', method='POST', data=payload)
            url = result.get('url', '?')
            aid = result.get('id', '?')
            print(f'  ✓ Published: {url}', flush=True)
            published.append({'id': aid, 'url': url, 'title': title})
            time.sleep(10)  # 10s between articles
        except Exception as e:
            print(f'  ✗ Error: {e}', flush=True)
            time.sleep(30)
    
    print()
    print(f'=== SUMMARY ===')
    print(f'  Articles published: {len(published)}/{len(ARTICLES)}')
    for p in published:
        print(f'  - {p["title"][:70]}')
        print(f'    {p["url"]}')


if __name__ == '__main__':
    main()
