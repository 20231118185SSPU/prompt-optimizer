[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string]$Target = "all",
  [string]$SkillsDir = "",
  [string]$Repo = "https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip",
  [switch]$Version,
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$ScriptVersion = "v3.0"
$Skills = @("optimize-prompt", "align-init")
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

  Invoke-WebRequest -Uri $Repo -OutFile $ZipPath
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
    Write-Host "What if: Only optimize-prompt and align-init would be removed."
  } else {
    Write-Host "Uninstall complete. Only optimize-prompt and align-init were removed."
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
    if (-not $validatedAdapters.ContainsKey($adapter)) {
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
  Write-Host "Installed skills: optimize-prompt, align-init"
  Write-Host "Use optimize-prompt with: `$optimize-prompt optimize: your rough idea"
  Write-Host "Use align-init with: /align-init (in your project directory)"
  Write-Host "Claude Code also supports: /optimize-prompt and /align-init"
  Write-Host "Note: ~/.agents/skills uses the dist/claude-code package because agents-style tools consume the Claude-compatible skill layout."
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
