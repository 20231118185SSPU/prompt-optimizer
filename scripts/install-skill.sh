#!/usr/bin/env bash
set -euo pipefail

# v3.1: Install optimize-prompt, align-init, and optimize-prompt-lite skills

VERSION="v3.1"
TARGET="all"
REPO_ZIP="${PROMPT_OPTIMIZER_ZIP:-https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip}"
WHAT_IF=0
UNINSTALL=0
TARGET_SET=0

for arg in "$@"; do
  case "$arg" in
    --version|-version)
      echo "prompt-optimizer installer $VERSION"
      exit 0
      ;;
    --what-if|--dry-run|-WhatIf)
      WHAT_IF=1
      ;;
    --uninstall|-uninstall)
      UNINSTALL=1
      ;;
    claude|codex|agents|all)
      if [ "$TARGET_SET" -eq 1 ]; then
        echo "Only one target may be specified." >&2
        exit 2
      fi
      TARGET="$arg"
      TARGET_SET=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

# ── Check Node.js dependency ──
if ! command -v node &> /dev/null; then
  echo "Warning: Node.js not found. TypeScript pipeline will not work."
  echo "Install Node.js from https://nodejs.org/ or use shell fallback."
fi

SKILLS=("optimize-prompt" "align-init" "optimize-prompt-lite")

resolve_install_targets() {
  case "$TARGET" in
    claude)
      printf '%s|%s|%s\n' "$HOME/.claude/skills" "claude-code" "Claude Code"
      return
      ;;
    codex)
      printf '%s|%s|%s\n' "${CODEX_HOME:-$HOME/.codex}/skills" "codex" "Codex"
      return
      ;;
    agents)
      printf '%s|%s|%s\n' "$HOME/.agents/skills" "claude-code" "agents-style"
      return
      ;;
    all)
      if [ -n "${CODEX_HOME:-}" ]; then
        printf '%s|%s|%s\n' "$CODEX_HOME/skills" "codex" "Codex"
      else
        printf '%s|%s|%s\n' "$HOME/.codex/skills" "codex" "Codex"
      fi
      printf '%s|%s|%s\n' "$HOME/.claude/skills" "claude-code" "Claude Code"
      printf '%s|%s|%s\n' "$HOME/.agents/skills" "claude-code" "agents-style"
      return
      ;;
  esac
}

if [ -n "${PROMPT_OPTIMIZER_SKILLS_DIR:-}" ]; then
  CUSTOM_ADAPTER="claude-code"
  if [ "$TARGET" = "codex" ]; then
    CUSTOM_ADAPTER="codex"
  fi
  INSTALL_TARGETS="$PROMPT_OPTIMIZER_SKILLS_DIR|$CUSTOM_ADAPTER|custom"
else
  INSTALL_TARGETS="$(resolve_install_targets)"
fi

if [ "$UNINSTALL" -eq 1 ]; then
  while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
    [ -n "$SKILLS_DIR" ] || continue
    for SKILL in "${SKILLS[@]}"; do
      INSTALL_DIR="$SKILLS_DIR/$SKILL"
      if [ "$WHAT_IF" -eq 1 ]; then
        echo "What if: Remove $SKILL skill from: $INSTALL_DIR (if present)"
      elif [ -d "$INSTALL_DIR" ]; then
        case "$INSTALL_DIR" in
          */skills/*) ;;
          *) echo "Refusing to rm: $INSTALL_DIR does not match */skills/*" >&2; exit 1 ;;
        esac
        rm -rf "$INSTALL_DIR"
        echo "Removed $SKILL skill from: $INSTALL_DIR"
      fi
    done
  done <<EOF
$INSTALL_TARGETS
EOF
  echo
  if [ "$WHAT_IF" -eq 1 ]; then
    echo 'What if: Only optimize-prompt, align-init and optimize-prompt-lite would be removed.'
    echo 'What if: The align-route hook would be removed from ~/.claude/settings.json.'
  else
    # 移除本协议安装的 hook 条目（只删自己的，其他 hooks 与字段不触碰）
    SETTINGS_FILE="$HOME/.claude/settings.json"
    if [ -f "$SETTINGS_FILE" ] && command -v python3 >/dev/null 2>&1; then
      SETTINGS="$SETTINGS_FILE" python3 - <<'PYEOF'
import json, os

settings_path = os.environ["SETTINGS"]
ours = (
    'bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true',
    "bash .align/align-route.sh 2>/dev/null || cat .align/HOOK-REMINDER.txt 2>/dev/null || true",
    "cat .align/HOOK-REMINDER.txt 2>/dev/null || true",
)
with open(settings_path, encoding="utf-8") as f:
    data = json.load(f)

entries = data.get("hooks", {}).get("UserPromptSubmit", [])
changed = False
for group in entries:
    kept = [h for h in group.get("hooks", []) if h.get("command") not in ours]
    if len(kept) != len(group.get("hooks", [])):
        group["hooks"] = kept
        changed = True
data.setdefault("hooks", {})["UserPromptSubmit"] = [g for g in entries if g.get("hooks")]
if not data["hooks"]["UserPromptSubmit"]:
    del data["hooks"]["UserPromptSubmit"]
if not data["hooks"]:
    del data["hooks"]

if changed:
    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Removed align-route hook from " + settings_path)
else:
    print("No align-route hook found in settings.json (no change).")
PYEOF
    elif [ -f "$SETTINGS_FILE" ]; then
      echo "Note: python3 not found — could not auto-remove the align-route hook."
      echo "      Remove the UserPromptSubmit entry manually from $SETTINGS_FILE."
    fi
    echo 'Uninstall complete. Only optimize-prompt, align-init and optimize-prompt-lite were removed.'
  fi
  echo 'Other skills and user content were not touched.'
  exit 0
fi

if [ "$WHAT_IF" -eq 1 ]; then
  while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
    [ -n "$SKILLS_DIR" ] || continue
    for SKILL in "${SKILLS[@]}"; do
      echo "What if: Install $SKILL skill to: $SKILLS_DIR/$SKILL (source: dist/$ADAPTER)"
    done
  done <<EOF
$INSTALL_TARGETS
EOF
  echo
  echo 'What if: Skills would be downloaded from' "$REPO_ZIP"
  echo 'Note: ~/.agents/skills uses the dist/claude-code package because agents-style tools consume the Claude-compatible skill layout.'
  exit 0
fi

TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ -d "$REPO_ZIP" ]; then
  SOURCE_ROOT="$REPO_ZIP"
else
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$REPO_ZIP" -o "$TMP_DIR/repo.zip"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$REPO_ZIP" -O "$TMP_DIR/repo.zip"
  else
    echo "curl or wget is required to download the skill archive." >&2
    exit 1
  fi

  unzip -q "$TMP_DIR/repo.zip" -d "$TMP_DIR/repo"
  DIST_ROOT="$(find "$TMP_DIR/repo" -path '*/dist' -type d -print -quit)"

  if [ -z "$DIST_ROOT" ]; then
    echo "Could not find dist directory in downloaded archive." >&2
    exit 1
  fi

  SOURCE_ROOT="$(dirname "$DIST_ROOT")"
fi

VALIDATED_ADAPTERS=""

validate_adapter() {
  local adapter="$1"
  local dist_source="$SOURCE_ROOT/dist/$adapter"
  local skill

  case " $VALIDATED_ADAPTERS " in
    *" $adapter "*) return ;;
  esac

  if [ ! -d "$dist_source" ]; then
    echo "Could not find dist/$adapter directory." >&2
    exit 1
  fi

  for skill in "${SKILLS[@]}"; do
    if [ ! -f "$dist_source/$skill/SKILL.md" ]; then
      echo "Could not find dist/$adapter/$skill/SKILL.md." >&2
      exit 1
    fi
  done

  VALIDATED_ADAPTERS="$VALIDATED_ADAPTERS $adapter"
}

while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
  [ -n "$SKILLS_DIR" ] || continue
  validate_adapter "$ADAPTER"
done <<EOF
$INSTALL_TARGETS
EOF

while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
  [ -n "$SKILLS_DIR" ] || continue
  DIST_SOURCE="$SOURCE_ROOT/dist/$ADAPTER"
  for SKILL in "${SKILLS[@]}"; do
    INSTALL_DIR="$SKILLS_DIR/$SKILL"
    mkdir -p "$SKILLS_DIR"
    rm -rf "$INSTALL_DIR"
    cp -R "$DIST_SOURCE/$SKILL" "$INSTALL_DIR"
    echo "Installed $SKILL skill to: $INSTALL_DIR (source: dist/$ADAPTER)"
  done
done <<EOF
$INSTALL_TARGETS
EOF

# ── Claude Code hook 自动接线（幂等：已存在则跳过；只增不删既有字段）──
wire_claude_hooks() {
  local settings="$HOME/.claude/settings.json"
  local hook_cmd='bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true'
  local legacy_cmd='cat .align/HOOK-REMINDER.txt 2>/dev/null || true'
  local old_relative_cmd='bash .align/align-route.sh 2>/dev/null || cat .align/HOOK-REMINDER.txt 2>/dev/null || true'

  if ! command -v python3 >/dev/null 2>&1; then
    echo "Note: python3 not found — skipped hook wiring."
    echo "      Merge dist/claude-code/hooks/settings.fragment.json into $settings manually."
    return 0
  fi

  mkdir -p "$HOME/.claude"
  if [ -f "$settings" ]; then
    cp "$settings" "$settings.bak-$(date +%Y%m%d%H%M%S)"
  fi

  HOOK_CMD="$hook_cmd" LEGACY_CMD="$legacy_cmd" OLD_CMD="$old_relative_cmd" SETTINGS="$settings" python3 - <<'PYEOF'
import json, os

settings_path = os.environ["SETTINGS"]
hook_cmd = os.environ["HOOK_CMD"]
# 旧形态（纯提醒 hook、CWD 相对路径 hook）都识别并原地升级到锚定版
legacy = (os.environ["LEGACY_CMD"], os.environ["OLD_CMD"])

data = {}
if os.path.exists(settings_path):
    with open(settings_path, encoding="utf-8") as f:
        data = json.load(f)

hooks = data.setdefault("hooks", {})
entries = hooks.setdefault("UserPromptSubmit", [])

def commands(entries):
    for group in entries:
        for h in group.get("hooks", []):
            yield h

if any(h.get("command") == hook_cmd for h in commands(entries)):
    print("Hook wiring: already present (no change).")
else:
    upgraded = False
    for h in commands(entries):
        if h.get("command") in legacy:
            h["command"] = hook_cmd
            upgraded = True
    if upgraded:
        print("Hook wiring: upgraded existing hook to project-anchored align-route.")
    else:
        entries.append({"hooks": [{"type": "command", "command": hook_cmd}]})
        print(f"Hook wiring: added UserPromptSubmit hook to {settings_path}")
    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
PYEOF
}

CLAUDE_INSTALLED=0
while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
  [ -n "$SKILLS_DIR" ] || continue
  case "$SKILLS_DIR" in
    "$HOME/.claude/skills") CLAUDE_INSTALLED=1 ;;
  esac
done <<EOF
$INSTALL_TARGETS
EOF

if [ "$CLAUDE_INSTALLED" -eq 1 ]; then
  wire_claude_hooks
fi

# ── 复制 hooks/ 脚本到全局目录（align-init 从此处复制到项目 .align/）──
copy_hooks_scripts() {
  local hooks_source="$SOURCE_ROOT/dist/claude-code/hooks"
  [ -d "$hooks_source" ] || return 0
  while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
    [ -n "$SKILLS_DIR" ] || continue
    local hooks_dest=""
    case "$SKILLS_DIR" in
      "$HOME/.claude/skills") hooks_dest="$HOME/.claude/hooks" ;;
      "$HOME/.agents/skills") hooks_dest="$HOME/.agents/hooks" ;;
    esac
    if [ -n "$hooks_dest" ]; then
      mkdir -p "$hooks_dest"
      for hf in align-route.sh align-check.sh HOOK-REMINDER.txt settings.fragment.json project-settings.fragment.json; do
        [ -f "$hooks_source/$hf" ] && cp -f "$hooks_source/$hf" "$hooks_dest/$hf"
      done
      echo "Copied hooks scripts to: $hooks_dest"
    fi
  done <<EOF
$INSTALL_TARGETS
EOF
}
copy_hooks_scripts

echo
echo 'Installed skills: optimize-prompt, align-init, optimize-prompt-lite'
echo 'Use optimize-prompt with: $optimize-prompt optimize: your rough idea'
echo 'Use align-init with: /align-init (in your project directory)'
echo 'Claude Code also supports: /optimize-prompt and /align-init'
echo 'Note: ~/.agents/skills uses the dist/claude-code package because agents-style tools consume the Claude-compatible skill layout.'
