#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROUTER="$ROOT/core/host/align-route.sh"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

mkdir -p "$SANDBOX/bin"
printf '%s\n' '#!/usr/bin/env bash' "printf '%s\\n' invoked > '$SANDBOX/node-invoked'" 'exit 99' > "$SANDBOX/bin/node"
chmod +x "$SANDBOX/bin/node"

pass=0
assert_projection() {
  local label="$1" router="$2" prompt="$3" expected="$4" actual
  actual="$(PATH="$SANDBOX/bin:$PATH" ALIGN_ARBITER=off bash "$router" --decision "$prompt" 2>"$SANDBOX/$label.err")"
  if [ "$actual" != "$expected" ]; then
    printf 'FAIL [%s]\nexpected=%s\nactual=%s\n' "$label" "$expected" "$actual"
    exit 1
  fi
  if [ -s "$SANDBOX/$label.err" ]; then
    echo "FAIL [$label]: shell runtime leaked an evaluation error"
    cat "$SANDBOX/$label.err"
    exit 1
  fi
  pass=$((pass + 1))
}

awk '
  /^# policy-projection:begin$/ { omitted=1; next }
  /^# policy-projection:end$/ { omitted=0; next }
  !omitted { print }
' "$ROUTER" > "$SANDBOX/missing-projection.sh"

prompt='删除旧用户数据。'
expected=$'clarify\truntime.degraded\task\ttrue'
assert_projection missing-projection "$SANDBOX/missing-projection.sh" "$prompt" "$expected"

assert_projection high-risk-incomplete "$ROUTER" '删除旧用户数据。' \
  $'clarify\trisk.data_mutation,intent.ambiguous_goal,scope.impact_unknown,verification.missing,diagnosis.score_below_threshold\task\ttrue'
assert_projection production-confirmation "$ROUTER" \
  '删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。' \
  $'block\tauthorization.confirmation_missing,risk.production_change,risk.data_mutation\twait_confirmation\ttrue'
assert_projection policy-prohibited "$ROUTER" \
  '执行 git reset --hard，保持其他配置不变，并运行测试。' \
  $'block\tpolicy.operation_prohibited\tstop\ttrue'
assert_projection authorized-fixture "$ROUTER" \
  '在开发 fixture 中删除 3 个已列名的废弃测试用户，运行 fixture 测试；已授权。' \
  $'enrich\trisk.data_mutation,requirements.needs_enrichment\texecute\ttrue'

awk '
  /# 50: pass_complete_input/ { pass_rule=1 }
  pass_rule && /POLICY_ACTION=/ { sub(/POLICY_ACTION=.*/, "POLICY_ACTION=unknown_action"); pass_rule=0 }
  { print }
' "$ROUTER" > "$SANDBOX/unknown-action.sh"
assert_projection unknown-action "$SANDBOX/unknown-action.sh" \
  '只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。' \
  $'clarify\truntime.degraded\task\ttrue'

awk '
  /reason_add requirements.sufficient/ { sub(/requirements.sufficient/, "runtime.unknown_reason") }
  { print }
' "$ROUTER" > "$SANDBOX/unknown-reason.sh"
assert_projection unknown-reason "$SANDBOX/unknown-reason.sh" \
  '只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。' \
  $'clarify\truntime.degraded\task\ttrue'

if [ -e "$SANDBOX/node-invoked" ]; then
  echo "FAIL: no-Node shell runtime invoked Node.js"
  exit 1
fi

echo "PASS: no-Node shell safety and fail-closed matrix ($pass/$pass)"
