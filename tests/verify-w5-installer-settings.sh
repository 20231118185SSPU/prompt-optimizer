#!/usr/bin/env bash
# W5 rollback: malformed Claude settings must fail before replacing an owned install.
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
SETTINGS="$HOME_DIR/.claude/settings.json"
RUNTIME="$HOME_DIR/.prompt-optimizer"
SKILL="$HOME_DIR/.claude/skills/optimize-prompt"
mkdir -p "$(dirname "$SETTINGS")" "$RUNTIME" "$SKILL"
printf '%s\n' '{ invalid settings json' > "$SETTINGS"
cp "$SETTINGS" "$SANDBOX/settings.before"
printf '%s\n' 'prompt-optimizer-runtime-v1' > "$RUNTIME/.prompt-optimizer-owned"
printf '%s\n' 'keep-runtime' > "$RUNTIME/user-sentinel"
printf '%s\n' 'keep-skill' > "$SKILL/user-sentinel"

HOME="$HOME_DIR" PROMPT_OPTIMIZER_ZIP="$ROOT" \
  bash "$ROOT/scripts/install-skill.sh" claude > "$SANDBOX/install.out" 2> "$SANDBOX/install.err"
status=$?

if [ "$status" -eq 0 ]; then
  echo 'FAIL: malformed settings unexpectedly allowed installation' >&2
  exit 1
fi
cmp -s "$SANDBOX/settings.before" "$SETTINGS" || {
  echo 'FAIL: malformed settings were changed during failed installation' >&2
  exit 1
}
[ -f "$RUNTIME/user-sentinel" ] || {
  echo 'FAIL: failed installation replaced the existing owned runtime' >&2
  exit 1
}
[ -f "$SKILL/user-sentinel" ] || {
  echo 'FAIL: failed installation replaced existing skills' >&2
  exit 1
}

SHAPE_HOME="$SANDBOX/shape-home"
SHAPE_SETTINGS="$SHAPE_HOME/.claude/settings.json"
SHAPE_RUNTIME="$SHAPE_HOME/.prompt-optimizer"
SHAPE_SKILL="$SHAPE_HOME/.claude/skills/optimize-prompt"
mkdir -p "$(dirname "$SHAPE_SETTINGS")" "$SHAPE_RUNTIME" "$SHAPE_SKILL"
printf '%s\n' '{"hooks":"keep-user-hooks","env":{"KEEP":"yes"}}' > "$SHAPE_SETTINGS"
cp "$SHAPE_SETTINGS" "$SANDBOX/shape-settings.before"
printf '%s\n' 'prompt-optimizer-runtime-v1' > "$SHAPE_RUNTIME/.prompt-optimizer-owned"
printf '%s\n' 'keep-runtime' > "$SHAPE_RUNTIME/user-sentinel"
printf '%s\n' 'keep-skill' > "$SHAPE_SKILL/user-sentinel"

HOME="$SHAPE_HOME" PROMPT_OPTIMIZER_ZIP="$ROOT" \
  bash "$ROOT/scripts/install-skill.sh" claude > "$SANDBOX/shape-install.out" 2> "$SANDBOX/shape-install.err"
shape_status=$?

if [ "$shape_status" -eq 0 ]; then
  echo 'FAIL: structurally invalid hooks unexpectedly allowed installation' >&2
  exit 1
fi
cmp -s "$SANDBOX/shape-settings.before" "$SHAPE_SETTINGS" || {
  echo 'FAIL: structurally invalid settings changed during failed installation' >&2
  exit 1
}
[ -f "$SHAPE_RUNTIME/user-sentinel" ] || {
  echo 'FAIL: late settings failure replaced the existing runtime' >&2
  exit 1
}
[ -f "$SHAPE_SKILL/user-sentinel" ] || {
  echo 'FAIL: late settings failure replaced existing skills' >&2
  exit 1
}

echo 'PASS: W5 invalid settings fail before installer changes'
