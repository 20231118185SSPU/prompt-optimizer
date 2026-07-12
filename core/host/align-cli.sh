#!/usr/bin/env bash
set -eu
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME="$(cd "$SCRIPT_DIR/../runtime" && pwd)/index.js"
NODE_COMMAND="${ALIGN_NODE_COMMAND:-node}"
if ! command -v "$NODE_COMMAND" >/dev/null 2>&1; then
  echo 'align-cli requires Node.js; use the packaged shell router for degraded routing.' >&2
  exit 2
fi
[ -f "$RUNTIME" ] || { echo 'align-cli runtime missing; reinstall Prompt Optimizer.' >&2; exit 1; }
exec "$NODE_COMMAND" "$RUNTIME" "$@"
