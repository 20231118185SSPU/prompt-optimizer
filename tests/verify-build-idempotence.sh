#!/usr/bin/env bash
# verify-build-idempotence.sh — 验证 build.sh 连续两次产出一致（幂等性）
# 幂等 = 连续两次 build 后 dist/ 无额外 diff
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

bash build/build.sh >/dev/null 2>&1 || { echo "FAIL: build.sh 第 1 次失败"; exit 1; }
git add dist/ 2>/dev/null
bash build/build.sh >/dev/null 2>&1 || { echo "FAIL: build.sh 第 2 次失败"; exit 1; }

if git diff --exit-code --stat dist/ >/dev/null 2>&1; then
  echo "PASS: build.sh idempotent (two runs produce identical dist/)"
  exit 0
else
  echo "FAIL: build.sh not idempotent (second run changed dist/)"
  git diff --stat dist/ 2>/dev/null | head -10
  exit 1
fi
