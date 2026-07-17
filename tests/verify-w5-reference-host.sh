#!/usr/bin/env bash
# W5: exercise the distributed Claude hook adapter through UserPromptSubmit and Stop.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADAPTER="$ROOT/dist/runtime/adapters/claude-code.sh"
PROJECT="$(mktemp -d)"
UNSAFE_PROJECT="$(mktemp -d)"
SESSION_PROJECT="$(mktemp -d)"
NO_SESSION_PROJECT="$(mktemp -d)"
BASELINE_FAILURE_PROJECT="$(mktemp -d)"
DEGRADED_PROJECT="$(mktemp -d)"
cleanup() {
  status=$?
  trap - EXIT
  rm -rf "$PROJECT" "$UNSAFE_PROJECT" "$SESSION_PROJECT" "$NO_SESSION_PROJECT" "$BASELINE_FAILURE_PROJECT" "$DEGRADED_PROJECT"
  exit "$status"
}
trap cleanup EXIT

fail=0
check() {
  if [ "$1" -eq 0 ]; then
    printf 'PASS: %s\n' "$2"
  else
    printf 'FAIL: %s\n' "$2"
    fail=1
  fi
}

mkdir -p "$PROJECT/.align"
printf '%s\n' 'bash -n .align/align-check.sh' 'exit 1' > "$PROJECT/.align/check-commands.txt"
printf '%s\n' '#!/usr/bin/env bash' 'true' > "$PROJECT/.align/align-check.sh"
printf '%s\n' 'Project verification contract' > "$PROJECT/.align/spec.md"
printf '%s\n' 'Project facts' > "$PROJECT/.align/facts.md"

printf '%s' '{"session_id":"w5-main","prompt":"只修改 parser；token=secret-value；完成后验证并运行 bash -n .align/align-check.sh。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER" > "$PROJECT/prompt.out" 2> "$PROJECT/prompt.err"
prompt_status=$?
check "$prompt_status" 'Claude UserPromptSubmit allows executable route'

STATE="$(find "$PROJECT/.align/.runtime" -maxdepth 1 -type f -name 'reference-host-*.json' | head -1)"
node -e '
const fs = require("node:fs");
const path = require("node:path");
const [stateFile, projectDir] = process.argv.slice(1);
const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const read = ref => JSON.parse(fs.readFileSync(path.join(projectDir, ref.slice("artifact:".length)), "utf8"));
const baseline = read(state.baselineReportRef);
const handoff = read(state.executionHandoffRef);
const identity = ["requestId", "decisionId", "runId", "revision"];
if (baseline.kind !== "alignment.baseline-report" || baseline.status !== "passed") process.exit(1);
if (handoff.kind !== "alignment.execution-handoff" || handoff.baselineReportRef !== state.baselineReportRef) process.exit(1);
if (!identity.every(key => baseline[key] === handoff[key])) process.exit(1);
if (handoff.acceptancePlanRef !== state.acceptancePlanRef || handoff.scopeFingerprint !== state.scopeFingerprint) process.exit(1);
' "$STATE" "$PROJECT"
check "$?" 'Claude UserPromptSubmit persists a passed baseline bound to its execution handoff'
if grep -R -qE 'secret-value|w5-main|session_id|CLAUDE_PROJECT_DIR|/tmp|[A-Za-z]:\\' "$PROJECT/.align/.runtime/lifecycle"; then
  check 1 'public lifecycle artifacts exclude sensitive text, session ids, and absolute paths'
else
  check 0 'public lifecycle artifacts exclude sensitive text, session ids, and absolute paths'
fi

printf '%s' '{"session_id":"w5-main"}' |
  ALIGN_HOOK_PHASE=stop CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER" > "$PROJECT/unobserved-stop.out" 2> "$PROJECT/unobserved-stop.err"
unobserved_stop_status=$?
check "$unobserved_stop_status" 'unobserved Stop-shaped input does not block the host'
grep -q 'status=not_observable' "$PROJECT/unobserved-stop.out"
check "$?" 'missing Claude Stop event cannot synthesize a completed receipt'
if find "$PROJECT/.align/.runtime/lifecycle" -type f -name '*receipt*' | grep -q .; then
  check 1 'missing Claude Stop event cannot create a public receipt artifact'
else
  check 0 'missing Claude Stop event cannot create a public receipt artifact'
fi

printf '%s' '{"session_id":"w5-main","hook_event_name":"Stop"}' |
  ALIGN_HOOK_PHASE=stop CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER" > "$PROJECT/stop.out" 2> "$PROJECT/stop.err"
stop_status=$?
check "$stop_status" 'Claude Stop hook completes without blocking the host'

LOG="$PROJECT/.align/.runtime/reference-host.log"
grep -q 'execution-receipt' "$LOG"
check "$?" 'Stop hook records an execution receipt in the private audit log'
grep -q 'completion-evidence' "$LOG"
check "$?" 'completion evidence is recorded after Stop receipt in the private audit log'
node -e '
const fs = require("node:fs");
const path = require("node:path");
const [stateFile, projectDir] = process.argv.slice(1);
const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
const read = ref => JSON.parse(fs.readFileSync(path.join(projectDir, ref.slice("artifact:".length)), "utf8"));
const receipt = read(state.executionReceiptRef);
const completion = read(state.completionReportRef);
if (receipt.kind !== "alignment.execution-receipt" || receipt.status !== "completed") process.exit(1);
if (completion.kind !== "alignment.completion-report" || completion.status !== "verified") process.exit(1);
if (![receipt, completion].every(item => item.requestId === state.requestId && item.decisionId === state.decisionId && item.runId === state.runId)) process.exit(1);
if (receipt.revision !== 2 || completion.revision !== 3 || completion.executionRef !== receipt.executionRef) process.exit(1);
' "$STATE" "$PROJECT"
check "$?" 'Stop hook persists public ExecutionReceipt and CompletionReport artifacts'
if grep -qE 'secret-value|session_id|CLAUDE_PROJECT_DIR|/tmp|[A-Za-z]:\\' "$LOG"; then
  check 1 'reference-host log excludes sensitive text, session ids, and paths'
else
  check 0 'reference-host log excludes sensitive text, session ids, and paths'
fi

printf '%s' '{"prompt":"删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER" > "$PROJECT/block.out" 2> "$PROJECT/block.err"
block_status=$?
[ "$block_status" -eq 2 ]
check "$?" 'unauthorized high-risk request exits with native block status'

printf '%s' '{"prompt":"优化登录。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER" > "$PROJECT/clarify.out" 2> "$PROJECT/clarify.err"
clarify_status=$?
check "$clarify_status" 'clarify request is not reported as a permanent block'
grep -q 'route=clarify next.action=ask' "$PROJECT/clarify.out"
check "$?" 'clarify hook output asks one question'

printf '%s' '{"prompt":"删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。"}' |
  BLOCK_ON_HIGH=on ALIGN_NODE_COMMAND=w5-node-missing CLAUDE_PROJECT_DIR="$PROJECT" bash "$ADAPTER" > "$PROJECT/no-node-block.out" 2> "$PROJECT/no-node-block.err"
no_node_block_status=$?
[ "$no_node_block_status" -eq 2 ]
check "$?" 'no-Node shell fallback preserves native block status'

mkdir -p "$DEGRADED_PROJECT/.align"
printf '%s\n' 'bash -n .align/align-check.sh' > "$DEGRADED_PROJECT/.align/check-commands.txt"
printf '%s\n' '#!/usr/bin/env bash' 'true' > "$DEGRADED_PROJECT/.align/align-check.sh"
printf '%s\n' 'Project verification contract' > "$DEGRADED_PROJECT/.align/spec.md"
printf '%s\n' 'Project facts' > "$DEGRADED_PROJECT/.align/facts.md"
printf '%s' '{"session_id":"w5-degraded","prompt":"只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。"}' |
  BLOCK_ON_HIGH=on ALIGN_NODE_COMMAND=w5-node-missing CLAUDE_PROJECT_DIR="$DEGRADED_PROJECT" bash "$ADAPTER" > "$DEGRADED_PROJECT/prompt.out" 2> "$DEGRADED_PROJECT/prompt.err"
degraded_prompt_status=$?
[ "$degraded_prompt_status" -eq 2 ]
check "$?" 'no-Node executable route fails closed when baseline artifacts are unavailable'
if [ -d "$DEGRADED_PROJECT/.align/.runtime/lifecycle" ] &&
   find "$DEGRADED_PROJECT/.align/.runtime/lifecycle" -type f | grep -q .; then
  check 1 'degraded executable route cannot create BaselineReport or ExecutionHandoff artifacts'
else
  check 0 'degraded executable route cannot create BaselineReport or ExecutionHandoff artifacts'
fi

mkdir -p "$UNSAFE_PROJECT/.align"
printf '%s\n' 'bash -n .align/align-check.sh && touch .align/unsafe-marker' > "$UNSAFE_PROJECT/.align/check-commands.txt"
printf '%s\n' '#!/usr/bin/env bash' 'true' > "$UNSAFE_PROJECT/.align/align-check.sh"
printf '%s\n' 'Project verification contract' > "$UNSAFE_PROJECT/.align/spec.md"
printf '%s\n' 'Project facts' > "$UNSAFE_PROJECT/.align/facts.md"

printf '%s' '{"session_id":"w5-unsafe","prompt":"只修改 parser hook；完成后验证。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$UNSAFE_PROJECT" bash "$ADAPTER" > "$UNSAFE_PROJECT/prompt.out" 2> "$UNSAFE_PROJECT/prompt.err"
unsafe_prompt_status=$?
check "$unsafe_prompt_status" 'shell-linked verification request reaches the reference host'

printf '%s' '{"session_id":"w5-unsafe","hook_event_name":"Stop"}' |
  ALIGN_HOOK_PHASE=stop CLAUDE_PROJECT_DIR="$UNSAFE_PROJECT" bash "$ADAPTER" > "$UNSAFE_PROJECT/stop.out" 2> "$UNSAFE_PROJECT/stop.err"
unsafe_stop_status=$?
check "$unsafe_stop_status" 'unsafe verification does not block the Stop hook'
if [ -e "$UNSAFE_PROJECT/.align/unsafe-marker" ]; then
  check 1 'shell-linked verification cannot execute a chained command'
else
  check 0 'shell-linked verification cannot execute a chained command'
fi
grep -q '"status":"verification_failed"' "$UNSAFE_PROJECT/.align/.runtime/reference-host.log"
check "$?" 'unsafe verification is recorded as failed evidence'

mkdir -p "$SESSION_PROJECT/.align"
printf '%s\n' 'bash -n .align/align-check.sh' > "$SESSION_PROJECT/.align/check-commands.txt"
printf '%s\n' '#!/usr/bin/env bash' 'true' > "$SESSION_PROJECT/.align/align-check.sh"
printf '%s\n' 'Project verification contract' > "$SESSION_PROJECT/.align/spec.md"
printf '%s\n' 'Project facts' > "$SESSION_PROJECT/.align/facts.md"

printf '%s' '{"session_id":"session-a","prompt":"只修改 parser；token=secret-value；完成后验证并运行 bash -n .align/align-check.sh。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$SESSION_PROJECT" bash "$ADAPTER" > "$SESSION_PROJECT/session-a.out" 2> "$SESSION_PROJECT/session-a.err"
session_a_prompt_status=$?
check "$session_a_prompt_status" 'session A creates a reference-host handoff'

printf '%s' '{"session_id":"session-b","hook_event_name":"Stop"}' |
  ALIGN_HOOK_PHASE=stop CLAUDE_PROJECT_DIR="$SESSION_PROJECT" bash "$ADAPTER" > "$SESSION_PROJECT/session-b-stop.out" 2> "$SESSION_PROJECT/session-b-stop.err"
grep -q 'status=not_observable' "$SESSION_PROJECT/session-b-stop.out"
check "$?" 'session B cannot consume session A completion state'

printf '%s' '{"session_id":"session-a","hook_event_name":"Stop"}' |
  ALIGN_HOOK_PHASE=stop CLAUDE_PROJECT_DIR="$SESSION_PROJECT" bash "$ADAPTER" > "$SESSION_PROJECT/session-a-stop.out" 2> "$SESSION_PROJECT/session-a-stop.err"
grep -q 'status=verified' "$SESSION_PROJECT/session-a-stop.out"
check "$?" 'session A Stop hook completes its own handoff'
if grep -qE 'session-a|session-b|session_id' "$SESSION_PROJECT/.align/.runtime/reference-host.log"; then
  check 1 'session correlation does not log raw session identifiers'
else
  check 0 'session correlation does not log raw session identifiers'
fi

mkdir -p "$NO_SESSION_PROJECT/.align"
printf '%s\n' 'bash -n .align/align-check.sh' > "$NO_SESSION_PROJECT/.align/check-commands.txt"
printf '%s\n' '#!/usr/bin/env bash' 'true' > "$NO_SESSION_PROJECT/.align/align-check.sh"
printf '%s\n' 'Project verification contract' > "$NO_SESSION_PROJECT/.align/spec.md"
printf '%s\n' 'Project facts' > "$NO_SESSION_PROJECT/.align/facts.md"
printf '%s' '{"prompt":"只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$NO_SESSION_PROJECT" bash "$ADAPTER" > "$NO_SESSION_PROJECT/prompt.out" 2> "$NO_SESSION_PROJECT/prompt.err"
no_session_prompt_status=$?
[ "$no_session_prompt_status" -eq 2 ]
check "$?" 'missing session id blocks an executable UserPromptSubmit before lifecycle handoff'
if [ -d "$NO_SESSION_PROJECT/.align/.runtime/lifecycle" ] &&
   find "$NO_SESSION_PROJECT/.align/.runtime/lifecycle" -type f | grep -q .; then
  check 1 'missing session id cannot create BaselineReport or ExecutionHandoff artifacts'
else
  check 0 'missing session id cannot create BaselineReport or ExecutionHandoff artifacts'
fi
printf '%s' '{"hook_event_name":"Stop"}' |
  ALIGN_HOOK_PHASE=stop CLAUDE_PROJECT_DIR="$NO_SESSION_PROJECT" bash "$ADAPTER" > "$NO_SESSION_PROJECT/stop.out" 2> "$NO_SESSION_PROJECT/stop.err"
grep -q 'status=not_observable' "$NO_SESSION_PROJECT/stop.out"
check "$?" 'missing session id cannot create or consume lifecycle state'

mkdir -p "$BASELINE_FAILURE_PROJECT/.align/.runtime"
printf '%s\n' 'bash -n .align/align-check.sh' > "$BASELINE_FAILURE_PROJECT/.align/check-commands.txt"
printf '%s\n' '#!/usr/bin/env bash' 'true' > "$BASELINE_FAILURE_PROJECT/.align/align-check.sh"
printf '%s\n' 'Project verification contract' > "$BASELINE_FAILURE_PROJECT/.align/spec.md"
printf '%s\n' 'Project facts' > "$BASELINE_FAILURE_PROJECT/.align/facts.md"
printf '%s\n' 'not-a-directory' > "$BASELINE_FAILURE_PROJECT/.align/.runtime/lifecycle"
printf '%s' '{"session_id":"w5-baseline-failure","prompt":"只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。"}' |
  BLOCK_ON_HIGH=on CLAUDE_PROJECT_DIR="$BASELINE_FAILURE_PROJECT" bash "$ADAPTER" > "$BASELINE_FAILURE_PROJECT/prompt.out" 2> "$BASELINE_FAILURE_PROJECT/prompt.err"
baseline_failure_status=$?
[ "$baseline_failure_status" -eq 2 ]
check "$?" 'Claude blocks execution when the required baseline artifact cannot be persisted'
if [ -f "$BASELINE_FAILURE_PROJECT/.align/.runtime/reference-host.log" ] &&
   grep -q 'execution-handoff' "$BASELINE_FAILURE_PROJECT/.align/.runtime/reference-host.log"; then
  check 1 'baseline persistence failure cannot create an execution handoff'
else
  check 0 'baseline persistence failure cannot create an execution handoff'
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo 'PASS: W5 Claude reference-host hook loop'
