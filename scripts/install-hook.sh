#!/usr/bin/env bash
# install-hook.sh — 一键安装通用 hook 到 Claude Code 项目
# 用法：
#   install-hook.sh [项目目录]     # 安装 hook
#   install-hook.sh --uninstall    # 卸载 hook
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${1:-.}"
if [ "$PROJECT_DIR" = "--uninstall" ]; then
  UNINSTALL=1
  PROJECT_DIR="${2:-.}"
else
  UNINSTALL=0
fi

PROJECT_DIR="$(cd "$PROJECT_DIR" 2>/dev/null && pwd)" || {
  echo "错误：无法访问项目目录 '$PROJECT_DIR'" >&2
  exit 1
}

SETTINGS_FILE="$PROJECT_DIR/.claude/settings.json"
HOOK_COMMAND='if [ -f "$PROJECT_ROOT/scripts/generic-hook.sh" ]; then bash "$PROJECT_ROOT/scripts/generic-hook.sh"; elif [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 .align/ 运行时。请运行 /align-init 接入对齐协议后再开发。"; fi'
STOP_COMMAND='if [ -f "$PROJECT_ROOT/scripts/generic-hook.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$PROJECT_ROOT/scripts/generic-hook.sh"; elif [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; fi'

# ── 检查 jq 可用性 ──
if ! command -v jq >/dev/null 2>&1; then
  echo "错误：需要 jq 来修改 JSON 文件" >&2
  echo "请安装 jq：https://stedolan.github.io/jq/download/" >&2
  exit 1
fi

# ── 卸载模式 ──
if [ "$UNINSTALL" -eq 1 ]; then
  if [ ! -f "$SETTINGS_FILE" ]; then
    echo "未找到 $SETTINGS_FILE，无需卸载"
    exit 0
  fi

  # 备份
  cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak-$(date +%Y%m%d%H%M%S)"

  # 移除 hook
  jq --arg cmd "$HOOK_COMMAND" '
    .hooks.UserPromptSubmit //= [] |
    .hooks.UserPromptSubmit |= map(
      .hooks |= map(select(.command != $cmd))
    ) |
    .hooks.UserPromptSubmit |= map(select(.hooks | length > 0))
  ' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp" && mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"

  echo "已从 $SETTINGS_FILE 移除 hook"
  exit 0
fi

# ── 安装模式 ──
mkdir -p "$PROJECT_DIR/.claude"

# 如果 settings.json 不存在，创建默认结构
if [ ! -f "$SETTINGS_FILE" ]; then
  cat > "$SETTINGS_FILE" << 'EOF'
{
  "hooks": {
    "UserPromptSubmit": [],
    "Stop": []
  }
}
EOF
  echo "创建 $SETTINGS_FILE"
fi

# 备份
cp "$SETTINGS_FILE" "$SETTINGS_FILE.bak-$(date +%Y%m%d%H%M%S)"

# 检查是否已安装
if jq -e --arg cmd "$HOOK_COMMAND" '
  .hooks.UserPromptSubmit[]?.hooks[]? | select(.command == $cmd)
' "$SETTINGS_FILE" >/dev/null 2>&1; then
  echo "Hook 已安装，跳过"
  exit 0
fi

# 添加 hook
jq --arg cmd "$HOOK_COMMAND" --arg stop_cmd "$STOP_COMMAND" '
  .hooks.UserPromptSubmit //= [] |
  .hooks.Stop //= [] |
  .hooks.UserPromptSubmit += [{"hooks": [{"type": "command", "command": $cmd}]}] |
  .hooks.Stop += [{"hooks": [{"type": "command", "command": $stop_cmd}]}]
' "$SETTINGS_FILE" > "$SETTINGS_FILE.tmp" && mv "$SETTINGS_FILE.tmp" "$SETTINGS_FILE"

echo "已安装 hook 到 $SETTINGS_FILE"
echo ""
echo "安装内容："
echo "  - UserPromptSubmit: 通用路由引擎"
echo "  - Stop: 任务结束收尾"
echo ""
echo "使用方式："
echo "  1. 在项目中创建 .align/ 目录（运行 /align-init）"
echo "  2. 配置 .align/route.conf（可选）"
echo "  3. 正常开发，hook 会自动运行"
