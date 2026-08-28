#!/usr/bin/env bash
# MarketNow Universal Trust Adapter (UTA) — Installer
# Usage: curl -fsSL https://marketnow.site/install.sh | bash
#
# What it does:
#   1. Detects OS (macOS / Linux) and architecture (x64 / arm64)
#   2. Downloads the appropriate binary from the GitHub releases page
#   3. Verifies the SHA-256 checksum against the published release manifest
#   4. Verifies the Sigstore signature (if cosign is available)
#   5. Installs to /usr/local/bin/uta-verify (may require sudo)
#
# Exit codes:
#   0  success
#   1  general error
#   2  unsupported OS / architecture
#   3  checksum mismatch (potential tampering)
#   4  signature verification failed
#   5  network error
#   6  permission denied (try with sudo)
#
# Repository: https://github.com/alicelabs-llc/universal-trust-adapter
# License: AL-1.0 (AliceLabs Source-Available License v1.0)

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
REPO="alicelabs-llc/universal-trust-adapter"
GITHUB_API="https://api.github.com/repos/${REPO}"
DOWNLOAD_BASE="https://github.com/${REPO}/releases/download"
INSTALL_PATH="/usr/local/bin/uta-verify"
TEMP_DIR="${TMPDIR:-/tmp}/uta-install-$$"
trap 'rm -rf "$TEMP_DIR"' EXIT

# Colors for output
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  NC='\033[0m' # No Color
else
  RED='' GREEN='' YELLOW='' BLUE='' BOLD='' NC=''
fi

log() { echo -e "${BLUE}[uta-installer]${NC} $*" >&2; }
ok()   { echo -e "${GREEN}✓${NC} $*" >&2; }
warn() { echo -e "${YELLOW}!${NC} $*" >&2; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }

# ============================================================================
# Step 1: Detect platform
# ============================================================================
detect_platform() {
  local os arch

  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) os="darwin" ;;
    Linux)  os="linux" ;;
    *) err "Unsupported OS: $os (only macOS and Linux are supported)"; exit 2 ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="amd64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) err "Unsupported architecture: $arch (only amd64 and arm64 are supported)"; exit 2 ;;
  esac

  PLATFORM="${os}-${arch}"
  ok "Detected platform: $PLATFORM"
}

# ============================================================================
# Step 2: Fetch latest release info from GitHub API
# ============================================================================
fetch_release_info() {
  log "Fetching latest release information from GitHub..."
  
  if ! RELEASE_JSON="$(curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    -H "User-Agent: uta-installer/1.0" \
    "${GITHUB_API}/releases/latest" 2>&1)"; then
    err "Failed to fetch release info from GitHub"
    err "Response: $RELEASE_JSON"
    exit 5
  fi

  # Extract tag_name (e.g. "v1.0.1")
  RELEASE_TAG="$(echo "$RELEASE_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(d.get('tag_name', ''))
" 2>/dev/null || echo "")"

  if [ -z "$RELEASE_TAG" ]; then
    err "Could not parse release tag from GitHub API response"
    exit 5
  fi

  ok "Latest release: $RELEASE_TAG"
}

# ============================================================================
# Step 3: Download binary and checksum
# ============================================================================
download_files() {
  mkdir -p "$TEMP_DIR"

  local binary_name="uta-verify-${PLATFORM}"
  local checksum_name="checksums.txt"
  local sig_name="checksums.txt.sig"

  BINARY_PATH="${TEMP_DIR}/${binary_name}"
  CHECKSUM_PATH="${TEMP_DIR}/${checksum_name}"
  SIG_PATH="${TEMP_DIR}/${sig_name}"

  log "Downloading ${binary_name}..."
  if ! curl -fsSL \
    -o "$BINARY_PATH" \
    "${DOWNLOAD_BASE}/${RELEASE_TAG}/${binary_name}"; then
    err "Failed to download binary"
    exit 5
  fi
  ok "Downloaded binary: $(du -h "$BINARY_PATH" | cut -f1)"

  log "Downloading checksum file..."
  if ! curl -fsSL \
    -o "$CHECKSUM_PATH" \
    "${DOWNLOAD_BASE}/${RELEASE_TAG}/${checksum_name}"; then
    warn "Checksum file not found in release (older release may not have it)"
    SKIP_CHECKSUM=1
  else
    ok "Downloaded checksums.txt"
    SKIP_CHECKSUM=0
  fi

  log "Downloading signature file..."
  if ! curl -fsSL \
    -o "$SIG_PATH" \
    "${DOWNLOAD_BASE}/${RELEASE_TAG}/${sig_name}"; then
    warn "Signature file not found in release (older release may not have it)"
    SKIP_SIG=1
  else
    ok "Downloaded checksums.txt.sig"
    SKIP_SIG=0
  fi
}

# ============================================================================
# Step 4: Verify checksum
# ============================================================================
verify_checksum() {
  if [ "${SKIP_CHECKSUM:-1}" = "1" ]; then
    warn "Skipping checksum verification (no checksums.txt in release)"
    return 0
  fi

  log "Verifying SHA-256 checksum..."
  local expected_hash actual_hash binary_basename
  binary_basename="$(basename "$BINARY_PATH")"

  expected_hash="$(grep "${binary_basename}" "$CHECKSUM_PATH" | awk '{print $1}')"
  if [ -z "$expected_hash" ]; then
    err "Binary not found in checksums.txt: $binary_basename"
    exit 3
  fi

  actual_hash="$(sha256sum "$BINARY_PATH" | awk '{print $1}')"

  if [ "$expected_hash" != "$actual_hash" ]; then
    err "Checksum mismatch!"
    err "  Expected: $expected_hash"
    err "  Actual:   $actual_hash"
    err "This may indicate tampering. DO NOT proceed."
    exit 3
  fi
  ok "Checksum verified: $actual_hash"
}

# ============================================================================
# Step 5: Verify signature (if cosign is available)
# ============================================================================
verify_signature() {
  if [ "${SKIP_SIG:-1}" = "1" ]; then
    warn "Skipping signature verification (no checksums.txt.sig in release)"
    return 0
  fi

  if ! command -v cosign >/dev/null 2>&1; then
    warn "cosign not installed — skipping signature verification"
    warn "To verify Sigstore signature, install cosign:"
    warn "  https://docs.sigstore.dev/cosign/installation"
    return 0
  fi

  log "Verifying Sigstore signature..."
  if cosign verify-blob \
    --certificate-identity "https://github.com/${REPO}/.github/workflows/release.yml@refs/tags/${RELEASE_TAG}" \
    --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
    --signature "$SIG_PATH" \
    --certificate "$CHECKSUM_PATH.cert" \
    "$CHECKSUM_PATH" 2>/dev/null; then
    ok "Sigstore signature verified (keyless signing via GitHub Actions OIDC)"
  else
    err "Signature verification failed — release may be tampered with"
    exit 4
  fi
}

# ============================================================================
# Step 6: Install binary
# ============================================================================
install_binary() {
  log "Installing to $INSTALL_PATH..."

  chmod +x "$BINARY_PATH"

  if [ -w "/usr/local/bin" ]; then
    mv "$BINARY_PATH" "$INSTALL_PATH"
  else
    warn "/usr/local/bin is not writable — retrying with sudo"
    if ! sudo mv "$BINARY_PATH" "$INSTALL_PATH"; then
      err "Permission denied. Try running this installer with sudo:"
      err "  curl -fsSL https://marketnow.site/install.sh | sudo bash"
      exit 6
    fi
  fi
  ok "Installed: $INSTALL_PATH"
}

# ============================================================================
# Step 7: Verify install
# ============================================================================
verify_install() {
  log "Verifying install..."
  if ! "$INSTALL_PATH" --version 2>/dev/null; then
    warn "Could not run uta-verify --version (binary may need different invocation)"
    return 0
  fi
  ok "uta-verify installed successfully"
  echo
  echo -e "${BOLD}Usage:${NC}"
  echo "  uta-verify --help              Show help"
  echo "  uta-verify <card.json>         Verify an ATC card"
  echo "  uta-verify --auto <payload>     Auto-detect format and verify"
  echo
  echo -e "${BOLD}Documentation:${NC} https://marketnow.site/uta/docs"
  echo -e "${BOLD}Repository:${NC}    https://github.com/${REPO}"
  echo -e "${BOLD}Status:${NC}       https://status.marketnow.site"
}

# ============================================================================
# Main
# ============================================================================
main() {
  echo
  echo -e "${BOLD}MarketNow Universal Trust Adapter (UTA) — Installer${NC}"
  echo "Repo: https://github.com/${REPO}"
  echo "License: AL-1.0 (AliceLabs Source-Available License)"
  echo

  detect_platform
  fetch_release_info
  download_files
  verify_checksum
  verify_signature
  install_binary
  verify_install
}

main "$@"
