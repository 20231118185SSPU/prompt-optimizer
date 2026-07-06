#!/usr/bin/env bash
# align-check.sh — 一键交付验证 + 债务台账（R8 验证门的机械化落地）
# 用法：
#   align-check.sh          跑 .align/check-commands.txt 中全部验证 + 债务扫描
#   align-check.sh --debt   只跑债务扫描
# 验证命令清单由 align-init 写入 .align/check-commands.txt（每行一条可执行命令，# 开头为注释）
set -u

ALIGN_DIR=".align"
CMDS="$ALIGN_DIR/check-commands.txt"
DEBT="$ALIGN_DIR/debt.md"
ONLY_DEBT=0
[ "${1:-}" = "--debt" ] && ONLY_DEBT=1

overall=0

# ── 1. 跑项目验证命令 ──
if [ "$ONLY_DEBT" -eq 0 ]; then
  if [ -f "$CMDS" ]; then
    echo "== align-check: 项目验证 =="
    echo "（正在执行 $CMDS 中的命令，请确认信任当前仓库）"
    n=0
    while IFS= read -r cmd; do
      case "$cmd" in ''|'#'*) continue ;; esac
      n=$((n+1))
      if bash -c "$cmd" >/dev/null 2>&1; then
        printf 'PASS: %s\n' "$cmd"
      else
        printf 'FAIL: %s\n' "$cmd"
        overall=1
      fi
    done < "$CMDS"
    [ "$n" -eq 0 ] && echo "(check-commands.txt 为空——请让 align-init 写入项目验证命令)"
  else
    echo "== align-check: 未找到 $CMDS，跳过项目验证（先运行 /align-init）=="
  fi
fi

# ── 2. 债务扫描：git 工作区新增的 TODO/FIXME/HACK 未登记 → 记入台账 ──
echo ""
echo "== align-check: 债务扫描 =="
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  NEW_DEBT="$(git diff HEAD --unified=0 2>/dev/null | grep -E '^\+' | grep -vE '^\+\+\+' \
    | grep -oiE '(TODO|FIXME|HACK|XXX)[:：].*' | tr -d '\r' | sort -u || true)"
  if [ -n "$NEW_DEBT" ]; then
    [ -f "$DEBT" ] || printf '# 债务台账\n\n> 每项债务要么当场清偿，要么在此登记并在后续会话被追讨。\n\n' > "$DEBT"
    added=0
    while IFS= read -r item; do
      [ -z "$item" ] && continue
      if ! grep -qF "$item" "$DEBT" 2>/dev/null; then
        printf -- '- [ ] %s（登记于 align-check）\n' "$item" >> "$DEBT"
        added=$((added+1))
      fi
    done <<EOF
$NEW_DEBT
EOF
    [ "$added" -gt 0 ] && echo "本次改动引入 $added 条新债务，已登记到 $DEBT——请当场处理或向用户说明"
  fi
fi
if [ -s "$DEBT" ]; then
  OPEN=$(grep -cE '^- \[ \]' "$DEBT" 2>/dev/null || echo 0)
  echo "未清偿债务：${OPEN:-0} 项（$DEBT）"
else
  echo "债务台账：无"
fi

echo ""
if [ "$overall" -eq 0 ]; then
  echo "=== align-check PASS ==="
else
  echo "=== align-check FAIL：修复后才能交付（R8 验证门）==="
fi
exit "$overall"
