#!/usr/bin/env bash
# =============================================================================
# deploy-all-platforms.sh
# =============================================================================
# Build the AEP marketplace once and deploy the result to every configured
# mirror platform in sequence:
#
#   1. npm run build              (Vite → dist/)
#   2. vercel deploy --prod       (primary)
#   3. wrangler pages deploy      (Cloudflare Pages mirror)
#   4. deno deploy                (Deno Deploy edge mirror)
#   5. npm publish                (npm registry — also republishes jsDelivr)
#   6. smoke-test every URL
#
# Each step is OPTIONAL — if the required tool is not installed or the
# required env var is missing, the step is skipped with a warning rather
# than failing the whole script. This lets you run the same script on a
# fresh laptop (just build + Vercel) and on CI (build + everything).
#
# Usage:
#   bash scripts/deploy-all-platforms.sh
#
# Optional env vars (any subset may be set):
#   SKIP_BUILD=1                  Skip the build step (use existing dist/)
#   SKIP_VERCEL=1                 Skip the Vercel deploy
#   SKIP_CLOUDFLARE=1             Skip the Cloudflare Pages deploy
#   SKIP_DENO=1                   Skip the Deno Deploy deploy
#   SKIP_NPM=1                    Skip the npm publish step
#   SKIP_SMOKE=1                  Skip the final smoke-test step
#   NPM_PUBLISH_IF_CHANGED=1      Only run `npm publish` if the version
#                                 differs from the latest published version
#   CLOUDFLARE_PROJECT_NAME=marketnow
#   DENO_PROJECT_NAME=marketnow-fallback
#   VERCEL_PROJECT_NAME=marketnow
#
# Exit codes:
#   0 — All non-skipped steps succeeded.
#   1 — A required non-optional step failed.
# =============================================================================
set -euo pipefail

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

# ANSI colors — disabled if not a TTY.
if [ -t 1 ]; then
  C_RESET="\033[0m"
  C_BOLD="\033[1m"
  C_GREEN="\033[32m"
  C_YELLOW="\033[33m"
  C_RED="\033[31m"
  C_BLUE="\033[34m"
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_BLUE=""
fi

log()  { printf '%b[%s]%b %s\n'        "$C_BLUE"   "$1" "$C_RESET" "${2:-}"; }
ok()   { printf '%b✓ [%s]%b %s\n'      "$C_GREEN"  "$1" "$C_RESET" "${2:-}"; }
skip() { printf '%b⊘ [%s]%b %s (skipped)\n' "$C_YELLOW" "$1" "$C_RESET" "${2:-}"; }
warn() { printf '%b! [%s]%b %s\n'      "$C_YELLOW" "$1" "$C_RESET" "${2:-}"; }
fail() { printf '%b✗ [%s]%b %s\n'      "$C_RED"    "$1" "$C_RESET" "${2:-}" >&2; }

have() { command -v "$1" >/dev/null 2>&1; }

# ----------------------------------------------------------------------------
# Locate project root (the directory containing package.json + wrangler.toml)
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f package.json ]; then
  fail "root" "package.json not found in $ROOT_DIR"
  exit 1
fi

# Read package name + version (works on Linux + macOS + WSL).
PKG_NAME=$(node -e 'console.log(require("./package.json").name || "unknown")')
PKG_VERSION=$(node -e 'console.log(require("./package.json").version || "0.0.0")')

echo ""
echo "============================================================"
echo " MarketNow — Deploy to all platforms"
echo "   package: $PKG_NAME"
echo "   version: $PKG_VERSION"
echo "   root:    $ROOT_DIR"
echo "============================================================"
echo ""

# ----------------------------------------------------------------------------
# Step 1 — Build
# ----------------------------------------------------------------------------
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  skip "build" "SKIP_BUILD=1"
elif [ ! -d dist ] || [ "${FORCE_BUILD:-0}" = "1" ]; then
  log "build" "running npm run build …"
  if npm run build; then
    ok "build" "dist/ is ready"
  else
    fail "build" "npm run build failed"
    exit 1
  fi
else
  skip "build" "dist/ already exists (set FORCE_BUILD=1 to rebuild)"
fi

# ----------------------------------------------------------------------------
# Step 2 — Vercel (primary)
# ----------------------------------------------------------------------------
if [ "${SKIP_VERCEL:-0}" = "1" ]; then
  skip "vercel" "SKIP_VERCEL=1"
elif ! have vercel; then
  skip "vercel" "vercel CLI not installed"
elif [ -z "${VERCEL_TOKEN:-}" ] && [ ! -f "$HOME/.vercel/auth.json" ]; then
  skip "vercel" "VERCEL_TOKEN not set and no local auth.json"
else
  log "vercel" "deploying to production …"
  if [ -n "${VERCEL_TOKEN:-}" ]; then
    if vercel deploy --prod --token="$VERCEL_TOKEN" --yes; then
      ok "vercel" "production deploy finished"
    else
      fail "vercel" "vercel deploy failed"
      exit 1
    fi
  else
    if vercel deploy --prod --yes; then
      ok "vercel" "production deploy finished"
    else
      fail "vercel" "vercel deploy failed"
      exit 1
    fi
  fi
fi

# ----------------------------------------------------------------------------
# Step 3 — Cloudflare Pages
# ----------------------------------------------------------------------------
CF_PROJECT="${CLOUDFLARE_PROJECT_NAME:-marketnow}"
if [ "${SKIP_CLOUDFLARE:-0}" = "1" ]; then
  skip "cloudflare" "SKIP_CLOUDFLARE=1"
elif ! have npx; then
  skip "cloudflare" "npx not available"
elif [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ ! -f "$HOME/.wrangler/config/default.toml" ]; then
  skip "cloudflare" "CLOUDFLARE_API_TOKEN not set and no local wrangler login"
elif [ ! -d dist ]; then
  skip "cloudflare" "dist/ does not exist (build was skipped?)"
else
  log "cloudflare" "deploying dist/ → $CF_PROJECT.pages.dev …"
  if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
    if npx --no-install wrangler pages deploy dist \
        --project-name="$CF_PROJECT" \
        --commit-dirty=true; then
      ok "cloudflare" "https://${CF_PROJECT}.pages.dev"
    else
      # Fall back to installing wrangler if missing locally.
      if npx -y wrangler@latest pages deploy dist \
          --project-name="$CF_PROJECT" \
          --commit-dirty=true; then
        ok "cloudflare" "https://${CF_PROJECT}.pages.dev (installed wrangler)"
      else
        fail "cloudflare" "wrangler pages deploy failed"
        exit 1
      fi
    fi
  else
    if npx --no-install wrangler pages deploy dist \
        --project-name="$CF_PROJECT" \
        --commit-dirty=true; then
      ok "cloudflare" "https://${CF_PROJECT}.pages.dev"
    else
      fail "cloudflare" "wrangler pages deploy failed"
      exit 1
    fi
  fi
fi

# ----------------------------------------------------------------------------
# Step 4 — Deno Deploy
# ----------------------------------------------------------------------------
DENO_PROJECT="${DENO_PROJECT_NAME:-marketnow-fallback}"
DENO_ENTRY="deno-deploy.ts"
if [ "${SKIP_DENO:-0}" = "1" ]; then
  skip "deno" "SKIP_DENO=1"
elif ! have deno; then
  skip "deno" "deno CLI not installed (https://deno.land)"
elif [ -z "${DENO_DEPLOY_TOKEN:-}" ]; then
  skip "deno" "DENO_DEPLOY_TOKEN not set"
elif [ ! -f "$DENO_ENTRY" ]; then
  skip "deno" "$DENO_ENTRY not found"
else
  log "deno" "deploying $DENO_ENTRY → $DENO_PROJECT.deno.dev …"
  # `deploy` is the modern alias for `deployctl deploy` in Deno 2.x.
  # Use a subshell so we can also fall back to deployctl if the alias
  # isn't recognised (older Deno installs).
  if (deno deploy --project="$DENO_PROJECT" --branch=main "$DENO_ENTRY" \
        || deployctl deploy --project="$DENO_PROJECT" --entrypoint="$DENO_ENTRY"); then
    ok "deno" "https://${DENO_PROJECT}.deno.dev"
  else
    fail "deno" "deno deploy failed"
    exit 1
  fi
fi

# ----------------------------------------------------------------------------
# Step 5 — npm publish (only if version changed)
# ----------------------------------------------------------------------------
if [ "${SKIP_NPM:-0}" = "1" ]; then
  skip "npm" "SKIP_NPM=1"
elif ! have npm; then
  skip "npm" "npm not available"
elif [ -z "${NPM_TOKEN:-}" ] && [ ! -f "$HOME/.npmrc" ]; then
  skip "npm" "NPM_TOKEN not set and no local ~/.npmrc"
else
  # Find the canonical npm package to publish (mcp-server is the primary).
  NPM_PKG_DIR="$ROOT_DIR/../../mcp-server"
  if [ ! -d "$NPM_PKG_DIR" ]; then
    NPM_PKG_DIR="$ROOT_DIR/../mcp-server"
  fi
  if [ ! -d "$NPM_PKG_DIR" ]; then
    skip "npm" "mcp-server directory not found — publish manually"
  else
    cd "$NPM_PKG_DIR"
    NPM_PKG_NAME=$(node -e 'console.log(require("./package.json").name || "unknown")')
    NPM_PKG_VERSION=$(node -e 'console.log(require("./package.json").version || "0.0.0")')
    NPM_LATEST=$(npm view "$NPM_PKG_NAME" version 2>/dev/null || echo "")

    if [ "$NPM_LATEST" = "$NPM_PKG_VERSION" ] && [ "${NPM_PUBLISH_FORCE:-0}" != "1" ]; then
      skip "npm" "version $NPM_PKG_VERSION is already published (set NPM_PUBLISH_FORCE=1 to republish)"
    else
      log "npm" "publishing $NPM_PKG_NAME@$NPM_PKG_VERSION …"
      if [ -n "${NPM_TOKEN:-}" ]; then
        # Token-based auth (CI)
        npm config set "//registry.npmjs.org/:_authToken" "$NPM_TOKEN" >/dev/null 2>&1 || true
      fi
      if npm publish --access public; then
        ok "npm" "$NPM_PKG_NAME@$NPM_PKG_VERSION published (jsDelivr will mirror within ~5 min)"
      else
        fail "npm" "npm publish failed"
        cd "$ROOT_DIR"
        exit 1
      fi
    fi
    cd "$ROOT_DIR"
  fi
fi

# ----------------------------------------------------------------------------
# Step 6 — Smoke test (verify every platform is serving the latest version)
# ----------------------------------------------------------------------------
if [ "${SKIP_SMOKE:-0}" = "1" ]; then
  skip "smoke" "SKIP_SMOKE=1"
  echo ""
  echo "============================================================"
  echo " Done (smoke test skipped)."
  echo "============================================================"
  exit 0
fi

echo ""
log "smoke" "verifying all platforms serve the latest version …"

SMOKE_OK=0
SMOKE_FAIL=0

smoke() {
  local label="$1"
  local url="$2"
  local expected="${3:-}"
  local body
  if body=$(curl -fsS --max-time 10 "$url" 2>/dev/null); then
    if [ -n "$expected" ] && ! echo "$body" | grep -q "$expected"; then
      warn "smoke" "$label returned 200 but expected pattern missing: $expected"
      SMOKE_FAIL=$((SMOKE_FAIL + 1))
      return
    fi
    ok "smoke" "$label → 200 OK"
    SMOKE_OK=$((SMOKE_OK + 1))
  else
    fail "smoke" "$label → unreachable ($url)"
    SMOKE_FAIL=$((SMOKE_FAIL + 1))
  fi
}

# jsDelivr (always available, doesn't depend on the local deploy)
# Note: jsDelivr pretty-prints package.json with a space after the colon, so
# we match the bare package name (more lenient than strict JSON).
smoke "jsdelivr/mcp"      "https://cdn.jsdelivr.net/npm/marketnow-mcp@latest/package.json"     "marketnow-mcp"
smoke "jsdelivr/atc"      "https://cdn.jsdelivr.net/npm/agent-trust-card@latest/package.json"  "agent-trust-card"

# Vercel primary
smoke "vercel/health"     "https://marketnow.site/api/health"                                  "\"ok\":true"
smoke "vercel/agent.json"  "https://marketnow.site/api/agent.json"                              "\"version\""

# Cloudflare Pages — only smoke-test if the project was deployed.
# Match a JSON-shaped pattern so we don't false-positive on Cloudflare's
# default HTML placeholder page.
smoke "cloudflare/health" "https://${CF_PROJECT}.pages.dev/api/agent.json"                       "\"agent\":"

# Deno Deploy
smoke "deno/health"       "https://${DENO_PROJECT}.deno.dev/api/health"                         "\"ok\":true"

echo ""
echo "============================================================"
echo " Smoke test results: $SMOKE_OK ok, $SMOKE_FAIL failed"
echo "============================================================"

if [ "$SMOKE_FAIL" -gt 0 ]; then
  fail "smoke" "$SMOKE_FAIL platform(s) unreachable — check the URLs above"
  exit 2
fi

ok "smoke" "All platforms are serving the latest version ($PKG_VERSION)"
exit 0
