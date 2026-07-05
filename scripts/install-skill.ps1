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

if ($Version) {
  Write-Host "prompt-optimizer installer $ScriptVersion"
  return
}

function Resolve-SkillsDirs {
  param([string]$Target)

  if ($Target -eq "claude") {
    return @((Join-Path $HOME ".claude\skills"))
  }

  if ($Target -eq "codex") {
    if ($env:CODEX_HOME) {
      return @((Join-Path $env:CODEX_HOME "skills"))
    }
    return @((Join-Path $HOME ".codex\skills"))
  }

  if ($Target -eq "agents") {
    return @((Join-Path $HOME ".agents\skills"))
  }

  if ($Target -eq "all") {
    $dirs = @()
    if ($env:CODEX_HOME) {
      $dirs += (Join-Path $env:CODEX_HOME "skills")
    } else {
      $dirs += (Join-Path $HOME ".codex\skills")
    }
    $dirs += (Join-Path $HOME ".claude\skills")
    $dirs += (Join-Path $HOME ".agents\skills")
    return $dirs
  }

  $codex = Join-Path $HOME ".codex\skills"
  $claude = Join-Path $HOME ".claude\skills"
  $agents = Join-Path $HOME ".agents\skills"

  if (Test-Path $codex) { return $codex }
  if (Test-Path $claude) { return $claude }
  if (Test-Path $agents) { return $agents }

  return @($codex)
}

if ($SkillsDir) {
  $skillsDirs = @($SkillsDir)
} else {
  $skillsDirs = Resolve-SkillsDirs -Target $Target
}

if ($Uninstall) {
  foreach ($skillsDir in $skillsDirs) {
    foreach ($skill in $Skills) {
      $installDir = Join-Path $skillsDir $skill
      if (Test-Path -LiteralPath $installDir -PathType Container) {
        if ($WhatIfPreference) {
          Write-Host "What if: Remove $skill skill from: $installDir"
        } else {
          Remove-Item -LiteralPath $installDir -Recurse -Force
          Write-Host "Removed $skill skill from: $installDir"
        }
      }
    }
  }
  Write-Host ""
  Write-Host "Uninstall complete. Only optimize-prompt and align-init were removed."
  Write-Host "Other skills and user content were not touched."
  return
}

if ($WhatIfPreference) {
  foreach ($skillsDir in $skillsDirs) {
    foreach ($skill in $Skills) {
      $installDir = Join-Path $skillsDir $skill
      Write-Host "What if: Install $skill skill to: $installDir"
    }
  }
  return
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("prompt-optimizer-skill-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "repo.zip"
$extractDir = Join-Path $tempRoot "repo"

New-Item -ItemType Directory -Force $tempRoot | Out-Null

try {
  if (Test-Path -LiteralPath $Repo -PathType Container) {
    $distSource = Join-Path (Resolve-Path -LiteralPath $Repo).Path "dist\claude-code"
  } else {
    Invoke-WebRequest -Uri $Repo -OutFile $zipPath
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
    $distSource = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1 | ForEach-Object {
      Join-Path $_.FullName "dist\claude-code"
    }
  }

  if (-not (Test-Path -LiteralPath $distSource -PathType Container)) {
    throw "Could not find dist\claude-code in downloaded archive."
  }

  foreach ($skill in $Skills) {
    $skillSource = Join-Path $distSource $skill
    if (-not (Test-Path -LiteralPath (Join-Path $skillSource "SKILL.md"))) {
      throw "Could not find dist\claude-code\$skill\SKILL.md."
    }
  }

  foreach ($skillsDir in $skillsDirs) {
    New-Item -ItemType Directory -Force $skillsDir | Out-Null

    foreach ($skill in $Skills) {
      $installDir = Join-Path $skillsDir $skill
      $skillSource = Join-Path $distSource $skill

      if (Test-Path -LiteralPath $installDir) {
        Remove-Item -LiteralPath $installDir -Recurse -Force
      }

      Copy-Item -LiteralPath $skillSource -Destination $installDir -Recurse
      Write-Host "Installed $skill skill to: $installDir"
    }
  }

  Write-Host ""
  Write-Host "Installed skills: optimize-prompt, align-init"
  Write-Host "Use optimize-prompt with: `$optimize-prompt optimize: your rough idea"
  Write-Host "Use align-init with: /align-init (in your project directory)"
  Write-Host "Claude Code also supports: /optimize-prompt and /align-init"
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
