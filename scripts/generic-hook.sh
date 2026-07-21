#!/usr/bin/env bash
# generic-hook.sh — 通用 Claude Code hook 入口脚本
# 自动检测项目根目录，查找 .align/ 目录，调用核心路由引擎
# 如果 .align/ 不存在或未配置，静默退出（不干扰无 hook 项目）
set -u

# ── 递归防护 ──
if [ -n "${ALIGN_ROUTE_INNER:-}" ]; then
  exit 0
fi

# ── 定位项目根目录 ──
# 优先级：CLAUDE_PROJECT_DIR > 脚本所在目录的父目录 > 当前目录
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "$CLAUDE_PROJECT_DIR" ]; then
  PROJECT_ROOT="$CLAUDE_PROJECT_DIR"
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd)"
fi
[ -n "$PROJECT_ROOT" ] || PROJECT_ROOT="$(pwd)"

# ── 查找 .align 目录 ──
ALIGN_DIR="$PROJECT_ROOT/.align"
if [ ! -d "$ALIGN_DIR" ]; then
  # .align 不存在，静默退出
  exit 0
fi

# ── 查找路由引擎 ──
# 优先级：项目内 scripts/hook-router.sh > 全局 ~/.prompt-optimizer/runtime/shell/align-route.sh
ROUTER=""
if [ -f "$PROJECT_ROOT/scripts/hook-router.sh" ]; then
  ROUTER="$PROJECT_ROOT/scripts/hook-router.sh"
elif [ -f "$ALIGN_DIR/hook-router.sh" ]; then
  ROUTER="$ALIGN_DIR/hook-router.sh"
elif [ -f "$HOME/.prompt-optimizer/runtime/shell/align-route.sh" ]; then
  ROUTER="$HOME/.prompt-optimizer/runtime/shell/align-route.sh"
fi

if [ -z "$ROUTER" ] || [ ! -f "$ROUTER" ]; then
  # 路由引擎不存在，静默退出
  exit 0
fi

# ── 调用路由引擎 ──
export ALIGN_DIR
export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"
exec bash "$ROUTER"
