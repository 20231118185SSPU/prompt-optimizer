#!/usr/bin/env bash
set -euo pipefail

export LC_ALL=C

whatif=0
for arg in "$@"; do
  case "$arg" in
    --what-if|-WhatIf|-whatif)
      whatif=1
      ;;
    *)
      printf 'Unknown argument: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
core_root="$repo_root/core"
protocol_root="$core_root/protocol"
templates_root="$core_root/templates"
dist_root="$repo_root/dist"

assert_dir() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    printf 'Required directory not found: %s\n' "$path" >&2
    exit 1
  fi
}

align_init_skill_root="$core_root/skills/align-init"
spec_kit_root="$core_root/spec-kit"
host_root="$core_root/host"

emit_template_map() {
  cat <<'MAP'
ACCEPTANCE-CHECKLIST.md|acceptance-checklist.md
AGENT-BRIEF.md|agent-brief.md
ANALYZE.md|analyze.md
ANTI-PATTERNS-REFERENCE.md|anti-patterns-reference.md
CLARIFY.md|clarify.md
CODE.md|code.md
INTENT-PROBE.md|intent-probe.md
META.md|meta.md
PROJECT-CONTEXT.md|project-context.md
WRITE.md|write.md
ALIGN-SPEC.md|align-spec.md
ALIGN-CONTEXT.md|align-context.md
ALIGN-LESSONS.md|align-lessons.md
ALIGN-DECISIONS.md|align-decisions.md
MAP
}

emit_file_lf() {
  sed 's/\r$//' "$1"
}

emit_file_lf_trim_trailing_blank_lines() {
  sed 's/\r$//' "$1" | awk '
    { lines[NR] = $0 }
    END {
      end = NR
      while (end > 0 && lines[end] == "") {
        end--
      }
      for (i = 1; i <= end; i++) {
        print lines[i]
      }
    }
  '
}

emit_protocol() {
  local first=1
  local found=0
  local file

  for file in "$protocol_root"/*.md; do
    [[ -e "$file" ]] || continue
    found=1
    if [[ "$first" -eq 0 ]]; then
      printf '\n---\n\n'
    fi
    first=0
    printf '<!-- source: core/protocol/%s -->\n\n' "$(basename "$file")"
    emit_file_lf_trim_trailing_blank_lines "$file"
  done

  if [[ "$found" -eq 0 ]]; then
    printf 'No protocol files found under %s\n' "$protocol_root" >&2
    exit 1
  fi
}

emit_reference_list() {
  local source_name
  local dest_name

  while IFS='|' read -r source_name dest_name; do
    printf -- '- `references/%s`: generated from `core/templates/%s`\n' "$dest_name" "$source_name"
  done < <(emit_template_map)
}

write_generated_file() {
  local path="$1"
  shift

  case "$path" in
    "$dist_root"/*) ;;
    *)
      printf 'Refusing to write outside dist/: %s\n' "$path" >&2
      exit 1
      ;;
  esac

  if [[ "$whatif" -eq 1 ]]; then
    printf 'Would write generated file: %s\n' "$path"
    return
  fi

  mkdir -p "$(dirname "$path")"
  "$@" > "$path"
}

emit_universal_prompt() {
  cat <<'EOF'
<!--
Generated from core/
Do not edit dist/ manually
-->

# Prompt Optimizer System Prompt

## System Prompt Start

You are an Agent Intent Alignment Protocol runtime. Transform rough instructions into executable, verifiable, reusable task contracts. Do not merely polish wording.

Follow the generated protocol below. If a referenced template is needed, load the matching file under `references/`.

## Core Protocol

EOF
  emit_protocol
  cat <<'EOF'

## Generated References

EOF
  emit_reference_list
  cat <<'EOF'

## System Prompt End
EOF
}

emit_skill() {
  local host_name="$1"

  cat <<EOF
---
name: optimize-prompt
description: Optimize vague user instructions into precise Agent Briefs. Use when the user asks to improve, rewrite, refine, clarify, or structure a prompt, or wants an AI agent to understand and execute an idea accurately.
generated_from: Generated from core/
notice: Do not edit dist/ manually
---

# Optimize Prompt

Generated from core/. Do not edit dist/ manually.

This is the $host_name adapter for the Agent Intent Alignment Protocol. Transform rough user instructions into prompts that an AI agent can understand, execute, verify, and learn from. Do not merely polish wording.

## v3 行为：显式 vs 隐式

### 显式模式（v2.0 兼容）

用户显式使用 \`优化：\`、\`/optimize-prompt\`、\`\$optimize-prompt\`，或要求"优化/改进/重写"一个 prompt → 输出完整 Agent Brief 文档（v2.0 行为）。显式模式满足"我就想看优化结果"的场景。

### 隐式模式（v3.0 默认）

普通开发指令（不包含显式前缀）→ 走 v3 三档路由：

- **档位 A（直通）**：简单+低风险+意图明确（五维快评 ≥8）→ 直接执行，不提"优化"二字。内部仍跑 R8 验证门。
- **档位 B（静默对齐）**：有缺口但可从 .align/ 补全 → 1-3 行披露后直接执行，不等待确认。
- **档位 C（浮出澄清）**：高风险/总分<6/[假设]>2 → 停下，一次一问+推荐答案。

隐式模式不展示完整 Agent Brief，默认直接执行。文档形态只在高风险/复杂任务或显式请求时出现。

## .align/ 读取顺序

当 \`.align/\` 存在时，档位 B 的缺口补全优先从 \`.align/\` 取材（越用越懂项目的闭环）：

1. \`.align/lessons.md\`（最易违反的最先读）
2. \`.align/spec.md\`（项目规范）
3. \`.align/context.md\`（项目上下文）

有 \`.align/\` 时，同一条模糊指令应少一次澄清（缺口从 .align/ 补全而非问用户）。不得静默处理高风险或 [假设]>2。

## 硬性红线

- 高风险场景不得静默假设（档位 C 必须拦截）
- [假设]>2 条不得直接输出（转入澄清）
- 档位 B 披露 ≤5 行，超过升档 C
- R8 验证门在所有档位强制生效

## Inputs

- If the user invokes \`\$optimize-prompt\`, \`/optimize-prompt\`, \`optimize:\`, or asks to improve or structure a prompt for an AI agent, treat the remaining text as the raw instruction (explicit mode → full Agent Brief).
- For normal development instructions without explicit prefixes, apply v3 three-tier routing (implicit mode → direct execution with silent alignment).
- For non-English trigger phrases and explicit mode prefixes, follow the generated Core Protocol below.
- Users do not need to choose a mode. Route automatically through the generated protocol.
- If the user explicitly requests a mode described by the generated protocol, honor it unless a hard safety gate is triggered.
- If no raw instruction is provided, ask for the original instruction to optimize.

## References

Read the generated references only when useful for the detected task type:

EOF
  emit_reference_list
  cat <<'EOF'

## Core Protocol

EOF
  emit_protocol
}

emit_cursor_rule() {
  cat <<'EOF'
---
description: Agent Intent Alignment Protocol generated from core/
alwaysApply: true
generated_from: Generated from core/
notice: Do not edit dist/ manually
---

# Prompt Optimizer Alignment Rule

Generated from core/. Do not edit dist/ manually.

Use this rule as the Cursor adapter for the Agent Intent Alignment Protocol. Apply it before executing user requests when the request is vague, high-risk, cross-file, or explicitly asks to optimize or structure a prompt.

## Generated References

EOF
  emit_reference_list
  cat <<'EOF'

## Core Protocol

EOF
  emit_protocol
}

emit_openai_yaml() {
  cat <<'EOF'
interface:
  display_name: "Optimize Prompt"
  short_description: "Turn rough ideas into executable Agent Briefs"
  default_prompt: "Use $optimize-prompt 优化：把我的粗糙想法改成可执行的 Agent Brief."
policy:
  allow_implicit_invocation: true
# Generated from core/
# Do not edit dist/ manually
EOF
}

emit_align_init_skill() {
  cat <<'EOF'
<!--
Generated from core/skills/align-init/SKILL.md
Generated from core/
Do not edit dist/ manually
-->

EOF
  emit_file_lf "$align_init_skill_root/SKILL.md"
}

emit_reference() {
  local source_path="$1"
  local source_label="$2"

  cat <<EOF
<!--
Generated from $source_label
Generated from core/
Do not edit dist/ manually
-->

EOF
  emit_file_lf "$source_path"
}

copy_references() {
  local destination_root="$1"
  local source_name
  local dest_name
  local source_path

  while IFS='|' read -r source_name dest_name; do
    source_path="$templates_root/$source_name"
    if [[ ! -f "$source_path" ]]; then
      printf 'Template not found: %s\n' "$source_path" >&2
      exit 1
    fi
    write_generated_file "$destination_root/$dest_name" emit_reference "$source_path" "core/templates/$source_name"
  done < <(emit_template_map)
}

copy_spec_kit() {
  local destination_root="$1"
  local source_path
  local section_file

  source_path="$spec_kit_root/scan.md"
  if [[ ! -f "$source_path" ]]; then
    printf 'Spec kit file not found: %s\n' "$source_path" >&2
    exit 1
  fi
  write_generated_file "$destination_root/scan.md" emit_reference "$source_path" "core/spec-kit/scan.md"

  source_path="$spec_kit_root/interview.md"
  if [[ ! -f "$source_path" ]]; then
    printf 'Spec kit file not found: %s\n' "$source_path" >&2
    exit 1
  fi
  write_generated_file "$destination_root/interview.md" emit_reference "$source_path" "core/spec-kit/interview.md"

  for section_file in "$spec_kit_root/spec-sections"/*.md; do
    [[ -e "$section_file" ]] || continue
    local section_name
    section_name="$(basename "$section_file")"
    write_generated_file "$destination_root/spec-sections/$section_name" emit_reference "$section_file" "core/spec-kit/spec-sections/$section_name"
  done
}

assert_dir "$protocol_root"
assert_dir "$templates_root"
assert_dir "$align_init_skill_root"
assert_dir "$spec_kit_root"
assert_dir "$host_root"

write_generated_file "$dist_root/universal/SYSTEM-PROMPT.md" emit_universal_prompt
write_generated_file "$dist_root/claude-code/optimize-prompt/SKILL.md" emit_skill "Claude Code"
write_generated_file "$dist_root/codex/optimize-prompt/SKILL.md" emit_skill "Codex"
write_generated_file "$dist_root/cursor/rules/align.mdc" emit_cursor_rule
write_generated_file "$dist_root/claude-code/optimize-prompt/agents/openai.yaml" emit_openai_yaml
write_generated_file "$dist_root/codex/optimize-prompt/agents/openai.yaml" emit_openai_yaml

write_generated_file "$dist_root/claude-code/align-init/SKILL.md" emit_align_init_skill
write_generated_file "$dist_root/codex/align-init/SKILL.md" emit_align_init_skill
write_generated_file "$dist_root/universal/align-init/SKILL.md" emit_align_init_skill

copy_references "$dist_root/universal/references"
copy_references "$dist_root/claude-code/optimize-prompt/references"
copy_references "$dist_root/codex/optimize-prompt/references"
copy_references "$dist_root/cursor/references"

copy_references "$dist_root/claude-code/align-init/references"
copy_references "$dist_root/codex/align-init/references"
copy_references "$dist_root/universal/align-init/references"

copy_spec_kit "$dist_root/claude-code/align-init/references"
copy_spec_kit "$dist_root/codex/align-init/references"
copy_spec_kit "$dist_root/universal/align-init/references"

write_generated_file "$dist_root/claude-code/CLAUDE.align.md" emit_file_lf "$host_root/mount-area.md"
write_generated_file "$dist_root/codex/AGENTS.align.md" emit_file_lf "$host_root/mount-area.md"
write_generated_file "$dist_root/claude-code/hooks/HOOK-REMINDER.txt" emit_file_lf "$host_root/hook-reminder.txt"
write_generated_file "$dist_root/claude-code/hooks/settings.fragment.json" emit_file_lf "$host_root/settings.fragment.json"
