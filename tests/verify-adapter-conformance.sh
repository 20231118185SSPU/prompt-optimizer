#!/usr/bin/env bash
# Distributed adapters must preserve every golden route and next.action.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS="$ROOT/core/contracts/golden/alignment-cases.jsonl"
CLAUDE_ADAPTER="$ROOT/dist/runtime/adapters/claude-code.sh"
CODEX_ADAPTER="$ROOT/dist/runtime/adapters/codex.sh"
CLI="$ROOT/dist/runtime/runtime/index.js"
SHELL_ROUTER="$ROOT/dist/runtime/runtime/shell/align-route.sh"
PROJECT="$(mktemp -d)"
trap 'rm -rf "$PROJECT"' EXIT

fail=0
case_total=0
case_pass=0
projection_total=0
projection_pass=0
decode_b64() {
  if base64 --help 2>&1 | grep -q -- '--decode'; then base64 --decode; else base64 -D; fi
}

while IFS='|' read -r id prompt_b64 context_b64 expected_route expected_action; do
  [ -n "$id" ] || continue
  case_total=$((case_total + 1))
  case_failed=0
  expected_action="${expected_action%$'\r'}"
  prompt="$(printf '%s' "$prompt_b64" | decode_b64)"
  context_json="$(printf '%s' "$context_b64" | decode_b64)"
  context_refs="$(printf '%s' "$context_json" | python3 -c 'import json,sys; print(",".join(f"{x[chr(107)+chr(105)+chr(110)+chr(100)]}:{x[chr(114)+chr(101)+chr(102)]}" for x in json.load(sys.stdin)))')"
  expected="$expected_route"$'\t'"$expected_action"
  case_project="$PROJECT/$id"
  mkdir -p "$case_project"
  if printf '%s' "$context_json" | python3 -c 'import json,sys; raise SystemExit(0 if any(x.get("kind") == "project" for x in json.load(sys.stdin)) else 1)'; then
    mkdir -p "$case_project/.align"
    printf '%s\n' 'Parser target and public API constraints are available.' > "$case_project/.align/spec.md"
    printf '%s\n' 'npm test -- parser' > "$case_project/.align/check-commands.txt"
  fi

  codex="$(bash "$CODEX_ADAPTER" "$prompt" "$case_project" 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["route"]+"\t"+d["next"]["action"])')"
  # Cursor's user channel is Brief-only; route/action conformance uses the canonical public interface.
  cursor="$(node -e 'const { alignInstruction } = require(process.argv[1]); const result = alignInstruction(process.argv[2], process.argv[3], { hostCapabilities: { adapter: "cursor" } }); process.stdout.write(`${result.decision.route}\t${result.decision.next.action}`);' "$CLI" "$prompt" "$case_project")"
  hook_json="$(CASE_ID="$id" PROMPT="$prompt" PYTHONIOENCODING=utf-8 python3 -c 'import json,os; print(json.dumps({"session_id":"conformance-"+os.environ["CASE_ID"],"prompt":os.environ["PROMPT"]}, ensure_ascii=False))')"
  claude="$(printf '%s' "$hook_json" | BLOCK_ON_HIGH=off CLAUDE_PROJECT_DIR="$case_project" bash "$CLAUDE_ADAPTER" | sed -n 's/.*route=\([a-z_]*\) next.action=\([a-z_]*\).*/\1\t\2/p' | head -1)"
  claude_shell="$(printf '%s' "$hook_json" | ALIGN_NODE_COMMAND=__missing_node__ BLOCK_ON_HIGH=off CLAUDE_PROJECT_DIR="$case_project" bash "$CLAUDE_ADAPTER" | sed -n 's/.*route=\([a-z_]*\) next.action=\([a-z_]*\).*/\1\t\2/p' | head -1)"
  shell="$(ALIGN_CONTEXT_REFS="$context_refs" ALIGN_ARBITER=off bash "$SHELL_ROUTER" --decision "$prompt" | cut -f1,3)"

  for adapter_projection in "codex:$codex" "cursor:$cursor" "claude:$claude" "claude-shell:$claude_shell" "shell:$shell"; do
    adapter="${adapter_projection%%:*}"
    actual="${adapter_projection#*:}"
    projection_total=$((projection_total + 1))
    if [ "$actual" != "$expected" ]; then
      printf 'FAIL adapter [%s] %s: expected=%s actual=%s\n' "$id" "$adapter" "$expected" "$actual"
      fail=1
      case_failed=1
    else
      projection_pass=$((projection_pass + 1))
    fi
  done
  if [ "$case_failed" -eq 0 ]; then case_pass=$((case_pass + 1)); fi
done < <(python3 - "$CORPUS" <<'PYEOF'
import base64, json, sys
for line in open(sys.argv[1], encoding="utf-8"):
    case = json.loads(line)
    prompt = base64.b64encode(case["input"]["text"].encode()).decode()
    context = base64.b64encode(json.dumps(case["input"].get("context", []), ensure_ascii=False).encode()).decode()
    print("|".join([case["id"], prompt, context, case["expect"]["route"], case["expect"]["next"]["action"]]))
PYEOF
)

[ "$fail" -eq 0 ] || exit 1
echo "PASS: Claude, Codex, Cursor, and shell fallback match golden route/action (cases=$case_pass/$case_total projections=$projection_pass/$projection_total)"
