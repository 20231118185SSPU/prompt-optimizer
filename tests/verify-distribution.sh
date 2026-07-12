#!/usr/bin/env bash
# G3 distribution evidence: generated runtime, doctor, Claude L3 and Codex L2.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist/runtime"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

for host in claude-code codex universal; do
  for skill in optimize-prompt align-init optimize-prompt-lite; do
    file="$ROOT/dist/$host/$skill/SKILL.md"
    [ -f "$file" ] || continue
    if [ "$(head -n 1 "$file" | tr -d '\r')" != '---' ]; then
      echo "FAIL: skill frontmatter is not first in $file"
      exit 1
    fi
    if [ "$(head -n 12 "$file" | tr -d '\r' | grep -c '^---$' || true)" -lt 2 ]; then
      echo "FAIL: skill frontmatter is not closed in $file"
      exit 1
    fi
  done
done

ignored_generated="$(git -C "$ROOT" ls-files --others --ignored --exclude-standard dist 2>/dev/null || true)"
if [ -n "$ignored_generated" ]; then
  echo "FAIL: generated dist files are hidden by .gitignore"
  printf '%s\n' "$ignored_generated" | head -20
  exit 1
fi

required=(
  .prompt-optimizer-owned
  runtime/index.js
  runtime/shell/align-route.sh
  adapters/claude-code.sh
  adapters/codex.sh
  bin/align-cli
  bin/align-doctor
  install-plan.tsv
)
for relative in "${required[@]}"; do
  if [ ! -f "$DIST/$relative" ]; then
    echo "FAIL: missing distribution artifact $relative"
    exit 1
  fi
done

before_hash="$(sha256sum "$DIST/runtime/index.js" | awk '{print $1}')"
ALIGN_NODE_COMMAND=prompt-optimizer-node-missing ALIGN_NPM_COMMAND=prompt-optimizer-npm-missing \
  bash "$ROOT/build/build.sh" >/dev/null
after_bash_hash="$(sha256sum "$DIST/runtime/index.js" | awk '{print $1}')"
if [ "$before_hash" != "$after_bash_hash" ]; then
  echo "FAIL: no-Node Bash build changed or removed the structured runtime"
  exit 1
fi
if command -v pwsh >/dev/null 2>&1; then
  ALIGN_NODE_COMMAND=prompt-optimizer-node-missing ALIGN_NPM_COMMAND=prompt-optimizer-npm-missing \
    pwsh -NoProfile -File "$ROOT/build/build.ps1" >/dev/null
  after_ps_hash="$(sha256sum "$DIST/runtime/index.js" | awk '{print $1}')"
  if [ "$before_hash" != "$after_ps_hash" ]; then
    echo "FAIL: no-Node PowerShell build changed or removed the structured runtime"
    exit 1
  fi
fi

if ! grep -q 'Generated from core/' "$DIST/runtime/index.js" ||
   ! grep -q 'Do not edit dist/ manually' "$DIST/runtime/index.js"; then
  echo "FAIL: runtime artifact lacks generated markers"
  exit 1
fi

cp -R "$DIST" "$SANDBOX/.prompt-optimizer"
mkdir -p "$SANDBOX/.claude"
printf '%s\n' '{"hooks":{"UserPromptSubmit":[{"hooks":[{"type":"command","command":"BLOCK_ON_HIGH=on bash $HOME/.prompt-optimizer/adapters/claude-code.sh"}]}]}}' > "$SANDBOX/.claude/settings.json"
doctor_json="$(HOME="$SANDBOX" bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$ROOT")"
printf '%s' "$doctor_json" | python3 -c 'import json,sys
d=json.load(sys.stdin)
assert d["runtime"] == "installed"
assert d["hosts"]["claude-code"]["level"] == "L3"
assert d["hosts"]["codex"]["level"] == "L2"'

unwired_json="$(CLAUDE_SETTINGS_PATH="$SANDBOX/missing-settings.json" \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$ROOT")"
if ! printf '%s' "$unwired_json" | grep -q '"claude-code":{"level":"L1"'; then
  echo "FAIL: doctor overstates Claude capability when hook wiring is absent"
  exit 1
fi
printf '%s\n' '{"env":{"NOTE":"BLOCK_ON_HIGH=on bash $HOME/.prompt-optimizer/adapters/claude-code.sh"}}' > "$SANDBOX/not-a-hook.json"
false_positive_json="$(CLAUDE_SETTINGS_PATH="$SANDBOX/not-a-hook.json" \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$ROOT")"
if ! printf '%s' "$false_positive_json" | grep -q '"claude-code":{"level":"L1"'; then
  echo "FAIL: doctor treated a non-hook settings field as activated Claude wiring"
  exit 1
fi

mkdir -p "$SANDBOX/project/.align"
printf '%s\n' '# outdated router' > "$SANDBOX/project/.align/align-route.sh"
outdated_json="$(bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$SANDBOX/project")"
if ! printf '%s' "$outdated_json" | grep -q '"projectRouter":"outdated"'; then
  echo "FAIL: doctor did not report an outdated project router"
  exit 1
fi

codex_json="$(bash "$SANDBOX/.prompt-optimizer/adapters/codex.sh" '优化登录' "$ROOT" 2>/dev/null)"
printf '%s' "$codex_json" | python3 -c 'import json,sys; assert json.load(sys.stdin)["kind"] == "alignment.decision"'

codex_degraded="$(ALIGN_NODE_COMMAND=prompt-optimizer-node-missing \
  bash "$SANDBOX/.prompt-optimizer/adapters/codex.sh" '优化登录' "$ROOT" 2>/dev/null)"
printf '%s' "$codex_degraded" | python3 -c 'import json,sys
d=json.load(sys.stdin)
assert d["kind"] == "alignment.decision.projection"
assert d["degraded"] is True'

printf '%s' '{"prompt":"[直出] 删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$ROOT" bash "$SANDBOX/.prompt-optimizer/adapters/claude-code.sh" \
  > "$SANDBOX/claude-out" 2> "$SANDBOX/claude-err"
status=$?
if [ "$status" -ne 2 ]; then
  echo "FAIL: installed Claude adapter did not enforce blocking (status=$status)"
  exit 1
fi

ALIGN_NODE_COMMAND=prompt-optimizer-node-missing \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json > "$SANDBOX/no-node.json"
if ! grep -q '"node":"missing"' "$SANDBOX/no-node.json"; then
  echo "FAIL: doctor did not disclose missing Node.js"
  exit 1
fi

echo "PASS: runtime distribution and Claude/Codex adapter evidence"
