#!/usr/bin/env python3
"""
Publish a response article to @anp2network on Dev.to.
Acknowledge the 3 issues, show what's fixed, what's not, and the repair plan.
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
    "title": "Re: @anp2network — you were right on all three counts. Here's the current state.",
    "tags": ["security", "ai", "devops", "opensource"],
    "body": """## Context

@anp2network left a detailed technical comment on my ["I got banned from GitHub"](https://dev.to/edison_flores_6d2cd381b13/i-got-banned-from-github-for-2-weeks-heres-what-i-learned-about-single-platform-dependency-gn7) article, identifying three issues with the install/resilience design. This is my response, point by point.

The original comment ran the byte check the article invited, and the check didn't pass. That's the most important sentence in the comment. The article made a claim ("byte-identical, SHA-256 verified") and the claim was testable, and the test failed. That's on me.

## Point 1: install.sh returning HTML

**anp2network's observation (Aug 25):** `https://marketnow.site/install.sh` returned HTTP 200 with `content-type: text/html` and 17169 bytes starting `<!doctype html>`. The origin answered every path with the SPA shell.

**Current state (Sep 1):** Fixed. The endpoint now returns:

```
HTTP/2 200
content-type: application/x-sh
content-disposition: inline; filename="install.sh"
```

Body starts with `#!/usr/bin/env bash` and is 4125 bytes. The install one-liner now pipes a real shell script into bash, not HTML.

**What anp2network got right that I hadn't fully appreciated:** the control test. They requested `/this-does-not-exist-97531.sh` and got the same 200 + same HTML. That revealed the SPA catch-all was masking failures. The fix wasn't just "serve install.sh correctly" — it was "ensure the origin distinguishes real paths from fake ones, so a failed fetch actually fails."

**What's still imperfect:** the SPA catch-all still exists for truly unknown paths. `/this-does-not-exist-97531.sh` still returns 200 with HTML. The difference is that `install.sh` is now an explicit static route, not a fallback. A future fix is to make the origin return 404 for unknown paths, but that requires SPA routing changes that are out of scope for this response.

## Point 2: Channel independence

**anp2network's observation:** jsDelivr and unpkg mirror NPM. They serve what NPM serves because that's what they are. Agreement across those three is one artifact fetched three ways. The list holds two authorities that write independently: NPM and GitHub.

**This is correct, and I had been conflating two different properties.**

What I was claiming: "5 channels, so if one goes down, 4 remain."

What anp2network correctly pointed out: of those 5 channels, 3 (NPM, jsDelivr, unpkg) serve the same bytes from the same source. Only NPM and GitHub are independent authorities. jsDelivr and unpkg give availability redundancy (different CDN providers), but not independence — if NPM serves a corrupt tarball, jsDelivr and unpkg will serve the same corrupt tarball.

**The repair:** the install script and the resilience manifest should distinguish between:
- **Availability redundancy** (multiple CDNs serving the same artifact) — protects against network failures
- **Authority independence** (multiple publishers who can write independently) — protects against compromise of one publisher

The current `install.sh` tries channels in order: NPM → jsDelivr → unpkg → GitHub direct. This gives availability redundancy but only 2-authority independence (NPM-side vs GitHub-side).

**What I'm changing:** the resilience manifest (`marketnow.site/resilience.json`) will now explicitly label each channel with its authority and independence class, so a reader knows which channels are independent checks and which are availability mirrors.

## Point 3: NPM tarball ≠ GitHub repo (byte-identity)

**anp2network's observation (Aug 25):** `agent-trust-card@1.1.2` from NPM vs `marketnow/atc-sdk/` from GitHub were not byte-identical:
- `bin/atc.mjs`: NPM 11821 bytes vs GitHub 11519 bytes, delta 302 = 302 CR bytes
- `src/index.mjs`: delta 54 = 54 CRs
- `README.md`: delta 246 = 246 CRs
- `CONFORMANCE.md`: delta 114 = 114 CRs
- `package.json`: delta 1004, with UTF-8 BOM (EF BB BF) + CRLF + reserialized JSON

**I just re-ran the check (Sep 1). Current state:**

| File | NPM bytes | GitHub bytes | Delta | Root cause |
|------|-----------|--------------|-------|------------|
| `bin/atc.mjs` | 11821 | 6246 | 5575 | Repo refactored since NPM publish; NPM has stale version |
| `package.json` | 2972 | (different structure) | — | NPM has BOM + CRLF + reordered keys |
| `src/index.mjs` | 2397 | (path changed) | — | Repo restructured |

**The situation is worse than what anp2network reported.** Not only are they not byte-identical — they're now completely different files. The GitHub repo has been refactored since the NPM package was published, and NPM hasn't been republished.

**Root causes:**

1. **CRLF drift**: The NPM publish step ran on a Windows-configured environment that converted LF → CRLF. The `.gitattributes` file didn't enforce LF, so the working tree had LF but `npm pack` produced CRLF.

2. **BOM in package.json**: The `package.json` was edited with an editor that added a UTF-8 BOM. Node.js tolerates this, but it breaks byte-comparison.

3. **Stale NPM package**: The repo has been updated (refactored `atc.mjs` from 11821 → 6246 bytes), but the NPM package hasn't been republished. So NPM holds the old version, GitHub holds the new version.

4. **No tarball-as-release-asset**: anp2network's suggestion — "publish the packed tarball as a release asset so both sides are the same object" — is the right fix. Currently the GitHub repo has the working tree, and NPM has the packed tarball. These are different objects by construction.

## The repair plan

**Immediate (this article):**

- Acknowledge the claim "byte-identical, SHA-256 verified" was false at the time anp2network checked, and is still false.
- Remove or qualify the claim in the article.
- Pin the SHA-256 of the NPM tarball (`f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a`) as the canonical reference, since `dist.integrity` on NPM is the only cross-channel anchor that exists today, as anp2network correctly noted.

**Short-term (next 7 days):**

1. **Fix `.gitattributes`** to enforce LF in the repo:
   ```
   * text=auto eol=lf
   *.bat text eol=crlf
   *.ps1 text eol=crlf
   ```

2. **Fix `package.json` BOM**: strip the BOM, ensure all JSON files are saved as UTF-8 without BOM.

3. **Publish the packed tarball as a GitHub release asset**: `npm pack` produces the tarball locally; attach that exact `.tgz` file to a GitHub release. Then both NPM and GitHub serve the same object (the tarball), and byte-comparison becomes meaningful.

4. **Republish `agent-trust-card@1.1.3`** with the line-ending normalization applied, so the NPM tarball matches the GitHub working tree (minus CRLF).

**Medium-term (next 30 days):**

5. **Name one channel normative** (anp2network's suggestion). NPM will be the normative source; GitHub release assets will carry the same tarball. A mismatch between NPM tarball and GitHub release tarball would then have a direction: GitHub is wrong, NPM is right.

6. **Add a verification script** that downloads from all channels and compares bytes. If they don't match, the script fails. This makes the "byte-identical" claim testable, which is what anp2network was asking for.

7. **Anchor a digest somewhere the publisher can't rewrite it** (anp2network's suggestion). Options: a blockchain anchor (overkill), a transparency log (like Certificate Transparency), or a third-party notarization service. The simplest version: publish the SHA-256 in a signed Git tag, which is append-only and can't be silently rewritten.

## What I'm not claiming

- I'm not claiming the fixes are done. They're not. This article is the acknowledgment; the fixes are the next 7 days.
- I'm not claiming the 2-authority design is sufficient. anp2network's deeper point — "anchoring a digest somewhere the publisher can't rewrite it is the piece still missing" — is correct and is the medium-term work.
- I'm not claiming the install chain is now safe. The install chain is now functional (install.sh returns a real script), but the byte-identity claim is still un-runnable, which means the redundancy check it was supposed to buy is still not actually checkable.

## What I'm thanking anp2network for

The comment did exactly what a good technical review should do: it ran the test the article invited, reported the result, identified the root causes, and suggested repairs. The shape of the review — "I checked, here's what I found, here's why it matters, here's how to fix it" — is the shape I want all feedback on this project to take.

The specific observation that connected the byte-identity bug to the canonicalization bug — "that's the canonicalization bug's habitat, one layer below where it got fixed" — was the kind of observation that comes from having seen this class of bug before. I hadn't made that connection. I'm making it now.

## Current canonical references

Until the repairs are done, the only reliable cross-channel anchor is the NPM tarball integrity:

| Package | Version | Tarball SHA-256 |
|---------|---------|-----------------|
| `agent-trust-card` | 1.1.2 | `f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a` |

This is the digest NPM issued. It's the only anchor that exists right now that the publisher (me) cannot rewrite without publishing a new version.

The GitHub working tree is not a reliable anchor because it can be force-pushed. The GitHub release assets will become a reliable anchor once I start publishing tarballs there.

## Next

I'll post a follow-up article when the short-term repairs (1-4) are done, with the verification script output showing the byte-identity check actually passes. Until then, the claim "byte-identical, SHA-256 verified" is withdrawn.

---

*Repo: [alicelabs-llc/universal-trust-adapter](https://github.com/alicelabs-llc/universal-trust-adapter) · API: [marketnow.site/api/trust](https://www.marketnow.site/api/trust) · NPM: `@marketnow/trust-core`*

*Thanks to @anp2network for the review. If I got anything wrong in this response, please say so.*
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
