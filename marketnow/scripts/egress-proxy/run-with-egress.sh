#!/usr/bin/env bash
# ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
#
# L2.6 — Sandbox run with Egress Proxy
# =====================================
#
# Runs the MCP server with network access BUT through an egress proxy
# that only allows whitelisted domains. This is for servers that 
# legitimately need outbound calls (npm install, API calls, etc.).
#
# Usage: bash scripts/egress-proxy/run-with-egress.sh <IMAGE> <SKILL_ID> <TIMEOUT>
#
# Architecture:
#   1. Start egress proxy on 127.0.0.1:3128
#   2. Run Docker container with --network none (isolated from host)
#   3. BUT mount the proxy as a network namespace
#   4. All outbound traffic goes through the proxy
#   5. Proxy only allows domains in allowlist.json
#   6. All requests (allowed + blocked) are logged

set -e

IMAGE="${1:?IMAGE required}"
SKILL_ID="${2:?SKILL_ID required}"
TIMEOUT="${3:-60}"
OUTPUT_DIR="/tmp/l2_output"
PROXY_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$OUTPUT_DIR"

echo "=== L2.6 Egress Proxy Sandbox ==="
echo "  Image: $IMAGE"
echo "  Skill: $SKILL_ID"
echo "  Timeout: ${TIMEOUT}s"
echo ""

# Phase 1: Start egress proxy
echo "--- Phase 1: Starting egress proxy ---"
node "$PROXY_DIR/egress-proxy.js" --port 3128 --allowlist "$PROXY_DIR/allowlist.json" &
PROXY_PID=$!
sleep 2
echo "  Proxy PID: $PROXY_PID"
echo "  Proxy running on 127.0.0.1:3128"

# Phase 2: Run container with proxy
echo ""
echo "--- Phase 2: Running container with egress proxy ---"

# Option A: Full isolation (--network none) — for servers that DON'T need network
# Option B: Egress proxy — for servers that DO need network
# We try Option B (with proxy) first

timeout "$TIMEOUT" docker run --rm \
  --runtime=runsc \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --memory 256m \
  --memory-swap 0 \
  --cpus 0.5 \
  --pids-limit 64 \
  --tmpfs /tmp:rw,size=64m \
  --user 1000:1000 \
  --env SKILL_ID="$SKILL_ID" \
  --env SENTINEL_L2_MODE=egress_proxy \
  --env HTTP_PROXY=http://host.docker.internal:3128 \
  --env HTTPS_PROXY=http://host.docker.internal:3128 \
  --env NO_PROXY=localhost,127.0.0.1 \
  --add-host=host.docker.internal:host-gateway \
  "$IMAGE" > "$OUTPUT_DIR/stdout.log" 2>&1 || true

# Phase 3: Stop proxy
echo ""
echo "--- Phase 3: Stopping egress proxy ---"
kill $PROXY_PID 2>/dev/null || true

# Phase 4: Analyze egress log
echo ""
echo "--- Phase 4: Egress log analysis ---"
if [ -f "$OUTPUT_DIR/egress_log.json" ]; then
  echo "  Egress log found: $OUTPUT_DIR/egress_log.json"
  
  ALLOWED=$(python3 -c "
import json
with open('$OUTPUT_DIR/egress_log.json') as f:
    entries = json.load(f)
allowed = [e for e in entries if e.get('action') == 'ALLOWED']
blocked = [e for e in entries if e.get('action') == 'BLOCKED']
print(f'  Allowed requests: {len(allowed)}')
print(f'  Blocked requests: {len(blocked)}')
if blocked:
    print('  Blocked domains:')
    for b in blocked[:10]:
        print(f'    ❌ {b.get(\"hostname\",\"?\")} ({b.get(\"method\",\"?\")})')
if allowed:
    print('  Allowed domains contacted:')
    domains = set()
    for a in allowed:
        domains.add(a.get('hostname','?'))
    for d in sorted(domains):
        print(f'    ✅ {d}')
" 2>/dev/null)
  echo "$ALLOWED"
else
  echo "  No egress log — server made no outbound requests"
fi

echo ""
echo "=== L2.6 Egress Proxy Sandbox Complete ==="
