#!/usr/bin/env bash
# verify-cross-platform-parity.sh — 验证 build.sh 和 build.ps1 产出一致
# 同一 core/ 输入应得到相同的 dist/ 内容，这是 SSOT 架构的核心承诺。
# 需要同时有 bash 和 PowerShell（powershell 或 pwsh）可用。
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
SNAPSHOT="$(mktemp -d)"
trap 'rm -rf "$SNAPSHOT"' EXIT

# ── 检测 PowerShell ──
PS_BIN=""
if command -v pwsh >/dev/null 2>&1; then
  PS_BIN="pwsh"
elif command -v powershell >/dev/null 2>&1; then
  PS_BIN="powershell"
else
  echo "SKIP: Neither pwsh nor powershell found — cannot verify cross-platform parity."
  echo "      Install PowerShell Core (pwsh) to run this test."
  exit 0
fi

echo "=== Step 1: build.sh ==="
bash build/build.sh >/dev/null 2>&1 || { echo "FAIL: build.sh failed"; exit 1; }
cp -R dist/. "$SNAPSHOT/"

echo "=== Step 2: build.ps1 ($PS_BIN) ==="
"$PS_BIN" -NoProfile -ExecutionPolicy Bypass -File build/build.ps1 >/dev/null 2>&1 || { echo "FAIL: build.ps1 failed"; exit 1; }

echo "=== Step 3: Compare dist/ ==="
if diff -qr "$SNAPSHOT" dist >/dev/null 2>&1; then
  echo "PASS: build.sh and build.ps1 produce identical dist/"
  exit 0
else
  echo "FAIL: dist/ differs between build.sh and build.ps1"
  diff -qr "$SNAPSHOT" dist 2>/dev/null | head -20
  echo ""
  echo "Run 'git diff dist/' to see the differences."
  exit 1
fi
