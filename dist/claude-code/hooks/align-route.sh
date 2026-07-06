#!/usr/bin/env bash
# align-route.sh — 确定性信号评分路由器（UserPromptSubmit hook）
# 设计：机械评分为主，灰区可选 LLM 仲裁（使用用户默认模型，超时降级）。
# 用法：
#   作为 hook：从 stdin 读取 Claude Code hook JSON，向 stdout 注入路由指令
#   测试模式：align-route.sh --classify "指令文本" → 只打印 HIGH|VAGUE|GRAY|CLEAR
set -u

# ── 递归防护：hook 内调用 claude -p 时，子进程再触发本 hook 直接退出 ──
if [ -n "${ALIGN_ROUTE_INNER:-}" ]; then
  exit 0
fi

# ── 定位 .align 目录：锚定项目根，绝不用 CWD 相对路径（防跨仓库劫持）──
# 优先 Claude Code 为 hook 注入的可信项目根 $CLAUDE_PROJECT_DIR；
# 回退到脚本自身所在目录（本脚本就住在 .align/ 内）。
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -d "$CLAUDE_PROJECT_DIR/.align" ]; then
  ALIGN_DIR="$CLAUDE_PROJECT_DIR/.align"
else
  ALIGN_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
fi
[ -n "$ALIGN_DIR" ] || ALIGN_DIR="."
CONF="$ALIGN_DIR/route.conf"
ARBITER="${ALIGN_ARBITER:-auto}"   # auto|off
ARBITER_TIMEOUT=5
BLOCK_ON_HIGH="off"                # off|on：HIGH verdict 是否 exit 2 阻断 prompt 提交
# route.conf 只做白名单解析，绝不 source 任意 shell（防仓库内 route.conf 注入代码）
if [ -f "$CONF" ]; then
  while IFS='=' read -r _k _v; do
    _k="$(printf '%s' "$_k" | tr -d '[:space:]')"
    _v="$(printf '%s' "$_v" | sed -E 's/#.*$//; s/[[:space:]"'\'']//g')"
    case "$_k" in
      ALIGN_ARBITER|ARBITER) [ -n "$_v" ] && ARBITER="$_v" ;;
      ARBITER_TIMEOUT) _v="$(printf '%s' "$_v" | tr -dc '0-9')"; [ -n "$_v" ] && ARBITER_TIMEOUT="$_v" ;;
      BLOCK_ON_HIGH) case "$_v" in on|true|1) BLOCK_ON_HIGH="on" ;; esac ;;
    esac
  done < "$CONF"
fi

# ── 输入获取 ──
MODE="hook"
PROMPT=""
if [ "${1:-}" = "--classify" ]; then
  MODE="classify"
  PROMPT="${2:-}"
else
  RAW="$(cat 2>/dev/null || true)"
  # 提取 JSON 的 .prompt 字段：python3 → 粗糙 sed 降级
  if command -v python3 >/dev/null 2>&1; then
    PROMPT="$(printf '%s' "$RAW" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("prompt",""))
except Exception: pass' 2>/dev/null || true)"
  fi
  if [ -z "$PROMPT" ] && command -v jq >/dev/null 2>&1; then
    PROMPT="$(printf '%s' "$RAW" | jq -r '.prompt // empty' 2>/dev/null || true)"
  fi
  if [ -z "$PROMPT" ]; then
    PROMPT="$(printf '%s' "$RAW" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  fi
  # 仅当输入不像 JSON（纯文本）才整体兜底；绝不拿 JSON 元数据去分类
  if [ -z "$PROMPT" ]; then
    case "$RAW" in
      '{'*|*'"prompt"'*) PROMPT="" ;;
      *) PROMPT="$RAW" ;;
    esac
  fi
fi

# ── bypass 检测：[直出] 前缀或 ALIGN_BYPASS=1 跳过整个路由 ──
BYPASS=0
if [ -n "${ALIGN_BYPASS:-}" ]; then
  BYPASS=1
else
  case "$PROMPT" in
    \[直出\]*|直出*) BYPASS=1 ;;
  esac
fi
if [ "$BYPASS" -eq 1 ]; then
  echo "[对齐] [直出] 模式，跳过路由。"
  exit 0
fi

# ── 文本清洗：剥离代码块 / 行内代码 / 引号内容（讨论≠执行）──
strip_noise() {
  printf '%s\n' "$1" \
    | awk 'BEGIN{inblock=0} /^```/{inblock=!inblock; next} !inblock{print}' \
    | sed -E 's/`[^`]*`//g' \
    | sed -E 's/"[^"]*"//g; s/“[^”]*”//g; s/「[^」]*」//g; s/『[^』]*』//g'
}

# ── 否定子句剔除：'不要删库' 不算风险信号 ──
strip_negation() {
  # 注意：不用 sed 的 `I` 标志（GNU 专有，BSD/macOS 会整条报错→输出为空→全部误判 CLEAR）
  printf '%s\n' "$1" \
    | sed -E "s/(不要|不得|不准|不能|别动|别去|禁止|避免|[Dd]o [Nn]ot|[Dd]on'?t|[Nn]ever|[Aa]void)[^,，。;；.!?！？]*//g"
}

CLEAN="$(strip_noise "$PROMPT")"
SIGNAL_TEXT="$(strip_negation "$CLEAN")"

# ── 信号计数（双语）──
RISK_RE='删除|删掉|删库|清空|清库|重置|回滚|强推|上线|生产环境|生产库|数据库迁移|drop table|truncate|rm -rf|reset --hard|force push|push --force|rollback|production|db migration'
VAGUE_RE='优化一下|优化下|改进|完善|提升一下|处理一下|看看|弄一下|搞一下|搞定|修一下|美化|更好|更快|更优雅|更稳定|optimi[sz]e|improve|clean ?up|polish|make it better|refactor|做个|做一个|做一下|加个|加一个|加一下|写个|写一个|写一下|搞个|搞一个|弄个|弄一个|实现个|实现一个|实现一下|建个|建一个|新建一个|创建一个'
SPEC_RE='[A-Za-z0-9_./\\-]+\.(sh|ps1|md|js|jsx|ts|tsx|py|json|yml|yaml|toml|go|rs|java|c|cpp|h|css|html|sql)|[A-Za-z_][A-Za-z0-9_]*\(\)|第[[:space:]]*[0-9]+[[:space:]]*行|line [0-9]+|:[0-9]+\b'

count_re() { printf '%s' "$1" | grep -oiE "$2" 2>/dev/null | wc -l | tr -d '[:space:]'; }

RISK=$(count_re "$SIGNAL_TEXT" "$RISK_RE")
VAGUE=$(count_re "$SIGNAL_TEXT" "$VAGUE_RE")
# 具体度在原文（未剥引号）上测：文件名常被反引号/引号包住
SPEC=$(count_re "$PROMPT" "$SPEC_RE")

# ── 两轴判定 ──
# 教学语境：谈论风险操作 ≠ 执行风险操作（'解释一下什么是 force push'）
EDU_RE='解释|什么是|介绍一下|翻译|explain|what is|translate'
EDU=$(count_re "$CLEAN" "$EDU_RE")

VERDICT="CLEAR"
if [ "${RISK:-0}" -ge 1 ]; then
  if [ "${EDU:-0}" -ge 1 ]; then
    VERDICT="GRAY"   # 疑似教学语境 → 交仲裁/保守处理，不直接放行
  else
    VERDICT="HIGH"
  fi
elif [ "${VAGUE:-0}" -ge 1 ] && [ "${SPEC:-0}" -eq 0 ]; then
  VERDICT="VAGUE"
elif [ "${VAGUE:-0}" -ge 1 ] && [ "${SPEC:-0}" -ge 1 ]; then
  VERDICT="GRAY"
fi

if [ "$MODE" = "classify" ]; then
  printf '%s\n' "$VERDICT"
  exit 0
fi

# ── 灰区 LLM 仲裁：用用户自己的默认模型（不指定 --model），超时降级为 VAGUE ──
if [ "$VERDICT" = "GRAY" ] && [ "$ARBITER" != "off" ] && command -v claude >/dev/null 2>&1; then
  # 必须有超时约束才发起阻塞的 claude -p；timeout(GNU)/gtimeout(macOS brew) 皆无 → 直接保守降级，绝不无上限阻塞
  TIMEOUT_BIN="$(command -v timeout || command -v gtimeout || true)"
  if [ -n "$TIMEOUT_BIN" ]; then
    LLM_OUT="$(ALIGN_ROUTE_INNER=1 "$TIMEOUT_BIN" "$ARBITER_TIMEOUT" claude -p "只回答一个词（HIGH/VAGUE/CLEAR）。判定这条开发指令：HIGH=含不可逆或生产风险操作；VAGUE=目标或对象不明需要澄清；CLEAR=目标对象明确可直接执行。指令：${PROMPT}" 2>/dev/null | grep -oiE 'HIGH|VAGUE|CLEAR' | head -1 | tr '[:lower:]' '[:upper:]')" || LLM_OUT=""
    case "$LLM_OUT" in
      HIGH|VAGUE|CLEAR) VERDICT="$LLM_OUT" ;;
      *) VERDICT="VAGUE" ;;  # 仲裁失败/超时 → 保守降级
    esac
  else
    VERDICT="VAGUE"  # 无 timeout 可用 → 不做无上限阻塞调用，保守降级
  fi
elif [ "$VERDICT" = "GRAY" ]; then
  VERDICT="VAGUE"  # 无仲裁可用 → 保守降级
fi

# ── 按判定注入路由指令（人话输出：氛围编程者能看懂）──
case "$VERDICT" in
  HIGH)
    if [ "$BLOCK_ON_HIGH" = "on" ]; then
      # 机械层硬拦截：exit 2 阻断 prompt 提交，stderr 显示警告
      printf '%s\n' "[对齐] ⚠️ 这条含高风险操作（删除/生产/数据库/不可逆）。已阻断提交。" >&2
      printf '%s\n' "  如确需执行，加 [直出] 前缀或设 ALIGN_BYPASS=1 后重发。" >&2
      exit 2
    fi
    cat <<'EOF'
[对齐] ⚠️ 这条含高风险操作（删除/生产/数据库/不可逆）。你必须：
1. 先列出全部影响面（哪些文件/数据/环境会被改动）
2. 输出执行方案，停下等待用户明确确认
3. 禁止在确认前执行任何写操作
硬性红线：高风险静默执行 = 无效输出。
EOF
    ;;
  VAGUE)
    cat <<'EOF'
[对齐] 这条指令不够清楚，我先问一个关键问题再开始，避免做偏返工。
若答案可从项目文件中读到，先自行读取再决定是否提问。
EOF
    ;;
  *)
    VERIFY_CMD=""
    if [ -f "$ALIGN_DIR/check-commands.txt" ]; then
      VERIFY_CMD="$(grep -vE '^\s*#' "$ALIGN_DIR/check-commands.txt" 2>/dev/null | grep -vE '^\s*$' | head -1 || true)"
    fi
    if [ -n "$VERIFY_CMD" ]; then
      printf '[对齐] 指令清楚，直接执行。完成后请跑：%s\n' "$VERIFY_CMD"
    else
      printf '%s\n' '[对齐] 指令清楚，直接执行。完成后自行验证核心功能未回归。'
    fi
    printf '%s\n' '有踩坑/纠正/新约定 → 追加到 .align/lessons.md。'
    ;;
esac

# ── 经验规则强制入上下文（沉淀闭环）──
if [ -s "$ALIGN_DIR/lessons.md" ]; then
  echo ""
  echo "── 项目经验规则（必须遵守）──"
  grep -E '^- ' "$ALIGN_DIR/lessons.md" 2>/dev/null | tail -30
fi
# ── 未清债务提醒 ──
if [ -s "$ALIGN_DIR/debt.md" ]; then
  DEBT_N=$(grep -cE '^- \[ \]' "$ALIGN_DIR/debt.md" 2>/dev/null || echo 0)
  if [ "${DEBT_N:-0}" -gt 0 ]; then
    echo ""
    echo "── 未清偿债务（$DEBT_N 项，处理或向用户说明）──"
    grep -E '^- \[ \]' "$ALIGN_DIR/debt.md" | tail -10
  fi
fi
exit 0
