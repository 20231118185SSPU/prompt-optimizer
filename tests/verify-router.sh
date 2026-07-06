#!/usr/bin/env bash
# verify-router.sh — align-route.sh 分类回归测试
# 任何人改路由规则，本测试不过 = 不许合。
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTER="$ROOT/core/host/align-route.sh"
CASES="$ROOT/tests/router-cases.tsv"

pass=0; fail=0
while IFS=$'\t' read -r expected prompt; do
  case "$expected" in ''|'#'*) continue ;; esac
  actual="$(bash "$ROUTER" --classify "$prompt")"
  if [ "$actual" = "$expected" ]; then
    pass=$((pass+1))
  else
    fail=$((fail+1))
    printf 'FAIL: expected=%s actual=%s prompt=%s\n' "$expected" "$actual" "$prompt"
  fi
done < "$CASES"

printf '\nrouter regression: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
echo "=== All router cases passed ==="
