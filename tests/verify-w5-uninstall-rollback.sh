#!/usr/bin/env bash
# W5 rollback: an unowned runtime must stop uninstall before any skill removal.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$(mktemp -d)"
cleanup() {
  status=$?
  rm -rf "$SANDBOX"
  exit "$status"
}
trap cleanup EXIT

HOME_DIR="$SANDBOX/home"
SKILL="$HOME_DIR/.claude/skills/optimize-prompt"
RUNTIME="$HOME_DIR/.prompt-optimizer"
mkdir -p "$SKILL" "$RUNTIME"
printf '%s\n' 'keep-skill' > "$SKILL/user-sentinel"
printf '%s\n' 'keep-runtime' > "$RUNTIME/user-sentinel"

HOME="$HOME_DIR" PROMPT_OPTIMIZER_ZIP="$ROOT" \
  bash "$ROOT/scripts/install-skill.sh" --uninstall claude > "$SANDBOX/uninstall.out" 2> "$SANDBOX/uninstall.err"
status=$?

if [ "$status" -eq 0 ]; then
  echo 'FAIL: unowned runtime unexpectedly allowed uninstall' >&2
  exit 1
fi
[ -f "$SKILL/user-sentinel" ] || {
  echo 'FAIL: failed uninstall removed existing skills before ownership validation' >&2
  exit 1
}
[ -f "$RUNTIME/user-sentinel" ] || {
  echo 'FAIL: failed uninstall changed the unowned runtime' >&2
  exit 1
}

NORMAL_HOME="$SANDBOX/normal-home"
NORMAL_SETTINGS="$NORMAL_HOME/.claude/settings.json"
mkdir -p "$(dirname "$NORMAL_SETTINGS")"
printf '%s\n' '{"env":{"KEEP":"yes"}}' > "$NORMAL_SETTINGS"
HOME="$NORMAL_HOME" PROMPT_OPTIMIZER_ZIP="$ROOT" \
  bash "$ROOT/scripts/install-skill.sh" claude > "$SANDBOX/normal-install.out" 2> "$SANDBOX/normal-install.err"

python3 - "$NORMAL_SETTINGS" <<'PYEOF'
import json, sys

path = sys.argv[1]
with open(path, encoding='utf-8') as handle:
    settings = json.load(handle)
settings['hooks']['Stop'].append({
    'hooks': [{'type': 'command', 'command': 'echo foreign-stop-hook'}]
})
with open(path, 'w', encoding='utf-8') as handle:
    json.dump(settings, handle)
PYEOF

HOME="$NORMAL_HOME" PROMPT_OPTIMIZER_ZIP="$ROOT" \
  bash "$ROOT/scripts/install-skill.sh" --uninstall claude > "$SANDBOX/normal-uninstall.out" 2> "$SANDBOX/normal-uninstall.err"

python3 - "$NORMAL_SETTINGS" <<'PYEOF'
import json, sys

with open(sys.argv[1], encoding='utf-8') as handle:
    settings = json.load(handle)
assert settings['env']['KEEP'] == 'yes'
commands = [
    hook.get('command', '')
    for event in ('UserPromptSubmit', 'Stop')
    for group in settings.get('hooks', {}).get(event, [])
    for hook in group.get('hooks', [])
]
assert 'echo foreign-stop-hook' in commands
assert not any('BLOCK_ON_HIGH=on' in command for command in commands)
assert not any('ALIGN_HOOK_PHASE=stop' in command for command in commands)
PYEOF

[ ! -d "$NORMAL_HOME/.claude/skills/optimize-prompt" ] || {
  echo 'FAIL: normal uninstall retained an owned skill' >&2
  exit 1
}
[ ! -d "$NORMAL_HOME/.prompt-optimizer" ] || {
  echo 'FAIL: normal uninstall retained the owned runtime' >&2
  exit 1
}

echo 'PASS: W5 uninstall validates ownership before removal'
