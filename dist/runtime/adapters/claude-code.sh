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
HOOK_TIMEOUT_SECONDS="${ALIGN_HOOK_TIMEOUT_SECONDS:-30}"
case "$HOOK_TIMEOUT_SECONDS" in
  ''|*[!0-9]*) HOOK_TIMEOUT_SECONDS=30 ;;
esac
[ "$HOOK_TIMEOUT_SECONDS" -gt 0 ] || HOOK_TIMEOUT_SECONDS=30
COMPLETION_TIMEOUT_MS=$((HOOK_TIMEOUT_SECONDS * 1000 - 1000))
[ "$COMPLETION_TIMEOUT_MS" -gt 0 ] || COMPLETION_TIMEOUT_MS=500
if [ "${ALIGN_HOOK_TIMEOUT_BIN+x}" = x ]; then
  TIMEOUT_BIN="$ALIGN_HOOK_TIMEOUT_BIN"
else
  TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"
fi
RAW="$(cat 2>/dev/null || true)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SESSION_ID=""
HOOK_EVENT_NAME=""
if command -v python3 &> /dev/null; then
  SESSION_ID="$(printf '%s' "$RAW" | PYTHONIOENCODING=utf-8 python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("session_id", ""))
except Exception: pass' 2>/dev/null || true)"
  HOOK_EVENT_NAME="$(printf '%s' "$RAW" | PYTHONIOENCODING=utf-8 python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("hook_event_name", ""))
except Exception: pass' 2>/dev/null || true)"
fi
if [ -z "$SESSION_ID" ] && command -v jq &> /dev/null; then
  SESSION_ID="$(printf '%s' "$RAW" | jq -r '.session_id // empty' 2>/dev/null || true)"
fi
if [ -z "$HOOK_EVENT_NAME" ] && command -v jq &> /dev/null; then
  HOOK_EVENT_NAME="$(printf '%s' "$RAW" | jq -r '.hook_event_name // empty' 2>/dev/null || true)"
fi
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="$(printf '%s' "$RAW" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
fi
if [ -z "$HOOK_EVENT_NAME" ]; then
  HOOK_EVENT_NAME="$(printf '%s' "$RAW" | sed -n 's/.*"hook_event_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
fi

session_ref() {
  if command -v sha256sum &> /dev/null; then
    printf '%s' "$1" | sha256sum | awk '{print substr($1,1,24)}'
  elif command -v shasum &> /dev/null; then
    printf '%s' "$1" | shasum -a 256 | awk '{print substr($1,1,24)}'
  elif command -v openssl &> /dev/null; then
    printf '%s' "$1" | openssl dgst -sha256 -r | awk '{print substr($1,1,24)}'
  else
    printf ''
  fi
}

SESSION_REF=""
[ -n "$SESSION_ID" ] && SESSION_REF="$(session_ref "$SESSION_ID")"

run_with_hook_timeout() {
  if [ -n "$TIMEOUT_BIN" ]; then
    "$TIMEOUT_BIN" -k 1 "$HOOK_TIMEOUT_SECONDS" "$@"
    status=$?
    [ "$status" -eq 124 ] || [ "$status" -eq 137 ] && return 124
    return "$status"
  fi

  # macOS does not provide GNU timeout by default. Use the available Node
  # runtime as a watchdog so hook execution still has a hard deadline.
  "$NODE_COMMAND" -e '
const { spawn } = require("node:child_process");
const [timeoutSeconds, command, ...args] = process.argv.slice(1);
const timeoutMs = Number(timeoutSeconds) * 1000;
const maxOutputBytes = 256 * 1024;
let output = Buffer.alloc(0);
const child = spawn(command, args, {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});
let timedOut = false;
let finished = false;
let forceTimer;
const stopChild = signal => {
  if (process.platform === "win32") {
    const treeKiller = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    treeKiller.unref();
    treeKiller.on("error", () => {
      try {
        child.kill(signal);
      } catch {
        // The child has already exited.
      }
    });
    return;
  }
  try {
    if (process.platform !== "win32") process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    child.kill(signal);
  }
};
const timer = setTimeout(() => {
  timedOut = true;
  stopChild("SIGTERM");
  forceTimer = setTimeout(() => {
    if (!finished) {
      if (child.stdout) {
        child.stdout.unpipe(process.stdout);
        child.stdout.destroy();
      }
      if (child.stderr) {
        child.stderr.unpipe(process.stderr);
        child.stderr.destroy();
      }
      if (process.platform !== "win32") stopChild("SIGKILL");
      finish(124);
    }
  }, 1000);
}, timeoutMs);
const finish = code => {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  clearTimeout(forceTimer);
  const exitCode = timedOut ? 124 : (code ?? 1);
  if (!timedOut && output.length > 0) {
    process.stdout.write(output, () => process.exit(exitCode));
    return;
  }
  process.exit(exitCode);
};
child.stdout.on("data", chunk => {
  if (output.length >= maxOutputBytes) return;
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  output = Buffer.concat([output, buffer.subarray(0, maxOutputBytes - output.length)]);
});
child.stderr.on("data", chunk => process.stderr.write(chunk));
child.on("error", () => {
  finish(1);
});
child.on("close", code => {
  finish(code);
});
' "$HOOK_TIMEOUT_SECONDS" "$@"
}

# A normal Claude Stop is an observable completed execution phase. It does not
# imply acceptance passed, and this host exposes no failed/cancelled signal.
if [ "${ALIGN_HOOK_PHASE:-prompt}" = "stop" ]; then
  if [ "$HOOK_EVENT_NAME" != "Stop" ] || [ -z "$SESSION_REF" ]; then
    echo "[对齐] execution receipt/completion status=not_observable failed/cancelled=enforcement_unavailable"
    exit 0
  fi
  if ! command -v "$NODE_COMMAND" &> /dev/null || [ ! -f "$RUNTIME" ]; then
    echo "[对齐] completion=unavailable degraded=runtime failed/cancelled=enforcement_unavailable"
    exit 0
  fi
  set +e
  RESULT="$(ALIGN_COMPLETION_TIMEOUT_MS="$COMPLETION_TIMEOUT_MS" ALIGN_SESSION_REF="$SESSION_REF" ALIGN_ROUTE_INNER=1 run_with_hook_timeout "$NODE_COMMAND" "$RUNTIME" claude-stop "" --project-dir "$PROJECT_DIR")"
  STATUS=$?
  set -e
  if [ "$STATUS" -eq 124 ]; then
    echo "[对齐] completion=unavailable degraded=timeout"
    exit 0
  fi
  [ -n "$RESULT" ] && printf '%s\n' "$RESULT"
  exit "$STATUS"
fi

run_shell_fallback() {
  if [ -f "$SHELL_ROUTER" ]; then
    context_refs=""
    if [ -f "$PROJECT_DIR/.align/spec.md" ] || [ -f "$PROJECT_DIR/.align/context.md" ]; then
      context_refs="project:.align/spec.md"
    fi
    set +e
    fallback_output="$(printf '%s' "$RAW" | ALIGN_CONTEXT_REFS="$context_refs" bash "$SHELL_ROUTER")"
    fallback_status=$?
    set -e
    [ -n "$fallback_output" ] && printf '%s\n' "$fallback_output"
    [ "$fallback_status" -eq 0 ] || return "$fallback_status"
    case "$fallback_output" in
      *'route=pass next.action=execute'*|*'route=enrich next.action=execute'*)
        printf '%s\n' '[对齐] baseline=unavailable degraded=shell。未签发 execution handoff，已阻断执行。' >&2
        return 2
        ;;
    esac
    return 0
  elif [ -f "$PIPELINE_DIR/../../.align/HOOK-REMINDER.txt" ]; then
    cat "$PIPELINE_DIR/../../.align/HOOK-REMINDER.txt"
  else
    echo "[对齐] 未检测到 .align/ 运行时。请运行 /align-init 接入对齐协议后再开发。"
  fi
  printf '%s\n' '[对齐] baseline=unavailable degraded=shell。未签发 execution handoff，已阻断执行。' >&2
  return 2
}

# ── 递归防护：hook 内调用 claude -p 时，子进程再触发本 hook 直接退出 ──
if [ -n "${ALIGN_ROUTE_INNER:-}" ]; then
  exit 0
fi

# ALIGN_BYPASS is a legacy presentation preference; routing still runs.

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
  [ "${ALIGN_SESSION_ACTIVATION:-}" = "on" ] && exit 2
  exit 0
fi

SESSION_ACTIVATION_ENABLED=false
[ "${ALIGN_SESSION_ACTIVATION:-}" = "on" ] && SESSION_ACTIVATION_ENABLED=true

is_align_setup() {
  [[ "$1" =~ ^/align[[:space:]]+setup([[:space:]]|$) ]]
}

is_align_anchor() {
  case "$1" in
    /align|/align[[:space:]]*) ;;
    *) return 1 ;;
  esac
  is_align_setup "$1" && return 1
  return 0
}

run_session_cli() {
  ALIGN_SESSION_REF="$SESSION_REF" PROMPT_OPTIMIZER_STATE_HOME="${PROMPT_OPTIMIZER_STATE_HOME:-}" \
    run_with_hook_timeout "$NODE_COMMAND" "$RUNTIME" claude-session "$1" --project-dir "$PROJECT_DIR"
}

if [ "$SESSION_ACTIVATION_ENABLED" = true ]; then
  if is_align_anchor "$PROMPT"; then
    ALIGN_REQUEST="${PROMPT#/align}"
    ALIGN_REQUEST="${ALIGN_REQUEST#"${ALIGN_REQUEST%%[![:space:]]*}"}"
    if ! command -v "$NODE_COMMAND" &> /dev/null || [ ! -f "$RUNTIME" ]; then
      echo "[对齐] 会话激活模式需要 Node.js runtime。请在当前会话运行 /align。"
      [ -n "$ALIGN_REQUEST" ] && exit 2
      exit 0
    fi
    if [ -z "$SESSION_REF" ]; then
      echo "[对齐] 无法识别当前会话，未启用。请在当前会话重新运行 /align。"
      [ -n "$ALIGN_REQUEST" ] && exit 2
      exit 0
    fi
    set +e
    ACTIVATION_RESULT="$(run_session_cli activate)"
    ACTIVATION_STATUS=$?
    set -e
    if [ "$ACTIVATION_STATUS" -eq 0 ] && printf '%s' "$ACTIVATION_RESULT" | grep -q '"status":"active"'; then
      if [ -n "$ALIGN_REQUEST" ]; then
        PROMPT="$ALIGN_REQUEST"
      else
        echo "[对齐] 当前会话已启用；打开新会话后请重新运行 /align。"
        exit 0
      fi
    else
      echo "[对齐] 当前会话未启用。请在当前会话重新运行 /align。"
      [ -n "$ALIGN_REQUEST" ] && exit 2
      exit 0
    fi
  fi

  if is_align_setup "$PROMPT"; then
    echo "[对齐] /align setup 不会启用当前会话。完成后请先运行 /align。"
    exit 0
  fi

  if ! command -v "$NODE_COMMAND" &> /dev/null || [ ! -f "$RUNTIME" ]; then
    echo "[对齐] 会话激活模式需要 Node.js runtime。请在当前会话运行 /align。"
    exit 2
  fi

  if [ -z "$SESSION_REF" ]; then
    echo "[对齐] 当前会话尚未启用。请先运行 /align。"
    exit 2
  fi
  set +e
  SESSION_STATUS_RESULT="$(run_session_cli status)"
  SESSION_STATUS=$?
  set -e
  if [ "$SESSION_STATUS" -ne 0 ] || ! printf '%s' "$SESSION_STATUS_RESULT" | grep -q '"status":"active"'; then
    echo "[对齐] 当前会话尚未启用或会话状态不可用。请先运行 /align。"
    exit 2
  fi
fi

# Default mode retains the legacy shell fallback. Strong session activation
# checks above must fail closed instead of reaching this branch.
if ! command -v "$NODE_COMMAND" &> /dev/null; then
  echo "[对齐] Warning: Node.js not found, falling back to shell router"
  set +e
  run_shell_fallback
  STATUS=$?
  set -e
  exit "$STATUS"
fi

# Call align-cli (safe: pass args positionally, not interpolated)
ALIGN_CMD='"$1" "$2" claude-code "$3" --project-dir "$4"'

set +e
RESULT="$(ALIGN_SESSION_REF="$SESSION_REF" ALIGN_ROUTE_INNER=1 run_with_hook_timeout bash -c "$ALIGN_CMD" _ "$NODE_COMMAND" "$RUNTIME" "$PROMPT" "$PROJECT_DIR")"
STATUS=$?
set -e

if [ "$SESSION_ACTIVATION_ENABLED" = true ]; then
  if [ "$STATUS" -ne 0 ]; then
    [ -n "$RESULT" ] && printf '%s\n' "$RESULT" >&2
    [ "$STATUS" -eq 124 ] && echo "[对齐] Runtime route timeout; strong session blocked execution." >&2
    exit 2
  fi
  if [ -z "$RESULT" ]; then
    echo "[对齐] Runtime route produced no output; strong session blocked execution." >&2
    exit 2
  fi
  printf '%s\n' "$RESULT"
  exit 0
fi

if [ "$STATUS" -eq 124 ]; then
  echo "[对齐] Runtime route timeout, falling back to shell router" >&2
  run_shell_fallback
  exit $?
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
