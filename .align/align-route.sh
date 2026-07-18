#!/usr/bin/env bash
# align-route.sh — 确定性信号评分路由器（UserPromptSubmit hook）
# 设计：机械评分为主，灰区可选 LLM 仲裁（使用用户默认模型，超时降级）。
# 用法：
#   作为 hook：从 stdin 读取 Claude Code hook JSON，向 stdout 注入路由指令
#   测试模式：align-route.sh --classify "指令文本" → 只打印 HIGH|VAGUE|GRAY|CLEAR
#   决策投影：align-route.sh --decision "指令文本" → route<TAB>reason,reason<TAB>next.action<TAB>degraded
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
BLOCK_ON_HIGH="${BLOCK_ON_HIGH:-off}" # legacy 配置名；on 时仅 block + wait_confirmation|stop 会 exit 2
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
if [ "${1:-}" = "--classify" ] || [ "${1:-}" = "--decision" ]; then
  [ "${1:-}" = "--decision" ] && MODE="decision" || MODE="classify"
  PROMPT="${2:-}"
else
  RAW="$(cat 2>/dev/null || true)"
  # 提取 JSON 的 .prompt 字段：python3 → 粗糙 sed 降级
  if command -v python3 >/dev/null 2>&1; then
    PROMPT="$(printf '%s' "$RAW" | PYTHONIOENCODING=utf-8 python3 -c 'import json,sys
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

# 空 prompt 可能来自 metadata-only 或畸形 hook JSON；不得分类元数据，也不注入项目上下文。
if [ "$MODE" = "hook" ] && [ -z "$PROMPT" ]; then
  exit 0
fi

# [直出] / legacy ALIGN_BYPASS 只改变展示，绝不绕过分析、安全阀或验证门。
DIRECT_OUTPUT=0
if [ -n "${ALIGN_BYPASS:-}" ]; then
  DIRECT_OUTPUT=1
else
  case "$PROMPT" in \[直出\]*|直出*) DIRECT_OUTPUT=1 ;; esac
fi
if [ "$DIRECT_OUTPUT" -eq 1 ]; then
  PROMPT="$(printf '%s' "$PROMPT" | sed -E 's/^[[:space:]]*(\[直出\]|直出)[[:space:]]*//')"
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
RISK_RE='删除|删掉|删库|清空|清库|清掉|重置|回滚|强推|上线|下线|停服|发版|部署到生产|生产环境|生产库|数据库迁移|格式化|抹掉|销毁|覆盖|drop table|truncate|rm -rf|reset --hard|force push|push --force|rollback|production|db migration|deploy to prod|destroy|format|权限|admin|root|sudo|所有用户|API.?key|密钥|token|密码|credential|secret|硬编码|hardcode|禁用|关闭|停用|disable|泄露|暴露|expose|leak|外网|外部服务器|公网|发送到.*服务器|upload.*external|send.*outside'
VAGUE_RE='优化一下|优化下|优化|改进|完善|完善一下|提升一下|提升|处理一下|处理|看看|弄一下|弄好|搞一下|搞定|搞定它|修一下|修好|美化|改改|改一下|改下|调整一下|调整下|梳理一下|梳理下|整理一下|整理下|重构|升级一下|升级下|升级(项目|代码|功能|系统|接口|协议|依赖|版本)|增强|更好|更快|更优雅|更稳定|更安全|more secure|more stable|faster|better|optimi[sz]e|improve|clean ?up|polish|make it better|refactor|tweak|adjust|fix|enhance|upgrade|refine|rework|reorganize|做个|做一个|做一下|加个|加一个|加一下|写个|写一个|写一下|搞个|搞一个|弄个|弄一个|实现个|实现一个|实现一下|建个|建一个|新建一个|创建一个|改成|改为|换成|转成|转换成|加上|加上的'
XY_RE='把.*换成|用.*来解决|为了解决.*把.*(异步|并发).*(同步|串行)|为了.*把.*(异常|错误).*(吞掉|忽略|屏蔽)|用正则.*解析.*HTML|正则.*HTML.*提取|改成.*方便|用.*代替|替换.*为|转换.*成|用.*eval|用.*exec|动态执行|吞掉.*错误|错误.*吞掉|吞掉.*异常|异常.*吞掉|忽略.*错误|错误.*忽略|屏蔽.*错误|错误.*屏蔽|suppress.*error|swallow.*error|error.*suppress|error.*swallow'
SPEC_RE='[A-Za-z0-9_./\\-]+\.(sh|ps1|md|js|jsx|ts|tsx|py|json|yml|yaml|toml|go|rs|java|c|cpp|h|css|html|sql)|[A-Za-z_][A-Za-z0-9_]*\(\)|第[[:space:]]*[0-9]+[[:space:]]*行|line [0-9]+|:[0-9]+\b'
VALUE_RE='[0-9]+|"([^"]*)"|从.*改成|从.*改为|从.*换成'

VAGUE_RE="${VAGUE_RE}|更顺滑"
count_re() { printf '%s' "$1" | grep -oiE "$2" 2>/dev/null | wc -l | tr -d '[:space:]'; }
count_re_case() { printf '%s' "$1" | grep -oE "$2" 2>/dev/null | wc -l | tr -d '[:space:]'; }

RISK=$(count_re "$SIGNAL_TEXT" "$RISK_RE")
VAGUE=$(count_re "$SIGNAL_TEXT" "$VAGUE_RE")
XY=$(count_re "$SIGNAL_TEXT" "$XY_RE")
# 具体度在原文（未剥引号）上测：文件名常被反引号/引号包住
SPEC=$(count_re "$PROMPT" "$SPEC_RE")
# 具体值在原文上测：数字或引号内的字符串
VALUE=$(count_re "$PROMPT" "$VALUE_RE")

# ── 两轴判定 ──
# 教学语境：谈论风险操作 ≠ 执行风险操作（'解释一下什么是 force push'）
EDU_RE='解释|什么是|介绍一下|翻译|explain|what is|translate'
EDU=$(count_re "$CLEAN" "$EDU_RE")

# ── Policy operator runtime（route precedence 由下方生成投影拥有）──
policy_reason_any() {
  local expected
  for expected in "$@"; do
    case ",${POLICY_REASONS:-}," in *",$expected,"*) return 0 ;; esac
  done
  return 1
}

policy_score_total() {
  local source="$1" comparator="$2" first="$3" second="${4:-}" total
  case "$source" in
    observed) total="${POLICY_OBSERVED_TOTAL:-}" ;;
    effective) total="${POLICY_EFFECTIVE_TOTAL:-}" ;;
    *) return 2 ;;
  esac
  case "$comparator" in
    lt) [ "$total" -lt "$first" ] ;;
    gte) [ "$total" -ge "$first" ] ;;
    between) [ "$total" -ge "$first" ] && [ "$total" -le "$second" ] ;;
    *) return 2 ;;
  esac
}

policy_minimum_dimension() {
  local source="$1" comparator="$2" expected="$3" minimum
  case "$source" in
    observed) minimum="${POLICY_OBSERVED_MINIMUM:-}" ;;
    effective) minimum="${POLICY_EFFECTIVE_MINIMUM:-}" ;;
    *) return 2 ;;
  esac
  case "$comparator" in
    lt) [ "$minimum" -lt "$expected" ] ;;
    gte) [ "$minimum" -ge "$expected" ] ;;
    *) return 2 ;;
  esac
}

policy_assumption_count() {
  local comparator="$1" expected="$2"
  case "$comparator" in
    gt) [ "${POLICY_ASSUMPTION_COUNT:-}" -gt "$expected" ] ;;
    lte) [ "${POLICY_ASSUMPTION_COUNT:-}" -le "$expected" ] ;;
    *) return 2 ;;
  esac
}

policy_scores_equal() { [ "${POLICY_SCORES_EQUAL:-}" = "$1" ]; }
policy_safety_critical() { [ "${POLICY_SAFETY_CRITICAL:-}" = "$1" ]; }

policy_projection_safety_from_reasons() {
  local code meta priority allowed safety
  local old_ifs="$IFS"
  IFS=','
  for code in ${POLICY_REASONS:-}; do
    meta="$(policy_projection_reason_meta "$code")" || { IFS="$old_ifs"; return 1; }
    IFS=$'\t' read -r priority allowed safety <<EOF
$meta
EOF
    IFS=','
    if [ "$safety" = "true" ]; then IFS="$old_ifs"; printf '%s\n' true; return 0; fi
  done
  IFS="$old_ifs"
  printf '%s\n' false
}

policy_projection_sorted_reasons() {
  local route="$1" code meta priority allowed safety rows=""
  local old_ifs="$IFS"
  IFS=','
  for code in ${POLICY_REASONS:-}; do
    [ -n "$code" ] || continue
    meta="$(policy_projection_reason_meta "$code")" || { IFS="$old_ifs"; return 1; }
    IFS=$'\t' read -r priority allowed safety <<EOF
$meta
EOF
    IFS=','
    case ",$allowed," in *",$route,"*) ;; *) IFS="$old_ifs"; return 1 ;; esac
    rows="${rows}${priority}"$'\t'"${code}"$'\n'
  done
  IFS="$old_ifs"
  [ -n "$rows" ] || return 1
  printf '%s' "$rows" | LC_ALL=C sort -t $'\t' -k1,1n -k2,2 | awk -F '\t' '
    !seen[$2]++ { if (result != "") result = result ","; result = result $2 }
    END { print result }
  '
}

policy_projection_fail_closed() {
  POLICY_ROUTE=clarify
  POLICY_ACTION=ask
  POLICY_REASONS=runtime.degraded
}

# policy-projection:begin
# Generated from core/contracts/decision-policy.json and reason-registry.json.
# Do not edit this block manually; run: node build/policy-projection.js --write
POLICY_PROJECTION_SHA256='6b0fa6a8d546fdf30108a9f6ffa9bee0d9c23b4f68f37ff10199dc79c7de5761'
POLICY_PROJECTION_POLICY_SHA256='250f46b5faadd5b2a096d36398b2b88fef0635b40dbc14a05809be3b1e332ee6'
POLICY_PROJECTION_REGISTRY_SHA256='6a432505c58b0c4038d2797fc4f55148929f82332f88482e49fd0427c2ea0c63'
POLICY_PROJECTION_POLICY_FILE_SHA256='184c0577d2c067ddbea91bf66b81ac0b9edadcfe7be75dce68075d7afb51e942'
POLICY_PROJECTION_SCHEMA_FILE_SHA256='63d692ed2c26a92f6ee7cd3297258b98f6a86dc6520dc0f10e23bf5b9078a93e'
POLICY_PROJECTION_REGISTRY_FILE_SHA256='bd876da51c8a425ee81881da355cf348e753587e7d6a2ecd43974f96990902a2'
POLICY_PROJECTION_VERSION='1.0.0'
POLICY_THRESHOLD_PASS_MINIMUM_TOTAL='8'
POLICY_THRESHOLD_EXECUTION_MINIMUM_TOTAL='6'
POLICY_THRESHOLD_EXECUTION_MINIMUM_DIMENSION='1'
POLICY_THRESHOLD_MAXIMUM_ASSUMPTIONS='2'

policy_projection_reason_meta() {
  case "$1" in
    'policy.operation_prohibited') printf '%s\t%s\t%s\n' '10' 'block' 'true' ;;
    'authorization.confirmation_missing') printf '%s\t%s\t%s\n' '20' 'block' 'true' ;;
    'lifecycle.baseline_failed') printf '%s\t%s\t%s\n' '30' 'block' 'true' ;;
    'risk.irreversible_operation') printf '%s\t%s\t%s\n' '40' 'enrich,clarify,block' 'true' ;;
    'risk.production_change') printf '%s\t%s\t%s\n' '41' 'enrich,clarify,block' 'true' ;;
    'risk.data_mutation') printf '%s\t%s\t%s\n' '42' 'enrich,clarify,block' 'true' ;;
    'intent.ambiguous_goal') printf '%s\t%s\t%s\n' '100' 'clarify' 'false' ;;
    'intent.xy_problem') printf '%s\t%s\t%s\n' '101' 'clarify' 'false' ;;
    'intent.symptom_as_cause') printf '%s\t%s\t%s\n' '102' 'clarify' 'false' ;;
    'scope.impact_unknown') printf '%s\t%s\t%s\n' '110' 'clarify' 'false' ;;
    'scope.too_broad') printf '%s\t%s\t%s\n' '111' 'clarify' 'false' ;;
    'assumption.too_many') printf '%s\t%s\t%s\n' '120' 'clarify' 'false' ;;
    'verification.missing') printf '%s\t%s\t%s\n' '130' 'enrich,clarify' 'false' ;;
    'diagnosis.score_below_threshold') printf '%s\t%s\t%s\n' '140' 'clarify' 'false' ;;
    'runtime.degraded') printf '%s\t%s\t%s\n' '150' 'clarify,block' 'false' ;;
    'context.resolvable_from_project') printf '%s\t%s\t%s\n' '200' 'enrich' 'false' ;;
    'requirements.needs_enrichment') printf '%s\t%s\t%s\n' '205' 'enrich' 'false' ;;
    'requirements.sufficient') printf '%s\t%s\t%s\n' '210' 'pass' 'false' ;;
    'override.explicit_direct_output') printf '%s\t%s\t%s\n' '900' 'pass,enrich,clarify,block' 'false' ;;
    'lifecycle.completion_failed') printf '%s\t%s\t%s\n' '30' '' 'false' ;;
    *) return 1 ;;
  esac
}

policy_projection_action_allowed() {
  case "$1:$2" in
    'block:stop'|'block:wait_confirmation'|'clarify:ask'|'enrich:execute'|'pass:execute') return 0 ;;
    *) return 1 ;;
  esac
}

policy_projection_evaluate() {
  POLICY_ROUTE=
  POLICY_ACTION=
  # 10: policy_block
  if policy_reason_any 'policy.operation_prohibited'; then
    POLICY_ROUTE='block'
    POLICY_ACTION='stop'
    return 0
  fi
  # 20: clarify_missing_contract
  if ( policy_reason_any 'intent.ambiguous_goal' 'intent.xy_problem' 'intent.symptom_as_cause' 'scope.impact_unknown' 'scope.too_broad' 'assumption.too_many' 'diagnosis.score_below_threshold' || policy_score_total 'effective' 'lt' '6' || policy_minimum_dimension 'effective' 'lt' '1' || policy_assumption_count 'gt' '2' ); then
    POLICY_ROUTE='clarify'
    POLICY_ACTION='ask'
    return 0
  fi
  # 30: authorization_block
  if policy_reason_any 'authorization.confirmation_missing'; then
    POLICY_ROUTE='block'
    POLICY_ACTION='wait_confirmation'
    return 0
  fi
  # 40: enrich_executable_contract
  if ( ( policy_reason_any 'context.resolvable_from_project' || policy_score_total 'observed' 'between' '6' '7' || ( policy_safety_critical 'true' && ! ( policy_reason_any 'policy.operation_prohibited' 'authorization.confirmation_missing' ) ) ) && policy_score_total 'effective' 'gte' '6' && policy_minimum_dimension 'effective' 'gte' '1' && policy_assumption_count 'lte' '2' ); then
    POLICY_ROUTE='enrich'
    POLICY_ACTION='execute'
    return 0
  fi
  # 50: pass_complete_input
  if ( policy_score_total 'observed' 'gte' '8' && policy_scores_equal 'true' && policy_minimum_dimension 'effective' 'gte' '1' && policy_assumption_count 'lte' '2' && policy_safety_critical 'false' ); then
    POLICY_ROUTE='pass'
    POLICY_ACTION='execute'
    return 0
  fi
  # 999: fail_closed_clarify
  if :; then
    POLICY_ROUTE='clarify'
    POLICY_ACTION='ask'
    return 0
  fi
  return 1
}
# policy-projection:end

# ── Alignment Decision 最小投影（无 Node fallback）──
if [ "$MODE" = "decision" ]; then
  if [ -z "${POLICY_PROJECTION_SHA256:-}" ] ||
     [ -z "${POLICY_THRESHOLD_PASS_MINIMUM_TOTAL:-}" ] ||
     [ -z "${POLICY_THRESHOLD_EXECUTION_MINIMUM_TOTAL:-}" ] ||
     [ -z "${POLICY_THRESHOLD_EXECUTION_MINIMUM_DIMENSION:-}" ] ||
     ! declare -F policy_projection_reason_meta >/dev/null ||
     ! declare -F policy_projection_action_allowed >/dev/null ||
     ! declare -F policy_projection_evaluate >/dev/null; then
    printf '%s\n' $'clarify\truntime.degraded\task\ttrue'
    exit 0
  fi
  reason_add() { [ -z "$REASONS" ] && REASONS="$1" || REASONS="$REASONS,$1"; }
  REASONS=""
  PRODUCTION=$(count_re "$SIGNAL_TEXT" '生产(环境|库|登录|系统|数据|订单|记录)?|production|deploy to prod')
  DATA_MUTATION=$(count_re "$SIGNAL_TEXT" '删除|删库|清空|drop table|truncate|批量(改|更新|修改|重置)|所有(用户|账户|账号).*(邮箱|密码).*(改|重置)|(管理员|全部账号).*(邮箱|密码).*(改|重置)')
  EXTERNAL_EGRESS=$(count_re "$SIGNAL_TEXT" '上传到外部服务器|发送到外网|发送到外部服务器|upload.*external|send.*outside')
  if [ "$EXTERNAL_EGRESS" -gt 0 ] && [ "$(count_re "$SIGNAL_TEXT" '删除远端副本')" -gt 0 ]; then
    DATA_MUTATION=$((DATA_MUTATION - 1))
    [ "$DATA_MUTATION" -lt 0 ] && DATA_MUTATION=0
  fi
  CONFIRM_MISSING=$(count_re "$SIGNAL_TEXT" '尚未确认|未确认执行|等待确认|without confirmation')
  VERIFY=$(count_re "$SIGNAL_TEXT" '运行.+测试|npm[[:space:]]+test|pnpm[[:space:]]+test|yarn[[:space:]]+test|验收|验证|回滚条件|bash[[:space:]]+-n|markdownlint|(^|[^[:alnum:]_])test([^[:alnum:]_]|$)')
  DOCUMENTATION_TASK=$(count_re "$PROMPT" 'README\.md|docs[/\\].*\.md|[A-Za-z0-9_./\\-]+\.md')
  DOC_RELEVANT_VERIFY=$(count_re "$PROMPT" 'markdownlint|textlint|vale|remark|(^|[[:space:]])rg[[:space:]]|(^|[[:space:]])grep[[:space:]]')
  DOC_IRRELEVANT_VERIFY=$(count_re "$PROMPT" 'bash[[:space:]]+-n|npm[[:space:]]+test|pnpm[[:space:]]+test|yarn[[:space:]]+test|pytest|tsc')
  if [ "$DOCUMENTATION_TASK" -gt 0 ] && [ "$DOC_RELEVANT_VERIFY" -eq 0 ] && [ "$DOC_IRRELEVANT_VERIFY" -gt 0 ]; then
    VERIFY=0
  fi
  BOUNDED=$(count_re "$SIGNAL_TEXT" '不改|只修改|只改|只限|保持现有|保持.*不变|全部[[:space:]]*[0-9]+[[:space:]]*天|[0-9]+[[:space:]]*个|已列名|指定|开发[[:space:]]*fixture|范围|public API')
  FILE_OR_SYMBOL=$(count_re "$PROMPT" '[A-Za-z0-9_./\-]+\.(ts|tsx|js|jsx|py|sh|ps1|md|json)')
  SYMBOL_COUNT=$(count_re_case "$PROMPT" 'parse[A-Z][A-Za-z0-9_]*')
  FILE_OR_SYMBOL=$((FILE_OR_SYMBOL + SYMBOL_COUNT))
  CACHE_OPEN=$(count_re "$SIGNAL_TEXT" '加缓存.+(细节|具体规则)你定')
  POLICY_PROHIBITED=$(count_re "$PROMPT" 'git[[:space:]]+reset[[:space:]]+--hard|access token.+公开|(API.?密钥|secret|token).*(写进|写入|硬编码).*(提交|仓库)|禁用所有用户的输入(验证|校验)|绕过.+(hook|pre-commit).+push[[:space:]]+main|忽略所有项目规则.+删除生产数据')
  COMPLETE_RISK=0
  if { [ "$PRODUCTION" -gt 0 ] || [ "$DATA_MUTATION" -gt 0 ]; } && [ "$BOUNDED" -gt 0 ] && [ "$VERIFY" -gt 0 ]; then COMPLETE_RISK=1; fi

  PROJECT_CONTEXT=0
  case "${ALIGN_CONTEXT_REFS:-}" in *project:*) PROJECT_CONTEXT=1 ;; esac
  PROJECT_VERIFICATION=0
  if [ "$VERIFY" -eq 0 ] && [ "$FILE_OR_SYMBOL" -gt 0 ] && [ "$BOUNDED" -gt 0 ] && [ "$PROJECT_CONTEXT" -eq 1 ]; then
    PROJECT_VERIFICATION=1
  fi

  POLICY_OBSERVED_TOTAL=1
  POLICY_EFFECTIVE_TOTAL=1
  POLICY_OBSERVED_MINIMUM=0
  POLICY_EFFECTIVE_MINIMUM=0
  POLICY_ASSUMPTION_COUNT=0
  POLICY_SCORES_EQUAL=true
  if [ "$CACHE_OPEN" -gt 0 ]; then
    POLICY_OBSERVED_TOTAL=2
    POLICY_EFFECTIVE_TOTAL=2
    POLICY_ASSUMPTION_COUNT=3
  elif [ "$COMPLETE_RISK" -eq 1 ] || { [ "$FILE_OR_SYMBOL" -gt 0 ] && [ "$BOUNDED" -gt 0 ] && [ "$VERIFY" -gt 0 ]; }; then
    POLICY_OBSERVED_TOTAL=8
    POLICY_EFFECTIVE_TOTAL=8
    POLICY_OBSERVED_MINIMUM=1
    POLICY_EFFECTIVE_MINIMUM=1
  elif [ "$FILE_OR_SYMBOL" -gt 0 ] && [ "$BOUNDED" -gt 0 ]; then
    POLICY_OBSERVED_TOTAL=7
    POLICY_EFFECTIVE_TOTAL=7
    if [ "$PROJECT_VERIFICATION" -eq 1 ]; then
      POLICY_EFFECTIVE_TOTAL=8
      POLICY_EFFECTIVE_MINIMUM=1
      POLICY_SCORES_EQUAL=false
    fi
  elif [ "$BOUNDED" -gt 0 ] && [ "$VERIFY" -gt 0 ]; then
    POLICY_OBSERVED_TOTAL=7
    POLICY_EFFECTIVE_TOTAL=7
    POLICY_OBSERVED_MINIMUM=1
    POLICY_EFFECTIVE_MINIMUM=1
  fi

  if [ "$POLICY_PROHIBITED" -gt 0 ]; then
    reason_add policy.operation_prohibited
  else
    if [ "$CONFIRM_MISSING" -gt 0 ]; then reason_add authorization.confirmation_missing; fi
    if [ "$PRODUCTION" -gt 0 ]; then reason_add risk.production_change; fi
    if [ "$DATA_MUTATION" -gt 0 ]; then reason_add risk.data_mutation; fi
    if [ "$COMPLETE_RISK" -eq 1 ] && [ "$CONFIRM_MISSING" -eq 0 ]; then reason_add requirements.needs_enrichment; fi
    if { [ "$XY" -gt 0 ] || [ "$DATA_MUTATION" -gt 0 ] || [ "$CACHE_OPEN" -gt 0 ]; } && [ "$COMPLETE_RISK" -eq 0 ]; then reason_add intent.ambiguous_goal; fi
    if [ "$VAGUE" -gt 0 ] && [ "$SPEC" -eq 0 ] && [ "$COMPLETE_RISK" -eq 0 ]; then reason_add intent.ambiguous_goal; fi
    if [ "$XY" -gt 0 ] && [ "$COMPLETE_RISK" -eq 0 ]; then reason_add intent.xy_problem; fi
    if [ "$DATA_MUTATION" -gt 0 ] && [ "$COMPLETE_RISK" -eq 0 ]; then reason_add scope.impact_unknown; fi
    if [ "$CACHE_OPEN" -gt 0 ]; then reason_add assumption.too_many; fi
    if [ "$VERIFY" -eq 0 ]; then reason_add verification.missing; fi
    if [ "$PROJECT_VERIFICATION" -eq 1 ]; then reason_add context.resolvable_from_project; fi
  fi

  if [ "$POLICY_PROHIBITED" -eq 0 ] && [ "$POLICY_EFFECTIVE_TOTAL" -lt "$POLICY_THRESHOLD_EXECUTION_MINIMUM_TOTAL" ]; then
    reason_add diagnosis.score_below_threshold
  fi
  if [ "$POLICY_PROHIBITED" -eq 0 ] && [ -z "$REASONS" ]; then
    if [ "$POLICY_OBSERVED_TOTAL" -ge "$POLICY_THRESHOLD_PASS_MINIMUM_TOTAL" ]; then
      reason_add requirements.sufficient
    elif [ "$POLICY_OBSERVED_TOTAL" -ge "$POLICY_THRESHOLD_EXECUTION_MINIMUM_TOTAL" ] &&
         [ "$POLICY_EFFECTIVE_MINIMUM" -ge "$POLICY_THRESHOLD_EXECUTION_MINIMUM_DIMENSION" ]; then
      reason_add requirements.needs_enrichment
    else
      reason_add intent.ambiguous_goal
    fi
  fi
  if [ "$DIRECT_OUTPUT" -eq 1 ]; then reason_add override.explicit_direct_output; fi

  POLICY_REASONS="$REASONS"
  POLICY_SAFETY_CRITICAL="$(policy_projection_safety_from_reasons)" || policy_projection_fail_closed
  if [ "$POLICY_REASONS" != "runtime.degraded" ]; then
    policy_projection_evaluate || policy_projection_fail_closed
  fi
  if ! policy_projection_action_allowed "$POLICY_ROUTE" "$POLICY_ACTION"; then
    policy_projection_fail_closed
  fi
  SORTED_REASONS="$(policy_projection_sorted_reasons "$POLICY_ROUTE")" || policy_projection_fail_closed
  if [ "$POLICY_REASONS" = "runtime.degraded" ]; then
    SORTED_REASONS=runtime.degraded
  fi
  printf '%s\t%s\t%s\ttrue\n' "$POLICY_ROUTE" "$SORTED_REASONS" "$POLICY_ACTION"
  exit 0
fi

VERDICT="CLEAR"
if [ "${RISK:-0}" -ge 1 ]; then
  if [ "${EDU:-0}" -ge 1 ]; then
    VERDICT="GRAY"   # 疑似教学语境 → 交仲裁/保守处理，不直接放行
  else
    VERDICT="HIGH"
  fi
elif [ "${XY:-0}" -ge 1 ]; then
  VERDICT="VAGUE"    # XY Problem：用户提议方案而非描述问题，必须澄清
elif [ "${VAGUE:-0}" -ge 1 ] && [ "${SPEC:-0}" -eq 0 ]; then
  VERDICT="VAGUE"
elif [ "${VAGUE:-0}" -ge 1 ] && [ "${SPEC:-0}" -ge 2 ]; then
  VERDICT="CLEAR"    # 有具体文件+具体值，是完整请求
elif [ "${VAGUE:-0}" -ge 1 ] && [ "${SPEC:-0}" -ge 1 ] && [ "${VALUE:-0}" -ge 1 ]; then
  VERDICT="CLEAR"    # 有具体文件+具体数值/字符串，是完整请求
elif [ "${VAGUE:-0}" -ge 1 ] && [ "${SPEC:-0}" -ge 1 ]; then
  # 检查是否只匹配"加一个"类模式（完整请求）还是"改成"类模式（需要澄清）
  VAGUE_ADD=$(count_re "$SIGNAL_TEXT" '加个|加一个|加一下')
  if [ "${VAGUE_ADD:-0}" -ge 1 ] && [ "${VAGUE:-0}" -eq 1 ] && [ "${VALUE:-0}" -ge 1 ]; then
    VERDICT="CLEAR"  # "加一个 <具体值>" 才是完整请求
  else
    VERDICT="GRAY"
  fi
fi

if [ "$MODE" = "classify" ]; then
  printf '%s\n' "$VERDICT"
  exit 0
fi

# ── Hook 只消费 Alignment Decision 最小投影；兼容 verdict 不参与执行路由 ──
DECISION_OUTPUT="$(ALIGN_CONTEXT_REFS="${ALIGN_CONTEXT_REFS:-}" ALIGN_ARBITER=off bash "$0" --decision "$PROMPT")"
IFS=$'\t' read -r MACHINE_ROUTE MACHINE_REASONS MACHINE_ACTION DEGRADED <<EOF
$DECISION_OUTPUT
EOF

case "$MACHINE_ROUTE" in
  block)
    if [ "$BLOCK_ON_HIGH" = "on" ]; then
      printf '%s\n' "[对齐] route=block next.action=$MACHINE_ACTION degraded=true。已阻断提交。" >&2
      printf '%s\n' "  补齐解除条件后必须重新分析，禁止沿用旧决定直接执行。" >&2
      exit 2
    fi
    printf '[对齐] route=block next.action=%s degraded=true。\n' "$MACHINE_ACTION"
    if [ "$MACHINE_ACTION" = "stop" ]; then
      printf '%s\n' '策略禁止执行该操作；不得通过补充确认解除。'
    else
      printf '%s\n' '停止执行并等待明确确认；解除后必须重新分析，禁止沿用旧决定直接执行。'
    fi
    ;;
  clarify)
    cat <<'EOF'
[对齐] route=clarify next.action=ask degraded=true。按以下对齐协议执行：
1. 先读 .align/lessons.md → spec.md → facts/glossary/state（三文件未齐时同时读 context.md）
2. 能从项目文件/代码/文档读到的信息，自行读取，不问用户
3. 仍缺失且会改变目标/范围/验收的关键信息 → 一次只问一个问题，附推荐答案
4. 禁止在意图对齐前执行写操作
EOF
    ;;
  pass|enrich)
    VERIFY_CMD=""
    if [ -f "$ALIGN_DIR/check-commands.txt" ]; then
      VERIFY_CMD="$(grep -vE '^\s*#' "$ALIGN_DIR/check-commands.txt" 2>/dev/null | grep -vE '^\s*$' | head -1 || true)"
    fi
    printf '[对齐] route=%s next.action=execute degraded=true，按以下执行协议行动：\n' "$MACHINE_ROUTE"
    printf '%s\n' '1. 先读 .align/lessons.md → spec.md → facts/glossary/state（三文件未齐时同时读 context.md）'
    printf '%s\n' '2. 按 Agent Brief 执行：明确目标 → 锁定范围 → 最小变更 → 完成后验证'
    if [ -n "$VERIFY_CMD" ]; then
      printf '3. 完成后跑验证：%s\n' "$VERIFY_CMD"
    else
      printf '%s\n' '3. 完成后自行验证核心功能未回归'
    fi
    printf '%s\n' '4. 有踩坑/纠正/新约定 → 追加到 .align/lessons.md（一条≤2行）'
    printf '%s\n' '5. 交付前自验证（R8 验证门不可跳过）'
    ;;
  *)
    printf '%s\n' '[对齐] shell decision projection invalid；保守停止并重新安装 runtime。' >&2
    exit 2
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
