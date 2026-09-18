#!/usr/bin/env bash
# universal-memory installer — (c) 2026 AliceLabs / MarketNow, MIT
# Downloads the skill files from marketnow.site into ./skills/universal-memory/
# Readable by design: 4 files, plain curl, no post-install execution.
set -euo pipefail

BASE_URL="${UNIVERSAL_MEMORY_URL:-https://marketnow.site/skills/universal-memory}"
DEST="${UNIVERSAL_MEMORY_DEST:-./skills/universal-memory}"

echo "universal-memory installer"
echo "  source: $BASE_URL"
echo "  dest:   $DEST"
echo ""

mkdir -p "$DEST"
for f in SKILL.md README.md LICENSE memory.cjs memory.py; do
  echo "  ↓ $f"
  curl -fsSL "$BASE_URL/$f" -o "$DEST/$f"
done

# optional: put the CLI on PATH (skip with SKIP_PATH=1)
if [ "${SKIP_PATH:-0}" != "1" ] && [ -w "${HOME}/.local/bin" ] || mkdir -p "${HOME}/.local/bin" 2>/dev/null; then
  if [ -d "${HOME}/.local/bin" ] && echo "$PATH" | grep -q "${HOME}/.local/bin"; then
    cp "$DEST/memory.cjs" "${HOME}/.local/bin/universal-memory"
    chmod +x "${HOME}/.local/bin/universal-memory"
    echo ""
    echo "  ✓ CLI on PATH: universal-memory remember|recall|profile|forget|stats|export|doctor"
  else
    echo ""
    echo "  (add ~/.local/bin to PATH or run the CLI directly with: node $DEST/memory.cjs <command>)"
  fi
fi

echo ""
echo "  ✓ installed. quick check:"
node "$DEST/memory.cjs" doctor || python3 "$DEST/memory.py" doctor
echo ""
echo "  next: tell your agent to read $DEST/SKILL.md — it knows what to do."
echo "  humans: $DEST/README.md"
