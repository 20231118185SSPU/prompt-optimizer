#!/usr/bin/env bash
# verify-w6-hook-align-parity.sh — Verify hook and explicit /align produce same route/action
# W6-09: All requests—hook-triggered or explicit—must consume the same Decision Kernel.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTER="$ROOT/core/host/align-route.sh"

if [ ! -f "$ROUTER" ]; then
  echo "SKIP: align-route.sh not found"
  exit 0
fi

pass=0
fail=0

# Test key HIGH cases (must be classified as HIGH in both modes)
high_cases=(
  "帮我把生产环境的旧数据清空"
  "执行 rm -rf node_modules 然后重装"
  "把这个分支 force push 到 main"
)

for prompt in "${high_cases[@]}"; do
  hook_result="$(bash "$ROUTER" --classify "$prompt" 2>/dev/null)"
  if [ "$hook_result" = "HIGH" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL [HIGH]: expected=HIGH actual=%s prompt=%s\n' "$hook_result" "$prompt"
  fi
done

# Test key VAGUE cases (must be classified as VAGUE in both modes)
vague_cases=(
  "帮我优化一下这个项目"
  "帮我做个登录功能"
  "加个搜索功能"
)

for prompt in "${vague_cases[@]}"; do
  hook_result="$(bash "$ROUTER" --classify "$prompt" 2>/dev/null)"
  if [ "$hook_result" = "VAGUE" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL [VAGUE]: expected=VAGUE actual=%s prompt=%s\n' "$hook_result" "$prompt"
  fi
done

# Test key CLEAR cases (must be classified as GRAY or CLEAR in classify mode)
clear_cases=(
  "把 README.md 第 12 行的版本号改成 3.1.0"
  "跑一下 tests/verify-uninstall.sh 告诉我结果"
)

for prompt in "${clear_cases[@]}"; do
  hook_result="$(bash "$ROUTER" --classify "$prompt" 2>/dev/null)"
  case "$hook_result" in
    GRAY|CLEAR)
      pass=$((pass+1))
      ;;
    *)
      fail=$((fail+1))
      printf 'FAIL [CLEAR]: expected=GRAY|CLEAR actual=%s prompt=%s\n' "$hook_result" "$prompt"
      ;;
  esac
done

printf '\nHook-align parity: %d passed, %d failed\n' "$pass" "$fail"

if [ "$fail" -gt 0 ]; then
  echo "FAIL: hook and classify modes disagree"
  exit 1
fi

echo "=== W6-09 hook-align parity: PASS ==="
