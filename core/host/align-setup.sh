#!/usr/bin/env bash
# align-setup.sh — Deterministic setup operations for /align setup
# Usage: align-setup.sh <command> [options]
#
# Commands:
#   detect-host     Detect current agent/host environment
#   detect-caps     Detect host capabilities
#   preview         Show what will be installed/changed
#   backup          Backup existing configuration
#   generate        Generate .align/ directory files
#   wire            Install hooks
#   mount           Inject mount area into host rules file
#   verify          Run doctor to verify installation
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUNTIME="$INSTALL_ROOT/runtime/index.js"
NODE_COMMAND="${ALIGN_NODE_COMMAND:-node}"

# Output helpers
json_get() {
  local json="$1" key="$2"
  printf '%s' "$json" | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" | head -1
}

# ── detect-host ──
cmd_detect_host() {
  local project_dir="${1:-$(pwd)}"
  local host_name="unknown"
  local host_version=""
  local config_path=""
  local prompt_ingress="unsupported"
  local mechanical_block="unsupported"
  local completion_event="unsupported"
  local config_scope="unknown"
  local explicit_invocation="supported"

  # Detect Claude Code
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ] || [ -f "$HOME/.claude/settings.json" ]; then
    host_name="claude-code"
    config_path="$HOME/.claude/settings.json"
    prompt_ingress="supported"
    mechanical_block="supported"
    completion_event="supported"
    config_scope="user+project"
  # Detect Codex
  elif [ -n "${CODEX_HOME:-}" ] || [ -f "$HOME/.codex/config.json" ] || [ -f "$HOME/.codex/config.toml" ]; then
    host_name="codex"
    config_path="${CODEX_HOME:-$HOME/.codex}"
    prompt_ingress="unsupported"
    mechanical_block="advisory"
    completion_event="unsupported"
    config_scope="user"
  # Detect Cursor
  elif [ -d "$project_dir/.cursor" ] || [ -f "$HOME/.cursor/settings.json" ]; then
    host_name="cursor"
    config_path="$project_dir/.cursor/rules"
    prompt_ingress="project-rule"
    mechanical_block="unsupported"
    completion_event="unsupported"
    config_scope="project"
  else
    host_name="generic"
    config_path=""
    config_scope="none"
  fi

  cat <<EOF
{
  "host": "$host_name",
  "version": "$host_version",
  "configPath": "$config_path",
  "capabilities": {
    "promptIngress": "$prompt_ingress",
    "mechanicalBlock": "$mechanical_block",
    "completionEvent": "$completion_event",
    "configScope": "$config_scope",
    "explicitInvocation": "$explicit_invocation"
  }
}
EOF
}

# ── detect-caps ──
cmd_detect_caps() {
  local project_dir="${1:-$(pwd)}"
  local doctor_output

  if [ -f "$INSTALL_ROOT/bin/align-doctor" ]; then
    doctor_output=$(bash "$INSTALL_ROOT/bin/align-doctor" --json "$project_dir" 2>/dev/null || echo '{}')
  else
    doctor_output='{"node":"missing","runtime":"missing","projectRouter":"not_connected","projectContext":"missing","verificationChain":"missing","hook":{"userPromptSubmit":"missing","stop":"missing"},"completionChain":"missing","hosts":{"claude-code":{"level":"L1","ingress":"advisory","block":"unavailable","completion":"unavailable"},"codex":{"level":"L1","ingress":"advisory","block":"unavailable"}}}'
  fi

  printf '%s\n' "$doctor_output"
}

# ── preview ──
cmd_preview() {
  local project_dir="${1:-$(pwd)}"
  local changes=""
  local changes_count=0

  # Check .align/ directory
  if [ ! -d "$project_dir/.align" ]; then
    changes="$changes\n  + .align/ directory (spec.md, facts.md, glossary.md, state.md, lessons.md, decisions.log.md)"
    changes="$changes\n  + .align/align-route.sh, .align/align-check.sh"
    changes="$changes\n  + .align/check-commands.txt"
    changes="$changes\n  + .align/HOOK-REMINDER.txt"
    changes_count=$((changes_count + 4))
  else
    changes="$changes\n  ~ .align/ directory (incremental update)"
    changes_count=$((changes_count + 1))
  fi

  # Check CLAUDE.md
  if [ -f "$project_dir/CLAUDE.md" ]; then
    if grep -q 'align-protocol:begin' "$project_dir/CLAUDE.md" 2>/dev/null; then
      changes="$changes\n  ~ CLAUDE.md (upgrade mount area)"
    else
      changes="$changes\n  ~ CLAUDE.md (append mount area)"
    fi
    changes_count=$((changes_count + 1))
  else
    changes="$changes\n  + CLAUDE.md (create with mount area)"
    changes_count=$((changes_count + 1))
  fi

  # Check AGENTS.md
  if [ -f "$project_dir/AGENTS.md" ]; then
    if grep -q 'align-protocol:begin' "$project_dir/AGENTS.md" 2>/dev/null; then
      changes="$changes\n  ~ AGENTS.md (upgrade mount area)"
    else
      changes="$changes\n  ~ AGENTS.md (append mount area)"
    fi
    changes_count=$((changes_count + 1))
  else
    changes="$changes\n  + AGENTS.md (create with mount area)"
    changes_count=$((changes_count + 1))
  fi

  # Check Claude settings
  local settings="$HOME/.claude/settings.json"
  if [ -f "$settings" ]; then
    if grep -q 'UserPromptSubmit' "$settings" 2>/dev/null; then
      changes="$changes\n  ~ ~/.claude/settings.json (verify/update hook)"
    else
      changes="$changes\n  ~ ~/.claude/settings.json (add UserPromptSubmit hook)"
    fi
    changes_count=$((changes_count + 1))
  fi

  cat <<EOF
{
  "projectDir": "$project_dir",
  "changesCount": $changes_count,
  "changes": "$(printf '%b' "$changes")"
}
EOF
}

# ── backup ──
cmd_backup() {
  local project_dir="${1:-$(pwd)}"
  local backup_dir="$project_dir/.align/backup-$(date +%Y%m%d%H%M%S)"
  local backed_up=0

  mkdir -p "$backup_dir"

  # Backup CLAUDE.md
  if [ -f "$project_dir/CLAUDE.md" ]; then
    cp "$project_dir/CLAUDE.md" "$backup_dir/CLAUDE.md"
    backed_up=$((backed_up + 1))
  fi

  # Backup AGENTS.md
  if [ -f "$project_dir/AGENTS.md" ]; then
    cp "$project_dir/AGENTS.md" "$backup_dir/AGENTS.md"
    backed_up=$((backed_up + 1))
  fi

  # Backup .cursor/rules/align.mdc
  if [ -f "$project_dir/.cursor/rules/align.mdc" ]; then
    mkdir -p "$backup_dir/.cursor/rules"
    cp "$project_dir/.cursor/rules/align.mdc" "$backup_dir/.cursor/rules/align.mdc"
    backed_up=$((backed_up + 1))
  fi

  cat <<EOF
{
  "backupDir": "$backup_dir",
  "filesBackedUp": $backed_up
}
EOF
}

# ── generate ──
cmd_generate() {
  local project_dir="${1:-$(pwd)}"

  mkdir -p "$project_dir/.align"

  # Copy scripts from install root
  if [ -f "$INSTALL_ROOT/runtime/shell/align-route.sh" ]; then
    cp "$INSTALL_ROOT/runtime/shell/align-route.sh" "$project_dir/.align/align-route.sh"
  elif [ -f "$SCRIPT_DIR/align-route.sh" ]; then
    cp "$SCRIPT_DIR/align-route.sh" "$project_dir/.align/align-route.sh"
  fi

  if [ -f "$SCRIPT_DIR/align-check.sh" ]; then
    cp "$SCRIPT_DIR/align-check.sh" "$project_dir/.align/align-check.sh"
  fi

  # Generate HOOK-REMINDER.txt
  cat > "$project_dir/.align/HOOK-REMINDER.txt" <<'HOOKEOF'
[Alignment Protocol] 本条指令须先过三档路由评估。
读取 .align/lessons.md → spec.md → facts.md / glossary.md / state.md；三个分类文件未齐全时同时读取 context.md，全部缺失时只读 legacy。
简单明确→直通；有缺口→补全回执后执行；高风险信息不足/总分<6→澄清，授权/政策/baseline 阻断→停止，契约与授权完整→补全回执后执行。
交付前必须自验证（R8 验证门不可跳过）。
HOOKEOF

  # Generate stub files if they don't exist
  for f in spec.md facts.md glossary.md state.md lessons.md decisions.log.md; do
    if [ ! -f "$project_dir/.align/$f" ]; then
      touch "$project_dir/.align/$f"
    fi
  done

  # Generate check-commands.txt stub
  if [ ! -f "$project_dir/.align/check-commands.txt" ]; then
    cat > "$project_dir/.align/check-commands.txt" <<'CHECKEOF'
# 待补：项目验证命令
CHECKEOF
  fi

  cat <<EOF
{
  "projectDir": "$project_dir",
  "generated": true
}
EOF
}

# ── wire ──
cmd_wire() {
  local project_dir="${1:-$(pwd)}"
  local settings="$HOME/.claude/settings.json"

  if [ ! -f "$settings" ]; then
    cat <<EOF
{
  "wired": false,
  "reason": "Claude settings file not found: $settings"
}
EOF
    return 1
  fi

  # Check if already wired
  if [ -f "$INSTALL_ROOT/bin/align-doctor" ]; then
    local hook_status
    hook_status=$(bash "$INSTALL_ROOT/bin/align-doctor" --json "$project_dir" 2>/dev/null | grep -o '"userPromptSubmit":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ "$hook_status" = "ready" ]; then
      cat <<EOF
{
  "wired": true,
  "reason": "Hook already installed",
  "settingsPath": "$settings"
}
EOF
      return 0
    fi
  fi

  # Backup settings before modification
  cp "$settings" "$settings.bak-$(date +%Y%m%d%H%M%S)"

  cat <<EOF
{
  "wired": false,
  "reason": "Hook installation requires user confirmation. Use installer script.",
  "settingsPath": "$settings",
  "backupCreated": true
}
EOF
  return 0
}

# ── mount ──
cmd_mount() {
  local project_dir="${1:-$(pwd)}"
  local target_file="${2:-CLAUDE.md}"
  local full_path="$project_dir/$target_file"
  local mount_version="v4.0"

  local mount_content
  mount_content=$(cat <<'MOUNTEOF'
<!-- align-protocol:begin v4.0 -->
## 对齐协议（Alignment Protocol）

默认模式：显式调用。每个新会话使用 `/align <请求>` 触发意图对齐；未显式调用时按宿主默认行为处理，禁止把普通消息视为自动对齐入口。

已显式 `--wire-hook` 且当前会话已 `/align` 的 Claude Code，后续普通请求可由 hook 持续进入同一对齐路径；新会话必须重新激活。Codex、Cursor 和未激活会话保持显式调用。

显式入口或已激活 hook 进入时：

1. 读取 `.align/lessons.md → spec.md → facts.md / glossary.md / state.md`；三个分类文件未齐全时同时读取 `context.md`，全部缺失时只读 legacy
2. 五维快评：简单且明确 → 直接执行（但交付前必须自验证）
3. 有缺口但项目上下文可补全 → 开头展示 ≤3 行补全回执（补全内容 + 来源 + `撤销补全 <ID>`），然后直接执行
   收到撤销口令时停止沿用指定项，回到原始请求重新分析；已产生改动则先报告，未经确认不自动回滚
4. 高风险（见 .align/spec.md 高风险清单）或总分<6 或假设>2 条
   → 停下澄清，一次只问一个问题并给推荐答案
5. 任务结束：有踩坑/纠正/新约定 → 追加到 .align/lessons.md

硬性红线：高风险静默假设 = 无效输出；交付前不验证 = 无效输出。
<!-- align-protocol:end -->
MOUNTEOF
)

  local action="none"

  if [ ! -f "$full_path" ]; then
    # File doesn't exist, create it
    printf '%s\n' "$mount_content" > "$full_path"
    action="created"
  elif grep -q 'align-protocol:begin' "$full_path" 2>/dev/null; then
    # File has existing mount, check version
    if grep -q "align-protocol:begin $mount_version" "$full_path" 2>/dev/null; then
      action="already_current"
    else
      # Upgrade: replace between markers
      local tmp="$full_path.tmp.$$"
      awk -v mount="$mount_content" '
        BEGIN { printing=1 }
        /<!-- align-protocol:begin/ { printing=0; printf "%s\n", mount; next }
        /<!-- align-protocol:end/ { printing=1; next }
        printing { print }
      ' "$full_path" > "$tmp"
      mv "$tmp" "$full_path"
      action="upgraded"
    fi
  else
    # File exists but no mount, append
    printf '\n%s\n' "$mount_content" >> "$full_path"
    action="appended"
  fi

  cat <<EOF
{
  "file": "$target_file",
  "action": "$action",
  "version": "$mount_version"
}
EOF
}

# ── verify ──
cmd_verify() {
  local project_dir="${1:-$(pwd)}"

  if [ -f "$INSTALL_ROOT/bin/align-doctor" ]; then
    bash "$INSTALL_ROOT/bin/align-doctor" --json "$project_dir"
  else
    echo '{"error": "doctor not found"}'
    return 1
  fi
}

# ── Main dispatch ──
case "${1:-help}" in
  detect-host)
    shift
    cmd_detect_host "$@"
    ;;
  detect-caps)
    shift
    cmd_detect_caps "$@"
    ;;
  preview)
    shift
    cmd_preview "$@"
    ;;
  backup)
    shift
    cmd_backup "$@"
    ;;
  generate)
    shift
    cmd_generate "$@"
    ;;
  wire)
    shift
    cmd_wire "$@"
    ;;
  mount)
    shift
    cmd_mount "$@"
    ;;
  verify)
    shift
    cmd_verify "$@"
    ;;
  help|--help|-h)
    cat <<'HELPEOF'
align-setup.sh — Deterministic setup operations for /align setup

Commands:
  detect-host [dir]   Detect current agent/host environment
  detect-caps [dir]   Detect host capabilities (runs doctor)
  preview [dir]       Show what will be installed/changed
  backup [dir]        Backup existing configuration
  generate [dir]      Generate .align/ directory files
  wire [dir]          Check hook wiring status
  mount [dir] [file]  Inject mount area into host rules file
  verify [dir]        Run doctor to verify installation

All commands output JSON. Default project directory is current directory.
HELPEOF
    ;;
  *)
    echo "Unknown command: $1" >&2
    echo "Run: align-setup.sh help" >&2
    exit 1
    ;;
esac
