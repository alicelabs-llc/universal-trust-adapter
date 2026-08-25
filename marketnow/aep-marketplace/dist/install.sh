#!/usr/bin/env bash
# MarketNow / UTA Multi-Source Installer
# Anti-ban: tries NPM first, then jsDelivr CDN, then unpkg CDN, then marketnow.site direct
# If any one channel is blocked, the others continue working.
#
# Usage:
#   curl -fsSL https://marketnow.site/install.sh | bash
#   curl -fsSL https://marketnow.site/install.sh | bash -s -- @marketnow/uts
#   curl -fsSL https://marketnow.site/install.sh | bash -s -- marketnow-mcp@1.10.0

set -euo pipefail

PACKAGE="${1:-@marketnow/uts}"
VERSION=""

if [[ "$PACKAGE" == *"@"* ]]; then
  # Split @version suffix
  PARTS=("${PACKAGE//@/ })
  if [[ ${#PARTS[@]} -ge 2 ]]; then
    PACKAGE="${PARTS[0]}"
    VERSION="${PARTS[1]}"
  fi
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  MarketNow / UTA Installer — Multi-Source Anti-Ban              ║"
echo "║  Package: ${PACKAGE}  Version: ${VERSION:-latest}                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Channel 1: NPM (primary — most reliable)
try_npm() {
  echo "▸ [1/4] Trying NPM registry..."
  if command -v npm &>/dev/null; then
    if [[ -n "$VERSION" ]]; then
      npm install -g "${PACKAGE}@${VERSION}" 2>&1 | tail -3
    else
      npm install -g "$PACKAGE" 2>&1 | tail -3
    fi
    if [[ $? -eq 0 ]]; then
      echo "  ✓ NPM install successful"
      return 0
    fi
  fi
  echo "  ✗ NPM unavailable or install failed"
  return 1
}

# Channel 2: jsDelivr CDN (free mirror of NPM)
try_jsdelivr() {
  echo "▸ [2/4] Trying jsDelivr CDN..."
  local VER_QUERY="${VERSION:-latest}"
  local URL="https://cdn.jsdelivr.net/npm/${PACKAGE}@${VER_QUERY}/package.json"
  if curl -fsS "$URL" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ Found via jsDelivr: {d.get(\"name\")} v{d.get(\"version\")}')" 2>/dev/null; then
    # Download tarball via jsDelivr
    local TARBALL_URL="https://cdn.jsdelivr.net/npm/${PACKAGE}@${VER_QUERY}/-/${PACKAGE##*/}-${VERSION}.tgz"
    curl -fsSL "$TARBALL_URL" -o "/tmp/${PACKAGE##*/}-${VERSION}.tgz" 2>/dev/null
    if [[ -f "/tmp/${PACKAGE##*/}-${VERSION}.tgz" ]]; then
      echo "  ✓ Downloaded tarball: /tmp/${PACKAGE##*/}-${VERSION}.tgz"
      return 0
    fi
  fi
  echo "  ✗ jsDelivr unavailable or package not found"
  return 1
}

# Channel 3: unpkg CDN
try_unpkg() {
  echo "▸ [3/4] Trying unpkg CDN..."
  local VER_QUERY="${VERSION:-latest}"
  local URL="https://unpkg.com/${PACKAGE}@${VER_QUERY}/package.json"
  if curl -fsS "$URL" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  ✓ Found via unpkg: {d.get(\"name\")} v{d.get(\"version\")}')" 2>/dev/null; then
    return 0
  fi
  echo "  ✗ unpkg unavailable"
  return 1
}

# Channel 4: marketnow.site direct (AliceLabs-owned)
try_marketnow() {
  echo "▸ [4/4] Trying marketnow.site direct..."
  local SHORT="${PACKAGE##*/}"
  local URL="https://marketnow.site/uta-packages/marketnow-${SHORT}-${VERSION}.tgz"
  if curl -fsSL "$URL" -o "/tmp/marketnow-${SHORT}-${VERSION}.tgz" 2>/dev/null; then
    echo "  ✓ Downloaded: /tmp/marketnow-${SHORT}-${VERSION}.tgz"
    echo "  URL: $URL"
    return 0
  fi
  echo "  ✗ marketnow.site direct failed"
  return 1
}

# Try channels in order
SUCCESS=0
try_npm && SUCCESS=1
[[ $SUCCESS -eq 0 ]] && try_jsdelivr && SUCCESS=1
[[ $SUCCESS -eq 0 ]] && try_unpkg && SUCCESS=1
[[ $SUCCESS -eq 0 ]] && try_marketnow && SUCCESS=1

echo ""
if [[ $SUCCESS -eq 1 ]]; then
  echo "✅ Installation succeeded via at least one channel."
  echo ""
  echo "Resilience Manifest (all channels):"
  echo "  https://marketnow.site/resilience.json"
  echo ""
  echo "Verify your install:"
  echo "  sha256sum /tmp/*.tgz   # compare with manifest"
else
  echo "❌ All 4 channels failed. Check internet or report to info@alicelabs.site"
  exit 1
fi
