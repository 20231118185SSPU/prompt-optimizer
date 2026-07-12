#!/usr/bin/env bash
# Codex L2 wrapper: structured runtime when Node is present, explicit shell degradation otherwise.
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME="$INSTALL_ROOT/runtime/index.js"
SHELL_ROUTER="$INSTALL_ROOT/runtime/shell/align-route.sh"
NODE_COMMAND="${ALIGN_NODE_COMMAND:-node}"

if [ "$#" -lt 1 ]; then
  echo 'Usage: codex.sh <instruction> [project-dir]' >&2
  exit 1
fi

INSTRUCTION="$1"
PROJECT_DIR="${2:-$(pwd)}"

if command -v "$NODE_COMMAND" >/dev/null 2>&1 && [ -f "$RUNTIME" ]; then
  exec "$NODE_COMMAND" "$RUNTIME" json "$INSTRUCTION" --project-dir "$PROJECT_DIR"
fi

if [ -f "$SHELL_ROUTER" ]; then
  echo '[alignment] degraded=shell host=codex level=L2 block=advisory completion=unavailable' >&2
  context_refs=""
  if [ -f "$PROJECT_DIR/.align/spec.md" ] || [ -f "$PROJECT_DIR/.align/context.md" ]; then
    context_refs="project:.align/spec.md"
  fi
  projection="$(ALIGN_CONTEXT_REFS="$context_refs" ALIGN_ARBITER=off bash "$SHELL_ROUTER" --decision "$INSTRUCTION")"
  IFS=$'\t' read -r route reasons action degraded <<EOF
$projection
EOF
  printf '{"schemaVersion":"1.0.0","kind":"alignment.decision.projection","route":"%s","reasons":"%s","next":{"action":"%s"},"degraded":true}\n' "$route" "$reasons" "$action"
  exit 0
fi

echo '[alignment] runtime missing: reinstall Prompt Optimizer or run align-doctor' >&2
exit 1
