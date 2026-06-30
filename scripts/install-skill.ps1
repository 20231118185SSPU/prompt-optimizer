param(
  [string]$Target = "auto",
  [string]$SkillsDir = "",
  [string]$Repo = "https://github.com/20231118185SSPU/prompt-optimizer/archive/refs/heads/main.zip"
)

$ErrorActionPreference = "Stop"

function Resolve-SkillsDir {
  param([string]$Target)

  if ($Target -eq "claude") {
    return Join-Path $HOME ".claude\skills"
  }

  if ($Target -eq "codex") {
    if ($env:CODEX_HOME) {
      return Join-Path $env:CODEX_HOME "skills"
    }
    return Join-Path $HOME ".codex\skills"
  }

  if ($Target -eq "agents") {
    return Join-Path $HOME ".agents\skills"
  }

  if ($env:CODEX_HOME) {
    return Join-Path $env:CODEX_HOME "skills"
  }

  $codex = Join-Path $HOME ".codex\skills"
  $claude = Join-Path $HOME ".claude\skills"
  $agents = Join-Path $HOME ".agents\skills"

  if (Test-Path $codex) { return $codex }
  if (Test-Path $claude) { return $claude }
  if (Test-Path $agents) { return $agents }

  return $codex
}

if ($SkillsDir) {
  $skillsDir = $SkillsDir
} else {
  $skillsDir = Resolve-SkillsDir -Target $Target
}
$installDir = Join-Path $skillsDir "optimize-prompt"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("prompt-optimizer-skill-" + [System.Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot "repo.zip"
$extractDir = Join-Path $tempRoot "repo"

New-Item -ItemType Directory -Force $tempRoot | Out-Null
New-Item -ItemType Directory -Force $skillsDir | Out-Null

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

  if (Test-Path -LiteralPath $installDir) {
    Remove-Item -LiteralPath $installDir -Recurse -Force
  }

  Copy-Item -LiteralPath $skillSource -Destination $installDir -Recurse

  Write-Host "Installed optimize-prompt skill to: $installDir"
  Write-Host "Invoke it with: `$optimize-prompt or /optimize-prompt, depending on your agent."
}
finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
