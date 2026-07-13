#!/usr/bin/env bash
# claude-code.sh — Claude Code hook adapter for align-pipeline
# Reads hook JSON from stdin, calls align-cli, outputs hook response
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIPELINE_DIR="$(cd "$SCRIPT_DIR/../../" && pwd)"
if [ -f "$PIPELINE_DIR/dist/index.js" ]; then
  RUNTIME="$PIPELINE_DIR/dist/index.js"
  SHELL_ROUTER="$PIPELINE_DIR/../align-route.sh"
else
  INSTALL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  RUNTIME="$INSTALL_ROOT/runtime/index.js"
  SHELL_ROUTER="$INSTALL_ROOT/runtime/shell/align-route.sh"
fi
NODE_COMMAND="${ALIGN_NODE_COMMAND:-node}"
RAW="$(cat 2>/dev/null || true)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

run_shell_fallback() {
  if [ -f "$SHELL_ROUTER" ]; then
    context_refs=""
    if [ -f "$PROJECT_DIR/.align/spec.md" ] || [ -f "$PROJECT_DIR/.align/context.md" ]; then
      context_refs="project:.align/spec.md"
    fi
    printf '%s' "$RAW" | ALIGN_CONTEXT_REFS="$context_refs" bash "$SHELL_ROUTER"
  elif [ -f "$PIPELINE_DIR/../../.align/HOOK-REMINDER.txt" ]; then
    cat "$PIPELINE_DIR/../../.align/HOOK-REMINDER.txt"
  else
    echo "[对齐] 未检测到 .align/ 运行时。请运行 /align-init 接入对齐协议后再开发。"
  fi
}

# ── 递归防护：hook 内调用 claude -p 时，子进程再触发本 hook 直接退出 ──
if [ -n "${ALIGN_ROUTE_INNER:-}" ]; then
  exit 0
fi

# ALIGN_BYPASS is a legacy presentation preference; routing still runs.

# Check if Node.js is available
if ! command -v "$NODE_COMMAND" &> /dev/null; then
  echo "[对齐] Warning: Node.js not found, falling back to shell router"
  run_shell_fallback
  exit 0
fi

# ── 输入提取：python3 → jq → sed 降级（与 align-route.sh 保持一致）──
PROMPT=""
if command -v python3 &> /dev/null; then
  PROMPT="$(printf '%s' "$RAW" | PYTHONIOENCODING=utf-8 python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("prompt",""))
except Exception: pass' 2>/dev/null || true)"
fi

if [ -z "$PROMPT" ] && command -v jq &> /dev/null; then
  PROMPT="$(printf '%s' "$RAW" | jq -r '.prompt // empty' 2>/dev/null || true)"
fi

if [ -z "$PROMPT" ]; then
  PROMPT="$(printf '%s' "$RAW" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
fi

# 仅当输入不像 JSON（纯文本）才整体兜底；绝不拿 JSON 元数据去分类
if [ -z "$PROMPT" ]; then
  case "$RAW" in
    '{'*|*'"prompt"'*) PROMPT="" ;;
    *) PROMPT="$RAW" ;;
  esac
fi

if [ -z "$PROMPT" ]; then
  echo "[对齐] Could not extract prompt from hook input"
  exit 0
fi

# Call align-cli (safe: pass args positionally, not interpolated)
TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"
ALIGN_CMD='"$1" "$2" claude-code "$3" --project-dir "$4"'

if [ -n "$TIMEOUT_BIN" ]; then
  set +e
  RESULT="$(ALIGN_ROUTE_INNER=1 "$TIMEOUT_BIN" 30 bash -c "$ALIGN_CMD" _ "$NODE_COMMAND" "$RUNTIME" "$PROMPT" "$PROJECT_DIR")"
  STATUS=$?
  set -e
else
  set +e
  RESULT="$(ALIGN_ROUTE_INNER=1 bash -c "$ALIGN_CMD" _ "$NODE_COMMAND" "$RUNTIME" "$PROMPT" "$PROJECT_DIR")"
  STATUS=$?
  set -e
fi

if [ "$STATUS" -eq 2 ]; then
  [ -n "$RESULT" ] && printf '%s\n' "$RESULT" >&2
  exit 2
fi

if [ -n "$RESULT" ]; then
  echo "$RESULT"
else
  echo "[对齐] Pipeline execution failed, falling back to shell router"
  run_shell_fallback
fi
