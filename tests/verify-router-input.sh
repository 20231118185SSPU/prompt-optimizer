#!/usr/bin/env bash
# Hook JSON parsing must classify only prompt, never metadata or malformed payload text.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTERS=("$ROOT/core/host/align-route.sh" "$ROOT/.align/align-route.sh")
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
mkdir -p "$SANDBOX/.align"
printf '%s\n' 'BLOCK_ON_HIGH=on' 'ALIGN_ARBITER=off' > "$SANDBOX/.align/route.conf"

for router in "${ROUTERS[@]}"; do
  output="$(printf '%s' '{"prompt":"","metadata":"删除生产库"}' | ALIGN_ARBITER=off bash "$router")"
  if printf '%s' "$output" | grep -q '高风险'; then
    echo "FAIL: JSON metadata was classified as prompt by $router"
    exit 1
  fi

  output="$(printf '%s' '{"prompt":' | ALIGN_ARBITER=off bash "$router")"
  if printf '%s' "$output" | grep -q '高风险'; then
    echo "FAIL: malformed JSON payload was classified as prompt by $router"
    exit 1
  fi

  printf '%s' '{"prompt":"[直出] 删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。"}' |
    CLAUDE_PROJECT_DIR="$SANDBOX" bash "$router" > "$SANDBOX/out" 2> "$SANDBOX/err"
  status=$?
  if [ "$status" -ne 2 ]; then
    echo "FAIL: direct-output risk did not preserve blocking exit 2 in $router (status=$status)"
    exit 1
  fi
  if grep -qE '加 \[直出\]|ALIGN_BYPASS' "$SANDBOX/err"; then
    echo "FAIL: blocking message still advertises a direct-output bypass in $router"
    exit 1
  fi
done

ADAPTER="$ROOT/core/host/pipeline/adapters/hook/claude-code.sh"
if command -v node >/dev/null 2>&1 && [ -f "$ROOT/core/host/pipeline/dist/index.js" ]; then
  printf '%s' '{"prompt":"[直出] 删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。"}' |
    BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$ROOT" bash "$ADAPTER" > "$SANDBOX/adapter-out" 2> "$SANDBOX/adapter-err"
  status=$?
  if [ "$status" -ne 2 ]; then
    echo "FAIL: Claude adapter swallowed direct-output blocking exit 2 (status=$status)"
    exit 1
  fi
  if grep -q '跳过路由' "$SANDBOX/adapter-out" "$SANDBOX/adapter-err"; then
    echo "FAIL: Claude adapter bypassed alignment for direct-output risk"
    exit 1
  fi
fi

echo "PASS: hook JSON is isolated and direct-output risk remains blocked"
