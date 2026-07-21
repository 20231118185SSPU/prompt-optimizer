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

PROJECT_CONTEXT_STATUS=missing
if [ -f "$PROJECT_DIR/.align/spec.md" ] &&
   { [ -f "$PROJECT_DIR/.align/context.md" ] || [ -f "$PROJECT_DIR/.align/facts.md" ]; }; then
  PROJECT_CONTEXT_STATUS=ready
fi

VERIFICATION_CHAIN_STATUS=missing
if [ -f "$PROJECT_DIR/.align/align-check.sh" ] && [ -s "$PROJECT_DIR/.align/check-commands.txt" ] &&
   grep -qvE '^[[:space:]]*(#|$)' "$PROJECT_DIR/.align/check-commands.txt" 2>/dev/null; then
  VERIFICATION_CHAIN_STATUS=ready
fi

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
if [ "$PROJECT_CONTEXT_STATUS" = ready ] && [ "$ROUTER_STATUS" != present ]; then
  PROJECT_CONTEXT_STATUS=missing
fi

CLAUDE_LEVEL=L1
CLAUDE_INGRESS=advisory
CLAUDE_BLOCK=unavailable
CLAUDE_COMPLETION=unavailable
CLAUDE_EXECUTION_RECEIPT=unavailable
CLAUDE_FAILED_CANCELLED=unavailable
CLAUDE_WIRED=0
CLAUDE_STRONG_WIRED=0
CLAUDE_STOP_WIRED=0
CLAUDE_PROMPT_HOOK_STATUS=missing
CLAUDE_SESSION_ACTIVATION=unavailable
CLAUDE_USER_HOOK_FULL='if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_SESSION_ACTIVATION=on BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi'
CLAUDE_USER_HOOK_OLD_FULL='if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi'
CLAUDE_USER_HOOK_SHORT='BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"'
CLAUDE_USER_HOOK_BARE='BLOCK_ON_HIGH=on bash $HOME/.prompt-optimizer/adapters/claude-code.sh'
CLAUDE_STOP_HOOK_FULL='if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; fi'
if [ -f "$CLAUDE_SETTINGS" ] && [ "$NODE_STATUS" = available ]; then
  CLAUDE_WIRED="$("$NODE_COMMAND" - "$CLAUDE_SETTINGS" <<'NODEEOF'
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const groups = data.hooks?.UserPromptSubmit ?? [];
  const ownedCommands = new Set([
    'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_SESSION_ACTIVATION=on BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi',
    'BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"',
    'BLOCK_ON_HIGH=on bash $HOME/.prompt-optimizer/adapters/claude-code.sh',
    'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi'
  ]);
  const isOwned = command => {
    const normalized = String(command ?? '').trim();
    return ownedCommands.has(normalized);
  };
  const wired = groups.some(group => (group.hooks ?? []).some(hook =>
    hook.type === 'command' &&
    isOwned(hook.command)
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
    owned_commands = {
        'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_SESSION_ACTIVATION=on BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi',
        'BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"',
        'BLOCK_ON_HIGH=on bash $HOME/.prompt-optimizer/adapters/claude-code.sh',
        'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi'
    }
    def owned(command):
        return command.strip() in owned_commands
    commands = [
        hook.get("command", "")
        for group in data.get("hooks", {}).get("UserPromptSubmit", [])
        for hook in group.get("hooks", [])
        if hook.get("type") == "command"
    ]
    print(1 if any(owned(command) for command in commands) else 0)
except Exception:
    print(0)
PYEOF
)"
elif [ -f "$CLAUDE_SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  if jq -e --arg full "$CLAUDE_USER_HOOK_FULL" --arg old_full "$CLAUDE_USER_HOOK_OLD_FULL" --arg short "$CLAUDE_USER_HOOK_SHORT" --arg bare "$CLAUDE_USER_HOOK_BARE" \
    '.hooks.UserPromptSubmit[]?.hooks[]? | select(.type == "command") | .command | select(. == $full or . == $old_full or . == $short or . == $bare)' "$CLAUDE_SETTINGS" >/dev/null 2>&1; then
    CLAUDE_WIRED=1
  fi
fi

if [ "$CLAUDE_WIRED" -eq 1 ] && [ -f "$CLAUDE_SETTINGS" ] && [ "$NODE_STATUS" = available ]; then
  CLAUDE_STRONG_WIRED="$($NODE_COMMAND - "$CLAUDE_SETTINGS" "$CLAUDE_USER_HOOK_FULL" <<'NODEEOF'
const fs = require('fs');
try {
  const [settingsFile, fullCommand] = process.argv.slice(2);
  const data = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  const wired = (data.hooks?.UserPromptSubmit ?? []).some(group =>
    (group.hooks ?? []).some(hook => hook.type === 'command' && String(hook.command ?? '').trim() === fullCommand)
  );
  process.stdout.write(wired ? '1' : '0');
} catch {
  process.stdout.write('0');
}
NODEEOF
)"
elif [ "$CLAUDE_WIRED" -eq 1 ] && [ -f "$CLAUDE_SETTINGS" ] && command -v python3 >/dev/null 2>&1; then
  CLAUDE_STRONG_WIRED="$(python3 - "$CLAUDE_SETTINGS" "$CLAUDE_USER_HOOK_FULL" <<'PYEOF'
import json, sys
try:
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    full_command = sys.argv[2]
    commands = [
        hook.get("command", "")
        for group in data.get("hooks", {}).get("UserPromptSubmit", [])
        for hook in group.get("hooks", [])
        if hook.get("type") == "command"
    ]
    print(1 if any(command.strip() == full_command for command in commands) else 0)
except Exception:
    print(0)
PYEOF
)"
elif [ "$CLAUDE_WIRED" -eq 1 ] && [ -f "$CLAUDE_SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  if jq -e --arg full "$CLAUDE_USER_HOOK_FULL" \
    '.hooks.UserPromptSubmit[]?.hooks[]? | select(.type == "command") | .command | select(. == $full)' "$CLAUDE_SETTINGS" >/dev/null 2>&1; then
    CLAUDE_STRONG_WIRED=1
  fi
fi

if [ "$CLAUDE_STRONG_WIRED" -eq 1 ]; then
  CLAUDE_PROMPT_HOOK_STATUS=ready
elif [ "$CLAUDE_WIRED" -eq 1 ]; then
  CLAUDE_PROMPT_HOOK_STATUS=legacy
fi

if [ -f "$CLAUDE_SETTINGS" ] && [ "$NODE_STATUS" = available ]; then
  CLAUDE_STOP_WIRED="$($NODE_COMMAND - "$CLAUDE_SETTINGS" <<'NODEEOF'
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const groups = data.hooks?.Stop ?? [];
  const ownedCommands = new Set([
    'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; fi'
  ]);
  const isOwned = command => {
    const normalized = String(command ?? '').trim();
    return ownedCommands.has(normalized);
  };
  const wired = groups.some(group => (group.hooks ?? []).some(hook =>
    hook.type === 'command' &&
    isOwned(hook.command)
  ));
  process.stdout.write(wired ? '1' : '0');
} catch {
  process.stdout.write('0');
}
NODEEOF
  )"
elif [ -f "$CLAUDE_SETTINGS" ] && command -v python3 >/dev/null 2>&1; then
  CLAUDE_STOP_WIRED="$(python3 - "$CLAUDE_SETTINGS" <<'PYEOF'
import json, sys
try:
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    owned_commands = {
        'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; fi'
    }
    def owned(command):
        return command.strip() in owned_commands
    commands = [
        hook.get("command", "")
        for group in data.get("hooks", {}).get("Stop", [])
        for hook in group.get("hooks", [])
        if hook.get("type") == "command"
    ]
    print(1 if any(owned(command) for command in commands) else 0)
except Exception:
    print(0)
PYEOF
  )"
elif [ -f "$CLAUDE_SETTINGS" ] && command -v jq >/dev/null 2>&1; then
  if jq -e --arg full "$CLAUDE_STOP_HOOK_FULL" \
    '.hooks.Stop[]?.hooks[]? | select(.type == "command") | .command | select(. == $full)' "$CLAUDE_SETTINGS" >/dev/null 2>&1; then
    CLAUDE_STOP_WIRED=1
  fi
fi
if [ -f "$CLAUDE_ADAPTER" ] && [ "$NODE_STATUS" = available ] && [ "$CLAUDE_WIRED" -eq 1 ]; then
  CLAUDE_INGRESS=enforced
  CLAUDE_BLOCK=enforced
  if [ "$CLAUDE_STRONG_WIRED" -eq 1 ]; then
    CLAUDE_LEVEL=L3
    CLAUDE_SESSION_ACTIVATION=opt_in_runtime_dependent
  else
    CLAUDE_LEVEL=L2
  fi
  if [ "$CLAUDE_STOP_WIRED" -eq 1 ]; then
    CLAUDE_COMPLETION=self_reported
    CLAUDE_EXECUTION_RECEIPT=normal_stop_only
  else
    CLAUDE_COMPLETION=unavailable
  fi
fi

COMPLETION_CHAIN_STATUS=missing
if [ "$RUNTIME_STATUS" = installed ] && [ "$NODE_STATUS" = available ] && [ "$CLAUDE_STRONG_WIRED" -eq 1 ] &&
   [ -f "$CLAUDE_ADAPTER" ] && [ "$CLAUDE_STOP_WIRED" -eq 1 ] &&
   [ "$PROJECT_CONTEXT_STATUS" = ready ] && [ "$VERIFICATION_CHAIN_STATUS" = ready ]; then
  COMPLETION_CHAIN_STATUS=ready
fi

CODEX_LEVEL=L1
CODEX_INGRESS=advisory
CODEX_BLOCK=unavailable
if [ -f "$CODEX_ADAPTER" ]; then
  CODEX_LEVEL=L2
  CODEX_BLOCK=advisory
fi

if [ "$JSON_MODE" -eq 1 ]; then
  printf '{"node":"%s","runtime":"%s","projectRouter":"%s","projectContext":"%s","verificationChain":"%s","hook":{"userPromptSubmit":"%s","stop":"%s"},"completionChain":"%s","hosts":{"claude-code":{"level":"%s","ingress":"%s","block":"%s","completion":"%s","executionReceipt":"%s","failedCancelled":"%s","sessionActivation":"%s"},"codex":{"level":"%s","ingress":"%s","block":"%s","completion":"unavailable","executionReceipt":"unavailable","failedCancelled":"unavailable","sessionActivation":"none"}}}\n' \
    "$NODE_STATUS" "$RUNTIME_STATUS" "$ROUTER_STATUS" "$PROJECT_CONTEXT_STATUS" "$VERIFICATION_CHAIN_STATUS" \
    "$CLAUDE_PROMPT_HOOK_STATUS" "$([ "$CLAUDE_STOP_WIRED" -eq 1 ] && echo ready || echo missing)" "$COMPLETION_CHAIN_STATUS" \
    "$CLAUDE_LEVEL" "$CLAUDE_INGRESS" "$CLAUDE_BLOCK" "$CLAUDE_COMPLETION" "$CLAUDE_EXECUTION_RECEIPT" "$CLAUDE_FAILED_CANCELLED" "$CLAUDE_SESSION_ACTIVATION" \
    "$CODEX_LEVEL" "$CODEX_INGRESS" "$CODEX_BLOCK"
  exit 0
fi

status_icon() { [ "$1" = "ready" ] || [ "$1" = "available" ] || [ "$1" = "installed" ] || [ "$1" = "present" ] && printf '[OK]' || printf '[!!]'; }

printf '\n=== Prompt Optimizer Doctor ===\n\n'
printf 'Runtime:\n'
printf '  Node.js:             %s %s\n' "$(status_icon "$NODE_STATUS")" "$NODE_STATUS"
printf '  Structured runtime:  %s %s\n' "$(status_icon "$RUNTIME_STATUS")" "$RUNTIME_STATUS"
printf '\nProject:\n'
printf '  Project router:      %s %s\n' "$(status_icon "$ROUTER_STATUS")" "$ROUTER_STATUS"
printf '  Project context:     %s %s\n' "$(status_icon "$PROJECT_CONTEXT_STATUS")" "$PROJECT_CONTEXT_STATUS"
printf '  Verification chain:  %s %s\n' "$(status_icon "$VERIFICATION_CHAIN_STATUS")" "$VERIFICATION_CHAIN_STATUS"
printf '\nClaude Code (reference host):\n'
printf '  Level:               %s\n' "$CLAUDE_LEVEL"
printf '  Ingress:             %s\n' "$CLAUDE_INGRESS"
printf '  Block:               %s\n' "$CLAUDE_BLOCK"
printf '  UserPromptSubmit:    %s %s\n' "$(status_icon "$CLAUDE_PROMPT_HOOK_STATUS")" "$CLAUDE_PROMPT_HOOK_STATUS"
printf '  Stop hook:           %s\n' "$([ "$CLAUDE_STOP_WIRED" -eq 1 ] && echo '[OK] ready' || echo '[!!] missing')"
printf '  Completion:          %s\n' "$CLAUDE_COMPLETION"
printf '  Execution receipt:   %s\n' "$CLAUDE_EXECUTION_RECEIPT"
printf '  Session activation:  %s\n' "$CLAUDE_SESSION_ACTIVATION"
printf '\nCodex:\n'
printf '  Level:               %s\n' "$CODEX_LEVEL"
printf '  Ingress:             %s\n' "$CODEX_INGRESS"
printf '  Block:               %s\n' "$CODEX_BLOCK"
printf '\nCompletion chain:      %s %s\n' "$(status_icon "$COMPLETION_CHAIN_STATUS")" "$COMPLETION_CHAIN_STATUS"

[ "$RUNTIME_STATUS" = installed ] || exit 1
[ "$NODE_STATUS" = available ] || exit 2
[ "$ROUTER_STATUS" != outdated ] || exit 3
[ "$PROJECT_CONTEXT_STATUS" = ready ] || exit 4
[ "$VERIFICATION_CHAIN_STATUS" = ready ] || exit 5
[ "$CLAUDE_STRONG_WIRED" -eq 1 ] || exit 6
[ -f "$CLAUDE_ADAPTER" ] || exit 7
[ "$CLAUDE_STOP_WIRED" -eq 1 ] || exit 8
[ "$COMPLETION_CHAIN_STATUS" = ready ] || exit 9
