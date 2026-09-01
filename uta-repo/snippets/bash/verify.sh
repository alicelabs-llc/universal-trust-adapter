#!/usr/bin/env bash
# UTA — Verify any AI agent credential from the command line.
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
set -euo pipefail
[ $# -lt 1 ] && { echo "Usage: $0 <credential-file-or-string>"; exit 1; }
INPUT="$1"
if [ -f "$INPUT" ]; then CARD=$(cat "$INPUT"); else CARD="$INPUT"; fi
PAYLOAD=$(jq -n --arg card "$CARD" '{card: $card}')
RESPONSE=$(curl -sS -X POST "https://www.marketnow.site/api/trust?action=verify" \
  -H "Content-Type: application/json" -d "$PAYLOAD")
echo "$RESPONSE" | jq .
DECISION=$(echo "$RESPONSE" | jq -r '.decision // "UNDETERMINED"')
case "$DECISION" in
  PERMIT) echo "OK PERMIT"; exit 0 ;;
  DENY)   echo "FAIL DENY"; exit 1 ;;
  *)      echo "WARN UNDETERMINED"; exit 2 ;;
esac
