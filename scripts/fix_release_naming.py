import os
#!/usr/bin/env python3
"""Fix the misnamed GitHub release and Dev.to article.
The release should be UTA v1.0.0 (Universal Trust Adapter), not 'ATC/1.0'."""
import json
import urllib.request

GH_TOKEN = os.environ.get("GH_TOKEN", "")
API_KEY = 'WYK9tdVMev3K7xwtbWxvkwNu'

def gh_request(url, method='GET', data=None):
    headers = {
        'Authorization': f'token {GH_TOKEN}',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'MarketNow-Fixer/1.0'
    }
    req = urllib.request.Request(url, method=method,
        data=json.dumps(data).encode() if data else None, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

def devto_request(url, method='GET', data=None):
    headers = {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (MarketNow-Publisher/1.0)'
    }
    req = urllib.request.Request(url, method=method,
        data=json.dumps(data).encode() if data else None, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# Step 1: Find the misnamed release
print("=== Step 1: Find and delete the misnamed release ===")
releases = gh_request('https://api.github.com/repos/alicelabs-llc/universal-trust-adapter/releases')
print(f"Found {len(releases)} releases:")
for r in releases:
    print(f"  - id={r.get('id')} name='{r.get('name')}' tag='{r.get('tag_name')}'")
    if 'ATC' in r.get('name', '') or 'Agent Trust Card Protocol' in r.get('name', ''):
        release_id = r.get('id')
        release_tag = r.get('tag_name')
        print(f"\n  → Deleting misnamed release {release_id} ({r.get('name')})")
        try:
            # Delete release
            req = urllib.request.Request(
                f'https://api.github.com/repos/alicelabs-llc/universal-trust-adapter/releases/{release_id}',
                method='DELETE',
                headers={
                    'Authorization': f'token {GH_TOKEN}',
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'MarketNow-Fixer/1.0'
                }
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                print(f"  ✓ Release deleted (status {resp.status})")
        except urllib.error.HTTPError as e:
            print(f"  ✗ Delete failed: {e.code} {e.reason}")

print()
print("=== Step 2: Find and delete the misnamed tag v1.0.0 ===")
# Note: tag still exists after release deletion, need to delete via ref
try:
    req = urllib.request.Request(
        'https://api.github.com/repos/alicelabs-llc/universal-trust-adapter/git/refs/tags/v1.0.0',
        method='DELETE',
        headers={
            'Authorization': f'token {GH_TOKEN}',
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'MarketNow-Fixer/1.0'
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        print(f"  ✓ Tag v1.0.0 deleted (status {resp.status})")
except urllib.error.HTTPError as e:
    print(f"  ✗ Tag delete: {e.code} {e.reason}")

# Step 3: Update the Dev.to article with correct name
print()
print("=== Step 3: Fix the Dev.to article title and content ===")

# Article ID 4478970 (the misnamed status report)
ARTICLE_ID = 4478970

# Get current article
article = devto_request(f'https://dev.to/api/articles/{ARTICLE_ID}')
old_title = article.get('title', '')
print(f"  Old title: {old_title[:80]}")

# New article body with correct naming
NEW_BODY = """---
title: UTA v1.0.0 — full status report: 96 articles, 2,276 NPM downloads, here's what's next
published: true
description: Two-month retrospective on Universal Trust Adapter v1.0.0. Stats across NPM, Dev.to, GitHub, jsDelivr.
tags: security, uts, agents, retrospective
---

**Correction (Aug 25):** Earlier version of this article misnamed the project as "ATC/1.0 — Agent Trust Card Protocol." That was wrong. ATC is one of 8 adapter formats UTA supports — not the project name. This version corrects that throughout.

The project is **Universal Trust Adapter (UTA) v1.0.0**. ATC is one of 8 formats it translates between (the others: EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE). The canonical schema is **Universal Trust Schema (UTS) v2.0.0**.

Two months in. Here's the honest numbers, then what's next.

## The numbers (as of Aug 25, 2026)

### NPM packages

| Package | Version | Description | Monthly downloads |
|---|---|---|---|
| `marketnow-mcp` | 1.10.0 | MCP server (13 trust tools) | 958 |
| `agent-trust-card` | 1.1.1 | ATC adapter SDK (issue/verify/inspect) | 518 |
| `marketnow-install-stack` | 1.1.0 | Multi-source installer | 345 |
| `@marketnow/uts` | 2.0.0 | Universal Trust Schema (canonical) | 125 |
| `@marketnow/trust-core` | 1.0.0 | Trust Engine core | 122 |
| `@marketnow/trust-adapters` | 1.0.0 | 8 format adapters | 106 |
| `@marketnow/trust-gateway` | 1.0.0 | Gateway + post-exec filter | 102 |
| **TOTAL** | — | — | **2,276/mo** |

All packages mirrored automatically by **jsDelivr CDN** and **unpkg CDN**.

### Dev.to

- **96 articles** published since July 2
- **26 reactions** accumulated
- **44 comments** received from 15 different developers
- **5 batched response articles** published (responding to all 32 actionable comments)
- **258 minutes** total reading time

**Top commenters by engagement:**
- @anp2network (6 comments) — most technically rigorous, found the JCS bug
- @mads_hansen (6 comments) — conexor.io, runtime policy angle
- @wrencalloway (4 comments) — wcalloway.substack.com, tool-description-poisoning
- @topstar_ai (3 comments) — production LLM systems, asked about collaboration
- @neelagiri65 (2 comments) — pushed for honest per-layer catch counts

### GitHub

- **alicelabs-llc org:** 21 repos, 6 stars, 1 fork
- **Most starred:** `sam-gov-types` (3 stars), `samgov-sdk` (2 stars), `Scraper` (1 star)
- **Personal account:** flagged by abuse-detection (ticket #4658791 open 2 weeks — still unresolved, SMS verification completed)
- **UTA canonical repo:** https://github.com/alicelabs-llc/universal-trust-adapter (publicly accessible)

### marketnow.site (AliceLabs-owned)

- HTTP 200 active
- Serving tarballs directly: `/uta-packages/marketnow-uts-2.0.0.tgz` etc.
- Multi-source installer: `/install.sh` (tries NPM → jsDelivr → unpkg → marketnow.site → GitHub)
- Resilience manifest: `/resilience.json`

## What UTA actually is

**Universal Trust Adapter (UTA)** is the project. It's the USB-C of agent trust — translates between 8 trust credential formats via a canonical Universal Trust Schema (UTS).

The 8 formats UTA translates between:

1. **ATC** (Agent Trust Card — AliceLabs)
2. **EAT-AI** (IETF RFC 9421)
3. **ZTA** (Anthropic Zero-Trust Agent)
4. **A2A Agent Card** (Google/AAIF)
5. **MCP Server Card** (Anthropic)
6. **W3C Verifiable Credentials**
7. **OAuth/OIDC**
8. **SPIFFE SVID**

The 12-stage verification pipeline uses Ed25519 (RFC 8032) signatures over RFC 8785 JCS canonicalization, with domain separation across 7 distinct signature domains to prevent cross-context reuse.

## What worked

1. **Writing in public.** 96 articles in 8 weeks. The 44 comments pushed the spec harder than 6 months of private iteration would have. @anp2network's first comment (the JCS replacer bug) caught a real cryptographic flaw I'd shipped to production.

2. **Multi-channel distribution.** When GitHub flagged my account two weeks ago, the 5-channel setup meant the project kept working. NPM downloads continued at the same rate. No user-visible disruption.

3. **Responding to every technical comment.** Even when the comment was sharp (anp2network called the spec "a private result that weighs about as much as any other assertion nobody can re-derive"), engaging with the substance produced the highest-value feedback. The test vectors only exist because anp2network publicly shamed me into publishing the bytes.

4. **Publishing the test CA private key.** Sounds counterintuitive but it's the only way to make a crypto spec truly verifiable across languages. Anyone can re-derive the signatures in Python, Go, or Rust.

## What didn't work

1. **Relying on a single GitHub account.** When the personal account got flagged, 55 public repos instantly returned HTTP 404. Should have moved to the org earlier.

2. **NPM package metadata still points to the flagged account.** Without an NPM publish token in the build environment, I couldn't republish packages with updated `repository.url`. The tarballs are byte-identical and downloadable, but the "Repository" link on npmjs.com is broken.

3. **"8 layers of security" framing.** The honest version is "8 layers, 2 of which actually caught things." The article should have led with per-layer catch counts, not layer count.

4. **Naming confusion between ATC and UTA.** ATC is one of 8 adapters in UTA, but my early articles presented ATC as if it were the project. The repo name (`universal-trust-adapter`) was always right; the article framing was wrong. Fixed in this article.

5. **Not having a Hacker News / Reddit presence.** Dev.to reaches the Dev.to audience, but the broader security / AI / cryptography communities don't read Dev.to. Should have cross-posted from day 1.

## Where I'm publishing next

Based on the gap analysis, the project needs presence on platforms where the security / AI / MCP communities actually hang out:

- **Reddit:** r/MCP, r/LocalLLaMA, r/cybersecurity, r/webdev
- **Hacker News:** Show HN submission for UTA v1.0.0
- **Hashnode:** cross-posting articles
- **LinkedIn:** B2B audience for enterprise security
- **Twitter/X:** threads for developer discovery
- **Discord communities:** Anthropic, MCP, Cursor, Cline, Continue, Aider servers
- **MCP marketplaces:** Smithery.ai, Glama.ai, PulseMCP, mcp.so

If you're in any of those communities and want to vouch for the project, that's the highest-value thing anyone can do right now.

## What's next on the technical side

1. **Multi-sig for high-value agents** — `attestation.signature` becomes an array, verifier requires N-of-M. Spec'd but not implemented.

2. **Runtime tool-catalog pinning** — the fix for the tool-description-poisoning attack @wrencalloway flagged. Pin catalog at approval, block at runtime if catalog changes.

3. **Behavior-based detection layer** — post-exec filter that inspects actual tool results, not just pre-call signatures.

4. **More test vectors** — the 5 current vectors cover the obvious failure classes (expired, tampered, wrong-ca-key, minimal-valid, capability-samples). Need edge cases: nested objects deeper than 2 levels, unicode payloads, large card sizes, multi-sig.

5. **NPM republish with correct repository.url** — once I have an NPM publish token, republish all 7 packages with `repository.url` pointing to `alicelabs-llc` instead of the flagged personal account.

6. **Cross-language SDKs** — currently Node.js only. Python, Go, Rust SDKs to be published from the same source tree.

## The honest ask

The project is at the inflection point where it needs more reviewers, not more features. If you're a security researcher, a cryptography implementer, or an MCP server author:

- Run your independent verifier against the test vectors: https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors
- Post disagreements (or confirmations) — both are equally useful
- If you find a bug, I'll triage and fix the same day

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
NPM: `marketnow-mcp@1.10.0` (958/mo) and `agent-trust-card@1.1.1` (518/mo)
Install: `curl -fsSL https://marketnow.site/install.sh | bash`

— Edison Flores, AliceLabs LLC"""

# Update the article
result = devto_request(
    f'https://dev.to/api/articles/{ARTICLE_ID}',
    method='PUT',
    data={'article': {'body_markdown': NEW_BODY, 'title': 'UTA v1.0.0 — full status report: 96 articles, 2,276 NPM downloads, what\'s next'}}
)
print(f"  ✓ Article updated")
print(f"    New title: {result.get('title')}")
print(f"    URL: {result.get('url')}")
print(f"    Edited at: {result.get('edited_at')}")

# Step 4: Recreate the GitHub release with correct name
print()
print("=== Step 4: Recreate GitHub release as 'UTA v1.0.0' ===")

RELEASE_NOTES = """## Universal Trust Adapter (UTA) v1.0.0

**The USB-C of agent trust.** UTA translates between 8 trust credential formats used by AI agents via a canonical Universal Trust Schema (UTS).

### What shipped in v1.0.0

**8 trust credential formats translated:**

1. ATC (Agent Trust Card — AliceLabs)
2. EAT-AI (IETF RFC 9421)
3. ZTA (Anthropic Zero-Trust Agent)
4. A2A Agent Card (Google/AAIF)
5. MCP Server Card (Anthropic)
6. W3C Verifiable Credentials
7. OAuth/OIDC
8. SPIFFE SVID

**Canonical schema: Universal Trust Schema (UTS) v2.0.0**

**12-stage fail-closed verification pipeline:**

1. Identity verification
2. Attestation structure validation
3. Capabilities enum validation
4. Evidence verification
5. Risk score range check
6. Ed25519 signature verification (over RFC 8785 JCS canonical bytes)
7. Revocation list check
8. Expiration window check
9. Proof-of-Possession (PoP) challenge
10. TrustRegistry key binding
11. Action receipt signature
12. Supply-chain SBOM verification

**Crypto primitives:**
- Ed25519 signatures (RFC 8032) — fast, compact, quantum-resistant enough
- RFC 8785 JCS canonicalization — same bytes in every language (Node.js, Python, Go, Rust)
- SHA-256 over canonical bytes
- Domain separation across 7 distinct signature domains
- Proof-of-Possession with nonce challenge (anti-replay)

**Test vectors:** 5 frozen fixtures with:
- Canonical JCS bytes per vector (hex + base64 + utf8)
- SHA-256 of canonical bytes
- Ed25519 signature
- Expected verification outcome
- Test CA private key intentionally published for cross-language reproducibility

**Conformance suite:** 23/23 tests pass.

### Multi-channel distribution

5 independent download channels (all serve byte-identical tarballs):

1. **NPM Registry** (primary)
2. **jsDelivr CDN** (free mirror of NPM)
3. **unpkg CDN** (alternative mirror)
4. **marketnow.site** (AliceLabs-owned origin)
5. **GitHub org** (alicelabs-llc)

### Bug fixes from community feedback

- **JCS replacer bug** (reported by @anp2network on dev.to): `JSON.stringify(payload, Object.keys(payload).sort())` was a replacer allowlist, not a sorter. Nested keys were dropped from signature preimage. Fixed with proper RFC 8785 JCS implementation.
- **Forward slash escaping**: RFC 8785 §3.2.2.2 says forward slash MUST NOT be escaped. Fixed.
- **Canonicalization method mislabel**: Cards signed with old V8-sort form were reporting `canonicalization_method = RFC 8785 JCS`. Fixed.

### Stats at UTA v1.0.0 release

- NPM packages: 7
- NPM monthly downloads: 2,276
- Dev.to articles: 96
- Dev.to comments received: 44
- Dev.to comments responded: 32 (via 5 batched response articles)
- Test vectors: 5 frozen + manifest
- Conformance tests: 23/23 pass
- Format adapters: 8 (ATC, EAT-AI, ZTA, A2A, MCP Card, W3C VC, OAuth, SPIFFE)

### Install

```bash
# Install the ATC adapter SDK (one of 8 adapters)
npm install agent-trust-card

# Verify any ATC card
atc verify card.json

# Install the MCP server (958 downloads/mo)
npx -y marketnow-mcp

# Multi-source installer (tries all 5 channels)
curl -fsSL https://marketnow.site/install.sh | bash
```

### Repo

- **Canonical:** https://github.com/alicelabs-llc/universal-trust-adapter
- **Architecture:** https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/docs/ARCHITECTURE.md
- **Test vectors:** https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors
- **Resilience manifest:** https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/aep-marketplace/public/resilience.json

### What's next

- Multi-sig for high-value agents (N-of-M CA signatures)
- Runtime tool-catalog pinning (catch tool-description-poisoning)
- Behavior-based detection layer (post-exec filter)
- More test vectors covering edge cases
- Cross-language SDKs (Python, Go, Rust)

— Edison Flores, AliceLabs LLC"""

payload = {
    "tag_name": "v1.0.0",
    "target_commitish": "main",
    "name": "UTA v1.0.0 — Universal Trust Adapter (8 format adapters, 12-stage verification pipeline)",
    "body": RELEASE_NOTES,
    "draft": False,
    "prerelease": False
}

result = gh_request(
    'https://api.github.com/repos/alicelabs-llc/universal-trust-adapter/releases',
    method='POST',
    data=payload
)
print(f"  ✓ Release created: {result.get('name')}")
print(f"    URL: {result.get('html_url')}")
print(f"    Tag: {result.get('tag_name')}")
