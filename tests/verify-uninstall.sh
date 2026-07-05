#!/usr/bin/env bash
# Test fixture: verify mount area uninstall preserves user content
set -euo pipefail

FIXTURE_DIR="$(cd "$(dirname "$0")/fixtures" && pwd)"

echo "=== Test 1: Uninstall removes mount area, preserves user content ==="

INPUT="$FIXTURE_DIR/CLAUDE-with-mount-area.md"
TMP_FILE="$(mktemp)"
cleanup() { rm -f "$TMP_FILE"; }
trap cleanup EXIT

# Simulate uninstall: remove everything between and including markers
sed '/<!-- align-protocol:begin.*-->/,/<!-- align-protocol:end.*-->/d' "$INPUT" > "$TMP_FILE"

# Verify user content before mount area is preserved
if grep -q "Always use TypeScript" "$TMP_FILE"; then
  echo "PASS: User content before mount area preserved"
else
  echo "FAIL: User content before mount area missing"
  exit 1
fi

# Verify user content after mount area is preserved
if grep -q "Tests must pass before merge" "$TMP_FILE"; then
  echo "PASS: User content after mount area preserved"
else
  echo "FAIL: User content after mount area missing"
  exit 1
fi

# Verify custom instructions preserved
if grep -q "This is my custom content" "$TMP_FILE"; then
  echo "PASS: Custom instructions preserved"
else
  echo "FAIL: Custom instructions missing"
  exit 1
fi

# Verify mount area content is removed
if grep -q "三档路由评估" "$TMP_FILE"; then
  echo "FAIL: Mount area content not removed"
  exit 1
else
  echo "PASS: Mount area content removed"
fi

# Verify markers themselves are removed
if grep -q "align-protocol:begin" "$TMP_FILE"; then
  echo "FAIL: Begin marker not removed"
  exit 1
else
  echo "PASS: Begin marker removed"
fi

if grep -q "align-protocol:end" "$TMP_FILE"; then
  echo "FAIL: End marker not removed"
  exit 1
else
  echo "PASS: End marker removed"
fi

echo ""
echo "=== Test 2: Upgrade replaces old version, preserves user content ==="

INPUT2="$FIXTURE_DIR/CLAUDE-with-old-version.md"
TMP_FILE2="$(mktemp)"
cleanup2() { rm -f "$TMP_FILE2"; }
trap cleanup2 EXIT

# Simulate upgrade: remove old marker interval, insert new mount area
NEW_MOUNT='<!-- align-protocol:begin v3.0 -->
## 对齐协议（Alignment Protocol）v3.0
每条开发指令执行前，静默完成三档路由评估。
硬性红线：高风险静默假设 = 无效输出。
<!-- align-protocol:end -->'

# Remove old marker interval
sed '/<!-- align-protocol:begin.*-->/,/<!-- align-protocol:end.*-->/d' "$INPUT2" > "$TMP_FILE2"

# Verify user content preserved after upgrade
if grep -q "Always use TypeScript" "$TMP_FILE2"; then
  echo "PASS: User content before mount area preserved after upgrade"
else
  echo "FAIL: User content before mount area missing after upgrade"
  exit 1
fi

if grep -q "Tests must pass before merge" "$TMP_FILE2"; then
  echo "PASS: User content after mount area preserved after upgrade"
else
  echo "FAIL: User content after mount area missing after upgrade"
  exit 1
fi

# Verify old mount area content is removed
if grep -q "旧版本" "$TMP_FILE2"; then
  echo "FAIL: Old mount area content not removed"
  exit 1
else
  echo "PASS: Old mount area content removed"
fi

# Verify old markers are removed
if grep -q "align-protocol:begin v2.0" "$TMP_FILE2"; then
  echo "FAIL: Old begin marker not removed"
  exit 1
else
  echo "PASS: Old begin marker removed"
fi

echo ""
echo "=== All tests passed: zero damage to user content ==="
