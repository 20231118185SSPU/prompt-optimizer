[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$Target = "all",
  [string]$SkillsDir = "",
  [string]$Repo = "https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip",
  [switch]$Version,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$ScriptVersion = "v3.1"
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
    return $list.ToArray()
  }
  return $InputObject
}

function Read-SettingsJson {
  param([string]$Path)
  $raw = Get-Content -LiteralPath $Path -Raw
  return ConvertTo-OrderedHashtable ($raw | ConvertFrom-Json)
}

function Write-SettingsJson {
  param([string]$Path, $Data)
  $json = $Data | ConvertTo-Json -Depth 64
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $json + "`n", $utf8NoBom)
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

if ($Uninstall) {
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
    Write-Host "What if: The align-route hook would be removed from ~/.claude/settings.json."
  } else {
    # 移除本协议安装的 hook 条目（只删自己的，其他 hooks 与字段不触碰）
    $settingsPath = Join-Path $HOME ".claude\settings.json"
    $ourCmds = @(
      'bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true',
      'bash .align/align-route.sh 2>/dev/null || cat .align/HOOK-REMINDER.txt 2>/dev/null || true',
      'cat .align/HOOK-REMINDER.txt 2>/dev/null || true'
    )
    if (Test-Path -LiteralPath $settingsPath) {
      $data = Read-SettingsJson $settingsPath
      $changed = $false
      if ($data["hooks"] -ne $null -and $data["hooks"]["UserPromptSubmit"] -ne $null) {
        $groups = @()
        foreach ($group in $data["hooks"]["UserPromptSubmit"]) {
          $kept = @($group["hooks"] | Where-Object { $ourCmds -notcontains $_["command"] })
          if ($kept.Count -ne @($group["hooks"]).Count) { $changed = $true }
          if ($kept.Count -gt 0) { $group["hooks"] = $kept; $groups += , $group }
        }
        if ($groups.Count -gt 0) { $data["hooks"]["UserPromptSubmit"] = $groups }
        else { $data["hooks"].Remove("UserPromptSubmit") }
        if ($data["hooks"].Count -eq 0) { $data.Remove("hooks") }
      }
      if ($changed) {
        Write-SettingsJson $settingsPath $data
        Write-Host "Removed align-route hook from $settingsPath"
      } else {
        Write-Host "No align-route hook found in settings.json (no change)."
      }
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
  $claudeSkillsDir = Join-Path $HOME ".claude\skills"
  $wireClaude = $false
  foreach ($target in $installTargets) {
    $skillsDir = Get-InstallTargetValue -Target $target -Name "SkillsDir"
    if ($skillsDir -eq $claudeSkillsDir) { $wireClaude = $true }
  }

  if ($wireClaude) {
    $settingsPath = Join-Path $HOME ".claude\settings.json"
    $hookCmd = 'bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh" 2>/dev/null || cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" 2>/dev/null || true'
    $legacyCmds = @(
      'cat .align/HOOK-REMINDER.txt 2>/dev/null || true',
      'bash .align/align-route.sh 2>/dev/null || cat .align/HOOK-REMINDER.txt 2>/dev/null || true'
    )

    New-Item -ItemType Directory -Force (Join-Path $HOME ".claude") | Out-Null
    $data = [ordered]@{}
    if (Test-Path -LiteralPath $settingsPath) {
      Copy-Item -LiteralPath $settingsPath -Destination "$settingsPath.bak-$(Get-Date -Format yyyyMMddHHmmss)"
      $data = Read-SettingsJson $settingsPath
    }

    if ($data["hooks"] -eq $null) { $data["hooks"] = @{} }
    if ($data["hooks"]["UserPromptSubmit"] -eq $null) { $data["hooks"]["UserPromptSubmit"] = @() }

    $entries = $data["hooks"]["UserPromptSubmit"]
    $present = $false
    $upgraded = $false
    foreach ($group in $entries) {
      foreach ($h in $group["hooks"]) {
        if ($h["command"] -eq $hookCmd) { $present = $true }
        elseif ($legacyCmds -contains $h["command"]) { $h["command"] = $hookCmd; $upgraded = $true }
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

    if (-not $present) {
      Write-SettingsJson $settingsPath $data
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
