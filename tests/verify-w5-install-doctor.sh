#!/usr/bin/env bash
# W5: installation wires the complete Claude reference-host path and reports it.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

HOME="$SANDBOX" PROMPT_OPTIMIZER_ZIP="$ROOT" bash "$ROOT/scripts/install-skill.sh" claude > "$SANDBOX/install.out" 2> "$SANDBOX/install.err"
install_status=$?
[ "$install_status" -eq 0 ]

grep -q 'Claude Code: L3' "$SANDBOX/install.out"
doctor_reported=$?

HOME="$SANDBOX" CLAUDE_SETTINGS_PATH="$SANDBOX/.claude/settings.json" \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$ROOT" > "$SANDBOX/doctor.json"
doctor_status=$?

HOME="$SANDBOX" CLAUDE_SETTINGS_PATH="$SANDBOX/.claude/settings.json" ALIGN_NODE_COMMAND=w5-node-missing \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$ROOT" > "$SANDBOX/no-node-doctor.json"
no_node_status=$?

python3 - "$SANDBOX/.claude/settings.json" "$SANDBOX/doctor.json" <<'PYEOF'
import json, sys

settings = json.load(open(sys.argv[1], encoding='utf-8'))
events = settings.get('hooks', {})
commands = [
    hook.get('command', '')
    for group in events.get('UserPromptSubmit', []) + events.get('Stop', [])
    for hook in group.get('hooks', [])
]
assert any('UserPromptSubmit' not in command and 'ALIGN_HOOK_PHASE=stop' in command for command in commands)
assert any('BLOCK_ON_HIGH=on' in command for command in commands)

doctor = json.load(open(sys.argv[2], encoding='utf-8'))
assert doctor['runtime'] == 'installed'
assert doctor['projectContext'] == 'ready'
assert doctor['verificationChain'] == 'ready'
assert doctor['completionChain'] == 'ready'
assert doctor['hosts']['claude-code']['level'] == 'L3'
assert doctor['hosts']['claude-code']['executionReceipt'] == 'normal_stop_only'
assert doctor['hosts']['claude-code']['failedCancelled'] == 'unavailable'
PYEOF
doctor_shape_status=$?

python3 - "$SANDBOX/no-node-doctor.json" <<'PYEOF'
import json, sys
doctor = json.load(open(sys.argv[1], encoding='utf-8'))
assert doctor['node'] == 'missing'
assert doctor['hosts']['claude-code']['level'] == 'L1'
assert doctor['completionChain'] == 'missing'
PYEOF
no_node_shape_status=$?

python3 - "$SANDBOX/.claude/settings.json" "$SANDBOX/no-stop-settings.json" <<'PYEOF'
import json, sys
settings = json.load(open(sys.argv[1], encoding='utf-8'))
settings['hooks'].pop('Stop', None)
with open(sys.argv[2], 'w', encoding='utf-8') as handle:
    json.dump(settings, handle)
PYEOF
no_stop_settings_status=$?

HOME="$SANDBOX" CLAUDE_SETTINGS_PATH="$SANDBOX/no-stop-settings.json" \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$ROOT" > "$SANDBOX/no-stop-doctor.json"
no_stop_status=$?
HOME="$SANDBOX" CLAUDE_SETTINGS_PATH="$SANDBOX/no-stop-settings.json" \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" "$ROOT" > "$SANDBOX/no-stop-text-doctor.out"
no_stop_text_status=$?

python3 - "$SANDBOX/no-stop-doctor.json" <<'PYEOF'
import json, sys
doctor = json.load(open(sys.argv[1], encoding='utf-8'))
assert doctor['hook']['stop'] == 'missing'
assert doctor['completionChain'] == 'missing'
assert doctor['hosts']['claude-code']['level'] == 'L3'
assert doctor['hosts']['claude-code']['completion'] == 'unavailable'
PYEOF
no_stop_shape_status=$?

mkdir -p "$SANDBOX/no-context/.align"
cp "$ROOT/core/host/align-route.sh" "$SANDBOX/no-context/.align/align-route.sh"
printf '%s\n' 'bash -n .align/align-check.sh' > "$SANDBOX/no-context/.align/check-commands.txt"
printf '%s\n' '#!/usr/bin/env bash' 'true' > "$SANDBOX/no-context/.align/align-check.sh"
HOME="$SANDBOX" CLAUDE_SETTINGS_PATH="$SANDBOX/.claude/settings.json" \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$SANDBOX/no-context" > "$SANDBOX/no-context-doctor.json"
no_context_status=$?

python3 - "$SANDBOX/no-context-doctor.json" <<'PYEOF'
import json, sys
doctor = json.load(open(sys.argv[1], encoding='utf-8'))
assert doctor['projectContext'] == 'missing'
assert doctor['completionChain'] == 'missing'
PYEOF
no_context_shape_status=$?

python3 - "$SANDBOX/.claude/settings.json" "$SANDBOX/inert-settings.json" <<'PYEOF'
import json, sys
settings = json.load(open(sys.argv[1], encoding='utf-8'))
settings['hooks']['UserPromptSubmit'][0]['hooks'][0]['command'] = \
    'BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; echo trailing'
with open(sys.argv[2], 'w', encoding='utf-8') as handle:
    json.dump(settings, handle)
PYEOF
inert_settings_status=$?

HOME="$SANDBOX" CLAUDE_SETTINGS_PATH="$SANDBOX/inert-settings.json" \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$ROOT" > "$SANDBOX/inert-doctor.json"
inert_doctor_status=$?

python3 - "$SANDBOX/inert-doctor.json" <<'PYEOF'
import json, sys
doctor = json.load(open(sys.argv[1], encoding='utf-8'))
assert doctor['hook']['userPromptSubmit'] == 'missing'
assert doctor['hosts']['claude-code']['level'] == 'L1'
PYEOF
inert_shape_status=$?

mv "$SANDBOX/.prompt-optimizer/adapters/claude-code.sh" "$SANDBOX/missing-claude-adapter.sh"
missing_adapter_move_status=$?
HOME="$SANDBOX" CLAUDE_SETTINGS_PATH="$SANDBOX/.claude/settings.json" \
  bash "$SANDBOX/.prompt-optimizer/bin/align-doctor" --json "$ROOT" > "$SANDBOX/missing-adapter-doctor.json"
missing_adapter_doctor_status=$?

python3 - "$SANDBOX/missing-adapter-doctor.json" <<'PYEOF'
import json, sys
doctor = json.load(open(sys.argv[1], encoding='utf-8'))
assert doctor['completionChain'] == 'missing'
assert doctor['hosts']['claude-code']['level'] == 'L1'
PYEOF
missing_adapter_shape_status=$?

if [ "$install_status" -eq 0 ] && [ "$doctor_reported" -eq 0 ] &&
   [ "$doctor_status" -eq 0 ] && [ "$doctor_shape_status" -eq 0 ] &&
   [ "$no_node_status" -eq 0 ] && [ "$no_node_shape_status" -eq 0 ] &&
   [ "$no_stop_text_status" -ne 0 ] &&
   [ "$no_stop_settings_status" -eq 0 ] && [ "$no_stop_status" -eq 0 ] &&
   [ "$no_stop_shape_status" -eq 0 ] && [ "$no_context_status" -eq 0 ] &&
   [ "$no_context_shape_status" -eq 0 ] && [ "$inert_settings_status" -eq 0 ] &&
   [ "$inert_doctor_status" -eq 0 ] && [ "$inert_shape_status" -eq 0 ] &&
   [ "$missing_adapter_move_status" -eq 0 ] && [ "$missing_adapter_doctor_status" -eq 0 ] &&
   [ "$missing_adapter_shape_status" -eq 0 ]; then
  echo 'PASS: W5 install and doctor report the Claude reference-host chain'
  exit 0
fi

echo 'FAIL: W5 install and doctor report the Claude reference-host chain'
exit 1
