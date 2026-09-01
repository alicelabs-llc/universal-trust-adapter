#!/usr/bin/env python3
"""
Cross-channel verification script.

Downloads each NPM package tarball from:
1. NPM registry
2. GitHub Release asset

Compares SHA-256. If all match, the cross-channel byte-identity claim is verified.

Usage:
    python3 tests/verify-cross-channel.py

Exit codes:
    0: All packages byte-identical across channels
    1: One or more packages mismatched
    2: Error fetching from a channel
"""
import json
import hashlib
import urllib.request
import urllib.error
import subprocess
import os
import sys
import tempfile

PACKAGES = [
    {
        "name": "agent-trust-card",
        "version": "1.1.2",
        "npm_tarball_name": "agent-trust-card-1.1.2.tgz",
        "github_asset_name": "agent-trust-card-1.1.2.tgz",
        "expected_sha256": "f1b44ed29eea0ca9eee65c1e0974c5d2b4b512378c6d21edb6344daf9184641a",
    },
    {
        "name": "marketnow-mcp",
        "version": "1.10.1",
        "npm_tarball_name": "marketnow-mcp-1.10.1.tgz",
        "github_asset_name": "marketnow-mcp-1.10.1.tgz",
        "expected_sha256": "0113cf8b6bedf6bea5825304c68532a7aacf33cecdfd96b2616e40861a038025",
    },
    {
        "name": "marketnow-install-stack",
        "version": "1.1.1",
        "npm_tarball_name": "marketnow-install-stack-1.1.1.tgz",
        "github_asset_name": "marketnow-install-stack-1.1.1.tgz",
        "expected_sha256": "7daa9d4fa5db6871d2448cd389bd4e26a84081ed50c17b632b2fa62b2de85f81",
    },
    {
        "name": "@marketnow/trust-core",
        "version": "1.0.1",
        "npm_tarball_name": "marketnow-trust-core-1.0.1.tgz",
        "github_asset_name": "marketnow-trust-core-1.0.1.tgz",
        "expected_sha256": "ad9c11e97c83df57346fdc35aa5f41391e9ee2f17cb12274d695db3f12ad7d10",
    },
    {
        "name": "@marketnow/trust-adapters",
        "version": "1.0.1",
        "npm_tarball_name": "marketnow-trust-adapters-1.0.1.tgz",
        "github_asset_name": "marketnow-trust-adapters-1.0.1.tgz",
        "expected_sha256": "783900cd807969ad56bbd37f54f444cb2e8f17d463866267248ab03994e1bde2",
    },
    {
        "name": "@marketnow/trust-gateway",
        "version": "1.0.1",
        "npm_tarball_name": "marketnow-trust-gateway-1.0.1.tgz",
        "github_asset_name": "marketnow-trust-gateway-1.0.1.tgz",
        "expected_sha256": "02319f29430da0f97d23277d9188fb96354e1e4262ea1887953e77b05043ca04",
    },
]

GITHUB_RELEASE_TAG = "v1.1.2-tarballs"
GITHUB_RELEASE_URL = f"https://github.com/alicelabs-llc/universal-trust-adapter/releases/download/{GITHUB_RELEASE_TAG}"


def sha256_file(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, filepath):
    try:
        urllib.request.urlretrieve(url, filepath)
        return True
    except Exception as e:
        print(f"    ERROR downloading: {e}")
        return False


def npm_pack(package_spec, output_dir):
    """Use npm pack to download a tarball."""
    result = subprocess.run(
        ["npm", "pack", package_spec, "--pack-destination", output_dir],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        print(f"    npm pack failed: {result.stderr[:200]}")
        return None
    # npm pack outputs the filename
    output = result.stdout.strip().split("\n")[-1]
    return os.path.basename(output) if output else None


def main():
    print("=" * 70)
    print("UTA Cross-Channel Verification")
    print("Downloads each tarball from NPM and GitHub Release, compares SHA-256")
    print("=" * 70)
    print()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        all_match = True
        
        for pkg in PACKAGES:
            print(f"--- {pkg['name']}@{pkg['version']} ---")
            print(f"  Expected SHA-256: {pkg['expected_sha256']}")
            
            # 1. Download from NPM
            print(f"  [1/2] Downloading from NPM...")
            npm_spec = f"{pkg['name']}@{pkg['version']}"
            npm_file = npm_pack(npm_spec, tmpdir)
            
            if not npm_file:
                print(f"  ❌ NPM download failed")
                all_match = False
                continue
            
            npm_path = os.path.join(tmpdir, npm_file)
            npm_sha = sha256_file(npm_path)
            print(f"  NPM SHA-256:    {npm_sha}")
            
            # 2. Download from GitHub Release
            print(f"  [2/2] Downloading from GitHub Release...")
            gh_url = f"{GITHUB_RELEASE_URL}/{pkg['github_asset_name']}"
            gh_path = os.path.join(tmpdir, f"gh-{pkg['github_asset_name']}")
            
            if not download(gh_url, gh_path):
                print(f"  ❌ GitHub download failed")
                all_match = False
                continue
            
            gh_sha = sha256_file(gh_path)
            print(f"  GitHub SHA-256: {gh_sha}")
            
            # 3. Compare
            print(f"  [3/3] Comparing...")
            npm_match = npm_sha == pkg["expected_sha256"]
            gh_match = gh_sha == pkg["expected_sha256"]
            cross_match = npm_sha == gh_sha
            
            if npm_match and gh_match and cross_match:
                print(f"  ✅ ALL MATCH — NPM and GitHub serve identical bytes")
            else:
                print(f"  ❌ MISMATCH:")
                if not npm_match:
                    print(f"     NPM ≠ expected")
                if not gh_match:
                    print(f"     GitHub ≠ expected")
                if not cross_match:
                    print(f"     NPM ≠ GitHub")
                all_match = False
            
            print()
        
        print("=" * 70)
        if all_match:
            print("✅ ALL PACKAGES VERIFIED — cross-channel byte-identity confirmed")
            print()
            print("Every NPM tarball is byte-identical to the corresponding GitHub")
            print("Release asset. A stranger can reproduce this verification by running:")
            print()
            print("  python3 tests/verify-cross-channel.py")
            print()
            sys.exit(0)
        else:
            print("❌ VERIFICATION FAILED — one or more packages mismatched")
            sys.exit(1)


if __name__ == "__main__":
    main()
