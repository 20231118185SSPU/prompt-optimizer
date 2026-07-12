#!/usr/bin/env bash
# Report installed runtime health and honest host capability levels.
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME="$INSTALL_ROOT/runtime/index.js"
PACKAGED_ROUTER="$INSTALL_ROOT/runtime/shell/align-route.sh"
CLAUDE_ADAPTER="$INSTALL_ROOT/adapters/claude-code.sh"
CODEX_ADAPTER="$INSTALL_ROOT/adapters/codex.sh"
CLAUDE_SETTINGS="${CLAUDE_SETTINGS_PATH:-$HOME/.claude/settings.json}"
JSON_MODE=0
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=1 ;;
    *) PROJECT_DIR="$arg" ;;
  esac
done
PROJECT_ROUTER="$PROJECT_DIR/.align/align-route.sh"

NODE_STATUS=missing
NODE_COMMAND="${ALIGN_NODE_COMMAND:-node}"
command -v "$NODE_COMMAND" >/dev/null 2>&1 && NODE_STATUS=available
RUNTIME_STATUS=missing
[ -f "$RUNTIME" ] && RUNTIME_STATUS=installed
ROUTER_STATUS=not_connected
if [ -f "$PROJECT_ROUTER" ]; then
  ROUTER_STATUS=present
  if [ -f "$PACKAGED_ROUTER" ] && ! cmp -s "$PROJECT_ROUTER" "$PACKAGED_ROUTER"; then
    ROUTER_STATUS=outdated
  fi
fi

CLAUDE_LEVEL=L1
CLAUDE_INGRESS=advisory
CLAUDE_BLOCK=unavailable
CLAUDE_COMPLETION=unavailable
CLAUDE_WIRED=0
if [ -f "$CLAUDE_SETTINGS" ] && [ "$NODE_STATUS" = available ]; then
  CLAUDE_WIRED="$("$NODE_COMMAND" - "$CLAUDE_SETTINGS" <<'NODEEOF'
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const groups = data.hooks?.UserPromptSubmit ?? [];
  const wired = groups.some(group => (group.hooks ?? []).some(hook =>
    hook.type === 'command' &&
    String(hook.command ?? '').includes('.prompt-optimizer/adapters/claude-code.sh') &&
    String(hook.command ?? '').includes('BLOCK_ON_HIGH=on')
  ));
  process.stdout.write(wired ? '1' : '0');
} catch {
  process.stdout.write('0');
}
NODEEOF
)"
elif [ -f "$CLAUDE_SETTINGS" ] && command -v python3 >/dev/null 2>&1; then
  CLAUDE_WIRED="$(python3 - "$CLAUDE_SETTINGS" <<'PYEOF'
import json, sys
try:
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    commands = [
        hook.get("command", "")
        for group in data.get("hooks", {}).get("UserPromptSubmit", [])
        for hook in group.get("hooks", [])
        if hook.get("type") == "command"
    ]
    print(1 if any('.prompt-optimizer/adapters/claude-code.sh' in command and 'BLOCK_ON_HIGH=on' in command for command in commands) else 0)
except Exception:
    print(0)
PYEOF
)"
elif [ -f "$CLAUDE_SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  if jq -e '.hooks.UserPromptSubmit[]?.hooks[]? | select(.type == "command") | .command | select(contains(".prompt-optimizer/adapters/claude-code.sh") and contains("BLOCK_ON_HIGH=on"))' "$CLAUDE_SETTINGS" >/dev/null 2>&1; then
    CLAUDE_WIRED=1
  fi
fi
if [ -f "$CLAUDE_ADAPTER" ] && [ "$CLAUDE_WIRED" -eq 1 ]; then
  CLAUDE_LEVEL=L3
  CLAUDE_INGRESS=enforced
  CLAUDE_BLOCK=enforced
  CLAUDE_COMPLETION=self_reported
fi

CODEX_LEVEL=L1
CODEX_INGRESS=advisory
CODEX_BLOCK=unavailable
if [ -f "$CODEX_ADAPTER" ]; then
  CODEX_LEVEL=L2
  [ "${ALIGN_CODEX_WRAPPER_ACTIVE:-}" = "1" ] && CODEX_INGRESS=enforced
  CODEX_BLOCK=advisory
fi

if [ "$JSON_MODE" -eq 1 ]; then
  printf '{"node":"%s","runtime":"%s","projectRouter":"%s","hosts":{"claude-code":{"level":"%s","ingress":"%s","block":"%s","completion":"%s"},"codex":{"level":"%s","ingress":"%s","block":"%s","completion":"unavailable"}}}\n' \
    "$NODE_STATUS" "$RUNTIME_STATUS" "$ROUTER_STATUS" \
    "$CLAUDE_LEVEL" "$CLAUDE_INGRESS" "$CLAUDE_BLOCK" "$CLAUDE_COMPLETION" \
    "$CODEX_LEVEL" "$CODEX_INGRESS" "$CODEX_BLOCK"
  exit 0
fi

printf 'Node.js: %s\n' "$NODE_STATUS"
printf 'Structured runtime: %s\n' "$RUNTIME_STATUS"
printf 'Project router: %s\n' "$ROUTER_STATUS"
printf 'Claude Code: %s (ingress %s; block %s; completion %s)\n' "$CLAUDE_LEVEL" "$CLAUDE_INGRESS" "$CLAUDE_BLOCK" "$CLAUDE_COMPLETION"
printf 'Codex: %s (ingress %s; block %s; completion unavailable)\n' "$CODEX_LEVEL" "$CODEX_INGRESS" "$CODEX_BLOCK"

[ "$RUNTIME_STATUS" = installed ] || exit 1
[ "$NODE_STATUS" = available ] || exit 2
[ "$ROUTER_STATUS" != outdated ] || exit 3
