#!/usr/bin/env bash
# W5: Stop must not synchronously hold the Claude host for a slow completion check.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADAPTER="$ROOT/dist/runtime/adapters/claude-code.sh"
PROJECT="$(mktemp -d)"
cleanup() {
  status="$1"
  trap - EXIT
  rm -rf "$PROJECT"
  exit "$status"
}
trap 'cleanup $?' EXIT

mkdir -p "$PROJECT/.align"
printf '%s\n' 'bash .align/align-check.sh' > "$PROJECT/.align/check-commands.txt"
printf '%s\n' '#!/usr/bin/env bash' 'sleep 4' > "$PROJECT/.align/align-check.sh"
printf '%s\n' 'Project verification contract' > "$PROJECT/.align/spec.md"
printf '%s\n' 'Project facts' > "$PROJECT/.align/facts.md"

printf '%s' '{"session_id":"w5-timeout","prompt":"只修改 parser；token=secret-value；完成后验证并运行 bash .align/align-check.sh。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER" > "$PROJECT/prompt.out"
grep -q 'route=pass\|route=enrich' "$PROJECT/prompt.out"
grep -q 'execution-handoff' "$PROJECT/.align/.runtime/reference-host.log"

start="$(python3 -c 'import time; print(time.monotonic())')"
printf '%s' '{"session_id":"w5-timeout","hook_event_name":"Stop"}' |
  ALIGN_HOOK_PHASE=stop ALIGN_HOOK_TIMEOUT_SECONDS=2 CLAUDE_PROJECT_DIR="$PROJECT" \
  bash "$ADAPTER" > "$PROJECT/stop.out"
elapsed="$(START="$start" python3 -c 'import os,time; print(time.monotonic() - float(os.environ["START"]))')"
if ! ELAPSED="$elapsed" python3 -c 'import os,sys; sys.exit(0 if float(os.environ["ELAPSED"]) < 3.5 else 1)'; then
  echo "FAIL: Stop hook exceeded its completion deadline (${elapsed}s)" >&2
  exit 1
fi
grep -q 'execution receipt/completion status=verification_failed' "$PROJECT/stop.out"

set +e
printf '%s' '{"session_id":"w5-timeout-fallback","prompt":"只修改 parser；token=secret-value；完成后验证并运行 bash .align/align-check.sh。"}' |
  ALIGN_HOOK_TIMEOUT_BIN='' BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$PROJECT" \
  bash "$ADAPTER" > "$PROJECT/fallback-prompt.out" 2> "$PROJECT/fallback-prompt.err"
fallback_prompt_status=$?
set -e
if [ "$fallback_prompt_status" -ne 0 ]; then
  cat "$PROJECT/fallback-prompt.err" >&2
  exit "$fallback_prompt_status"
fi
grep -q 'route=pass\|route=enrich' "$PROJECT/fallback-prompt.out"

start="$(python3 -c 'import time; print(time.monotonic())')"
printf '%s' '{"session_id":"w5-timeout-fallback","hook_event_name":"Stop"}' |
  ALIGN_HOOK_TIMEOUT_BIN='' ALIGN_HOOK_PHASE=stop ALIGN_HOOK_TIMEOUT_SECONDS=2 CLAUDE_PROJECT_DIR="$PROJECT" \
  bash "$ADAPTER" > "$PROJECT/fallback-stop.out"
elapsed="$(START="$start" python3 -c 'import os,time; print(time.monotonic() - float(os.environ["START"]))')"
if ! ELAPSED="$elapsed" python3 -c 'import os,sys; sys.exit(0 if float(os.environ["ELAPSED"]) < 3.5 else 1)'; then
  echo "FAIL: Stop hook fallback exceeded its completion deadline (${elapsed}s)" >&2
  exit 1
fi
grep -q 'execution receipt/completion status=verification_failed' "$PROJECT/fallback-stop.out"

TERM_RESISTANT_ROOT="$PROJECT/term-resistant"
TERM_RESISTANT_ADAPTER="$TERM_RESISTANT_ROOT/runtime/adapters/claude-code.sh"
mkdir -p "$TERM_RESISTANT_ROOT/runtime/adapters" "$TERM_RESISTANT_ROOT/runtime/runtime/shell"
cp "$ADAPTER" "$TERM_RESISTANT_ADAPTER"
printf '%s\n' '#!/usr/bin/env bash' "printf '%s\\n' '[对齐] route=clarify next.action=ask degraded=true'" > "$TERM_RESISTANT_ROOT/runtime/runtime/shell/align-route.sh"
printf '%s\n' "process.on('SIGTERM', () => {});" 'setTimeout(() => process.exit(0), 6000);' > "$TERM_RESISTANT_ROOT/runtime/runtime/index.js"

start="$(python3 -c 'import time; print(time.monotonic())')"
printf '%s' '{"session_id":"w5-timeout-term-resistant","prompt":"只修改 parser。"}' |
  ALIGN_HOOK_TIMEOUT_BIN='' ALIGN_HOOK_TIMEOUT_SECONDS=2 BLOCK_ON_HIGH=on \
  CLAUDE_PROJECT_DIR="$PROJECT" bash "$TERM_RESISTANT_ADAPTER" \
  > "$PROJECT/term-resistant-prompt.out" 2> "$PROJECT/term-resistant-prompt.err"
elapsed="$(START="$start" python3 -c 'import os,time; print(time.monotonic() - float(os.environ["START"]))')"
# Windows task-tree termination can add a bounded escalation delay, but must
# never wait for the TERM-resistant runtime's full six-second lifetime.
if ! ELAPSED="$elapsed" python3 -c 'import os,sys; sys.exit(0 if float(os.environ["ELAPSED"]) < 5.5 else 1)'; then
  echo "FAIL: Hook fallback exceeded its TERM-resistant escalation budget (${elapsed}s)" >&2
  exit 1
fi
grep -q 'route=' "$PROJECT/term-resistant-prompt.out"
grep -q 'Runtime route timeout' "$PROJECT/term-resistant-prompt.err"

echo 'PASS: W5 Stop hook respects the completion timeout budget'
