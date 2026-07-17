[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$Target = "all",
  [string]$SkillsDir = "",
  [string]$Repo = "https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip",
  [switch]$Version,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$ScriptVersion = "v3.2.0-rc.1"
$Skills = @("optimize-prompt", "align-init", "optimize-prompt-lite")
$UserHome = $HOME
if ([string]::IsNullOrWhiteSpace($UserHome)) {
  $UserHome = $env:USERPROFILE
}
if ([string]::IsNullOrWhiteSpace($UserHome)) {
  $UserHome = [Environment]::GetFolderPath('UserProfile')
}
if ([string]::IsNullOrWhiteSpace($UserHome)) {
  throw "Could not resolve user home directory."
}
$RuntimeHome = $env:PROMPT_OPTIMIZER_HOME
if ([string]::IsNullOrWhiteSpace($RuntimeHome)) {
  $RuntimeHome = $UserHome
}
$RuntimePlanPointer = Join-Path $RuntimeHome '.prompt-optimizer-install-plan.tsv'

# ── Check Node.js dependency ──
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Warning: Node.js not found. TypeScript pipeline will not work."
  Write-Host "Install Node.js from https://nodejs.org/ or use shell fallback."
}

# ── PowerShell 5.1 兼容的 JSON 读写 ──
# -AsHashtable 是 PS6+ 专有；Win10/11 默认 shell 是 PS5.1，直接用会终止安装。
# 用递归转换保留 key 顺序；写出用无 BOM UTF-8 + 足够深度，与 bash/python 侧字节对齐。
function ConvertTo-OrderedHashtable {
  param($InputObject)
  if ($null -eq $InputObject) { return $null }
  if ($InputObject -is [System.Management.Automation.PSCustomObject]) {
    $ht = [ordered]@{}
    foreach ($p in $InputObject.PSObject.Properties) {
      $ht[$p.Name] = ConvertTo-OrderedHashtable $p.Value
    }
    return $ht
  }
  if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
    $list = New-Object System.Collections.ArrayList
    foreach ($item in $InputObject) {
      $list.Add((ConvertTo-OrderedHashtable $item)) | Out-Null
    }
    return , $list.ToArray()
  }
  return $InputObject
}

function Assert-SettingsShape {
  param($Data, [string]$Path)
  if ($Data -isnot [System.Collections.IDictionary]) {
    throw "Claude settings root must be a JSON object: $Path"
  }
  if (-not $Data.Contains('hooks') -or $null -eq $Data['hooks']) { return }
  $hooks = $Data['hooks']
  if ($hooks -isnot [System.Collections.IDictionary]) {
    throw "Claude settings hooks must be a JSON object: $Path"
  }
  foreach ($eventName in @('UserPromptSubmit', 'Stop')) {
    if (-not $hooks.Contains($eventName) -or $null -eq $hooks[$eventName]) { continue }
    $entries = $hooks[$eventName]
    if ($entries -is [string]) {
      throw "Claude settings hooks.$eventName must be an array: $Path"
    }
    foreach ($group in @($entries)) {
      if ($group -isnot [System.Collections.IDictionary] -or -not $group.Contains('hooks') -or
          $null -eq $group['hooks'] -or $group['hooks'] -is [string]) {
        throw "Claude settings hooks.$eventName contains an invalid group: $Path"
      }
      foreach ($hook in @($group['hooks'])) {
        if ($hook -isnot [System.Collections.IDictionary]) {
          throw "Claude settings hooks.$eventName contains an invalid hook: $Path"
        }
        if ($hook.Contains('command') -and $null -ne $hook['command'] -and $hook['command'] -isnot [string]) {
          throw "Claude settings hooks.$eventName command must be a string: $Path"
        }
      }
    }
  }
}

function Read-SettingsJson {
  param([string]$Path)
  $raw = Get-Content -LiteralPath $Path -Raw
  $data = ConvertTo-OrderedHashtable ($raw | ConvertFrom-Json)
  Assert-SettingsShape -Data $data -Path $Path
  return $data
}

function Write-SettingsJson {
  param([string]$Path, $Data)
  $json = $Data | ConvertTo-Json -Depth 64
  $utf8WithBom = New-Object System.Text.UTF8Encoding($true)
  $directory = Split-Path -Parent $Path
  if ([string]::IsNullOrWhiteSpace($directory)) { $directory = (Get-Location).Path }
  $temporary = Join-Path $directory ('.settings.json.' + [guid]::NewGuid().ToString('N'))
  $replaceBackup = Join-Path $directory ('.settings.json.replace-' + [guid]::NewGuid().ToString('N') + '.bak')
  try {
    [System.IO.File]::WriteAllText($temporary, $json + "`n", $utf8WithBom)
    if (Test-Path -LiteralPath $Path) {
      [System.IO.File]::Replace($temporary, $Path, $replaceBackup)
    } else {
      [System.IO.File]::Move($temporary, $Path)
    }
  }
  finally {
    if (Test-Path -LiteralPath $temporary) {
      Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $replaceBackup) {
      Remove-Item -LiteralPath $replaceBackup -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($Version) {
  Write-Host "prompt-optimizer installer $ScriptVersion"
  return
}

function Resolve-InstallTargets {
  param([string]$Target)

  function New-InstallTarget {
    param(
      [string]$SkillsDir,
      [string]$Adapter,
      [string]$Label
    )

    if ([string]::IsNullOrWhiteSpace($SkillsDir)) {
      throw "Could not resolve skills directory for target: $Label"
    }

    return "$SkillsDir|$Adapter|$Label"
  }

  if ($Target -eq "claude") {
    return ,(New-InstallTarget -SkillsDir (Join-Path $UserHome ".claude\skills") -Adapter "claude-code" -Label "Claude Code")
  }

  if ($Target -eq "codex") {
    if ($env:CODEX_HOME) {
      return ,(New-InstallTarget -SkillsDir (Join-Path $env:CODEX_HOME "skills") -Adapter "codex" -Label "Codex")
    }
    return ,(New-InstallTarget -SkillsDir (Join-Path $UserHome ".codex\skills") -Adapter "codex" -Label "Codex")
  }

  if ($Target -eq "agents") {
    return ,(New-InstallTarget -SkillsDir (Join-Path $UserHome ".agents\skills") -Adapter "claude-code" -Label "agents-style")
  }

  if ($Target -eq "all") {
    $targets = New-Object System.Collections.Generic.List[string]
    if ($env:CODEX_HOME) {
      $codexDir = Join-Path $env:CODEX_HOME "skills"
    } else {
      $codexDir = Join-Path $UserHome ".codex\skills"
    }
    $targets.Add((New-InstallTarget -SkillsDir $codexDir -Adapter "codex" -Label "Codex"))
    $targets.Add((New-InstallTarget -SkillsDir (Join-Path $UserHome ".claude\skills") -Adapter "claude-code" -Label "Claude Code"))
    $targets.Add((New-InstallTarget -SkillsDir (Join-Path $UserHome ".agents\skills") -Adapter "claude-code" -Label "agents-style"))
    return $targets.ToArray()
  }

  throw "Unknown target: $Target"
}

function Resolve-SourceRoot {
  param(
    [string]$Repo,
    [string]$ZipPath,
    [string]$ExtractDir
  )

  if (Test-Path -LiteralPath $Repo -PathType Container) {
    return (Resolve-Path -LiteralPath $Repo).Path
  }

  Invoke-WebRequest -Uri $Repo -OutFile $ZipPath -UseBasicParsing
  Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractDir -Force

  $distRoot = Get-ChildItem -LiteralPath $ExtractDir -Directory -Recurse |
    Where-Object { $_.Name -eq "dist" } |
    Select-Object -First 1

  if (-not $distRoot) {
    throw "Could not find dist directory in downloaded archive."
  }

  return (Split-Path -Parent $distRoot.FullName)
}

function Test-AdapterSource {
  param(
    [string]$SourceRoot,
    [string]$Adapter
  )

  $distSource = Join-Path $SourceRoot "dist\$Adapter"
  if (-not (Test-Path -LiteralPath $distSource -PathType Container)) {
    throw "Could not find dist\$Adapter directory."
  }

  foreach ($skill in $Skills) {
    $skillSource = Join-Path $distSource $skill
    if (-not (Test-Path -LiteralPath (Join-Path $skillSource "SKILL.md"))) {
      throw "Could not find dist\$Adapter\$skill\SKILL.md."
    }
  }
}

function Get-InstallTargetValue {
  param(
    [string]$Target,
    [string]$Name
  )

  $parts = $Target -split '\|', 3
  if ($parts.Count -lt 3) {
    throw "Invalid install target entry: $Target"
  }

  switch ($Name) {
    "SkillsDir" {
      return $parts[0]
    }
    "Adapter" {
      return $parts[1]
    }
    "Label" {
      return $parts[2]
    }
    default {
      return ""
    }
  }
}

if ($SkillsDir) {
  $customAdapter = "claude-code"
  if ($Target -eq "codex") {
    $customAdapter = "codex"
  }
  $installTargets = @("$SkillsDir|$customAdapter|custom")
} else {
  $installTargets = @(Resolve-InstallTargets -Target $Target)
}

if ($env:PROMPT_OPTIMIZER_HOME -and ($Target -eq 'claude' -or $Target -eq 'all') -and (-not $Uninstall)) {
  throw 'PROMPT_OPTIMIZER_HOME cannot be combined with Claude installation because Claude hooks resolve runtime from HOME.'
}

if ($Uninstall) {
  $claudeSkillsDir = Join-Path $UserHome ".claude\skills"
  $uninstallClaude = $false
  foreach ($target in $installTargets) {
    if ((Get-InstallTargetValue -Target $target -Name "SkillsDir") -eq $claudeSkillsDir) { $uninstallClaude = $true }
  }
  if (-not $WhatIfPreference) {
    $settingsPreflightPath = Join-Path $UserHome ".claude\settings.json"
    if ($uninstallClaude -and (Test-Path -LiteralPath $settingsPreflightPath)) {
      $null = Read-SettingsJson $settingsPreflightPath
    }
    $preflightRuntimeDestination = '.prompt-optimizer'
    if (Test-Path -LiteralPath $RuntimePlanPointer -PathType Leaf) {
      $installedLine = Get-Content -LiteralPath $RuntimePlanPointer | Where-Object { $_ -like "distribution`t*" } | Select-Object -First 1
      $installedParts = @($installedLine -split "`t", 4)
      if ($installedParts.Count -ne 4) { throw "Invalid installed runtime plan: $RuntimePlanPointer" }
      $preflightRuntimeDestination = $installedParts[2]
    }
    $preflightRuntimeInstallDir = Join-Path $RuntimeHome $preflightRuntimeDestination
    if (Test-Path -LiteralPath $preflightRuntimeInstallDir -PathType Container) {
      $ownership = Join-Path $preflightRuntimeInstallDir '.prompt-optimizer-owned'
      if ((-not (Test-Path -LiteralPath $ownership -PathType Leaf)) -or ((Get-Content -LiteralPath $ownership -Raw).Trim() -ne 'prompt-optimizer-runtime-v1')) {
        throw "Refusing to remove unowned runtime directory: $preflightRuntimeInstallDir"
      }
    }
  }
  foreach ($target in $installTargets) {
    $skillsDir = Get-InstallTargetValue -Target $target -Name "SkillsDir"
    if ([string]::IsNullOrWhiteSpace($skillsDir)) {
      throw "Resolved an empty skills directory for target $($target | Out-String)."
    }
    foreach ($skill in $Skills) {
      $installDir = Join-Path $skillsDir $skill
      if ($WhatIfPreference) {
        Write-Host "What if: Remove $skill skill from: $installDir (if present)"
      } elseif (Test-Path -LiteralPath $installDir -PathType Container) {
        Remove-Item -LiteralPath $installDir -Recurse -Force
        Write-Host "Removed $skill skill from: $installDir"
      }
    }
  }
  Write-Host ""
  if ($WhatIfPreference) {
    Write-Host "What if: Only optimize-prompt, align-init and optimize-prompt-lite would be removed."
    if ($uninstallClaude) { Write-Host "What if: The Claude UserPromptSubmit and Stop hooks would be removed from ~/.claude/settings.json." }
    Write-Host "What if: The Prompt Optimizer runtime declared by the installed plan would be removed."
  } else {
    # 移除本协议安装的 hook 条目（只删自己的，其他 hooks 与字段不触碰）
    $settingsPath = Join-Path $UserHome ".claude\settings.json"
    $ourCmds = @(
      'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi',
      'if [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 .align/ 运行时。请运行 /align-init 接入对齐协议后再开发。"; fi',
      'bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true',
      'bash .align/align-route.sh 2>/dev/null || cat .align/HOOK-REMINDER.txt 2>/dev/null || true',
      'cat .align/HOOK-REMINDER.txt 2>/dev/null || true',
      'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; fi'
    )
    if ($uninstallClaude -and (Test-Path -LiteralPath $settingsPath)) {
      $data = Read-SettingsJson $settingsPath
      $changed = $false
      foreach ($eventName in @('UserPromptSubmit', 'Stop')) {
        if ($data["hooks"] -ne $null -and $data["hooks"][$eventName] -ne $null) {
          $groups = @()
          foreach ($group in $data["hooks"][$eventName]) {
            $kept = @($group["hooks"] | Where-Object { $ourCmds -notcontains $_["command"] })
            if ($kept.Count -ne @($group["hooks"]).Count) { $changed = $true }
            if ($kept.Count -gt 0) { $group["hooks"] = $kept; $groups += , $group }
          }
          if ($groups.Count -gt 0) { $data["hooks"][$eventName] = $groups }
          else { $data["hooks"].Remove($eventName) }
        }
      }
      if ($data["hooks"] -ne $null -and $data["hooks"].Count -eq 0) { $data.Remove("hooks") }
      if ($changed) {
        Write-SettingsJson $settingsPath $data
        Write-Host "Removed align-route hook from $settingsPath"
      } else {
        Write-Host "No align-route hook found in settings.json (no change)."
      }
    }
    $runtimeDestination = '.prompt-optimizer'
    if (Test-Path -LiteralPath $RuntimePlanPointer -PathType Leaf) {
      $installedLine = Get-Content -LiteralPath $RuntimePlanPointer | Where-Object { $_ -like "distribution`t*" } | Select-Object -First 1
      $installedParts = @($installedLine -split "`t", 4)
      if ($installedParts.Count -ne 4) { throw "Invalid installed runtime plan: $RuntimePlanPointer" }
      $runtimeDestination = $installedParts[2]
    }
    $runtimeInstallDir = Join-Path $RuntimeHome $runtimeDestination
    if (Test-Path -LiteralPath $runtimeInstallDir -PathType Container) {
      $ownership = Join-Path $runtimeInstallDir '.prompt-optimizer-owned'
      if ((-not (Test-Path -LiteralPath $ownership -PathType Leaf)) -or ((Get-Content -LiteralPath $ownership -Raw).Trim() -ne 'prompt-optimizer-runtime-v1')) {
        throw "Refusing to remove unowned runtime directory: $runtimeInstallDir"
      }
      Remove-Item -LiteralPath $runtimeInstallDir -Recurse -Force
      Remove-Item -LiteralPath $RuntimePlanPointer -Force -ErrorAction SilentlyContinue
      Write-Host "Removed Prompt Optimizer runtime from: $runtimeInstallDir"
    }
    Write-Host "Uninstall complete. Only optimize-prompt, align-init and optimize-prompt-lite were removed."
  }
  Write-Host "Other skills and user content were not touched."
  return
}

if ($WhatIfPreference) {
  foreach ($target in $installTargets) {
    $skillsDir = Get-InstallTargetValue -Target $target -Name "SkillsDir"
    if ([string]::IsNullOrWhiteSpace($skillsDir)) {
      throw "Resolved an empty skills directory for target $($target | Out-String)."
    }
    foreach ($skill in $Skills) {
      $installDir = Join-Path $skillsDir $skill
      $adapter = Get-InstallTargetValue -Target $target -Name "Adapter"
      Write-Host "What if: Install $skill skill to: $installDir (source: dist/$adapter)"
    }
  }
  Write-Host ""
  Write-Host "What if: Skills would be downloaded from $Repo"
  Write-Host "What if: Install runtime distribution according to dist/runtime/install-plan.tsv"
  Write-Host "Note: ~/.agents/skills uses the dist/claude-code package because agents-style tools consume the Claude-compatible skill layout."
  return
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("prompt-optimizer-skill-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "repo.zip"
$extractDir = Join-Path $tempRoot "repo"

New-Item -ItemType Directory -Force $tempRoot | Out-Null

try {
  $sourceRoot = Resolve-SourceRoot -Repo $Repo -ZipPath $zipPath -ExtractDir $extractDir

  $validatedAdapters = @{}
  foreach ($target in $installTargets) {
    $adapter = Get-InstallTargetValue -Target $target -Name "Adapter"
    if ($validatedAdapters[$adapter] -eq $null) {
      Test-AdapterSource -SourceRoot $sourceRoot -Adapter $adapter
      $validatedAdapters[$adapter] = $true
    }
  }

  $claudeSkillsDir = Join-Path $UserHome ".claude\skills"
  $wireClaude = $false
  foreach ($target in $installTargets) {
    $skillsDir = Get-InstallTargetValue -Target $target -Name "SkillsDir"
    if ($skillsDir -eq $claudeSkillsDir) { $wireClaude = $true }
  }
  if ($wireClaude) {
    $settingsPreflightPath = Join-Path $UserHome ".claude\settings.json"
    if (Test-Path -LiteralPath $settingsPreflightPath) {
      $null = Read-SettingsJson $settingsPreflightPath
    }
  }

  $installPlan = Join-Path $sourceRoot "dist\runtime\install-plan.tsv"
  if (-not (Test-Path -LiteralPath $installPlan -PathType Leaf)) {
    throw "Missing runtime install plan: $installPlan"
  }
  $planLine = Get-Content -LiteralPath $installPlan | Where-Object { $_ -like "distribution`t*" } | Select-Object -First 1
  $planParts = @($planLine -split "`t", 4)
  if ($planParts.Count -ne 4 -or $planParts[0] -ne 'distribution') {
    throw "Invalid runtime install plan: $installPlan"
  }
  if ($planParts[3] -ne 'always') {
    throw "Unsupported install-plan requirement: $($planParts[3])"
  }
  $runtimeSource = Join-Path $sourceRoot ("dist\" + $planParts[1])
  $runtimeInstallDir = Join-Path $RuntimeHome $planParts[2]
  $sourceOwnership = Join-Path $runtimeSource '.prompt-optimizer-owned'
  if (-not (Test-Path -LiteralPath $sourceOwnership -PathType Leaf)) {
    throw "Runtime distribution lacks ownership marker: $runtimeSource"
  }
  if (Test-Path -LiteralPath $runtimeInstallDir) {
    $ownership = Join-Path $runtimeInstallDir '.prompt-optimizer-owned'
    if ((-not (Test-Path -LiteralPath $ownership -PathType Leaf)) -or ((Get-Content -LiteralPath $ownership -Raw).Trim() -ne 'prompt-optimizer-runtime-v1')) {
      throw "Refusing to replace unowned runtime directory: $runtimeInstallDir"
    }
    Remove-Item -LiteralPath $runtimeInstallDir -Recurse -Force
  }
  Copy-Item -LiteralPath $runtimeSource -Destination $runtimeInstallDir -Recurse
  Copy-Item -LiteralPath $installPlan -Destination $RuntimePlanPointer -Force
  Write-Host "Installed Prompt Optimizer runtime to: $runtimeInstallDir"

  foreach ($target in $installTargets) {
    $skillsDir = Get-InstallTargetValue -Target $target -Name "SkillsDir"
    if ([string]::IsNullOrWhiteSpace($skillsDir)) {
      throw "Resolved an empty skills directory for target $($target | Out-String)."
    }
    $adapter = Get-InstallTargetValue -Target $target -Name "Adapter"
    $distSource = Join-Path $sourceRoot "dist\$adapter"
    New-Item -ItemType Directory -Force $skillsDir | Out-Null

    foreach ($skill in $Skills) {
      $installDir = Join-Path $skillsDir $skill
      $skillSource = Join-Path $distSource $skill

      if (Test-Path -LiteralPath $installDir) {
        Remove-Item -LiteralPath $installDir -Recurse -Force
      }

      Copy-Item -LiteralPath $skillSource -Destination $installDir -Recurse
      Write-Host "Installed $skill skill to: $installDir (source: dist/$adapter)"
    }
  }

  Write-Host ""
  Write-Host "Installed skills: optimize-prompt, align-init, optimize-prompt-lite"
  Write-Host "Use optimize-prompt with: `$optimize-prompt optimize: your rough idea"
  Write-Host "Use align-init with: /align-init (in your project directory)"
  Write-Host "Claude Code also supports: /optimize-prompt and /align-init"
  Write-Host "Note: ~/.agents/skills uses the dist/claude-code package because agents-style tools consume the Claude-compatible skill layout."

  # ── Claude Code hook 自动接线（幂等：已存在则跳过；只增不删既有字段）──
  if ($wireClaude) {
    $settingsPath = Join-Path $UserHome ".claude\settings.json"
    $hookCmd = 'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi'
    $stopHookCmd = 'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_HOOK_PHASE=stop bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; fi'
    $legacyCmds = @(
      'if [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; else printf "%s\n" "[对齐] 未检测到 .align/ 运行时。请运行 /align-init 接入对齐协议后再开发。"; fi',
      'bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true',
      'cat .align/HOOK-REMINDER.txt 2>/dev/null || true',
      'bash .align/align-route.sh 2>/dev/null || cat .align/HOOK-REMINDER.txt 2>/dev/null || true'
    )

    New-Item -ItemType Directory -Force (Join-Path $UserHome ".claude") | Out-Null
    $data = [ordered]@{}
    if (Test-Path -LiteralPath $settingsPath) {
      Copy-Item -LiteralPath $settingsPath -Destination "$settingsPath.bak-$(Get-Date -Format yyyyMMddHHmmss)"
      $data = Read-SettingsJson $settingsPath
    }

    if ($data["hooks"] -eq $null) { $data["hooks"] = @{} }
    if ($data["hooks"]["UserPromptSubmit"] -eq $null) { $data["hooks"]["UserPromptSubmit"] = @() }
    if ($data["hooks"]["Stop"] -eq $null) { $data["hooks"]["Stop"] = @() }

    $entries = $data["hooks"]["UserPromptSubmit"]
    $stopEntries = $data["hooks"]["Stop"]
    $present = $false
    $upgraded = $false
    $stopPresent = $false
    foreach ($group in $entries) {
      foreach ($h in $group["hooks"]) {
        if ($h["command"] -eq $hookCmd) { $present = $true }
        elseif ($legacyCmds -contains $h["command"]) { $h["command"] = $hookCmd; $upgraded = $true }
      }
    }

    foreach ($group in $stopEntries) {
      foreach ($h in $group["hooks"]) {
        if ($h["command"] -eq $stopHookCmd) { $stopPresent = $true }
      }
    }

    if ($present) {
      Write-Host "Hook wiring: already present (no change)."
    }
    elseif ($upgraded) {
      Write-Host "Hook wiring: upgraded legacy reminder hook to align-route."
    }
    else {
      $data["hooks"]["UserPromptSubmit"] += , @{ hooks = @(@{ type = "command"; command = $hookCmd }) }
      Write-Host "Hook wiring: added UserPromptSubmit hook to $settingsPath"
    }

    if (-not $stopPresent) {
      $data["hooks"]["Stop"] += , @{ hooks = @(@{ type = "command"; command = $stopHookCmd }) }
      Write-Host "Hook wiring: added Stop hook to $settingsPath"
    }

    if (-not $present -or $upgraded -or -not $stopPresent) {
      Write-SettingsJson $settingsPath $data
    }
  }

  $doctor = Join-Path $RuntimeHome '.prompt-optimizer\bin\align-doctor'
  if ($wireClaude -and (Test-Path -LiteralPath $doctor -PathType Leaf)) {
    Write-Host ''
    Write-Host 'Post-install doctor (informational; run it again from the target project after /align-init):'
    $doctorProject = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { (Get-Location).Path }
    $bash = Get-Command bash -ErrorAction SilentlyContinue
    if ($bash) {
      & $bash.Source $doctor $doctorProject
      if ($LASTEXITCODE -ne 0) { Write-Host "Doctor reported incomplete project integration (status $LASTEXITCODE)." }
    } else {
      Write-Host 'Doctor unavailable: bash was not found; run the installed doctor from Git Bash or WSL.'
    }
  }

  # ── 复制 hooks/ 脚本到全局目录（align-init 从此处复制到项目 .align/）──
  $hooksSource = Join-Path $sourceRoot "dist\claude-code\hooks"
  if (Test-Path -LiteralPath $hooksSource -PathType Container) {
    $hooksFiles = @('align-route.sh', 'align-check.sh', 'HOOK-REMINDER.txt', 'settings.fragment.json', 'project-settings.fragment.json')
    foreach ($target in $installTargets) {
      $skillsDir = Get-InstallTargetValue -Target $target -Name "SkillsDir"
      $hooksDest = ""
      if ($skillsDir -eq (Join-Path $HOME ".claude\skills")) {
        $hooksDest = Join-Path $HOME ".claude\hooks"
      } elseif ($skillsDir -eq (Join-Path $HOME ".agents\skills")) {
        $hooksDest = Join-Path $HOME ".agents\hooks"
      }
      if ($hooksDest) {
        New-Item -ItemType Directory -Force $hooksDest | Out-Null
        foreach ($hf in $hooksFiles) {
          $src = Join-Path $hooksSource $hf
          if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $hooksDest $hf) -Force
          }
        }
        Write-Host "Copied hooks scripts to: $hooksDest"
      }
    }
  }
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
