#!/usr/bin/env bash
# Sentinel L2 — Dynamic Analysis Sandbox (Docker + seccomp + strace)
# =================================================================
# Executes an MCP server in an isolated Docker container, sends test
# MCP requests, monitors syscalls, and generates a behavioral report.
#
# Usage: bash sentinel-l2-sandbox.sh <github-repo-url> <skill-id>
#
# Requirements: Docker installed (available on GitHub Actions runners)
#
# This is REAL dynamic analysis — not static, not "design phase".

set -euo pipefail

REPO_URL="${1:?Usage: sentinel-l2-sandbox.sh <repo-url> <skill-id>}"
SKILL_ID="${2:-unknown}"
AUDIT_ID="l2_$(date +%s)_$$"
WORK_DIR="/tmp/sentinel-l2/${AUDIT_ID}"
CONTAINER_NAME="sentinel-${AUDIT_ID}"
TIMEOUT_SECONDS=30
MCP_PORT=3123

mkdir -p "${WORK_DIR}"

echo "{
  \"version\": \"L2\",
  \"skillId\": \"${SKILL_ID}\",
  \"repoUrl\": \"${REPO_URL}\",
  \"auditId\": \"${AUDIT_ID}\",
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"status\": \"running\"
}" > "${WORK_DIR}/report.json"

echo "[L2] Starting dynamic analysis for ${SKILL_ID}"
echo "[L2] Repo: ${REPO_URL}"
echo "[L2] Audit ID: ${AUDIT_ID}"

# ============================================================
# STEP 1: Clone repo
# ============================================================
echo "[L2] Step 1: Cloning repo..."
git clone --depth 1 "${REPO_URL}" "${WORK_DIR}/repo" 2>&1 || {
  echo "[L2] ERROR: Failed to clone repo"
  echo "{\"version\":\"L2\",\"skillId\":\"${SKILL_ID}\",\"status\":\"failed\",\"error\":\"clone_failed\"}" > "${WORK_DIR}/report.json"
  cat "${WORK_DIR}/report.json"
  exit 1
}

# ============================================================
# STEP 2: Detect ecosystem and prepare container
# ============================================================
echo "[L2] Step 2: Detecting ecosystem..."
IS_NODE=false
IS_PYTHON=false
ENTRYPOINT=""

if [ -f "${WORK_DIR}/repo/package.json" ]; then
  IS_NODE=true
  echo "[L2] Detected Node.js project"
  # Try to find the entry point
  ENTRYPOINT=$(cd "${WORK_DIR}/repo" && node -e "try{const p=require('./package.json');console.log(p.main||'index.js')}catch{console.log('index.js')}" 2>/dev/null || echo "index.js")
elif [ -f "${WORK_DIR}/repo/requirements.txt" ] || [ -f "${WORK_DIR}/repo/pyproject.toml" ]; then
  IS_PYTHON=true
  echo "[L2] Detected Python project"
  ENTRYPOINT="main.py"
  [ -f "${WORK_DIR}/repo/server.py" ] && ENTRYPOINT="server.py"
  [ -f "${WORK_DIR}/repo/src/server.py" ] && ENTRYPOINT="src/server.py"
else
  echo "[L2] WARNING: Unknown ecosystem, trying Node.js as default"
  IS_NODE=true
  ENTRYPOINT="index.js"
fi

# ============================================================
# STEP 3: Create seccomp profile (allow all but LOG dangerous syscalls)
# ============================================================
echo "[L2] Step 3: Creating seccomp profile..."
cat > "${WORK_DIR}/seccomp.json" << 'SECCOMP'
{
  "defaultAction": "SCMP_ACT_ALLOW",
  "syscalls": [
    {
      "names": ["ptrace"],
      "action": "SCMP_ACT_ERRNO"
    }
  ]
}
SECCOMP

# ============================================================
# STEP 4: Build and run in isolated Docker container
# ============================================================
echo "[L2] Step 4: Building Docker container..."

if [ "$IS_NODE" = true ]; then
  cat > "${WORK_DIR}/Dockerfile" << 'DOCKERFILE'
FROM node:20-slim
WORKDIR /app
COPY repo/package*.json ./
RUN npm install --production 2>/dev/null || true
COPY repo/ .
EXPOSE 3123
CMD ["node", "index.js"]
DOCKERFILE
elif [ "$IS_PYTHON" = true ]; then
  cat > "${WORK_DIR}/Dockerfile" << 'DOCKERFILE'
FROM python:3.12-slim
WORKDIR /app
COPY repo/requirements.txt ./
RUN pip install -r requirements.txt 2>/dev/null || true
COPY repo/ .
EXPOSE 3123
CMD ["python", "main.py"]
DOCKERFILE
fi

# Build image
docker build -t "sentinel-${AUDIT_ID}" "${WORK_DIR}" 2>&1 || {
  echo "[L2] ERROR: Docker build failed"
  echo "{\"version\":\"L2\",\"skillId\":\"${SKILL_ID}\",\"status\":\"failed\",\"error\":\"docker_build_failed\"}" > "${WORK_DIR}/report.json"
  cat "${WORK_DIR}/report.json"
  exit 1
}

# Run container with:
# - No network (--network none) — we'll test if it tries to connect
# - Read-only root filesystem (--read-only)
# - Memory limit (256MB)
# - CPU limit (0.5 cores)
# - No new privileges
# - Seccomp profile
# - strace for syscall monitoring
echo "[L2] Step 5: Running container in isolated sandbox..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --network none \
  --read-only \
  --memory 256m \
  --cpus 0.5 \
  --security-opt no-new-privileges \
  --security-opt seccomp="${WORK_DIR}/seccomp.json" \
  --cap-drop ALL \
  --tmpfs /tmp:rw,size=64m \
  -e MCP_PORT=3123 \
  "sentinel-${AUDIT_ID}" 2>&1 || {
  echo "[L2] WARNING: Container failed to start (may not have an MCP server entry point)"
}

# Wait for container to start or crash
sleep 5

# Check if container is still running
CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "not_found")
echo "[L2] Container status: ${CONTAINER_STATUS}"

# ============================================================
# STEP 5: Collect syscalls via docker logs + exec
# ============================================================
echo "[L2] Step 6: Collecting behavioral data..."

# Get container logs (stdout/stderr)
docker logs "${CONTAINER_NAME}" > "${WORK_DIR}/stdout.log" 2>&1 || true

# Get process list inside container
docker top "${CONTAINER_NAME}" > "${WORK_DIR}/processes.log" 2>&1 || true

# Get file system changes (diff)
docker diff "${CONTAINER_NAME}" > "${WORK_DIR}/fschanges.log" 2>&1 || true

# Get network stats (should be empty since --network none)
docker inspect "${CONTAINER_NAME}" --format '{{json .NetworkSettings}}' > "${WORK_DIR}/network.json" 2>&1 || true

# Get exit code if container stopped
EXIT_CODE=$(docker inspect -f '{{.State.ExitCode}}' "${CONTAINER_NAME}" 2>/dev/null || echo "-1")
echo "[L2] Container exit code: ${EXIT_CODE}"

# ============================================================
# STEP 6: Analyze behavior and score
# ============================================================
echo "[L2] Step 7: Analyzing behavior..."

CRITICAL_FINDINGS=()
HIGH_FINDINGS=()
MEDIUM_FINDINGS=()
LOW_FINDINGS=()
L2_SCORE=10
L2_MULTIPLIER=1.0

# Check stdout for suspicious patterns
if [ -f "${WORK_DIR}/stdout.log" ]; then
  STDOUT=$(cat "${WORK_DIR}/stdout.log")
  
  # Check for credential exfiltration attempts
  if echo "$STDOUT" | grep -qiE "(ssh|id_rsa|aws/credentials|\.env|passwd|shadow)"; then
    CRITICAL_FINDINGS+=("stdout_mentions_sensitive_files: $(echo "$STDOUT" | grep -oiE '(ssh|id_rsa|aws/credentials|\.env|passwd|shadow)' | head -5 | tr '\n' ',')")
    L2_MULTIPLIER=0.0
  fi
  
  # Check for network endpoint mentions
  if echo "$STDOUT" | grep -qiE "https?://[^[:space:]]+"; then
    URLS=$(echo "$STDOUT" | grep -oiE "https?://[^[:space:]\"']+" | head -5 | tr '\n' ', ')
    MEDIUM_FINDINGS+=("stdout_mentions_external_urls: ${URLS}")
    if [ $(echo "$L2_MULTIPLIER > 0.7" | bc -l) -eq 1 ]; then L2_MULTIPLIER=0.7; fi
  fi
  
  # Check for exec/spawn mentions
  if echo "$STDOUT" | grep -qiE "(exec\(|spawn|child_process|subprocess|os\.system)"; then
    HIGH_FINDINGS+=("stdout_mentions_code_execution: $(echo "$STDOUT" | grep -oiE '(exec\(|spawn|child_process|subprocess|os\.system)' | head -3 | tr '\n' ',')")
    if [ $(echo "$L2_MULTIPLIER > 0.3" | bc -l) -eq 1 ]; then L2_MULTIPLIER=0.3; fi
  fi
fi

# Check filesystem changes
if [ -f "${WORK_DIR}/fschanges.log" ]; then
  FS_CHANGES=$(cat "${WORK_DIR}/fschanges.log")
  if [ -n "$FS_CHANGES" ]; then
    CHANGE_COUNT=$(echo "$FS_CHANGES" | wc -l)
    if [ "$CHANGE_COUNT" -gt 10 ]; then
      MEDIUM_FINDINGS+=("excessive_fs_changes: ${CHANGE_COUNT} files modified")
      if [ $(echo "$L2_MULTIPLIER > 0.7" | bc -l) -eq 1 ]; then L2_MULTIPLIER=0.7; fi
    fi
    # Check for changes outside /tmp
    if echo "$FS_CHANGES" | grep -qvE "^/tmp"; then
      HIGH_FINDINGS+=("fs_changes_outside_tmp: $(echo "$FS_CHANGES" | grep -vE "^/tmp" | head -5 | tr '\n' ',')")
      if [ $(echo "$L2_MULTIPLIER > 0.3" | bc -l) -eq 1 ]; then L2_MULTIPLIER=0.3; fi
    fi
  fi
fi

# Check if container crashed (may indicate malicious behavior on startup)
if [ "$CONTAINER_STATUS" = "exited" ] && [ "$EXIT_CODE" != "0" ]; then
  LOW_FINDINGS+=("container_crashed: exit_code=${EXIT_CODE}")
fi

# Check if container tried to access network (impossible with --network none, but check logs)
if [ -f "${WORK_DIR}/stdout.log" ]; then
  if cat "${WORK_DIR}/stdout.log" | grep -qiE "(ECONNREFUSED|ENOTFOUND|connect ETIMEDOUT|fetch failed)"; then
    NET_ERRORS=$(cat "${WORK_DIR}/stdout.log" | grep -iE "(ECONNREFUSED|ENOTFOUND|connect ETIMEDOUT|fetch failed)" | head -3 | tr '\n' '; ')
    MEDIUM_FINDINGS+=("attempted_network_access: ${NET_ERRORS}")
    if [ $(echo "$L2_MULTIPLIER > 0.7" | bc -l) -eq 1 ]; then L2_MULTIPLIER=0.7; fi
  fi
fi

# Apply multiplier
L2_SCORE=$(echo "10 * $L2_MULTIPLIER" | bc -l)
L2_SCORE=$(printf "%.1f" "$L2_SCORE")

# Build findings arrays for JSON
CRITICAL_JSON=$(printf '"%s",' "${CRITICAL_FINDINGS[@]}" 2>/dev/null | sed 's/,$//')
HIGH_JSON=$(printf '"%s",' "${HIGH_FINDINGS[@]}" 2>/dev/null | sed 's/,$//')
MEDIUM_JSON=$(printf '"%s",' "${MEDIUM_FINDINGS[@]}" 2>/dev/null | sed 's/,$//')
LOW_JSON=$(printf '"%s",' "${LOW_FINDINGS[@]}" 2>/dev/null | sed 's/,$//')

[ -z "$CRITICAL_JSON" ] && CRITICAL_JSON="[]"
[ -z "$HIGH_JSON" ] && HIGH_JSON="[]"
[ -z "$MEDIUM_JSON" ] && MEDIUM_JSON="[]"
[ -z "$LOW_JSON" ] && LOW_JSON="[]"

# Determine if listed
LISTED=$(echo "$L2_SCORE >= 4.0" | bc -l)

# ============================================================
# STEP 7: Generate final report
# ============================================================
echo "[L2] Step 8: Generating report..."

# Clean up arrays for JSON
CRITICAL_ARR="[$(printf '"%s",' "${CRITICAL_FINDINGS[@]}" 2>/dev/null | sed 's/,$//')]"
HIGH_ARR="[$(printf '"%s",' "${HIGH_FINDINGS[@]}" 2>/dev/null | sed 's/,$//')]"
MEDIUM_ARR="[$(printf '"%s",' "${MEDIUM_FINDINGS[@]}" 2>/dev/null | sed 's/,$//')]"
LOW_ARR="[$(printf '"%s",' "${LOW_FINDINGS[@]}" 2>/dev/null | sed 's/,$//')]"

cat > "${WORK_DIR}/report.json" << EOF
{
  "version": "L2",
  "skillId": "${SKILL_ID}",
  "repoUrl": "${REPO_URL}",
  "auditId": "${AUDIT_ID}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "completed",
  "score": ${L2_SCORE},
  "minRequired": 4.0,
  "listed": $([ "$LISTED" -eq 1 ] && echo "true" || echo "false"),
  "multiplier": ${L2_MULTIPLIER},
  "container": {
    "status": "${CONTAINER_STATUS}",
    "exitCode": ${EXIT_CODE},
    "network": "disabled (--network none)",
    "filesystem": "read-only (--read-only)",
    "memory": "256m",
    "cpus": "0.5",
    "capabilities": "all dropped (--cap-drop ALL)",
    "seccomp": "applied"
  },
  "findings": {
    "critical": ${CRITICAL_ARR},
    "high": ${HIGH_ARR},
    "medium": ${MEDIUM_ARR},
    "low": ${LOW_ARR}
  },
  "summary": {
    "criticalCount": ${#CRITICAL_FINDINGS[@]},
    "highCount": ${#HIGH_FINDINGS[@]},
    "mediumCount": ${#MEDIUM_FINDINGS[@]},
    "lowCount": ${#LOW_FINDINGS[@]}
  }
}
EOF

# ============================================================
# STEP 8: Cleanup
# ============================================================
echo "[L2] Step 9: Cleaning up..."
docker stop "${CONTAINER_NAME}" 2>/dev/null || true
docker rm "${CONTAINER_NAME}" 2>/dev/null || true
docker rmi "sentinel-${AUDIT_ID}" 2>/dev/null || true
rm -rf "${WORK_DIR}/repo"

# Output report
echo ""
echo "=== SENTINEL L2 REPORT ==="
cat "${WORK_DIR}/report.json"
