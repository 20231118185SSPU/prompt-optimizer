$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Sandbox = Join-Path ([System.IO.Path]::GetTempPath()) ("po-runtime-" + [guid]::NewGuid().ToString('N'))
$Skills = Join-Path $Sandbox 'skills'
$env:PROMPT_OPTIMIZER_HOME = $Sandbox

try {
  New-Item -ItemType Directory -Force $Sandbox | Out-Null
  $unowned = Join-Path $Sandbox '.prompt-optimizer'
  New-Item -ItemType Directory -Force $unowned | Out-Null
  Set-Content -LiteralPath (Join-Path $unowned 'user-file') -Value 'user data'
  $refused = $false
  try {
    & (Join-Path $Root 'scripts\install-skill.ps1') -Target codex -SkillsDir $Skills -Repo $Root
  } catch {
    $refused = $true
  }
  if (-not $refused -or -not (Test-Path -LiteralPath (Join-Path $unowned 'user-file'))) {
    throw 'Installer did not preserve an unowned runtime directory.'
  }
  Remove-Item -LiteralPath $unowned -Recurse -Force

  & (Join-Path $Root 'scripts\install-skill.ps1') -Target codex -SkillsDir $Skills -Repo $Root
  if (-not (Test-Path -LiteralPath (Join-Path $Sandbox '.prompt-optimizer\runtime\index.js'))) {
    throw 'Structured runtime was not installed.'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $Sandbox '.prompt-optimizer\adapters\codex.sh'))) {
    throw 'Codex adapter was not installed.'
  }

  New-Item -ItemType File -Force (Join-Path $Sandbox '.prompt-optimizer\stale-file') | Out-Null
  & (Join-Path $Root 'scripts\install-skill.ps1') -Target codex -SkillsDir $Skills -Repo $Root
  if (Test-Path -LiteralPath (Join-Path $Sandbox '.prompt-optimizer\stale-file')) {
    throw 'Runtime upgrade did not remove a stale file.'
  }

  & (Join-Path $Root 'scripts\install-skill.ps1') -Target codex -SkillsDir $Skills -Repo $Root -Uninstall
  if (Test-Path -LiteralPath (Join-Path $Sandbox '.prompt-optimizer')) {
    throw 'Runtime uninstall did not remove the owned directory.'
  }
  Write-Host 'PASS: PowerShell runtime install, upgrade, and uninstall sandbox'
}
finally {
  Remove-Item Env:PROMPT_OPTIMIZER_HOME -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Sandbox -Recurse -Force -ErrorAction SilentlyContinue
}
