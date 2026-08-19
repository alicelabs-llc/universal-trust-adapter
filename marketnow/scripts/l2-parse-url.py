#!/usr/bin/env python3
# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# C11 FIX: Parse GitHub URL and output JSON (not bash eval).
# No more eval — the workflow reads this with jq/python.
#
# Usage: python3 scripts/l2-parse-url.py <REPO_URL>
# Output: JSON with OWNER_REPO, REF, SUBPATH, CLONE_URL

import os
import re
import sys
import json

url = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('REPO_URL', '')
if not url:
    print(json.dumps({"error": "REPO_URL required"}))
    sys.exit(1)

url = url.rstrip('/').removesuffix('.git')

m = re.match(r'^https?://github\.com/([^/]+/[^/]+)(?:/tree/([^/]+)(?:/(.+))?)?$', url)
if not m:
    print(json.dumps({"error": f"Invalid GitHub URL: {url}"}))
    sys.exit(1)

owner_repo = m.group(1)
ref = m.group(2) or ''
subpath = m.group(3) or ''

# H13 FIX: Reject path traversal in subpath
if '..' in subpath:
    print(json.dumps({"error": f"Path traversal detected in subpath: {subpath}"}))
    sys.exit(1)

clone_url = f'https://github.com/{owner_repo}.git'

print(json.dumps({
    "OWNER_REPO": owner_repo,
    "REF": ref,
    "SUBPATH": subpath,
    "CLONE_URL": clone_url
}))
