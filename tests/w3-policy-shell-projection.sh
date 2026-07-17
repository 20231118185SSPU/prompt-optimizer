#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HELPER="$ROOT/build/policy-projection.js"
ROUTER="$ROOT/core/host/align-route.sh"
POLICY="$ROOT/core/contracts/decision-policy.json"
SCHEMA="$ROOT/core/contracts/decision-policy.schema.json"
REGISTRY="$ROOT/core/contracts/reason-registry.json"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

if [ ! -f "$HELPER" ]; then
  echo "FAIL: missing policy projection helper: $HELPER"
  exit 1
fi

if ! node "$HELPER" --check --router "$ROUTER"; then
  echo "FAIL: shell policy projection is stale"
  exit 1
fi

cp "$ROUTER" "$SANDBOX/align-route.sh"
cp "$POLICY" "$SANDBOX/decision-policy.json"
node - "$SANDBOX/decision-policy.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
const passRule = policy.routePrecedence.find(rule => rule.id === 'pass_complete_input');
passRule.when.conditions.find(condition => condition.op === 'score_total').value = 9;
fs.writeFileSync(file, `${JSON.stringify(policy, null, 2)}\n`);
NODE
if node "$HELPER" --check \
  --policy "$SANDBOX/decision-policy.json" \
  --schema "$SCHEMA" \
  --registry "$REGISTRY" \
  --router "$ROUTER" >/dev/null 2>&1; then
  echo "FAIL: policy mutation was not detected as a stale shell projection"
  exit 1
fi
node "$HELPER" --write \
  --policy "$SANDBOX/decision-policy.json" \
  --schema "$SCHEMA" \
  --registry "$REGISTRY" \
  --router "$SANDBOX/align-route.sh"

prompt='只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。'
default_projection="$(ALIGN_ARBITER=off bash "$ROUTER" --decision "$prompt")"
mutated_projection="$(ALIGN_ARBITER=off bash "$SANDBOX/align-route.sh" --decision "$prompt")"
if [ "$(printf '%s' "$default_projection" | cut -f1,3)" != $'pass\texecute' ]; then
  echo "FAIL: default policy no longer routes complete low-risk input to pass/execute"
  exit 1
fi
if [ "$(printf '%s' "$mutated_projection" | cut -f1,3)" != $'clarify\task' ]; then
  echo "FAIL: mutating the policy rule did not change shell production evaluation"
  exit 1
fi

expect_invalid() {
  local label="$1"
  shift
  if node "$HELPER" --validate "$@" >/dev/null 2>"$SANDBOX/$label.err"; then
    echo "FAIL: invalid fixture was accepted: $label"
    exit 1
  fi
}

cp "$POLICY" "$SANDBOX/unknown-operator.json"
node - "$SANDBOX/unknown-operator.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
policy.routePrecedence[0].when.op = 'unknown_operator';
fs.writeFileSync(file, JSON.stringify(policy));
NODE
expect_invalid unknown-operator --policy "$SANDBOX/unknown-operator.json" --schema "$SCHEMA" --registry "$REGISTRY"

cp "$POLICY" "$SANDBOX/unknown-reason.json"
node - "$SANDBOX/unknown-reason.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
policy.routePrecedence[0].when.codes = ['runtime.unknown_reason'];
fs.writeFileSync(file, JSON.stringify(policy));
NODE
expect_invalid unknown-reason --policy "$SANDBOX/unknown-reason.json" --schema "$SCHEMA" --registry "$REGISTRY"

cp "$POLICY" "$SANDBOX/invalid-action.json"
node - "$SANDBOX/invalid-action.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
policy.routePrecedence.find(rule => rule.route === 'pass').nextActions = ['ask'];
fs.writeFileSync(file, JSON.stringify(policy));
NODE
expect_invalid invalid-action --policy "$SANDBOX/invalid-action.json" --schema "$SCHEMA" --registry "$REGISTRY"

printf '%s\n' '{not-json' > "$SANDBOX/invalid-schema.json"
expect_invalid invalid-schema --policy "$POLICY" --schema "$SANDBOX/invalid-schema.json" --registry "$REGISTRY"
expect_invalid missing-policy --policy "$SANDBOX/missing-policy.json" --schema "$SCHEMA" --registry "$REGISTRY"
expect_invalid missing-registry --policy "$POLICY" --schema "$SCHEMA" --registry "$SANDBOX/missing-registry.json"

cp "$ROUTER" "$SANDBOX/no-match-router.sh"
cp "$POLICY" "$SANDBOX/no-match-policy.json"
node - "$SANDBOX/no-match-policy.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const policy = JSON.parse(fs.readFileSync(file, 'utf8'));
policy.routePrecedence = policy.routePrecedence.filter(rule => rule.id === 'pass_complete_input');
fs.writeFileSync(file, JSON.stringify(policy));
NODE
node "$HELPER" --write \
  --policy "$SANDBOX/no-match-policy.json" \
  --schema "$SCHEMA" \
  --registry "$REGISTRY" \
  --router "$SANDBOX/no-match-router.sh"
no_match="$(ALIGN_ARBITER=off bash "$SANDBOX/no-match-router.sh" --decision '优化登录。')"
if [ "$no_match" != $'clarify\truntime.degraded\task\ttrue' ]; then
  printf 'FAIL: no matching policy rule did not fail closed\nactual=%s\n' "$no_match"
  exit 1
fi

echo "PASS: shell projection is current, mutable, strictly validated, and fail closed"
