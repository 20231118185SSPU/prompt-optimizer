#!/usr/bin/env bash
set -euo pipefail

# v3.2.0-rc.1: Install optimize-prompt, align-init, and optimize-prompt-lite skills

VERSION="v3.2.0-rc.1"
RUNTIME_HOME="${PROMPT_OPTIMIZER_HOME:-$HOME}"
RUNTIME_PLAN_POINTER="$RUNTIME_HOME/.prompt-optimizer-install-plan.tsv"
TARGET="all"
REPO_ZIP="${PROMPT_OPTIMIZER_ZIP:-https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip}"
WHAT_IF=0
UNINSTALL=0
TARGET_SET=0
WIRE_HOOK=0

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
    --wire-hook)
      WIRE_HOOK=1
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

if [ -n "${PROMPT_OPTIMIZER_HOME:-}" ] && { [ "$TARGET" = "claude" ] || [ "$TARGET" = "all" ]; } && [ "$UNINSTALL" -eq 0 ]; then
  echo "PROMPT_OPTIMIZER_HOME cannot be combined with Claude installation because Claude hooks resolve runtime from HOME." >&2
  exit 2
fi

# ── Check Node.js dependency ──
if ! command -v node &> /dev/null; then
  echo "Warning: Node.js not found. TypeScript pipeline will not work."
  echo "Install Node.js from https://nodejs.org/ or use shell fallback."
fi

SKILLS=("optimize-prompt" "align-init" "optimize-prompt-lite" "align")

validate_claude_settings_file() {
  local settings="$1"
  SETTINGS="$settings" python3 - <<'PYEOF'
import json, os

settings_path = os.environ["SETTINGS"]
with open(settings_path, encoding="utf-8") as handle:
    data = json.load(handle)
if not isinstance(data, dict):
    raise ValueError("settings root must be an object")
hooks = data.get("hooks", {})
if hooks is None:
    hooks = {}
if not isinstance(hooks, dict):
    raise ValueError("settings hooks must be an object")
for event in ("UserPromptSubmit", "Stop"):
    entries = hooks.get(event, [])
    if entries is None:
        continue
    if not isinstance(entries, list):
        raise ValueError(f"hooks.{event} must be an array")
    for group in entries:
        if not isinstance(group, dict) or not isinstance(group.get("hooks"), list):
            raise ValueError(f"hooks.{event} contains an invalid group")
        for hook in group["hooks"]:
            if not isinstance(hook, dict):
                raise ValueError(f"hooks.{event} contains an invalid hook")
            if "command" in hook and hook["command"] is not None and not isinstance(hook["command"], str):
                raise ValueError(f"hooks.{event} command must be a string")
PYEOF
}

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
  CLAUDE_UNINSTALL=0
  while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
    [ -n "$SKILLS_DIR" ] || continue
    [ "$SKILLS_DIR" = "$HOME/.claude/skills" ] && CLAUDE_UNINSTALL=1
  done <<EOF
$INSTALL_TARGETS
EOF
  if [ "$WHAT_IF" -eq 0 ]; then
    SETTINGS_FILE="$HOME/.claude/settings.json"
    if [ "$CLAUDE_UNINSTALL" -eq 1 ] && [ -f "$SETTINGS_FILE" ]; then
      if ! command -v python3 >/dev/null 2>&1; then
        echo "Cannot safely uninstall Claude hooks without python3: $SETTINGS_FILE" >&2
        exit 1
      fi
      if ! validate_claude_settings_file "$SETTINGS_FILE"
      then
        echo "Invalid Claude settings; uninstall was not changed: $SETTINGS_FILE" >&2
        exit 1
      fi
    fi

    RUNTIME_DEST_REL=".prompt-optimizer"
    if [ -f "$RUNTIME_PLAN_POINTER" ]; then
      RUNTIME_DEST_REL="$(awk -F '\t' '$1 == "distribution" { print $3; exit }' "$RUNTIME_PLAN_POINTER")"
    fi
    [ -n "$RUNTIME_DEST_REL" ] || { echo "Invalid installed runtime plan: $RUNTIME_PLAN_POINTER" >&2; exit 1; }
    RUNTIME_INSTALL_DIR="$RUNTIME_HOME/$RUNTIME_DEST_REL"
    if [ -d "$RUNTIME_INSTALL_DIR" ] && { [ ! -f "$RUNTIME_INSTALL_DIR/.prompt-optimizer-owned" ] ||
       [ "$(tr -d '\r\n' < "$RUNTIME_INSTALL_DIR/.prompt-optimizer-owned")" != "prompt-optimizer-runtime-v1" ]; }; then
      echo "Refusing to remove unowned runtime directory: $RUNTIME_INSTALL_DIR" >&2
      exit 1
    fi
  fi
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
    echo 'What if: Only optimize-prompt, align-init, optimize-prompt-lite and align would be removed.'
    [ "$CLAUDE_UNINSTALL" -eq 1 ] && echo 'What if: The Claude UserPromptSubmit and Stop hooks would be removed from ~/.claude/settings.json.'
    echo 'What if: The Prompt Optimizer runtime declared by the installed plan would be removed.'
  else
    # 移除本协议安装的 hook 条目（只删自己的，其他 hooks 与字段不触碰）
    SETTINGS_FILE="$HOME/.claude/settings.json"
    if [ "$CLAUDE_UNINSTALL" -eq 1 ] && [ -f "$SETTINGS_FILE" ] && command -v python3 >/dev/null 2>&1; then
      cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak-$(date +%Y%m%d%H%M%S)"
      SETTINGS="$SETTINGS_FILE" python3 - <<'PYEOF'
import json, os, stat, tempfile

settings_path = os.environ["SETTINGS"]
ours = (
    'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_SESSION_ACTIVATION=on BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi',
    'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi',
    'if [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\\n" "[对齐] 未检测到 .align/ 运行时。请运行 /align-init 接入对齐协议后再开发。"; fi',
    'bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true',
    "bash .align/align-route.sh 2>/dev/null || cat .align/HOOK-REMINDER.txt 2>/dev/null || true",
    "cat .align/HOOK-REMINDER.txt 2>/dev/null || true",
    'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; fi',
)
with open(settings_path, encoding="utf-8") as f:
    data = json.load(f)

changed = False
for event in ("UserPromptSubmit", "Stop"):
    entries = data.get("hooks", {}).get(event, [])
    for group in entries:
        kept = [h for h in group.get("hooks", []) if h.get("command") not in ours]
        if len(kept) != len(group.get("hooks", [])):
            group["hooks"] = kept
            changed = True
    data.setdefault("hooks", {})[event] = [g for g in entries if g.get("hooks")]
    if not data["hooks"][event]:
        del data["hooks"][event]
if not data["hooks"]:
    del data["hooks"]

if changed:
    directory = os.path.dirname(settings_path) or "."
    original_mode = stat.S_IMODE(os.stat(settings_path).st_mode)
    descriptor, temporary = tempfile.mkstemp(prefix=".settings.json.", dir=directory)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.chmod(temporary, original_mode)
        os.replace(temporary, settings_path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
    print("Removed align-route hook from " + settings_path)
else:
    print("No align-route hook found in settings.json (no change).")
PYEOF
    elif [ -f "$SETTINGS_FILE" ]; then
      echo "Note: python3 not found — could not auto-remove the align-route hook."
      echo "      Remove the UserPromptSubmit and Stop entries manually from $SETTINGS_FILE."
    fi
    RUNTIME_DEST_REL=".prompt-optimizer"
    if [ -f "$RUNTIME_PLAN_POINTER" ]; then
      RUNTIME_DEST_REL="$(awk -F '\t' '$1 == "distribution" { print $3; exit }' "$RUNTIME_PLAN_POINTER")"
    fi
    [ -n "$RUNTIME_DEST_REL" ] || { echo "Invalid installed runtime plan: $RUNTIME_PLAN_POINTER" >&2; exit 1; }
    RUNTIME_INSTALL_DIR="$RUNTIME_HOME/$RUNTIME_DEST_REL"
    if [ -d "$RUNTIME_INSTALL_DIR" ]; then
      if [ ! -f "$RUNTIME_INSTALL_DIR/.prompt-optimizer-owned" ] ||
         [ "$(tr -d '\r\n' < "$RUNTIME_INSTALL_DIR/.prompt-optimizer-owned")" != "prompt-optimizer-runtime-v1" ]; then
        echo "Refusing to remove unowned runtime directory: $RUNTIME_INSTALL_DIR" >&2
        exit 1
      fi
      rm -rf "$RUNTIME_INSTALL_DIR"
      rm -f "$RUNTIME_PLAN_POINTER"
      echo "Removed Prompt Optimizer runtime from: $RUNTIME_INSTALL_DIR"
    fi
    echo 'Uninstall complete. Only optimize-prompt, align-init, optimize-prompt-lite and align were removed.'
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
  echo 'What if: Install runtime distribution according to dist/runtime/install-plan.tsv'
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

CLAUDE_INSTALLED=0
while IFS='|' read -r SKILLS_DIR ADAPTER TARGET_LABEL; do
  [ -n "$SKILLS_DIR" ] || continue
  case "$SKILLS_DIR" in
    "$HOME/.claude/skills") CLAUDE_INSTALLED=1 ;;
  esac
done <<EOF
$INSTALL_TARGETS
EOF

validate_claude_settings() {
  local settings="$HOME/.claude/settings.json"
  [ "$CLAUDE_INSTALLED" -eq 1 ] || return 0
  [ -f "$settings" ] || return 0
  command -v python3 >/dev/null 2>&1 || return 0
  if ! validate_claude_settings_file "$settings"
  then
    echo "Invalid Claude settings; installation was not changed: $settings" >&2
    return 1
  fi
}

validate_claude_settings

install_distribution() {
  local plan="$SOURCE_ROOT/dist/runtime/install-plan.tsv"
  if [ ! -f "$plan" ]; then
    echo "Invalid or missing runtime install plan: $plan" >&2
    exit 1
  fi
  local plan_line
  plan_line="$(awk -F '\t' '$1 == "distribution" { print; exit }' "$plan")"
  local plan_id source_rel destination_rel requirement
  IFS=$'\t' read -r plan_id source_rel destination_rel requirement <<EOF
$plan_line
EOF
  if [ "$plan_id" != "distribution" ] || [ -z "$source_rel" ] || [ -z "$destination_rel" ]; then
    echo "Invalid distribution entry in install plan: $plan" >&2
    exit 1
  fi
  if [ "$requirement" != "always" ]; then
    echo "Unsupported install-plan requirement: $requirement" >&2
    exit 1
  fi
  local source="$SOURCE_ROOT/dist/$source_rel"
  local destination="$RUNTIME_HOME/$destination_rel"
  if [ ! -f "$source/.prompt-optimizer-owned" ]; then
    echo "Runtime distribution lacks ownership marker: $source" >&2
    exit 1
  fi
  if [ -e "$destination" ] && { [ ! -f "$destination/.prompt-optimizer-owned" ] ||
     [ "$(tr -d '\r\n' < "$destination/.prompt-optimizer-owned")" != "prompt-optimizer-runtime-v1" ]; }; then
    echo "Refusing to replace unowned runtime directory: $destination" >&2
    exit 1
  fi
  rm -rf "$destination"
  cp -R "$source" "$destination"
  cp "$plan" "$RUNTIME_PLAN_POINTER"
  find "$destination/bin" "$destination/adapters" "$destination/runtime/shell" -type f -exec chmod +x {} + 2>/dev/null || true
  echo "Installed Prompt Optimizer runtime to: $destination"
}

install_distribution

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

# ── Claude Code hook 接线（需要 --wire-hook 明确启用；幂等：已存在则跳过）──
wire_claude_hooks() {
  local settings="$HOME/.claude/settings.json"
  local hook_cmd='if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_SESSION_ACTIVATION=on BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi'
  local old_canonical_cmd='if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi'
  local stop_hook_cmd='if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; fi'
  local old_anchored_cmd='bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true'
  local project_only_cmd='if [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 .align/ 运行时。请运行 /align-init 接入对齐协议后再开发。"; fi'
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

HOOK_CMD="$hook_cmd" STOP_HOOK_CMD="$stop_hook_cmd" OLD_CANONICAL_CMD="$old_canonical_cmd" LEGACY_CMD="$legacy_cmd" OLD_ANCHORED_CMD="$old_anchored_cmd" PROJECT_ONLY_CMD="$project_only_cmd" OLD_CMD="$old_relative_cmd" SETTINGS="$settings" python3 - <<'PYEOF'
import json, os, stat, tempfile

settings_path = os.environ["SETTINGS"]
hook_cmd = os.environ["HOOK_CMD"]
stop_hook_cmd = os.environ["STOP_HOOK_CMD"]
# 旧形态（纯提醒 hook、CWD 相对路径 hook）都识别并原地升级到锚定版
legacy = (os.environ["OLD_CANONICAL_CMD"], os.environ["LEGACY_CMD"], os.environ["OLD_ANCHORED_CMD"], os.environ["PROJECT_ONLY_CMD"], os.environ["OLD_CMD"])

data = {}
if os.path.exists(settings_path):
    with open(settings_path, encoding="utf-8") as f:
        data = json.load(f)

hooks = data.setdefault("hooks", {})
entries = hooks.setdefault("UserPromptSubmit", [])
stop_entries = hooks.setdefault("Stop", [])
changed = False

def commands(entries):
    for group in entries:
        for h in group.get("hooks", []):
            yield h

seen_hook = False
upgraded = False
deduplicated = False
normalized_entries = []

for group in entries:
    original_hooks = group.get("hooks", [])
    kept_hooks = []
    for h in original_hooks:
        command = h.get("command")
        if command in legacy:
            h["command"] = hook_cmd
            command = hook_cmd
            upgraded = True
        if command == hook_cmd:
            if seen_hook:
                deduplicated = True
                continue
            seen_hook = True
        kept_hooks.append(h)
    if not original_hooks or kept_hooks:
        if len(kept_hooks) != len(original_hooks):
            group["hooks"] = kept_hooks
        normalized_entries.append(group)
    else:
        deduplicated = True

if len(normalized_entries) != len(entries):
    entries[:] = normalized_entries

if seen_hook:
    if upgraded or deduplicated:
        print("Hook wiring: normalized owned hooks to one session-activation hook.")
        changed = True
    else:
        print("Hook wiring: already present (no change).")
else:
    entries.append({"hooks": [{"type": "command", "command": hook_cmd}]})
    print(f"Hook wiring: added UserPromptSubmit hook to {settings_path}")
    changed = True

if not any(h.get("command") == stop_hook_cmd for h in commands(stop_entries)):
    stop_entries.append({"hooks": [{"type": "command", "command": stop_hook_cmd}]})
    print(f"Hook wiring: added Stop hook to {settings_path}")
    changed = True

if changed:
    directory = os.path.dirname(settings_path) or "."
    original_mode = stat.S_IMODE(os.stat(settings_path).st_mode) if os.path.exists(settings_path) else None
    descriptor, temporary = tempfile.mkstemp(prefix=".settings.json.", dir=directory)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        if original_mode is not None:
            os.chmod(temporary, original_mode)
        os.replace(temporary, settings_path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
PYEOF
}

if [ "$CLAUDE_INSTALLED" -eq 1 ]; then
  if [ "$WIRE_HOOK" -eq 1 ]; then
    wire_claude_hooks
  else
    echo ""
    echo "Note: Claude Code hooks were NOT installed. To enable automatic alignment routing,"
    echo "  re-run with: --wire-hook"
    echo "  Or run /align setup in your project for guided hook installation."
  fi
  if [ -x "$RUNTIME_HOME/.prompt-optimizer/bin/align-doctor" ]; then
    echo
    echo 'Post-install doctor (informational; run it again from the target project after /align-init):'
    doctor_project="${CLAUDE_PROJECT_DIR:-$PWD}"
    CLAUDE_PROJECT_DIR="$doctor_project" \
      bash "$RUNTIME_HOME/.prompt-optimizer/bin/align-doctor" "$doctor_project" || true
  fi
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
echo 'Next steps:'
echo '  1. Enter your project directory: cd your-project'
echo '  2. Run: /align-init'
echo '  3. Check wiring: bash "$HOME/.prompt-optimizer/bin/align-doctor" --json "$PWD"'
echo
echo 'Installed: optimize-prompt (main entry), align-init (project setup), optimize-prompt-lite (weak models)'
echo 'Claude Code is the reference host. Other hosts use the same Alignment Decision with reduced enforcement.'
