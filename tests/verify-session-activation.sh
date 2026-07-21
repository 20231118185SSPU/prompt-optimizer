#!/usr/bin/env bash
# verify-session-activation.sh — Claude hook strong session activation is scoped and private.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADAPTER="$ROOT/core/host/pipeline/adapters/hook/claude-code.sh"
SANDBOX="$(mktemp -d)"
PROJECT="$SANDBOX/project"
STATE_HOME="$SANDBOX/state"
NODE_WRAPPER="$SANDBOX/node-wrapper.sh"
TIMEOUT_WRAPPER="$SANDBOX/timeout-wrapper.sh"
RAW_SESSION_A="session-for-activation-a"
RAW_SESSION_B="session-for-activation-b"
RAW_PROMPT="只修改 parser；完成后运行 npm test。"
cleanup() {
  status="$1"
  trap - EXIT
  rm -rf "$SANDBOX"
  exit "$status"
}
trap 'cleanup $?' EXIT

mkdir -p "$PROJECT" "$STATE_HOME"
cat > "$NODE_WRAPPER" <<'EOF'
#!/usr/bin/env bash
set -eu

if [ "$2" = "claude-session" ]; then
  exec node "$@"
fi

case "${TEST_RUNTIME_BEHAVIOR:-}" in
  timeout) exit 124 ;;
  empty) exit 0 ;;
  *) exec node "$@" ;;
esac
EOF
chmod +x "$NODE_WRAPPER"

cat > "$TIMEOUT_WRAPPER" <<'EOF'
#!/usr/bin/env bash
set -eu

if [ "$1" = '-k' ]; then
  shift 3
fi
exec "$@"
EOF
chmod +x "$TIMEOUT_WRAPPER"

run_hook() {
  local session_id="$1"
  local prompt="$2"
  local state_home="${3:-$STATE_HOME}"
  local node_command="${4:-node}"
  local timeout_seconds="${5:-30}"
  local runtime_behavior="${6:-}"
  printf '{"session_id":"%s","prompt":"%s"}' "$session_id" "$prompt" |
    ALIGN_SESSION_ACTIVATION=on BLOCK_ON_HIGH=on ALIGN_NODE_COMMAND="$node_command" \
    ALIGN_HOOK_TIMEOUT_SECONDS="$timeout_seconds" TEST_RUNTIME_BEHAVIOR="$runtime_behavior" \
    ALIGN_HOOK_TIMEOUT_BIN="$TIMEOUT_WRAPPER" \
    PROMPT_OPTIMIZER_STATE_HOME="$state_home" \
    CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER" 2>&1
}

run_hook_capture() {
  set +e
  HOOK_OUTPUT="$(run_hook "$@")"
  HOOK_STATUS=$?
  set -e
}

run_hook_capture "$RAW_SESSION_A" "$RAW_PROMPT"
before="$HOOK_OUTPUT"
[ "$HOOK_STATUS" -eq 2 ] || { echo "FAIL: inactive session did not block (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q '请先运行 /align' <<<"$before"
if grep -q 'route=' <<<"$before"; then
  echo 'FAIL: inactive session reached the runtime/router' >&2
  exit 1
fi

set +e
no_node="$(printf '{"session_id":"%s","prompt":"%s"}' "$RAW_SESSION_A" "$RAW_PROMPT" |
  ALIGN_SESSION_ACTIVATION=on ALIGN_NODE_COMMAND='missing-node' \
  PROMPT_OPTIMIZER_STATE_HOME="$STATE_HOME" CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER")"
no_node_status=$?
set -e
[ "$no_node_status" -eq 2 ] || { echo "FAIL: missing Node.js did not block (status=$no_node_status)" >&2; exit 1; }
grep -q '需要 Node.js runtime' <<<"$no_node"
if grep -q 'route=' <<<"$no_node"; then
  echo 'FAIL: missing Node.js fell back to the router in strong mode' >&2
  exit 1
fi

set +e
malformed_payload="$(printf '{"session_id":"%s","not_prompt":"%s"}' "$RAW_SESSION_A" "$RAW_PROMPT" | ALIGN_SESSION_ACTIVATION=on PROMPT_OPTIMIZER_STATE_HOME="$STATE_HOME" CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER")"
malformed_payload_status=$?
set -e
[ "$malformed_payload_status" -eq 2 ] || { echo "FAIL: malformed hook payload did not block (status=$malformed_payload_status)" >&2; exit 1; }
grep -q 'Could not extract prompt' <<<"$malformed_payload"

run_hook_capture "$RAW_SESSION_A" '/align'
anchor="$HOOK_OUTPUT"
[ "$HOOK_STATUS" -eq 0 ] || { echo "FAIL: /align activation failed (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q '当前会话已启用' <<<"$anchor"
grep -q '新会话后请重新运行 /align' <<<"$anchor"

run_hook_capture 'session-for-align-request' '/align 删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。'
[ "$HOOK_STATUS" -eq 2 ] || { echo "FAIL: /align request was allowed without canonical routing (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q 'route=' <<<"$HOOK_OUTPUT"

run_hook_capture '' '/align 删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。'
[ "$HOOK_STATUS" -eq 2 ] || { echo "FAIL: failed /align request activation was allowed (status=$HOOK_STATUS)" >&2; exit 1; }

run_hook_capture 'session-for-runtime-timeout' '/align' "$STATE_HOME" "$NODE_WRAPPER"
[ "$HOOK_STATUS" -eq 0 ] || { echo "FAIL: timeout session activation failed (status=$HOOK_STATUS)" >&2; exit 1; }
run_hook_capture 'session-for-runtime-timeout' "$RAW_PROMPT" "$STATE_HOME" "$NODE_WRAPPER" 1 timeout
[ "$HOOK_STATUS" -eq 2 ] || { echo "FAIL: runtime timeout did not fail closed (status=$HOOK_STATUS)" >&2; exit 1; }
if grep -q 'falling back to shell router\|route=' <<<"$HOOK_OUTPUT"; then
  echo 'FAIL: runtime timeout reached the shell fallback' >&2
  exit 1
fi

run_hook_capture 'session-for-runtime-empty' '/align' "$STATE_HOME" "$NODE_WRAPPER"
[ "$HOOK_STATUS" -eq 0 ] || { echo "FAIL: empty-output session activation failed (status=$HOOK_STATUS)" >&2; exit 1; }
run_hook_capture 'session-for-runtime-empty' "$RAW_PROMPT" "$STATE_HOME" "$NODE_WRAPPER" 30 empty
[ "$HOOK_STATUS" -eq 2 ] || { echo "FAIL: empty runtime output did not fail closed (status=$HOOK_STATUS)" >&2; exit 1; }
if grep -q 'falling back to shell router\|route=' <<<"$HOOK_OUTPUT"; then
  echo 'FAIL: empty runtime output reached the shell fallback' >&2
  exit 1
fi

run_hook_capture "$RAW_SESSION_A" "$RAW_PROMPT"
same_session="$HOOK_OUTPUT"
[ "$HOOK_STATUS" -eq 0 ] || { echo "FAIL: active session did not reach runtime (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q 'route=' <<<"$same_session"

run_hook_capture "$RAW_SESSION_B" "$RAW_PROMPT"
other_session="$HOOK_OUTPUT"
[ "$HOOK_STATUS" -eq 2 ] || { echo "FAIL: different session did not block (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q '请先运行 /align' <<<"$other_session"
if grep -q 'route=' <<<"$other_session"; then
  echo 'FAIL: different session reached the runtime/router' >&2
  exit 1
fi

run_hook_capture 'session-for-setup' '/align setup'
setup_session="$HOOK_OUTPUT"
[ "$HOOK_STATUS" -eq 0 ] || { echo "FAIL: /align setup was blocked (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q '请先运行 /align' <<<"$setup_session"
if find "$STATE_HOME" -type f -print0 | xargs -0 grep -F -q 'session-for-setup'; then
  echo 'FAIL: /align setup activated a session' >&2
  exit 1
fi

run_hook_capture 'session-for-spaced-setup' '/align   setup'
spaced_setup_session="$HOOK_OUTPUT"
[ "$HOOK_STATUS" -eq 0 ] || { echo "FAIL: spaced /align setup was blocked (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q '请先运行 /align' <<<"$spaced_setup_session"
if find "$STATE_HOME" -type f -print0 | xargs -0 grep -F -q 'session-for-spaced-setup'; then
  echo 'FAIL: spaced /align setup activated a session' >&2
  exit 1
fi

run_hook_capture '' "$RAW_PROMPT"
[ "$HOOK_STATUS" -eq 2 ] || { echo "FAIL: missing session id did not block (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q '请先运行 /align' <<<"$HOOK_OUTPUT"

STATE_FILE="$SANDBOX/state-file"
printf '%s' 'not-a-directory' > "$STATE_FILE"
run_hook_capture 'session-for-unavailable-state' "$RAW_PROMPT" "$STATE_FILE"
[ "$HOOK_STATUS" -eq 2 ] || { echo "FAIL: unavailable state storage did not block (status=$HOOK_STATUS)" >&2; exit 1; }
grep -q '会话状态不可用' <<<"$HOOK_OUTPUT"

if find "$STATE_HOME" -type f -print0 | xargs -0 grep -F -q "$RAW_SESSION_A"; then
  echo 'FAIL: activation state contains a raw session id' >&2
  exit 1
fi
if find "$STATE_HOME" -type f -print0 | xargs -0 grep -F -q "$RAW_PROMPT"; then
  echo 'FAIL: activation state contains a raw prompt' >&2
  exit 1
fi

echo 'PASS: Claude session activation is explicit, scoped, and private'
