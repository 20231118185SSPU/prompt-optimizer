#!/usr/bin/env bash
# verify-hook-exit-code.sh — hook 只在 router 缺失时降级，阻断退出码必须透传
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
export HOME="$SANDBOX/home"
mkdir -p "$HOME"

PROJECT="$SANDBOX/project"
ALIGN_DIR="$PROJECT/.align"
mkdir -p "$ALIGN_DIR"

HOOK_CMD="$(python3 - "$ROOT/core/host/settings.fragment.json" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
print(data["hooks"]["UserPromptSubmit"][0]["hooks"][0]["command"])
PYEOF
)"

cat > "$ALIGN_DIR/align-route.sh" <<'EOF'
#!/usr/bin/env bash
echo "blocked" >&2
exit 2
EOF
chmod +x "$ALIGN_DIR/align-route.sh"
printf '%s\n' 'fallback reminder' > "$ALIGN_DIR/HOOK-REMINDER.txt"

set +e
CLAUDE_PROJECT_DIR="$PROJECT" bash -c "$HOOK_CMD" >"$SANDBOX/out" 2>"$SANDBOX/err"
STATUS=$?
set -e

if [ "$STATUS" -ne 2 ]; then
  echo "FAIL: blocking exit code was swallowed (status=$STATUS)"
  exit 1
fi
if ! grep -q 'blocked' "$SANDBOX/err"; then
  echo "FAIL: blocking message was not preserved on stderr"
  exit 1
fi
if grep -q 'fallback reminder' "$SANDBOX/out"; then
  echo "FAIL: reminder ran after an intentional block"
  exit 1
fi

rm -f "$ALIGN_DIR/align-route.sh"
CLAUDE_PROJECT_DIR="$PROJECT" bash -c "$HOOK_CMD" >"$SANDBOX/fallback-out" 2>"$SANDBOX/fallback-err"
if ! grep -q 'fallback reminder' "$SANDBOX/fallback-out"; then
  echo "FAIL: missing router did not use reminder fallback"
  exit 1
fi

echo "PASS: hook preserves exit 2 and only falls back when router is missing"
