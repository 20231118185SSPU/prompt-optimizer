#!/usr/bin/env bash
# verify-w6-clarify-behavior.sh — Verify clarify multi-round behavior
# W6-09: clarify must ask one highest-value question per round.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTER="$ROOT/core/host/align-route.sh"

if [ ! -f "$ROUTER" ]; then
  echo "SKIP: align-route.sh not found"
  exit 0
fi

pass=0
fail=0

# Test VAGUE cases: must produce clarify route with ask action
vague_cases=(
  "帮我优化一下这个项目"
  "帮我做个登录功能"
  "加个搜索功能"
  "搞个好看的界面"
  "弄个导出功能"
)

for prompt in "${vague_cases[@]}"; do
  output="$(echo "$prompt" | bash "$ROUTER" 2>/dev/null)"

  # Check for clarify route
  if echo "$output" | grep -q "route=clarify"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL [VAGUE]: missing route=clarify prompt=%s\n' "$prompt"
    continue
  fi

  # Check for ask action
  if echo "$output" | grep -q "next.action=ask"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL [VAGUE]: missing next.action=ask prompt=%s\n' "$prompt"
  fi

  # Check for "一次只问一个问题" instruction
  if echo "$output" | grep -q "一次只问一个问题"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL [VAGUE]: missing one-question instruction prompt=%s\n' "$prompt"
  fi

  # Check for "推荐答案" instruction
  if echo "$output" | grep -q "推荐答案"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL [VAGUE]: missing recommendation instruction prompt=%s\n' "$prompt"
  fi
done

# Test HIGH cases: must produce clarify or block route
high_cases=(
  "帮我把生产环境的旧数据清空"
  "执行 rm -rf node_modules 然后重装"
  "把这个分支 force push 到 main"
)

for prompt in "${high_cases[@]}"; do
  output="$(echo "$prompt" | bash "$ROUTER" 2>/dev/null)"

  # Check for clarify or block route
  if echo "$output" | grep -qE "route=(clarify|block)"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL [HIGH]: missing route=clarify|block prompt=%s\n' "$prompt"
    continue
  fi

  # Check for ask or wait_confirmation action
  if echo "$output" | grep -qE "next.action=(ask|wait_confirmation)"; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL [HIGH]: missing next.action=ask|wait_confirmation prompt=%s\n' "$prompt"
  fi
done

printf '\nClarify behavior: %d passed, %d failed\n' "$pass" "$fail"

if [ "$fail" -gt 0 ]; then
  echo "FAIL: clarify behavior verification failed"
  exit 1
fi

echo "=== W6-09 clarify behavior: PASS ==="
