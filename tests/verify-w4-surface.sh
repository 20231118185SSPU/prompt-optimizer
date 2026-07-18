#!/usr/bin/env bash
# W4 surface gate: audit consumers, public exports, and shallow-module deletion.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$ROOT/dist/runtime"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo '=== Consumer graph (production sources only) ==='
for module in classifier router verifier lifecycle matt-handoff rules/generate; do
  count="$(rg -l "from ['\"]\./${module}|require\(['\"]\./${module}" \
    "$ROOT/core/host/pipeline/src" --glob '!__tests__/**' --glob '*.ts' | wc -l | tr -d '[:space:]')"
  printf '%s consumers=%s\n' "$module" "$count"
done

echo '=== Repository consumer inventory ==='
for module in classifier router verifier lifecycle matt-handoff rules/generate; do
  matches="$(rg -n "from ['\"]\.{1,2}/[^'\"]*${module}|from ['\"]\./${module}|require\(['\"][^'\"]*${module}" \
    "$ROOT/core" "$ROOT/tests" "$ROOT/scripts" "$ROOT/build" "$ROOT/docs" "$ROOT/README.md" \
    --glob '!dist/**' --glob '!core/host/pipeline/dist/**' 2>/dev/null || true)"
  if [ -n "$matches" ]; then
    printf '%s\n' "$matches"
  else
    printf '%s no repository consumer\n' "$module"
  fi
done

echo '=== Public export inventory ==='
exports="$(node -e "const value=require('./dist/runtime/runtime/index.js'); console.log(Object.keys(value).sort().join(' '))")"
printf '%s\n' "$exports"
case " $exports " in
  *' alignInstruction '*) ;;
  *) echo 'FAIL: alignInstruction is missing from the public seam' >&2; exit 1 ;;
esac
for forbidden in processInstruction enrich getVerificationCommands runVerification analyzeInstruction decideRoute LifecycleCoordinator buildMattHandoff generateCopilotRules; do
  case " $exports " in
    *" $forbidden "*) echo "FAIL: internal export remains public: $forbidden" >&2; exit 1 ;;
  esac
done

echo '=== Shallow-module deletion simulation ==='
cp -R "$RUNTIME/." "$TMP/"
for file in classifier.js classifier.d.ts router.js router.d.ts verifier.js verifier.d.ts lifecycle.js lifecycle.d.ts matt-handoff.js matt-handoff.d.ts matt-cli.js matt-cli.d.ts internal.js internal.d.ts rules/generate.js rules/generate.d.ts; do
  rm -f "$TMP/runtime/$file"
done
node -e '
const api = require(process.argv[1]);
const result = api.alignInstruction(
  "只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。",
  process.argv[2]
);
const decision = result.decision;
if (decision.kind !== "alignment.decision" || decision.route !== "pass" || decision.next.action !== "execute") {
  process.exit(1);
}
' "$TMP/runtime/alignment-interface.js" "$ROOT"
echo 'PASS: core Decision survives deletion of shallow compatibility modules'
