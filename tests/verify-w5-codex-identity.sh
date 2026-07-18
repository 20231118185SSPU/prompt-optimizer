#!/usr/bin/env bash
# W5-08: the distributed Codex adapter must expose the same Decision identity
# as the public alignInstruction seam, with truthful Codex host attribution.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$ROOT/dist/runtime/runtime/index.js"
ADAPTER="$ROOT/dist/runtime/adapters/codex.sh"
PROJECT="$(mktemp -d)"
trap 'rm -rf "$PROJECT"' EXIT

mkdir -p "$PROJECT/.align"
printf '%s\n' 'Project verification contract' > "$PROJECT/.align/spec.md"
printf '%s\n' 'Project facts' > "$PROJECT/.align/facts.md"

INSTRUCTION='只修改 parser；不得改公开 API；完成后运行 npm test -- parser。'
EXPECTED="$(node -e '
const runtime = require(process.argv[1]);
const result = runtime.alignInstruction(process.argv[2], process.argv[3], {
  hostCapabilities: { adapter: "codex" }
});
process.stdout.write(JSON.stringify(result.decision));
' "$RUNTIME" "$INSTRUCTION" "$PROJECT")"
ACTUAL="$(bash "$ADAPTER" "$INSTRUCTION" "$PROJECT" 2>/dev/null)"

EXPECTED="$EXPECTED" ACTUAL="$ACTUAL" python3 - <<'PYEOF'
import json
import os

expected = json.loads(os.environ['EXPECTED'])
actual = json.loads(os.environ['ACTUAL'])

assert actual['requestId'] == expected['requestId']
assert actual['decisionId'] == expected['decisionId']
assert actual['route'] == expected['route']
assert actual['next']['action'] == expected['next']['action']
assert actual['host']['adapter'] == 'codex'
PYEOF

echo 'PASS: W5 Codex adapter preserves Decision identity and host attribution'
