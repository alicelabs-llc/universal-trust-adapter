#!/usr/bin/env bash
# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# This file is part of the Sentinel Security Audit Engine.
# DO NOT COPY, REDISTRIBUTE, OR BUILD COMPETING PRODUCTS.
# See SENTINEL-LICENSE for full terms.
#
# "Sentinel" is a trademark of AliceLabs LLC.
# Patent pending on the 3-layer audit pipeline (L1.5 → L1.6 → L2).

# MarketNow — L2 Docker Build Helper
# ====================================
# This script is called by .github/workflows/sentinel-l2-sandbox.yml
# to build the Docker image for the MCP server being audited.
#
# It's a separate file (not inline in the workflow) because:
#   1. Bash heredocs with PYEOF terminators don't work well inside YAML
#      run: | blocks (the terminator indent doesn't match).
#   2. python3 -c "..." with newlines confuses the YAML parser.
#   3. Keeping the logic here makes the workflow file much cleaner.
#
# Usage: bash scripts/l2-build-docker.sh <BUILD_DIR> <REPO_ROOT>
#
# Output:
#   - Builds a Docker image tagged 'mcp-audit-target'
#   - Exits 0 on success, 1 on failure
#   - Prints diagnostic info to stdout

set -e

BUILD_DIR="${1:?BUILD_DIR required}"
REPO_ROOT="${2:?REPO_ROOT required}"

echo "Build directory: $BUILD_DIR"
echo "Repo root:       $REPO_ROOT"
cd "$BUILD_DIR" || { echo "::error::Cannot cd to $BUILD_DIR"; exit 1; }

# ─── If the repo ships a Dockerfile, use it ───────────────────────────────
# Monorepo Dockerfiles are inconsistent about build context:
#   - Some use COPY paths relative to REPO_ROOT (e.g. "COPY src/everything /app")
#   - Others assume context IS the subpath (e.g. "COPY uv.lock /uv.lock")
#
# Build-time network policy (L2.5):
#   Build needs network to fetch npm/pip deps from public registries.
#   --network none is NOT applied to `docker build` because:
#     1. GitHub Actions runner has no sensitive data to exfiltrate at build time
#     2. Runtime isolation (docker run --network none) is what actually matters
#     3. Blocking build-time network breaks 90%+ of real Dockerfiles
#   The runtime sandbox (--network none --read-only --cap-drop ALL) is unchanged.
#
# We detect repo-root-relative COPY/ADD instructions to choose the right context.
if [ -f "Dockerfile" ] || [ -f "Dockerfile.dev" ]; then
  DOCKERFILE_PATH="Dockerfile"
  [ -f "Dockerfile" ] || DOCKERFILE_PATH="Dockerfile.dev"
  echo "✓ Found $DOCKERFILE_PATH in $BUILD_DIR"

  # Detect if the Dockerfile uses repo-root-relative paths (e.g. COPY src/foo /app)
  # If so, we MUST use REPO_ROOT as context. Otherwise SUBPATH is fine.
  USE_REPO_ROOT=false
  if grep -qE '^(COPY|ADD)\s+(src|packages|apps|libs)/' "$BUILD_DIR/$DOCKERFILE_PATH" 2>/dev/null; then
    USE_REPO_ROOT=true
    echo "  Dockerfile uses repo-root-relative paths → context=REPO_ROOT"
  else
    echo "  Dockerfile uses subpath-relative paths → try context=SUBPATH first"
  fi

  if [ "$USE_REPO_ROOT" = "false" ]; then
    echo "  Attempt 1: build with context=SUBPATH ($BUILD_DIR)"
    if DOCKER_BUILDKIT=1 docker build --no-cache -t mcp-audit-target -f "$BUILD_DIR/$DOCKERFILE_PATH" "$BUILD_DIR" 2>&1 | tail -50; then
      if docker image inspect mcp-audit-target >/dev/null 2>&1; then
        echo "✓ Image built with subpath context"
        exit 0
      fi
    fi
    echo "  Attempt 1 failed — image not found, trying with context=REPO_ROOT"
  fi

  echo "  Attempt 2: build with context=REPO_ROOT ($REPO_ROOT)"
  DOCKER_BUILDKIT=1 docker build --no-cache -t mcp-audit-target -f "$BUILD_DIR/$DOCKERFILE_PATH" "$REPO_ROOT" 2>&1 | tail -50
  if ! docker image inspect mcp-audit-target >/dev/null 2>&1; then
    echo "::error::Both build attempts failed — image mcp-audit-target not found"
    echo "::error::This skill's Dockerfile is incompatible with the sandbox."
    exit 1
  fi
  echo "✓ Image built with repo-root context"
  exit 0
fi

# ─── No Dockerfile — generate a smart one based on project type ───────────
IS_NODE=0
IS_PYTHON=0
[ -f "package.json" ] && IS_NODE=1
{ [ -f "pyproject.toml" ] || [ -f "requirements.txt" ] || [ -f "setup.py" ]; } && IS_PYTHON=1

echo "  Detected: IS_NODE=$IS_NODE  IS_PYTHON=$IS_PYTHON"

if [ "$IS_NODE" = "1" ]; then
  echo "=== Generating Node smart Dockerfile ==="

  # Detect entrypoint using Python (reads package.json)
  ENTRYPOINT=$(python3 -c "
import json, os
try:
    with open('package.json') as f:
        pkg = json.load(f)
except FileNotFoundError:
    print('node index.js'); exit(0)
scripts = pkg.get('scripts', {}) or {}
if 'start' in scripts:
    print('sh -c ' + chr(34) + scripts['start'] + chr(34)); exit(0)
bin = pkg.get('bin', {})
if isinstance(bin, dict) and bin:
    print('node ' + list(bin.values())[0]); exit(0)
if isinstance(bin, str):
    print('node ' + bin); exit(0)
main = pkg.get('main')
if main:
    print('node ' + main); exit(0)
if os.path.exists('dist/index.js'):
    print('node dist/index.js')
else:
    print('node index.js')
")
  echo "  Detected entrypoint: $ENTRYPOINT"

  HAS_TS=$(python3 -c "
import json
try:
    with open('package.json') as f:
        d = json.load(f)
    deps = {**(d.get('dependencies') or {}), **(d.get('devDependencies') or {})}
    print('yes' if 'typescript' in deps else 'no')
except Exception:
    print('no')
")

  cat > Dockerfile.audit << EOD
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund 2>&1 || true
EOD

  if [ "$HAS_TS" = "yes" ]; then
    echo "  Detected TypeScript — adding build step"
    cat >> Dockerfile.audit << 'EOD'
COPY tsconfig*.json ./
RUN npm run build 2>&1 || npx tsc 2>&1 || true
EOD
  fi

  cat >> Dockerfile.audit << 'EOD'
COPY . .
EOD

  if echo "$ENTRYPOINT" | grep -q '^node '; then
    # Convert "node dist/index.js" → CMD ["node", "dist/index.js"]
    # Bug fix: sed was replacing ALL spaces including after CMD, producing
    # invalid Dockerfile syntax: CMD", "node", "dist/index.js"]"
    ENTRIES=$(echo "$ENTRYPOINT" | sed 's/ /", "/g')
    echo "CMD [\"$ENTRIES\"]" >> Dockerfile.audit
  else
    echo "CMD [\"sh\", \"-c\", \"$ENTRYPOINT\"]" >> Dockerfile.audit
  fi

elif [ "$IS_PYTHON" = "1" ]; then
  echo "=== Generating Python smart Dockerfile ==="

  PY_ENTRYPOINT=$(python3 -c "
import os, re
try:
    with open('pyproject.toml') as f:
        content = f.read()
    m = re.search(r'\[project\.scripts\]\s*\n([^\[]+)', content)
    if m:
        section = m.group(1)
        line_m = re.search(r'^\s*\w+\s*=\s*[\'\"]([^\'\"]+)[\'\"]', section, re.MULTILINE)
        if line_m:
            target = line_m.group(1)
            if ':' in target:
                mod, func = target.split(':', 1)
                print('sh -c ' + chr(34) + 'python -c ' + chr(39) + 'import ' + mod + '; ' + mod + '.' + func + '()' + chr(39) + chr(34))
                exit(0)
            else:
                print('sh -c ' + chr(34) + 'python -c ' + chr(39) + 'import ' + target + '; ' + target + '()' + chr(39) + chr(34))
                exit(0)
except FileNotFoundError:
    pass
for candidate in ['main.py', 'app.py', 'server.py', 'src/main.py', 'src/server.py']:
    if os.path.exists(candidate):
        print('python ' + candidate)
        exit(0)
print('python main.py')
")
  echo "  Detected entrypoint: $PY_ENTRYPOINT"

  cat > Dockerfile.audit << 'EOD'
FROM python:3.12-slim
WORKDIR /app
EOD

  if [ -f "pyproject.toml" ]; then
    cat >> Dockerfile.audit << 'EOD'
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e . 2>&1 || pip install --no-cache-dir . 2>&1 || true
EOD
  elif [ -f "requirements.txt" ]; then
    cat >> Dockerfile.audit << 'EOD'
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt 2>&1 || true
EOD
  fi

  cat >> Dockerfile.audit << 'EOD'
COPY . .
EOD
  echo "CMD [\"sh\", \"-c\", \"$PY_ENTRYPOINT\"]" >> Dockerfile.audit

else
  echo "::warning::No package.json, pyproject.toml, requirements.txt, or setup.py found in $BUILD_DIR"
  echo "  Using stub Dockerfile (no entrypoint — sandbox will detect no runtime behavior)"
  cat > Dockerfile.audit << 'EOD'
FROM ubuntu:22.04
COPY . /app
WORKDIR /app
CMD ["sleep", "60"]
EOD
fi

echo "=== Generated Dockerfile.audit ==="
cat Dockerfile.audit
echo "==================================="

DOCKER_BUILDKIT=1 docker build --no-cache -t mcp-audit-target -f Dockerfile.audit "$BUILD_DIR" 2>&1 | tail -30
if ! docker image inspect mcp-audit-target >/dev/null 2>&1; then
  echo "::error::docker build reported success but image mcp-audit-target not found"
  exit 1
fi
echo "✓ Image mcp-audit-target built successfully"
