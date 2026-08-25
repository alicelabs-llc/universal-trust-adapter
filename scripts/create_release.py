import os
#!/usr/bin/env python3
"""Create GitHub release v1.0.0 with proper JSON escaping."""
import json
import urllib.request

GH_TOKEN = os.environ.get("GH_TOKEN", "")

RELEASE_NOTES = """## ATC/1.0 — Agent Trust Card Protocol (v1.0.0)

The USB-C of agent trust. **ATC** (Agent Trust Card) is a signed, verifiable, revocable credential format for AI agents — like X.509 certificates, but for agents instead of websites.

### What shipped in v1.0.0

**Spec:** ATC/1.0 with 8 verification controls:
- ATC-001 Identity (agent_id, agent_name, agent_owner, owner_contact)
- ATC-002 Attestation (subject_public_key, signature, signed_payload_hash)
- ATC-003 Capabilities (filesystem, network, shell, credentials, process — all enum-validated)
- ATC-004 Evidence (audit_pipeline, static/dynamic/runtime checks, findings)
- ATC-005 Risk (trust_score 0-10, risk_level, decision_authority=consumer)
- ATC-006 Signature (Ed25519 over RFC 8785 JCS, SHA-256)
- ATC-007 Revocation (revocation_check_url, method, required)
- ATC-008 Expiration (issued_at, expires_at, max_ttl_days)

**Reference implementation:** ~200 lines Node.js, only `node:crypto`, no external crypto deps.

**Test vectors:** 5 frozen fixtures with:
- Canonical JCS bytes per vector (hex + base64 + utf8)
- SHA-256 of canonical bytes
- Ed25519 signature
- Expected verification outcome
- Test CA private key intentionally published for cross-language reproducibility

**Conformance suite:** 23/23 tests pass.

### Multi-channel distribution

5 independent download channels (all serve byte-identical tarballs):
1. NPM Registry (primary)
2. jsDelivr CDN (free mirror of NPM)
3. unpkg CDN (alternative mirror)
4. marketnow.site (AliceLabs-owned origin)
5. GitHub org (alicelabs-llc)

### Bug fixes from community feedback

- **JCS bug** (reported by @anp2network on dev.to): `JSON.stringify(payload, Object.keys(payload).sort())` was a replacer allowlist, not a sorter. Nested keys were dropped from signature preimage. Fixed with proper RFC 8785 JCS implementation.
- **Forward slash escaping**: RFC 8785 §3.2.2.2 says forward slash MUST NOT be escaped. Fixed.
- **Canonicalization method mislabel**: Cards signed with old V8-sort form were reporting `canonicalization_method = RFC 8785 JCS`. Fixed.

### Stats at v1.0.0 release

- NPM packages: 7
- NPM monthly downloads: 2,276
- Dev.to articles: 95
- Dev.to comments received: 44
- Dev.to comments responded: 32 (via 5 batched response articles)
- Test vectors: 5 frozen + manifest
- Conformance tests: 23/23 pass

### Install

```bash
# Install the ATC SDK
npm install agent-trust-card

# Verify any ATC card
atc verify card.json

# Install the MCP server (940 downloads/mo)
npx -y marketnow-mcp

# Multi-source installer (tries all 5 channels)
curl -fsSL https://marketnow.site/install.sh | bash
```

### Repo

- **Canonical:** https://github.com/alicelabs-llc/universal-trust-adapter
- **Spec:** https://github.com/alicelabs-llc/universal-trust-adapter/blob/main/marketnow/docs/atc-spec/SPEC.md
- **Test vectors:** https://github.com/alicelabs-llc/universal-trust-adapter/tree/main/marketnow/docs/atc-spec/test-vectors
- **Resilience manifest:** https://raw.githubusercontent.com/alicelabs-llc/universal-trust-adapter/main/marketnow/aep-marketplace/public/resilience.json

### What's next

- Multi-sig for high-value agents (N-of-M CA signatures)
- Runtime tool-catalog pinning (catch tool-description-poisoning)
- Behavior-based detection layer (post-exec filter)
- More test vectors covering edge cases

— Edison Flores, AliceLabs LLC"""

payload = {
    "tag_name": "v1.0.0",
    "target_commitish": "main",
    "name": "ATC/1.0 — Agent Trust Card Protocol (v1.0.0)",
    "body": RELEASE_NOTES,
    "draft": False,
    "prerelease": False
}

req = urllib.request.Request(
    "https://api.github.com/repos/alicelabs-llc/universal-trust-adapter/releases",
    method="POST",
    data=json.dumps(payload).encode('utf-8'),
    headers={
        "Authorization": f"token {GH_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "MarketNow-Release-Publisher/1.0"
    }
)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        print(f"✓ Release created: {result.get('name')}")
        print(f"  URL: {result.get('html_url')}")
        print(f"  Tag: {result.get('tag_name')}")
        print(f"  Published: {result.get('published_at')}")
except urllib.error.HTTPError as e:
    err_body = e.read().decode('utf-8')
    print(f"HTTP {e.code}: {err_body[:500]}")
except Exception as e:
    print(f"Error: {e}")
