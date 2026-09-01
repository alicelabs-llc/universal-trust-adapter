#!/usr/bin/env python3
"""
Create a GitHub release with NPM tarballs as release assets.
This makes NPM and GitHub serve the exact same tarball object,
enabling real byte-identity verification.
"""
import json
import urllib.request
import urllib.error
import subprocess
import os
import time

GH_TOKEN = subprocess.check_output(
    "cd /home/z/my-project/uta-repo && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-release-creator"
}

REPO = "alicelabs-llc/universal-trust-adapter"
TAG = "v1.1.2-tarballs"

# Step 1: Download NPM tarballs
print("=== Step 1: Download NPM tarballs ===")
TARBALL_DIR = "/tmp/release-tarballs"
os.makedirs(TARBALL_DIR, exist_ok=True)
os.chdir(TARBALL_DIR)

PACKAGES = [
    "agent-trust-card@1.1.2",
    "@marketnow/trust-core@latest",
    "@marketnow/trust-adapters@latest",
    "@marketnow/trust-gateway@latest",
    "marketnow-mcp@latest",
    "marketnow-install-stack@latest",
]

tarballs = []
for pkg in PACKAGES:
    print(f"  npm pack {pkg}...")
    result = subprocess.run(["npm", "pack", pkg], capture_output=True, text=True, cwd=TARBALL_DIR)
    output = result.stdout.strip().split('\n')[-1] if result.stdout else ""
    if output and output.endswith('.tgz'):
        full_path = os.path.join(TARBALL_DIR, output)
        if os.path.exists(full_path):
            size = os.path.getsize(full_path)
            # Compute SHA-256
            sha = subprocess.check_output(["shasum", "-a", "256", full_path]).decode().split()[0]
            tarballs.append({"path": full_path, "name": output, "size": size, "sha256": sha})
            print(f"    ✅ {output} ({size} bytes, SHA={sha[:16]}...)")
    time.sleep(1)

print(f"\n  Total tarballs: {len(tarballs)}")

# Step 2: Create release
print("\n=== Step 2: Create GitHub release ===")
RELEASE_BODY = """## Cross-channel anchor

This release contains the exact NPM tarballs for the packages published at this version.

### Why this exists

@anp2network pointed out (correctly) that the NPM tarball and the GitHub working tree are not byte-identical — the NPM tarball has CRLF line endings and a BOM in package.json, while the GitHub repo has LF and no BOM. This makes the claim "byte-identical, SHA-256 verified" un-runnable.

The fix: publish the **exact same tarball** that NPM serves as a GitHub release asset. Then both NPM and GitHub serve the same object (the tarball), and byte-comparison becomes meaningful.

### SHA-256 digests

"""

for t in tarballs:
    RELEASE_BODY += f"- `{t['name']}`: `{t['sha256']}` ({t['size']} bytes)\n"

RELEASE_BODY += """
### How to verify

```bash
# Download from NPM
npm pack agent-trust-card@1.1.2

# Download from GitHub release
curl -L -o agent-trust-card.tgz https://github.com/alicelabs-llc/universal-trust-adapter/releases/download/v1.1.2-tarballs/agent-trust-card-1.1.2.tgz

# Compare
shasum -a 256 agent-trust-card-1.1.2.tgz  # NPM
shasum -a 256 agent-trust-card.tgz          # GitHub
# Should be identical
```

If the digests match, the two authorities (NPM and GitHub) are serving the same bytes.

### What this does NOT solve

- The GitHub **working tree** (source code) still differs from the tarball, because `npm pack` applies transformations (CRLF, BOM). The working tree is for development; the tarball is the artifact.
- This is a 2-authority design (NPM + GitHub). A 3rd independent authority is future work.

### Acknowledgment

Thanks to @anp2network for the review. See: https://dev.to/edison_flores_6d2cd381b13/re-anp2network-you-were-right-on-all-three-counts-heres-the-current-state-3hfa
"""

payload = json.dumps({
    "tag_name": TAG,
    "name": "v1.1.2 — NPM Tarballs (cross-channel anchor)",
    "body": RELEASE_BODY,
    "draft": False,
    "prerelease": False
}).encode()

req = urllib.request.Request(
    f"https://api.github.com/repos/{REPO}/releases",
    data=payload,
    headers=HEADERS,
    method="POST"
)

try:
    with urllib.request.urlopen(req, timeout=30) as r:
        resp = json.loads(r.read())
        release_id = resp.get("id")
        upload_url = resp.get("upload_url", "").replace("{?name,label}", "")
        html_url = resp.get("html_url")
        print(f"  ✅ Release created: {html_url}")
        print(f"  Release ID: {release_id}")
except urllib.error.HTTPError as e:
    body = e.read().decode()[:500]
    print(f"  ❌ ERROR {e.code}: {body}")
    # If release exists, get its info
    req2 = urllib.request.Request(
        f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}",
        headers=HEADERS
    )
    with urllib.request.urlopen(req2, timeout=30) as r:
        resp = json.loads(r.read())
        release_id = resp.get("id")
        upload_url = resp.get("upload_url", "").replace("{?name,label}", "")
        print(f"  (Existing release found, ID: {release_id})")

# Step 3: Upload tarballs as assets
print(f"\n=== Step 3: Upload {len(tarballs)} tarballs as release assets ===")

for t in tarballs:
    # Sanitize name (remove @ from scoped packages)
    safe_name = t["name"].replace("@", "")
    print(f"  Uploading {safe_name}...")
    
    with open(t["path"], "rb") as f:
        data = f.read()
    
    req = urllib.request.Request(
        f"{upload_url}?name={safe_name}",
        data=data,
        headers={**HEADERS, "Content-Type": "application/gzip"},
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.loads(r.read())
            print(f"    ✅ {resp.get('name')}: {resp.get('browser_download_url')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]
        print(f"    ❌ ERROR {e.code}: {body}")
    except Exception as e:
        print(f"    ❌ EXCEPTION: {e}")
    
    time.sleep(1)

# Step 4: Verify
print(f"\n=== Step 4: Verify release ===")
req = urllib.request.Request(
    f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}",
    headers=HEADERS
)
with urllib.request.urlopen(req, timeout=30) as r:
    resp = json.loads(r.read())
    print(f"  Release: {resp.get('name')}")
    print(f"  URL: {resp.get('html_url')}")
    print(f"  Assets ({len(resp.get('assets',[]))}):")
    for a in resp.get("assets", []):
        print(f"    - {a['name']} ({a['size']} bytes)")
        print(f"      {a['browser_download_url']}")

# Save release info
info = {
    "release_url": resp.get("html_url"),
    "tag": TAG,
    "tarballs": [{"name": t["name"], "sha256": t["sha256"], "size": t["size"]} for t in tarballs]
}
os.makedirs("/home/z/my-project/download/promotion", exist_ok=True)
with open("/home/z/my-project/download/promotion/release_v1.1.2_tarballs.json", "w") as f:
    json.dump(info, f, indent=2)

print(f"\n  Saved: /home/z/my-project/download/promotion/release_v1.1.2_tarballs.json")
