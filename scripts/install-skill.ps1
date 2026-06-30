param(
  [string]$Target = "all",
  [string]$SkillsDir = "",
  [string]$Repo = "https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip"
)

$ErrorActionPreference = "Stop"

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
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("prompt-optimizer-skill-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "repo.zip"
$extractDir = Join-Path $tempRoot "repo"

New-Item -ItemType Directory -Force $tempRoot | Out-Null

try {
  if (Test-Path -LiteralPath $Repo -PathType Container) {
    $skillSource = Join-Path (Resolve-Path -LiteralPath $Repo).Path "agent-skills\optimize-prompt"
  } else {
    Invoke-WebRequest -Uri $Repo -OutFile $zipPath
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
    $skillSource = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1 | ForEach-Object {
      Join-Path $_.FullName "agent-skills\optimize-prompt"
    }
  }

  if (-not (Test-Path -LiteralPath (Join-Path $skillSource "SKILL.md"))) {
    throw "Could not find agent-skills\optimize-prompt in downloaded archive."
  }

  foreach ($skillsDir in $skillsDirs) {
    $installDir = Join-Path $skillsDir "optimize-prompt"
    New-Item -ItemType Directory -Force $skillsDir | Out-Null

    if (Test-Path -LiteralPath $installDir) {
      Remove-Item -LiteralPath $installDir -Recurse -Force
    }

    Copy-Item -LiteralPath $skillSource -Destination $installDir -Recurse
    Write-Host "Installed optimize-prompt skill to: $installDir"
  }

  Write-Host ""
  Write-Host "Use it with: `$optimize-prompt optimize: your rough idea"
  Write-Host "Claude Code also supports: /optimize-prompt optimize: your rough idea"
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
