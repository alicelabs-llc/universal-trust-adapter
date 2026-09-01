#!/usr/bin/env python3
"""
Open issues in OUR repo for:
1. gate.cat integration proposal
2. Countersignature / third-party timestamp anchor (anp2network feedback)

Then verify which NEW external repos accept issues, and open targeted ones.
"""
import json
import urllib.request
import urllib.error
import subprocess
import time
import os

GH_TOKEN = subprocess.check_output(
    "cd /home/z/my-project && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-integrations"
}

OUR_REPO = "alicelabs-llc/universal-trust-adapter"

# ============================================================
# STEP 1: Open issues in OUR repo
# ============================================================

OUR_ISSUES = [
    {
        "title": "Integration proposal: gate.cat as exec-boundary layer (L1.9 quarantine → L3 monitor → gate.cat veto)",
        "body": """## Context

This issue tracks a proposed integration with [gate.cat](https://github.com/BGMLAI/gate.cat) — a deterministic fail-closed action veto for AI agents, built by @BGMLAI (Bogumił Jankiewicz).

The proposal originated from a [comment by @bogumi_jankiewicz on our L3 article](https://dev.to/edison_flores_6d2cd381b13/l3-i-built-continuous-runtime-monitoring-because-certification-is-point-in-time-attacks-are-2jd8):

> "Drift detection answers 'did the skill change?' — but blast radius is decided at a much narrower interface: the concrete action that reaches the shell/API. A drifted, compromised, or prompt-injected agent still has to emit `rm -rf`, `DROP TABLE`, or a payout call eventually. Gating that point is cheap (~0.6% intervention rate on real commands) and doesn't need to know why the agent went bad."

## What gate.cat does

- **Deterministic fail-closed veto** at the exec boundary
- Blocks irreversible actions (`rm -rf`, `DROP TABLE`, `terraform destroy`, `curl|sh`) before they execute
- Works as a PreToolUse hook in Claude Code, or as an in-process adapter for crewAI/LangGraph
- 1,085,159 real agent commands replayed, 0.6% intervention rate
- Publishes its own [bypass map in CI](https://github.com/BGMLAI/gate.cat/blob/master/OBJECTIONS.md)
- Apache 2.0, on [PyPI](https://pypi.org/project/gate.cat/) (v0.4.18, 175 downloads/month)

## Why it fits UTA

UTA and gate.cat operate at **different layers** and are complements, not substitutes:

```
Agent decides to call tool
    ↓
[UTA: credential verification]  ← Is this tool's credential valid? Who issued it?
    ↓ PERMIT
[L3: runtime drift monitoring]  ← Did the tool change since install?
    ↓ no drift
[gate.cat: action veto]         ← Is the specific action destructive?
    ↓ not blocked
execute
```

- **UTA** answers: "should we trust this tool at all?" (credential provenance)
- **L3** answers: "did the tool drift from what we approved?" (runtime monitoring)
- **gate.cat** answers: "is this specific action irreversible/destructive?" (exec boundary)

A tool can have valid credentials (UTA passes), no drift (L3 passes), and still be asked to execute `rm -rf /` (gate.cat blocks). The three layers catch different threat classes.

## What @bogumi_jankiewicz said about complementarity

> "Honest limit from our side of the fence: a deny-gate is certain only about what it **blocks** — an unmatched action is *unchecked*, not safe*. So it complements the drift/attestation work L3 does rather than replacing it."

This is the key insight. gate.cat is **certain about what it blocks** (deny-list, deterministic). UTA is **certain about what it verifies** (cryptographic, 12-stage pipeline). Neither is sufficient alone:

- UTA can't catch a prompt-injected agent with valid credentials
- gate.cat can't catch a tool whose credential was issued by a malicious CA
- Together: credential validity + action safety

## Proposed integration

### Phase 1: Documentation (this issue)

Add a `INTEGRATIONS.md` file to the repo documenting:
- The defense-in-depth stack: UTA → L3 → gate.cat
- How to install gate.cat alongside UTA
- A reference architecture diagram
- Which layer catches which threat class

### Phase 2: Code-level integration (future issue)

If there's interest from both sides:
- UTA's `verify()` result could feed into gate.cat's context (a tool with revoked credentials gets a stricter action policy)
- gate.cat's veto log could be attested with an ATC, creating an auditable chain: "this action was blocked, here's the signed receipt"
- Shared test vectors: a tool that fails UTA verification should also be blocked by gate.cat

### Phase 3: Joint conformance suite (future)

- A test suite that runs both UTA verification and gate.cat veto on the same agent commands
- Published results: "for these 1000 commands, UTA verified credentials X%, gate.cat blocked Y%, the overlap is Z%"

## What I'm asking

1. **@bogumi_jankiewicz** — if you see this, is the complementarity framing accurate from your side? Are there integration points I'm missing?
2. **Community** — does this defense-in-depth stack make sense? Are there other layers I should add?
3. **Maintainers (me)** — track this as a documentation task first, code integration later.

## References

- gate.cat repo: https://github.com/BGMLAI/gate.cat
- gate.cat site: https://gate.cat
- gate.cat on PyPI: https://pypi.org/project/gate.cat/
- gate.cat OBJECTIONS.md (bypass map): https://github.com/BGMLAI/gate.cat/blob/master/OBJECTIONS.md
- Our L3 article: https://dev.to/edison_flores_6d2cd381b13/l3-i-built-continuous-runtime-monitoring-because-certification-is-point-in-time-attacks-are-2jd8
- Our response to community comments: https://dev.to/edison_flores_6d2cd381b13/re-community-answers-to-12-unanswered-comments-across-9-articles-4p36

## Attribution

This issue was opened as a follow-up to the community response article. The integration idea came from @bogumi_jankiewicz's comment. If he'd like to co-author the INTEGRATIONS.md doc, that would be ideal.
"""
    },
    {
        "title": "Anchor digests with third-party countersignature + timestamp (response to @anp2network)",
        "body": """## Context

This issue tracks the medium-term fix for the digest anchoring gap identified by @anp2network in their [latest comment](https://dev.to/edison_flores_6d2cd381b13/re-anp2network-you-were-right-on-all-three-counts-heres-the-current-state-3hfa#comment):

> "A signed Git tag is not append-only. Tags can be deleted and re-pushed. The signature proves who created the object, not that the pointer never moved, so it authenticates the publisher while leaving the publisher free to rewrite. The threat you named in point 7 was exactly the publisher rewriting their own anchor, so a signed tag does not close the hole it is listed under."

## The problem

In my response article, I listed "publish the SHA-256 in a signed Git tag" as a medium-term fix for anchoring digests somewhere the publisher can't rewrite them.

@anp2network correctly pointed out that **signed Git tags are not immutable**:
- Tags can be deleted and re-pushed
- The signature authenticates the creator, not the pointer's history
- The publisher can rewrite the tag and the new tag will still verify

So a signed Git tag does NOT solve "anchor a digest somewhere the publisher can't rewrite it."

## What actually solves it

@anp2network's correction:

> "What gets you there is a countersignature from a party with no stake in the rewrite, carrying a timestamp, published somewhere a third party can check inclusion afterwards. Storage was never the property being bought. What you want is a stranger re-deriving the same answer months later without having to ask you."

The key properties:
1. **Countersignature from a third party** — not the publisher
2. **Timestamp** — proves the digest existed at time T
3. **Inclusion checkable by anyone** — a stranger can verify without asking the publisher
4. **Publisher cannot rewrite** — the third party holds the record

## Options to evaluate

### Option A: Sigstore (Rekor)

- [Rekor](https://github.com/sigstore/rekor) is a transparency log for signed artifacts
- Append-only, Merkle tree, publicly auditable
- Already used in our supply chain (sigstore keyless signing)
- Free, hosted by the Sigstore project
- **Fit:** High. We already use sigstore. Adding Rekor entries for digest anchoring is a natural extension.

### Option B: Chainpoint / blockchain anchor

- Anchor the SHA-256 in a blockchain (Bitcoin, Ethereum)
- Proves existence at a block height
- Cost: small fee per anchor
- **Fit:** Medium. Overkill for this use case, but provides the strongest immutability guarantee.

### Option C: Certificate Transparency-style log

- A custom append-only log, like CT for certificates
- Requires running a log server
- **Fit:** Low. Too much infrastructure for the value.

### Option D: Time Stamp Authority (TSA)

- RFC 3161 timestamp from a TSA (e.g., DigiCert, Sectigo)
- Proves the digest existed at a time
- Doesn't prevent rewriting, but proves the original existed
- **Fit:** Medium. Useful but doesn't fully solve "publisher can't rewrite."

## Proposed approach

**Phase 1:** Use Sigstore/Rekor (Option A). We already use sigstore for signing. Adding Rekor entries for each release's tarball SHA-256 gives us:
- Third-party countersignature (Sigstore's Fulcio CA)
- Timestamped inclusion in Rekor's append-only log
- Public verifiability (anyone can query rekor.sigstore.dev)
- Publisher cannot rewrite (Rekor is append-only)

**Phase 2:** Document the verification flow:
```bash
# Verify a tarball was anchored in Rekor
curl -X POST https://rekor.sigstore.dev/api/v1/log/entries \\
  -d '{"hash": "sha256:f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a"}'
# Returns inclusion proof if anchored
```

**Phase 3:** Add Rekor anchoring to the release workflow:
1. `npm pack` produces the tarball
2. Compute SHA-256
3. Sign with sigstore keyless (already done)
4. Submit to Rekor (new step)
5. Store the Rekor entry hash in the GitHub Release notes

## What this does NOT solve

- **Unpublish windows on NPM:** NPM allows unpublish within 72 hours. After that, the tarball is immutable. But Rekor anchoring proves the tarball existed, even if NPM later removes it.
- **Registry compromise:** if NPM is compromised and serves a different tarball, the Rekor entry won't match. But the Rekor entry itself is on a separate infrastructure.

## Acknowledgment

Thanks to @anp2network for the correction. The signed Git tag idea was wrong — it doesn't solve the problem I claimed it solved. This issue tracks the actual fix.

## References

- anp2network's comment: https://dev.to/edison_flores_6d2cd381b13/re-anp2network-you-were-right-on-all-three-counts-heres-the-current-state-3hfa
- Sigstore Rekor: https://github.com/sigstore/rekor
- RFC 3161 (Time-Stamp Protocol): https://datatracker.ietf.org/doc/html/rfc3161
- Our current sigstore setup: see `.github/workflows/`
"""
    },
]


def open_issue(repo, title, body):
    url = f"https://api.github.com/repos/{repo}/issues"
    payload = json.dumps({"title": title, "body": body, "labels": ["integration", "documentation"]}).encode()
    req = urllib.request.Request(url, data=payload, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
            return data.get("html_url"), data.get("number")
    except urllib.error.HTTPError as e:
        # Labels might not exist, retry without
        try:
            payload2 = json.dumps({"title": title, "body": body}).encode()
            req2 = urllib.request.Request(url, data=payload2, headers=HEADERS, method="POST")
            with urllib.request.urlopen(req2, timeout=30) as r:
                data = json.loads(r.read())
                return data.get("html_url"), data.get("number")
        except urllib.error.HTTPError as e2:
            return f"ERROR {e2.code}: {e2.read().decode()[:300]}", None
    except Exception as e:
        return f"EXCEPTION: {e}", None


print("=== STEP 1: Open issues in OUR repo ===\n")
our_results = []
for issue in OUR_ISSUES:
    print(f"Opening: {issue['title'][:70]}...")
    url, num = open_issue(OUR_REPO, issue["title"], issue["body"])
    print(f"  → {url}")
    our_results.append({"title": issue["title"], "url": url, "number": num})
    time.sleep(2)

print("\n=== OUR REPO ISSUES SUMMARY ===")
for r in our_results:
    status = "✅" if r["url"].startswith("https://") else "❌"
    print(f"  {status} #{r['number']} {r['title'][:70]}")
    print(f"     {r['url']}")

# Save
os.makedirs("/home/z/my-project/download/promotion", exist_ok=True)
with open("/home/z/my-project/download/promotion/our_repo_issues.json", "w") as f:
    json.dump(our_results, f, indent=2)
