#!/usr/bin/env bash
# TypeScript runtime and shell fallback must agree on route + reason + action projection.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS="$ROOT/core/contracts/golden/alignment-cases.jsonl"
CLI="$ROOT/core/host/pipeline/dist/index.js"
ROUTERS=(
  "$ROOT/core/host/align-route.sh"
  "$ROOT/dist/runtime/runtime/shell/align-route.sh"
  "$ROOT/.align/align-route.sh"
)

if [ ! -f "$CLI" ]; then
  echo "FAIL: TypeScript runtime is not built: $CLI"
  exit 1
fi

fail=0
case_total=0
case_pass=0
projection_total=0
projection_pass=0
decode_b64() {
  if base64 --help 2>&1 | grep -q -- '--decode'; then
    base64 --decode
  else
    base64 -D
  fi
}

while IFS='|' read -r id prompt_b64 context_b64 expected_route expected_reasons expected_action; do
  [ -n "$id" ] || continue
  case_total=$((case_total + 1))
  case_failed=0
  expected_reasons="${expected_reasons%$'\r'}"
  expected_action="${expected_action%$'\r'}"
  prompt="$(printf '%s' "$prompt_b64" | decode_b64)"
  context_json="$(printf '%s' "$context_b64" | decode_b64)"
  context_refs="$(printf '%s' "$context_json" | python3 -c 'import json,sys; print(",".join(f"{x[chr(107)+chr(105)+chr(110)+chr(100)]}:{x[chr(114)+chr(101)+chr(102)]}" for x in json.load(sys.stdin)))')"
  ts_projection="$(PROMPT="$prompt" CONTEXT_JSON="$context_json" node - "$ROOT/core/host/pipeline/dist" <<'NODEEOF'
const base = process.argv[2];
const { analyzeInstruction } = require(base + '/analyzer.js');
const { buildAlignmentDecision } = require(base + '/contract-builder.js');
const decision = buildAlignmentDecision(analyzeInstruction(process.env.PROMPT, JSON.parse(process.env.CONTEXT_JSON)));
process.stdout.write(decision.route + '\t' + decision.reasons.join(',') + '\t' + decision.next.action);
NODEEOF
)"
  expected="$expected_route"$'\t'"$expected_reasons"$'\t'"$expected_action"
  projection_total=$((projection_total + 1))
  if [ "$ts_projection" != "$expected" ]; then
    printf 'FAIL TypeScript [%s]: expected=%s actual=%s\n' "$id" "$expected" "$ts_projection"
    fail=1
    case_failed=1
  else
    projection_pass=$((projection_pass + 1))
  fi
  for router in "${ROUTERS[@]}"; do
    projection_total=$((projection_total + 1))
    actual="$(ALIGN_CONTEXT_REFS="$context_refs" ALIGN_ARBITER=off bash "$router" --decision "$prompt")"
    if [ "$actual" != "$expected"$'\t''true' ]; then
      printf 'FAIL shell [%s] %s: expected=%s actual=%s\n' "$id" "$router" "$expected"$'\t''true' "$actual"
      fail=1
      case_failed=1
    else
      projection_pass=$((projection_pass + 1))
    fi
  done
  if [ "$case_failed" -eq 0 ]; then case_pass=$((case_pass + 1)); fi
done < <(python3 - "$CORPUS" <<'PYEOF'
import json, sys
import base64
for line in open(sys.argv[1], encoding="utf-8"):
    case = json.loads(line)
    prompt = base64.b64encode(case["input"]["text"].encode()).decode()
    context = base64.b64encode(json.dumps(case["input"].get("context", []), ensure_ascii=False).encode()).decode()
    expect = case["expect"]
    fields = [case["id"], prompt, context, expect["route"], ",".join(expect["reasons"]), expect["next"]["action"]]
    print("|".join(fields))
PYEOF
)

[ "$fail" -eq 0 ] || exit 1
echo "PASS: Node, core shell, distributed shell, and project shell match golden route/reason/action (cases=$case_pass/$case_total projections=$projection_pass/$projection_total)"
