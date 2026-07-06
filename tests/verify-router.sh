#!/usr/bin/env bash
# verify-router.sh — align-route.sh 分类回归测试
# 任何人改路由规则，本测试不过 = 不许合。
# 同时测试 core/host/（SSOT 源）和 .align/（运行时副本）两份，防同步断口。
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CASES="$ROOT/tests/router-cases.tsv"
ROUTERS=("$ROOT/core/host/align-route.sh" "$ROOT/.align/align-route.sh")

overall_fail=0
for ROUTER in "${ROUTERS[@]}"; do
  if [ ! -f "$ROUTER" ]; then
    printf 'SKIP (不存在): %s\n' "$ROUTER"
    continue
  fi
  pass=0; fail=0
  while IFS=$'\t' read -r expected prompt; do
    case "$expected" in ''|'#'*) continue ;; esac
    actual="$(bash "$ROUTER" --classify "$prompt")"
    if [ "$actual" = "$expected" ]; then
      pass=$((pass+1))
    else
      fail=$((fail+1))
      printf 'FAIL [%s]: expected=%s actual=%s prompt=%s\n' "$(basename "$(dirname "$ROUTER")")" "$expected" "$actual" "$prompt"
    fi
  done < "$CASES"
  printf '\n%s: %d passed, %d failed\n' "$ROUTER" "$pass" "$fail"
  [ "$fail" -eq 0 ] || overall_fail=1
done

[ "$overall_fail" -eq 0 ] || exit 1
echo "=== All router cases passed (both core/host and .align) ==="
