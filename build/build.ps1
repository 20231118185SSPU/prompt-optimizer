[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'

$Utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
$RepoRoot = Split-Path -Parent $PSScriptRoot
$CoreRoot = Join-Path $RepoRoot 'core'
$ProtocolRoot = Join-Path $CoreRoot 'protocol'
$TemplatesRoot = Join-Path $CoreRoot 'templates'
$ContractsRoot = Join-Path $CoreRoot 'contracts'
$DistRoot = Join-Path $RepoRoot 'dist'
$AlignInitSkillRoot = Join-Path $CoreRoot 'skills/align-init'
$OptimizeSkillRoot = Join-Path $CoreRoot 'skills/optimize-prompt'
$LiteSkillRoot = Join-Path $CoreRoot 'skills/optimize-prompt-lite'
$SpecKitRoot = Join-Path $CoreRoot 'spec-kit'
$HostRoot = Join-Path $CoreRoot 'host'
$PolicyProjectionHelper = Join-Path $PSScriptRoot 'policy-projection.js'
$NodeCommand = if ($env:ALIGN_NODE_COMMAND) { $env:ALIGN_NODE_COMMAND } else { 'node' }
$NpmCommand = if ($env:ALIGN_NPM_COMMAND) { $env:ALIGN_NPM_COMMAND } else { 'npm' }

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
    @('ALIGN-DECISIONS.md', 'align-decisions.md'),
    @('ALIGN-FACTS.md', 'align-facts.md'),
    @('ALIGN-GLOSSARY.md', 'align-glossary.md'),
    @('ALIGN-STATE.md', 'align-state.md')
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

    if (($FullPath -ne $FullDistRoot) -and (-not $FullPath.StartsWith($DistPrefix, [System.StringComparison]::Ordinal))) {
        throw "Refusing to write outside dist/: $FullPath"
    }

    if ($PSCmdlet.ShouldProcess($FullPath, 'Write generated file')) {
        $Parent = Split-Path -Parent $FullPath
        if (-not (Test-Path -LiteralPath $Parent -PathType Container)) {
            New-Item -ItemType Directory -Force -Path $Parent | Out-Null
        }
        $tmpPath = $FullPath + '.tmp'
        [System.IO.File]::WriteAllText($tmpPath, (Normalize-Lf $Content), $Utf8NoBom)
        if (Test-Path -LiteralPath $FullPath) {
            Remove-Item -LiteralPath $FullPath -Force
        }
        [System.IO.File]::Move($tmpPath, $FullPath)
    }
}

function Copy-GeneratedAsset {
    param(
        [string]$Path,
        [string]$SourcePath
    )

    $FullPath = [System.IO.Path]::GetFullPath($Path)
    $FullDistRoot = [System.IO.Path]::GetFullPath($DistRoot).TrimEnd('\', '/')
    $DistPrefix = $FullDistRoot + [System.IO.Path]::DirectorySeparatorChar
    if (($FullPath -ne $FullDistRoot) -and (-not $FullPath.StartsWith($DistPrefix, [System.StringComparison]::Ordinal))) {
        throw "Refusing to write outside dist/: $FullPath"
    }
    if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
        throw "Required generated asset source not found: $SourcePath"
    }
    if ($WhatIfPreference) {
        Write-Host "Would copy generated asset: $($FullPath.Replace('\', '/'))"
        return
    }
    if ($PSCmdlet.ShouldProcess($FullPath, 'Copy generated asset')) {
        $Parent = Split-Path -Parent $FullPath
        if (-not (Test-Path -LiteralPath $Parent -PathType Container)) {
            New-Item -ItemType Directory -Force -Path $Parent | Out-Null
        }
        $TmpPath = $FullPath + '.tmp'
        [System.IO.File]::Copy($SourcePath, $TmpPath, $true)
        if (Test-Path -LiteralPath $FullPath) {
            Remove-Item -LiteralPath $FullPath -Force
        }
        [System.IO.File]::Move($TmpPath, $FullPath)
    }
}

function Get-Sha256Hex {
    param([string]$Path)

    $Stream = [System.IO.File]::OpenRead($Path)
    try {
        $Hasher = [System.Security.Cryptography.SHA256]::Create()
        try {
            $Bytes = $Hasher.ComputeHash($Stream)
        } finally {
            $Hasher.Dispose()
        }
    } finally {
        $Stream.Dispose()
    }
    return ([System.BitConverter]::ToString($Bytes) -replace '-', '').ToLowerInvariant()
}

function Assert-EmbeddedPolicySources {
    param([string]$RouterPath)

    $RouterText = [System.IO.File]::ReadAllText($RouterPath, $Utf8NoBom)
    $Mappings = @(
        @('decision-policy.json', 'POLICY_PROJECTION_POLICY_FILE_SHA256'),
        @('decision-policy.schema.json', 'POLICY_PROJECTION_SCHEMA_FILE_SHA256'),
        @('reason-registry.json', 'POLICY_PROJECTION_REGISTRY_FILE_SHA256')
    )
    foreach ($Mapping in $Mappings) {
        $Asset = $Mapping[0]
        $Variable = $Mapping[1]
        $Pattern = "(?m)^$([regex]::Escape($Variable))='([0-9a-f]{64})'$"
        $Match = [regex]::Match($RouterText, $Pattern)
        if (-not $Match.Success) {
            throw "Embedded policy projection is missing $Variable."
        }
        $Actual = Get-Sha256Hex (Join-Path $ContractsRoot $Asset)
        if ($Actual -ne $Match.Groups[1].Value) {
            throw "Embedded policy projection is stale for $Asset."
        }
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
Standalone L0 copy-paste artifact; not a resident skill entry.
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
3. `.align/facts.md` / `.align/glossary.md` / `.align/state.md`（分类 SSOT）
4. 三个分类文件未齐全时同时读取 `.align/context.md`；全部缺失时只读 legacy

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

    $SourceContent = Read-TextFile (Join-Path $OptimizeSkillRoot 'SKILL.md')
    return @"
---
description: Agent Intent Alignment Protocol generated from core/
alwaysApply: true
generated_from: Generated from core/
notice: Do not edit dist/ manually
---

# Prompt Optimizer Alignment Rule

Generated from core/. Do not edit dist/ manually.

$SourceContent
"@
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
    return $SourceContent
}

function New-LiteSkill {
    $SourceContent = Read-TextFile (Join-Path $LiteSkillRoot 'SKILL.md')
    return $SourceContent
}

function New-OptimizeSkill {
    $SourceContent = Read-TextFile (Join-Path $OptimizeSkillRoot 'SKILL.md')
    return $SourceContent
}

function New-ProtocolBranch {
    param([string]$BranchName, [string]$WhenToRead, [string]$Outcome, [string[]]$ProtocolFiles)
    $Sections = @()
    foreach ($ProtocolFile in $ProtocolFiles) {
        $Content = Read-TextFile (Join-Path $ProtocolRoot $ProtocolFile)
        $Sections += "<!-- source: core/protocol/$ProtocolFile -->`n`n" + $Content.TrimEnd("`n")
    }
    $Body = $Sections -join "`n`n---`n`n"
    return "<!--`nGenerated from core/protocol/ for branch: $BranchName`nGenerated from core/`nDo not edit dist/ manually`n-->`n`n# Protocol Branch: $BranchName`n`nWhen to read: $WhenToRead`n`nRequired outcome: $Outcome`n`n$Body"
}

function Write-ProtocolBranches {
    param([string]$DestinationRoot)
    $Branches = @(
        @('protocol-intent.md', 'Intent', 'When the goal is ambiguous, an XY problem is suspected, or D1-D5 diagnosis is required.', 'Identify the real goal, claims, missing information, and confidence.', @('00-positioning.md', '01-intent-probe.md', '02-diagnosis.md')),
        @('protocol-routing.md', 'Routing', 'When routes conflict, risk is present, or clarify must be distinguished from block.', 'Produce one route, canonical reasons, and the next action.', @('03-routing.md')),
        @('protocol-contract.md', 'Contract', 'For explicit optimization, enrich, complex, or cross-module work.', 'Produce an Agent Brief, decidable acceptance, and contract review.', @('04-transform-rules.md', '05-contract-check.md')),
        @('protocol-verification.md', 'Verification', 'For baseline checks or completion verification after an execution receipt.', 'Separate the verification plan from completion evidence and report actual results.', @('06-lifecycle-gates.md')),
        @('protocol-precipitation.md', 'Precipitation', 'When a correction, lesson, convention, or hard-to-reverse decision appears.', 'Write to the correct store; produce nothing when no signal exists.', @('07-precipitation.md'))
    )
    foreach ($Branch in $Branches) {
        $Content = New-ProtocolBranch -BranchName $Branch[1] -WhenToRead $Branch[2] -Outcome $Branch[3] -ProtocolFiles $Branch[4]
        Write-GeneratedFile -Path (Join-Path $DestinationRoot $Branch[0]) -Content $Content
    }
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
Assert-Directory $ContractsRoot
Assert-Directory $AlignInitSkillRoot
Assert-Directory $OptimizeSkillRoot
Assert-Directory $LiteSkillRoot
Assert-Directory $SpecKitRoot
Assert-Directory $HostRoot

$PolicyContractAssets = @('decision-policy.json', 'decision-policy.schema.json', 'reason-registry.json')
foreach ($ContractAsset in $PolicyContractAssets) {
    $ContractPath = Join-Path $ContractsRoot $ContractAsset
    if (-not (Test-Path -LiteralPath $ContractPath -PathType Leaf)) {
        throw "Required policy contract not found: $ContractPath"
    }
}
if (Get-Command $NodeCommand -ErrorAction SilentlyContinue) {
    & $NodeCommand $PolicyProjectionHelper --check `
        --policy (Join-Path $ContractsRoot 'decision-policy.json') `
        --schema (Join-Path $ContractsRoot 'decision-policy.schema.json') `
        --registry (Join-Path $ContractsRoot 'reason-registry.json') `
        --router (Join-Path $HostRoot 'align-route.sh')
    if ($LASTEXITCODE -ne 0) {
        throw 'Shell policy projection verification failed.'
    }
    Write-Host 'Policy projection verified from core/contracts/decision-policy.json'
} else {
    $RouterPath = Join-Path $HostRoot 'align-route.sh'
    $HasProjectionHash = Select-String -LiteralPath $RouterPath -Pattern '^POLICY_PROJECTION_SHA256=' -Quiet
    $HasProjectionEnd = Select-String -LiteralPath $RouterPath -Pattern '^# policy-projection:end$' -Quiet
    if (-not $HasProjectionHash -or -not $HasProjectionEnd) {
        throw 'Node.js is unavailable and the embedded shell policy projection is missing.'
    }
    Assert-EmbeddedPolicySources -RouterPath $RouterPath
    Write-Host 'Embedded shell policy projection matches all contract SHA-256 values.'
    Write-Host 'Warning: Node.js not found; using the embedded policy projection.'
}

$ProtocolContent = Get-ProtocolContent
$ReferenceList = Get-ReferenceList

Write-GeneratedFile -Path (Join-Path $DistRoot 'universal/SYSTEM-PROMPT.md') -Content (New-UniversalPrompt -ProtocolContent $ProtocolContent -ReferenceList $ReferenceList)
Write-GeneratedFile -Path (Join-Path $DistRoot 'claude-code/optimize-prompt/SKILL.md') -Content (New-OptimizeSkill)
Write-GeneratedFile -Path (Join-Path $DistRoot 'codex/optimize-prompt/SKILL.md') -Content (New-OptimizeSkill)
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

Write-ProtocolBranches -DestinationRoot (Join-Path $DistRoot 'universal/references')
Write-ProtocolBranches -DestinationRoot (Join-Path $DistRoot 'claude-code/optimize-prompt/references')
Write-ProtocolBranches -DestinationRoot (Join-Path $DistRoot 'codex/optimize-prompt/references')
Write-ProtocolBranches -DestinationRoot (Join-Path $DistRoot 'cursor/references')

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

# ── TypeScript Pipeline Compilation ──
Write-Host "Building TypeScript pipeline..."
if ((Get-Command $NodeCommand -ErrorAction SilentlyContinue) -and (Get-Command $NpmCommand -ErrorAction SilentlyContinue)) {
  $RuntimeDist = Join-Path $DistRoot 'runtime'
  if (Test-Path -LiteralPath $RuntimeDist -PathType Container) {
    if ($PSCmdlet.ShouldProcess($RuntimeDist, 'Remove generated runtime directory')) {
      Remove-Item -LiteralPath $RuntimeDist -Recurse -Force
    }
  }
  Push-Location "$RepoRoot\core\host\pipeline"
  & $NpmCommand install
  & $NpmCommand run build
  Pop-Location
  $PipelineDist = Join-Path $HostRoot 'pipeline\dist'
  Get-ChildItem -LiteralPath $PipelineDist -Recurse -File | Where-Object {
    $_.Name.EndsWith('.js') -or $_.Name.EndsWith('.d.ts')
  } | ForEach-Object {
    $relative = $_.FullName.Substring($PipelineDist.Length).TrimStart('\', '/')
    $sourceContent = Read-TextFile $_.FullName
    $header = "// Generated from core/host/pipeline/src/`n// Generated from core/`n// Do not edit dist/ manually`n"
    if ($sourceContent.StartsWith('#!')) {
      $newline = $sourceContent.IndexOf("`n")
      $content = $sourceContent.Substring(0, $newline + 1) + $header + $sourceContent.Substring($newline + 1)
    } else {
      $content = $header + $sourceContent
    }
    Write-GeneratedFile -Path (Join-Path $DistRoot "runtime\runtime\$relative") -Content $content
  }
  Write-Host "TypeScript pipeline built successfully"
} else {
  if ((-not $WhatIfPreference) -and (-not (Test-Path -LiteralPath (Join-Path $DistRoot 'runtime/runtime/index.js') -PathType Leaf))) {
    throw 'Node.js is not available and no generated structured runtime exists.'
  }
  Write-Host "Warning: Node.js/npm not found; preserving the existing generated structured runtime"
}

foreach ($ContractAsset in $PolicyContractAssets) {
    Copy-GeneratedAsset `
        -Path (Join-Path $DistRoot "runtime/contracts/$ContractAsset") `
        -SourcePath (Join-Path $ContractsRoot $ContractAsset)
}

Write-GeneratedFile -Path (Join-Path $DistRoot 'runtime/runtime/shell/align-route.sh') -Content (Read-TextFile (Join-Path $HostRoot 'align-route.sh'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'runtime/adapters/claude-code.sh') -Content (Read-TextFile (Join-Path $HostRoot 'pipeline/adapters/hook/claude-code.sh'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'runtime/adapters/codex.sh') -Content (Read-TextFile (Join-Path $HostRoot 'pipeline/adapters/cli/codex.sh'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'runtime/bin/align-doctor') -Content (Read-TextFile (Join-Path $HostRoot 'doctor.sh'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'runtime/bin/align-cli') -Content (Read-TextFile (Join-Path $HostRoot 'align-cli.sh'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'runtime/install-plan.tsv') -Content (Read-TextFile (Join-Path $RepoRoot 'core/distribution/install-plan.tsv'))
Write-GeneratedFile -Path (Join-Path $DistRoot 'runtime/.prompt-optimizer-owned') -Content (Read-TextFile (Join-Path $RepoRoot 'core/distribution/OWNERSHIP'))
