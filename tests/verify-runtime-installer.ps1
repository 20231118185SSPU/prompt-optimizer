$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RealSettings = Join-Path $HOME '.claude\settings.json'

function Get-FileHashOrMissing {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 'missing' }
  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  # Fallback for PS 5.1 environments without Get-FileHash
  $certUtilOutput = & certutil -hashfile $Path SHA256 2>$null
  return ($certUtilOutput[0] -replace '\s','').ToLowerInvariant()
}

if ($env:PROMPT_OPTIMIZER_RUNTIME_TEST_CHILD -eq '1') {
  $Sandbox = $env:PROMPT_OPTIMIZER_RUNTIME_TEST_SANDBOX
  $Skills = Join-Path $Sandbox 'skills'
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
  exit 0
}

$Sandbox = Join-Path ([System.IO.Path]::GetTempPath()) ("po-runtime-" + [guid]::NewGuid().ToString('N'))
$realSettingsHashBefore = Get-FileHashOrMissing $RealSettings
try {
  New-Item -ItemType Directory -Force $Sandbox | Out-Null
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = (Get-Command pwsh).Source
  $startInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $MyInvocation.MyCommand.Path + '"'
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.EnvironmentVariables['HOME'] = $Sandbox
  $startInfo.EnvironmentVariables['USERPROFILE'] = $Sandbox
  $startInfo.EnvironmentVariables['APPDATA'] = (Join-Path $Sandbox 'AppData\Roaming')
  $startInfo.EnvironmentVariables['CLAUDE_CONFIG_DIR'] = (Join-Path $Sandbox '.claude')
  $startInfo.EnvironmentVariables['PROMPT_OPTIMIZER_HOME'] = $Sandbox
  $startInfo.EnvironmentVariables['PROMPT_OPTIMIZER_RUNTIME_TEST_CHILD'] = '1'
  $startInfo.EnvironmentVariables['PROMPT_OPTIMIZER_RUNTIME_TEST_SANDBOX'] = $Sandbox
  $startInfo.EnvironmentVariables.Remove('CODEX_HOME')
  $child = [System.Diagnostics.Process]::Start($startInfo)
  $stdoutTask = $child.StandardOutput.ReadToEndAsync()
  $stderrTask = $child.StandardError.ReadToEndAsync()
  if (-not $child.WaitForExit(60000)) {
    try { $child.Kill($true) } catch { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue }
    $child.WaitForExit(5000) | Out-Null
    throw 'PowerShell runtime installer test exceeded its 60 second deadline.'
  }
  [Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask))
  if ($child.ExitCode -ne 0) {
    throw "PowerShell runtime installer child failed: $($stdoutTask.Result) $($stderrTask.Result)"
  }
  Write-Host $stdoutTask.Result.Trim()
}
finally {
  Remove-Item -LiteralPath $Sandbox -Recurse -Force -ErrorAction SilentlyContinue
  $realSettingsHashAfter = Get-FileHashOrMissing $RealSettings
  if ($realSettingsHashAfter -ne $realSettingsHashBefore) {
    throw "Real Claude settings hash changed: $realSettingsHashBefore -> $realSettingsHashAfter"
  }
}
