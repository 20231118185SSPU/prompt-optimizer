[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'

$Utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
$RepoRoot = Split-Path -Parent $PSScriptRoot
$CoreRoot = Join-Path $RepoRoot 'core'
$ProtocolRoot = Join-Path $CoreRoot 'protocol'
$TemplatesRoot = Join-Path $CoreRoot 'templates'
$DistRoot = Join-Path $RepoRoot 'dist'
$AlignInitSkillRoot = Join-Path $CoreRoot 'skills/align-init'
$LiteSkillRoot = Join-Path $CoreRoot 'skills/optimize-prompt-lite'
$SpecKitRoot = Join-Path $CoreRoot 'spec-kit'
$HostRoot = Join-Path $CoreRoot 'host'

$TemplateMap = @(
    @('ACCEPTANCE-CHECKLIST.md', 'acceptance-checklist.md'),
    @('AGENT-BRIEF.md', 'agent-brief.md'),
    @('ANALYZE.md', 'analyze.md'),
    @('ANTI-PATTERNS-REFERENCE.md', 'anti-patterns-reference.md'),
    @('CLARIFY.md', 'clarify.md'),
    @('CODE.md', 'code.md'),
    @('INTENT-PROBE.md', 'intent-probe.md'),
    @('META.md', 'meta.md'),
    @('PROJECT-CONTEXT.md', 'project-context.md'),
    @('WRITE.md', 'write.md'),
    @('ALIGN-SPEC.md', 'align-spec.md'),
    @('ALIGN-CONTEXT.md', 'align-context.md'),
    @('ALIGN-LESSONS.md', 'align-lessons.md'),
    @('ALIGN-DECISIONS.md', 'align-decisions.md')
)

function Assert-Directory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "Required directory not found: $Path"
    }
}

function Normalize-Lf {
    param([AllowNull()][string]$Text)

    if ($null -eq $Text) {
        return "`n"
    }

    $Normalized = $Text -replace "`r`n", "`n"
    $Normalized = $Normalized -replace "`r", "`n"
    return $Normalized.TrimEnd("`n") + "`n"
}

function Read-TextFile {
    param([string]$Path)

    return Normalize-Lf ([System.IO.File]::ReadAllText($Path, $Utf8NoBom))
}

function Write-GeneratedFile {
    param(
        [string]$Path,
        [string]$Content
    )

    $FullPath = [System.IO.Path]::GetFullPath($Path)
    $FullDistRoot = [System.IO.Path]::GetFullPath($DistRoot).TrimEnd('\', '/')
    $DistPrefix = $FullDistRoot + [System.IO.Path]::DirectorySeparatorChar

    if (($FullPath -ne $FullDistRoot) -and (-not $FullPath.StartsWith($DistPrefix, [System.StringComparison]::OrdinalIgnoreCase))) {
        throw "Refusing to write outside dist/: $FullPath"
    }

    if ($PSCmdlet.ShouldProcess($FullPath, 'Write generated file')) {
        $Parent = Split-Path -Parent $FullPath
        if (-not (Test-Path -LiteralPath $Parent -PathType Container)) {
            New-Item -ItemType Directory -Force -Path $Parent | Out-Null
        }
        [System.IO.File]::WriteAllText($FullPath, (Normalize-Lf $Content), $Utf8NoBom)
    }
}

function Get-ProtocolContent {
    $Files = Get-ChildItem -LiteralPath $ProtocolRoot -File -Filter '*.md' | Sort-Object Name
    if ($Files.Count -eq 0) {
        throw "No protocol files found under $ProtocolRoot"
    }

    $Chunks = New-Object System.Collections.Generic.List[string]
    foreach ($File in $Files) {
        $Content = (Read-TextFile $File.FullName).TrimEnd("`n")
        $Chunks.Add("<!-- source: core/protocol/$($File.Name) -->`n`n$Content")
    }

    return Normalize-Lf ($Chunks -join "`n`n---`n`n")
}

function Get-ReferenceList {
    $Lines = New-Object System.Collections.Generic.List[string]
    foreach ($Pair in $TemplateMap) {
        $SourceName = $Pair[0]
        $DestName = $Pair[1]
        $Lines.Add("- ``references/$DestName``: generated from ``core/templates/$SourceName``")
    }
    return Normalize-Lf ($Lines -join "`n")
}

function New-UniversalPrompt {
    param(
        [string]$ProtocolContent,
        [string]$ReferenceList
    )

    $Template = @'
<!--
Generated from core/
Do not edit dist/ manually
-->

# Prompt Optimizer System Prompt

## System Prompt Start

You are an Agent Intent Alignment Protocol runtime. Transform rough instructions into executable, verifiable, reusable task contracts. Do not merely polish wording.

Follow the generated protocol below. If a referenced template is needed, load the matching file under `references/`.

## Core Protocol

{{PROTOCOL_CONTENT}}

## Generated References

{{REFERENCE_LIST}}
## System Prompt End
'@

    return $Template.Replace('{{PROTOCOL_CONTENT}}', $ProtocolContent.TrimEnd("`n")).Replace('{{REFERENCE_LIST}}', $ReferenceList)
}

function New-SkillContent {
    param(
        [string]$HostName,
        [string]$ProtocolContent,
        [string]$ReferenceList
    )

    $Template = @'
---
name: optimize-prompt
description: Optimize vague user instructions into precise Agent Briefs. Use when the user asks to improve, rewrite, refine, clarify, or structure a prompt, or wants an AI agent to understand and execute an idea accurately.
generated_from: Generated from core/
notice: Do not edit dist/ manually
---

# Optimize Prompt

Generated from core/. Do not edit dist/ manually.

This is the {{HOST_NAME}} adapter for the Agent Intent Alignment Protocol. Transform rough user instructions into prompts that an AI agent can understand, execute, verify, and learn from. Do not merely polish wording.

## v3 行为：显式 vs 隐式

### 显式模式（v2.0 兼容）

用户显式使用 `优化：`、`/optimize-prompt`、`$optimize-prompt`，或要求"优化/改进/重写"一个 prompt → 输出完整 Agent Brief 文档（v2.0 行为）。显式模式满足"我就想看优化结果"的场景。

### 隐式模式（v3.0 默认）

普通开发指令（不包含显式前缀）→ 走 v3 三档路由：

- **档位 A（直通）**：简单+低风险+意图明确（五维快评 ≥8）→ 直接执行，不提"优化"二字。内部仍跑 R8 验证门。
- **档位 B（静默对齐）**：有缺口但可从 .align/ 补全 → 1-3 行披露后直接执行，不等待确认。
- **档位 C（浮出澄清）**：高风险/总分<6/[假设]>2 → 停下，一次一问+推荐答案。

隐式模式不展示完整 Agent Brief，默认直接执行。文档形态只在高风险/复杂任务或显式请求时出现。

## .align/ 读取顺序

当 `.align/` 存在时，档位 B 的缺口补全优先从 `.align/` 取材（越用越懂项目的闭环）：

1. `.align/lessons.md`（最易违反的最先读）
2. `.align/spec.md`（项目规范）
3. `.align/context.md`（项目上下文）

有 `.align/` 时，同一条模糊指令应少一次澄清（缺口从 .align/ 补全而非问用户）。不得静默处理高风险或 [假设]>2。

## 硬性红线

- 高风险场景不得静默假设（档位 C 必须拦截）
- [假设]>2 条不得直接输出（转入澄清）
- 档位 B 披露 ≤5 行，超过升档 C
- R8 验证门在所有档位强制生效

## Inputs

- If the user invokes `$optimize-prompt`, `/optimize-prompt`, `optimize:`, or asks to improve or structure a prompt for an AI agent, treat the remaining text as the raw instruction (explicit mode → full Agent Brief).
- For normal development instructions without explicit prefixes, apply v3 three-tier routing (implicit mode → direct execution with silent alignment).
- For non-English trigger phrases and explicit mode prefixes, follow the generated Core Protocol below.
- Users do not need to choose a mode. Route automatically through the generated protocol.
- If the user explicitly requests a mode described by the generated protocol, honor it unless a hard safety gate is triggered.
- If no raw instruction is provided, ask for the original instruction to optimize.

## References

Read the generated references only when useful for the detected task type:

{{REFERENCE_LIST}}
## Core Protocol

{{PROTOCOL_CONTENT}}
'@

    return $Template.Replace('{{HOST_NAME}}', $HostName).Replace('{{REFERENCE_LIST}}', $ReferenceList).Replace('{{PROTOCOL_CONTENT}}', $ProtocolContent.TrimEnd("`n"))
}

function New-CursorRule {
    param(
        [string]$ProtocolContent,
        [string]$ReferenceList
    )

    $Template = @'
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

{{REFERENCE_LIST}}
## Core Protocol

{{PROTOCOL_CONTENT}}
'@

    return $Template.Replace('{{REFERENCE_LIST}}', $ReferenceList).Replace('{{PROTOCOL_CONTENT}}', $ProtocolContent.TrimEnd("`n"))
}

function New-OpenAiYaml {
    return @'
interface:
  display_name: "Optimize Prompt"
  short_description: "Turn rough ideas into executable Agent Briefs"
  default_prompt: "Use $optimize-prompt 优化：把我的粗糙想法改成可执行的 Agent Brief."
policy:
  allow_implicit_invocation: true
# Generated from core/
# Do not edit dist/ manually
'@
}

function New-AlignInitSkill {
    $SourceContent = Read-TextFile (Join-Path $AlignInitSkillRoot 'SKILL.md')
    return @"
<!--
Generated from core/skills/align-init/SKILL.md
Generated from core/
Do not edit dist/ manually
-->

$SourceContent
"@
}

function New-LiteSkill {
    $SourceContent = Read-TextFile (Join-Path $LiteSkillRoot 'SKILL.md')
    return @"
<!--
Generated from core/skills/optimize-prompt-lite/SKILL.md
Generated from core/
Do not edit dist/ manually
-->

$SourceContent
"@
}

function Copy-SpecKit {
    param([string]$DestinationRoot)

    $ScanPath = Join-Path $SpecKitRoot 'scan.md'
    if (-not (Test-Path -LiteralPath $ScanPath -PathType Leaf)) {
        throw "Spec kit file not found: $ScanPath"
    }
    $ScanContent = Read-TextFile $ScanPath
    Write-GeneratedFile -Path (Join-Path $DestinationRoot 'scan.md') -Content @"
<!--
Generated from core/spec-kit/scan.md
Generated from core/
Do not edit dist/ manually
-->

$ScanContent
"@

    $InterviewPath = Join-Path $SpecKitRoot 'interview.md'
    if (-not (Test-Path -LiteralPath $InterviewPath -PathType Leaf)) {
        throw "Spec kit file not found: $InterviewPath"
    }
    $InterviewContent = Read-TextFile $InterviewPath
    Write-GeneratedFile -Path (Join-Path $DestinationRoot 'interview.md') -Content @"
<!--
Generated from core/spec-kit/interview.md
Generated from core/
Do not edit dist/ manually
-->

$InterviewContent
"@

    $SectionsRoot = Join-Path $SpecKitRoot 'spec-sections'
    if (Test-Path -LiteralPath $SectionsRoot -PathType Container) {
        $SectionFiles = Get-ChildItem -LiteralPath $SectionsRoot -File -Filter '*.md'
        foreach ($SectionFile in $SectionFiles) {
            $SectionContent = Read-TextFile $SectionFile.FullName
            $SectionName = $SectionFile.Name
            Write-GeneratedFile -Path (Join-Path $DestinationRoot "spec-sections/$SectionName") -Content @"
<!--
Generated from core/spec-kit/spec-sections/$SectionName
Generated from core/
Do not edit dist/ manually
-->

$SectionContent
"@
        }
    }
}

function Copy-References {
    param([string]$DestinationRoot)

    foreach ($Pair in $TemplateMap) {
        $SourceName = $Pair[0]
        $DestName = $Pair[1]
        $SourcePath = Join-Path $TemplatesRoot $SourceName
        if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
            throw "Template not found: $SourcePath"
        }

        $SourceContent = Read-TextFile $SourcePath
        $GeneratedContent = @"
<!--
Generated from core/templates/$SourceName
Generated from core/
Do not edit dist/ manually
-->

$SourceContent
"@
        Write-GeneratedFile -Path (Join-Path $DestinationRoot $DestName) -Content $GeneratedContent
    }
}

Assert-Directory $ProtocolRoot
Assert-Directory $TemplatesRoot
Assert-Directory $AlignInitSkillRoot
Assert-Directory $LiteSkillRoot
Assert-Directory $SpecKitRoot
Assert-Directory $HostRoot

$ProtocolContent = Get-ProtocolContent
$ReferenceList = Get-ReferenceList

Write-GeneratedFile -Path (Join-Path $DistRoot 'universal/SYSTEM-PROMPT.md') -Content (New-UniversalPrompt -ProtocolContent $ProtocolContent -ReferenceList $ReferenceList)
Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/optimize-prompt/SKILL.md') -Content (New-SkillContent -HostName 'Claude Code' -ProtocolContent $ProtocolContent -ReferenceList $ReferenceList)
Write-GeneratedFile -Path (Join-Path $DistRoot 'codex/optimize-prompt/SKILL.md') -Content (New-SkillContent -HostName 'Codex' -ProtocolContent $ProtocolContent -ReferenceList $ReferenceList)
Write-GeneratedFile -Path (Join-Path $DistRoot 'cursor/rules/align.mdc') -Content (New-CursorRule -ProtocolContent $ProtocolContent -ReferenceList $ReferenceList)
Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/optimize-prompt/agents/openai.yaml') -Content (New-OpenAiYaml)
Write-GeneratedFile -Path (Join-Path $DistRoot 'codex/optimize-prompt/agents/openai.yaml') -Content (New-OpenAiYaml)

Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/align-init/SKILL.md') -Content (New-AlignInitSkill)
Write-GeneratedFile -Path (Join-Path $DistRoot 'codex/align-init/SKILL.md') -Content (New-AlignInitSkill)
Write-GeneratedFile -Path (Join-Path $DistRoot 'universal/align-init/SKILL.md') -Content (New-AlignInitSkill)

Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/optimize-prompt-lite/SKILL.md') -Content (New-LiteSkill)
Write-GeneratedFile -Path (Join-Path $DistRoot 'codex/optimize-prompt-lite/SKILL.md') -Content (New-LiteSkill)
Write-GeneratedFile -Path (Join-Path $DistRoot 'universal/optimize-prompt-lite/SKILL.md') -Content (New-LiteSkill)

Copy-References -DestinationRoot (Join-Path $DistRoot 'universal/references')
Copy-References -DestinationRoot (Join-Path $DistRoot 'claude-code/optimize-prompt/references')
Copy-References -DestinationRoot (Join-Path $DistRoot 'codex/optimize-prompt/references')
Copy-References -DestinationRoot (Join-Path $DistRoot 'cursor/references')

Copy-References -DestinationRoot (Join-Path $DistRoot 'claude-code/align-init/references')
Copy-References -DestinationRoot (Join-Path $DistRoot 'codex/align-init/references')
Copy-References -DestinationRoot (Join-Path $DistRoot 'universal/align-init/references')

Copy-SpecKit -DestinationRoot (Join-Path $DistRoot 'claude-code/align-init/references')
Copy-SpecKit -DestinationRoot (Join-Path $DistRoot 'codex/align-init/references')
Copy-SpecKit -DestinationRoot (Join-Path $DistRoot 'universal/align-init/references')

Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/CLAUDE.align.md') -Content (Read-TextFile (Join-Path $HostRoot 'mount-area.md'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'codex/AGENTS.align.md') -Content (Read-TextFile (Join-Path $HostRoot 'mount-area.md'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/hooks/HOOK-REMINDER.txt') -Content (Read-TextFile (Join-Path $HostRoot 'hook-reminder.txt'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/hooks/settings.fragment.json') -Content (Read-TextFile (Join-Path $HostRoot 'settings.fragment.json'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/hooks/align-route.sh') -Content (Read-TextFile (Join-Path $HostRoot 'align-route.sh'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/hooks/align-check.sh') -Content (Read-TextFile (Join-Path $HostRoot 'align-check.sh'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/hooks/project-settings.fragment.json') -Content (Read-TextFile (Join-Path $HostRoot 'project-settings.fragment.json'))
