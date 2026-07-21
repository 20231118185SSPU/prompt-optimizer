#!/usr/bin/env bash
# Test fixture: verify mount area uninstall preserves user content
set -euo pipefail

FIXTURE_DIR="$(cd "$(dirname "$0")/fixtures" && pwd)"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

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
TMP_DIR2="$(mktemp -d)"
cleanup2() { rm -rf "$TMP_DIR2"; }
trap cleanup2 EXIT
cp "$INPUT2" "$TMP_DIR2/CLAUDE.md"
bash "$PROJECT_ROOT/core/host/align-setup.sh" mount "$TMP_DIR2" CLAUDE.md > "$TMP_DIR2/mount.json"
TMP_FILE2="$TMP_DIR2/CLAUDE.md"

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

if [ "$(grep -c 'align-protocol:begin v4.0' "$TMP_FILE2")" -ne 1 ] || [ "$(grep -c 'align-protocol:end' "$TMP_FILE2")" -ne 1 ]; then
  echo "FAIL: Upgraded mount markers are not unique"
  exit 1
else
  echo "PASS: Upgraded mount markers are unique"
fi

BEFORE_LINE="$(grep -n 'Always use TypeScript' "$TMP_FILE2" | cut -d: -f1)"
MOUNT_LINE="$(grep -n 'align-protocol:begin v4.0' "$TMP_FILE2" | cut -d: -f1)"
AFTER_LINE="$(grep -n 'Tests must pass before merge' "$TMP_FILE2" | cut -d: -f1)"
if [ "$BEFORE_LINE" -lt "$MOUNT_LINE" ] && [ "$MOUNT_LINE" -lt "$AFTER_LINE" ]; then
  echo "PASS: User content order preserved after upgrade"
else
  echo "FAIL: User content order changed after upgrade"
  exit 1
fi

echo ""
echo "=== All tests passed: zero damage to user content ==="
