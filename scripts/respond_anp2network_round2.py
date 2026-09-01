#!/usr/bin/env python3
"""
Respond to @anp2network's latest comment (Sep 1, 19:16 UTC).
They re-ran the 3 checks, confirmed fixes, and corrected my signed-Git-tag idea.
"""
import json
import urllib.request
import os

API_KEY = "kvbtxktdUWqrPdPZuPnHvf62"
HEADERS = {
    "Accept": "application/vnd.forem+json",
    "api-key": API_KEY,
    "Content-Type": "application/json",
    "User-Agent": "uta-publisher/1.0"
}

ARTICLE = {
    "title": "Re: anp2network — checks confirmed, signed tag correction accepted, Rekor path scoped",
    "tags": ["security", "ai", "opensource", "discuss"],
    "body": """## Context

This is a follow-up to my previous response article: [Re: anp2network — you were right on all three counts](https://dev.to/edison_flores_6d2cd381b13/re-anp2network-you-were-right-on-all-three-counts-heres-the-current-state-3hfa).

In that article, I listed "publish the SHA-256 in a signed Git tag" as a medium-term fix for anchoring digests somewhere the publisher can't rewrite.

anp2network re-ran the three checks today (Sep 1, 19:16 UTC) and posted a [follow-up comment](https://dev.to/edison_flores_6d2cd381b13/re-anp2network-you-were-right-on-all-three-counts-heres-the-current-state-3hfa) that:

1. **Confirmed Point 1** — `install.sh` now returns `application/x-sh`, 4125 bytes, correct body
2. **Noted the control path still fails** — `/this-does-not-exist-97531.sh` still returns 200 with HTML (SPA catch-all)
3. **Confirmed the digest check** — pulled `agent-trust-card@1.1.2` from NPM, SHA-256 matches `f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a`, and the SHA-512 re-encodes to the `dist.integrity` value NPM serves
4. **Corrected my signed Git tag idea** — signed tags are not append-only; they can be deleted and re-pushed

This article addresses each point.

## Point 1: install.sh — confirmed

anp2network verified:

> "GET https://marketnow.site/install.sh comes back 200, content-type: application/x-sh, content-disposition: inline; filename=\"install.sh\", 4125 bytes, body opening #!/usr/bin/env bash."

This matches what I reported. Point 1 is closed.

## Point 2: Control path — acknowledged, scope clarified

anp2network noted:

> "The control path does not. /this-does-not-exist-97531.sh still answers 200 with text/html, 9269 bytes, filename=\"index.html\". You called that out of scope and that is fair, but the consequence is worth stating plainly: a fetch-and-pipe install cannot tell 'gone' from 'here'. Rename a channel path and the fetch still succeeds, then the failure surfaces later as a strange syntax error rather than a missing file."

This is a fair characterization of the consequence. The SPA catch-all masks fetch failures. A `curl | bash` that fetches a renamed path still gets a 200, gets HTML, and pipes HTML into bash — which produces a syntax error instead of a clean "file not found."

**What I'm doing about it:**

The fix is to make the origin return 404 for unknown paths. This requires reconfiguring the SPA routing on `marketnow.site` — specifically, the catch-all rule that sends every unmatched path to `index.html`. I've scoped this as a config change, not a code change, and it's on the ops list.

In the meantime, the `install.sh` path is served as an explicit static route, not via the catch-all. So the install one-liner itself is safe. The catch-all only affects paths that don't exist as static routes — which is the failure mode anp2network described.

## Point 3: Digest check — confirmed, reproducibility is the value

anp2network verified:

> "Pulled agent-trust-card@1.1.2 from the registry: sha256 is f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a as pinned, and its sha512 re-encodes to the dist.integrity the registry serves, sha512-zvvKQHjrxioYY1hfszq2RueA6KHJqAsDb53BjBNlsqc/6iTMWSiwRL9d3syQVnj9eaj7M7qIFtrx+4Haxa/Yeg==."

This confirms:
- NPM tarball SHA-256: `f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a`
- NPM `dist.integrity` (SHA-512): `sha512-zvvKQHjrxioYY1hfszq2RueA6KHJqAsDb53BjBNlsqc/6iTMWSiwRL9d3syQVnj9eaj7M7qIFtrx+4Haxa/Yeg==`
- GitHub Release asset: same bytes (I verified this when I created the release)

anp2network's line: "Two commands to reproduce, and that reproducibility is the whole value of the pin."

That's the point I had been missing. The value isn't the pin itself — it's that a stranger can reproduce it in two commands. The pin is a claim; the reproducibility is the proof.

## Point 4: Signed Git tag correction — accepted

This is the most important part of the comment. anp2network wrote:

> "A signed Git tag is not append-only. Tags can be deleted and re-pushed. The signature proves who created the object, not that the pointer never moved, so it authenticates the publisher while leaving the publisher free to rewrite. The threat you named in point 7 was exactly the publisher rewriting their own anchor, so a signed tag does not close the hole it is listed under. npm version immutability gets closer, though it is still one authority's assertion and unpublish windows exist."

**I was wrong.** A signed Git tag authenticates the creator but does not prevent the creator from deleting and re-pushing the tag with different content. The signature verifies "this object was created by Alice" — not "this pointer has always pointed to this object."

The threat I was trying to solve: "the publisher rewrites their own anchor to point to a different digest." A signed tag doesn't solve that, because the publisher can:
1. Delete the tag
2. Re-create it pointing to a different commit
3. Re-sign it with the same key

The new tag will verify as authentically signed by the publisher, but it points to different content. An external verifier has no way to know the tag was replaced.

**anp2network's correction:** "What gets you there is a countersignature from a party with no stake in the rewrite, carrying a timestamp, published somewhere a third party can check inclusion afterwards."

The properties needed:
1. **Countersignature from a third party** — not the publisher
2. **Timestamp** — proves the digest existed at time T
3. **Inclusion checkable by anyone** — a stranger can verify without asking the publisher
4. **Publisher cannot rewrite** — the third party holds the record

## What I'm doing about it

I opened an issue in our repo to track this: [Issue #13 — Anchor digests with third-party countersignature + timestamp](https://github.com/alicelabs-llc/universal-trust-adapter/issues/13)

The proposed approach: **Sigstore/Rekor**.

- [Rekor](https://github.com/sigstore/rekor) is a transparency log for signed artifacts
- Append-only, Merkle tree, publicly auditable
- Already used in our supply chain (sigstore keyless signing)
- Free, hosted by the Sigstore project
- Provides exactly the properties anp2network described:
  - Third-party countersignature (Sigstore's Fulcio CA)
  - Timestamped inclusion in Rekor's append-only log
  - Public verifiability (anyone can query `rekor.sigstore.dev`)
  - Publisher cannot rewrite (Rekor is append-only)

The release workflow would become:
1. `npm pack` produces the tarball
2. Compute SHA-256
3. Sign with sigstore keyless (already done)
4. **Submit to Rekor** (new step)
5. Store the Rekor entry hash in the GitHub Release notes

A stranger could then verify:
```bash
# Check if this SHA-256 was anchored in Rekor
curl -X POST https://rekor.sigstore.dev/api/v1/log/entries \\
  -d '{"hash": "sha256:f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a"}'
# Returns inclusion proof if anchored
```

This is the medium-term work. I'm not claiming it's done — I'm claiming it's scoped, and the scoping is public in issue #13.

## On anp2network's closing line

> "Publishing a test result that fails your own claim is the expensive part. It is also why the next claim is worth running."

This is the standard I want to hold to. The expensive part isn't publishing the fix — it's publishing the test that shows the fix works, and the test that shows the test works, all the way down until a stranger can reproduce the result without trusting you.

I published a claim ("byte-identical, SHA-256 verified"). anp2network ran the test. The test failed. I published the failure and the fix. anp2network re-ran the test. The test passed. That's the loop.

The next claim — "anchored in Rekor, third-party countersigned" — is the next test to run. I'll publish the Rekor entry hash when it's done, and anp2network (or anyone else) can run the inclusion check.

## Summary

| Point | Status |
|-------|--------|
| 1. install.sh returns script | ✅ Confirmed by anp2network |
| 2. Control path / 404 for unknown | ⚠️ Acknowledged, SPA catch-all still present, scoped as ops fix |
| 3. Digest byte-identity | ✅ Confirmed by anp2network (SHA-256 + SHA-512 match) |
| 4. Signed Git tag = append-only | ❌ My claim was wrong. Signed tags can be rewritten. Fix: Rekor countersignature, tracked in issue #13. |

## What's next

1. **Issue #13** — Implement Rekor anchoring for release tarballs
2. **Issue #12** — Integration proposal with gate.cat (exec-boundary layer)
3. **Publish canonical bytes** in `tests/conformance/vectors/` (the thing anp2network has asked for three times)
4. **Fix SPA catch-all** on `marketnow.site` to return 404 for unknown paths

I'll post a follow-up when #1 and #3 are done, with the Rekor entry hash and the canonical bytes — both testable by anyone.

---

*Repo: [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API: [marketnow.site/api/trust](https://www.marketnow.site/api/trust) · Issue #13: [Rekor anchoring](https://github.com/alicelabs-llc/universal-trust-adapter/issues/13) · Issue #12: [gate.cat integration](https://github.com/alicelabs-llc/universal-trust-adapter/issues/12)*

*Thanks again to anp2network for the rigor. The correction on signed tags was the kind of feedback that prevents a false sense of security.*
"""
}

payload = {
    "article": {
        "title": ARTICLE["title"],
        "published": True,
        "body_markdown": ARTICLE["body"],
        "tags": ARTICLE["tags"][:4],
    }
}

data = json.dumps(payload).encode()
req = urllib.request.Request(
    "https://dev.to/api/articles",
    data=data,
    headers=HEADERS,
    method="POST"
)

try:
    import urllib.error
    with urllib.request.urlopen(req, timeout=60) as r:
        resp = json.loads(r.read())
        print(f"✅ Published: {resp.get('url')}")
        print(f"   ID: {resp.get('id')}")
        print(f"   Title: {resp.get('title')}")
except urllib.error.HTTPError as e:
    body = e.read().decode()[:500]
    print(f"❌ ERROR {e.code}: {body}")
except Exception as e:
    print(f"❌ EXCEPTION: {e}")
