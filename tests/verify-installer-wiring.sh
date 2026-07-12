#!/usr/bin/env bash
# verify-installer-wiring.sh — 安装器 hook 接线沙箱测试
# 在假 HOME 中测试：安装接线 → 幂等 → 旧 hook 升级 → 卸载移除 → 用户内容零损伤
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

export HOME="$SANDBOX/home"
mkdir -p "$HOME/.claude"

HOOK_CMD='if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi'
OLD_ANCHORED_CMD='bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true'
LEGACY_CMD='cat .align/HOOK-REMINDER.txt 2>/dev/null || true'
OLD_RELATIVE_CMD='bash .align/align-route.sh 2>/dev/null || cat .align/HOOK-REMINDER.txt 2>/dev/null || true'

fail=0
check() { # check <desc> <cond-exit-code>
  if [ "$2" -eq 0 ]; then echo "PASS: $1"; else echo "FAIL: $1"; fail=1; fi
}

json_has_cmd() { # json_has_cmd <file> <cmd>
  CMD="$2" python3 - "$1" <<'PYEOF'
import json, os, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
cmd = os.environ["CMD"]
found = any(h.get("command") == cmd
            for g in data.get("hooks", {}).get("UserPromptSubmit", [])
            for h in g.get("hooks", []))
sys.exit(0 if found else 1)
PYEOF
}

json_cmd_count() { # json_cmd_count <file> <cmd>
  CMD="$2" python3 - "$1" <<'PYEOF'
import json, os, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
cmd = os.environ["CMD"]
print(sum(h.get("command") == cmd
          for g in data.get("hooks", {}).get("UserPromptSubmit", [])
          for h in g.get("hooks", [])))
PYEOF
}

write_settings_with_cmd() { # write_settings_with_cmd <file> <cmd>
  CMD="$2" python3 - "$1" <<'PYEOF'
import json, os, sys
data = {
    "env": {"MY_KEY": "my-value"},
    "hooks": {"UserPromptSubmit": [{"hooks": [{
        "type": "command",
        "command": os.environ["CMD"],
    }]}]},
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False)
    f.write("\n")
PYEOF
}

env_preserved() { # env_preserved <file>
  python3 -c "import json,sys; d=json.load(open(sys.argv[1], encoding='utf-8')); sys.exit(0 if d.get('env',{}).get('MY_KEY')=='my-value' else 1)" "$1"
}

run_install() {
  PROMPT_OPTIMIZER_ZIP="$ROOT" bash "$ROOT/scripts/install-skill.sh" claude >/dev/null 2>&1
}

echo "=== Test 0: 未认领 runtime 目录 → 拒绝覆盖 ==="
mkdir -p "$HOME/.prompt-optimizer"
printf '%s\n' 'user data' > "$HOME/.prompt-optimizer/user-file"
run_install
[ $? -ne 0 ]; check "unowned runtime directory refused" $?
test -f "$HOME/.prompt-optimizer/user-file"; check "unowned runtime content preserved" $?
rm -rf "$HOME/.prompt-optimizer"

echo "=== Test 1: 全新安装 → hook 接线 + env 保留 ==="
cat > "$HOME/.claude/settings.json" <<'EOF'
{"env": {"MY_KEY": "my-value"}}
EOF
run_install
json_has_cmd "$HOME/.claude/settings.json" "$HOOK_CMD"; check "hook added on fresh install" $?
env_preserved "$HOME/.claude/settings.json"
check "existing env preserved" $?
test -d "$HOME/.claude/skills/optimize-prompt-lite"; check "lite skill installed" $?
test -f "$HOME/.prompt-optimizer/runtime/index.js"; check "structured runtime installed" $?
test -f "$HOME/.prompt-optimizer/bin/align-doctor"; check "doctor installed" $?
test -f "$HOME/.prompt-optimizer/adapters/claude-code.sh"; check "Claude adapter installed" $?
test -f "$HOME/.prompt-optimizer/adapters/codex.sh"; check "Codex adapter installed" $?
printf '%s' '{"prompt":"[直出] 删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。"}' |
  CLAUDE_PROJECT_DIR="$ROOT" bash -c "$HOOK_CMD" > "$SANDBOX/hook-out" 2> "$SANDBOX/hook-err"
HOOK_STATUS=$?
[ "$HOOK_STATUS" -eq 2 ]; check "installed Claude hook reaches runtime adapter and blocks (status=$HOOK_STATUS)" $?
DOCTOR_JSON="$(CLAUDE_SETTINGS_PATH="$HOME/.claude/settings.json" bash "$HOME/.prompt-optimizer/bin/align-doctor" --json "$ROOT")"
printf '%s' "$DOCTOR_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); raise SystemExit(0 if d["hosts"]["claude-code"]["level"] == "L3" else 1)'
check "doctor reports activated Claude L3 wiring" $?

echo "=== Test 2: 重复安装 → 幂等（hook 不重复）==="
touch "$HOME/.prompt-optimizer/stale-file"
run_install
COUNT=$(json_cmd_count "$HOME/.claude/settings.json" "$HOOK_CMD")
[ "$COUNT" -eq 1 ]; check "hook not duplicated (count=$COUNT)" $?
test ! -e "$HOME/.prompt-optimizer/stale-file"; check "runtime upgrade removes stale files" $?

echo "=== Test 3: 旧版 hook → 原位升级 ==="
write_settings_with_cmd "$HOME/.claude/settings.json" "$LEGACY_CMD"
run_install
json_has_cmd "$HOME/.claude/settings.json" "$HOOK_CMD"; check "legacy hook upgraded" $?
json_has_cmd "$HOME/.claude/settings.json" "$LEGACY_CMD"
[ $? -ne 0 ]; check "legacy command removed after upgrade" $?

echo "=== Test 3b: 旧版相对路径 hook（CWD 劫持漏洞）→ 升级为项目锚定 ==="
write_settings_with_cmd "$HOME/.claude/settings.json" "$OLD_RELATIVE_CMD"
run_install
json_has_cmd "$HOME/.claude/settings.json" "$HOOK_CMD"; check "old relative hook upgraded to anchored" $?
json_has_cmd "$HOME/.claude/settings.json" "$OLD_RELATIVE_CMD"
[ $? -ne 0 ]; check "vulnerable relative command removed after upgrade" $?
COUNT=$(json_cmd_count "$HOME/.claude/settings.json" "$HOOK_CMD")
[ "$COUNT" -eq 1 ]; check "no duplicate hook after relative->anchored upgrade (count=$COUNT)" $?

echo "=== Test 3c: 旧版吞退出码 hook → 升级为退出码透传 ==="
write_settings_with_cmd "$HOME/.claude/settings.json" "$OLD_ANCHORED_CMD"
run_install
json_has_cmd "$HOME/.claude/settings.json" "$HOOK_CMD"; check "old anchored hook upgraded to exit-code-preserving command" $?
json_has_cmd "$HOME/.claude/settings.json" "$OLD_ANCHORED_CMD"
[ $? -ne 0 ]; check "exit-code-swallowing hook removed after upgrade" $?

echo "=== Test 4: 卸载 → 只移除自己的 hook，用户 hook 零损伤 ==="
python3 - "$HOME/.claude/settings.json" <<'PYEOF'
import json, sys
p = sys.argv[1]
d = json.load(open(p, encoding="utf-8"))
d["hooks"]["UserPromptSubmit"].append({"hooks": [{"type": "command", "command": "echo user-own-hook"}]})
json.dump(d, open(p, "w", encoding="utf-8"), indent=2)
PYEOF
bash "$ROOT/scripts/install-skill.sh" --uninstall claude >/dev/null 2>&1
json_has_cmd "$HOME/.claude/settings.json" "$HOOK_CMD"
[ $? -ne 0 ]; check "our hook removed on uninstall" $?
json_has_cmd "$HOME/.claude/settings.json" "echo user-own-hook"; check "user's own hook untouched" $?
env_preserved "$HOME/.claude/settings.json"
check "env still preserved after uninstall" $?
test ! -d "$HOME/.claude/skills/optimize-prompt"; check "skills removed" $?
test ! -d "$HOME/.prompt-optimizer"; check "runtime removed" $?

echo ""
if [ "$fail" -eq 0 ]; then
  echo "=== All installer wiring tests passed ==="
else
  echo "=== Installer wiring tests FAILED ==="
  exit 1
fi
