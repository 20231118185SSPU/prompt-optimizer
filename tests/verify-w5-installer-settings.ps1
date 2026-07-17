$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Installer = Join-Path $Root 'scripts\install-skill.ps1'
$PowerShell = (Get-Command pwsh).Source
$Sandboxes = New-Object System.Collections.Generic.List[string]
$RealSettings = Join-Path $HOME '.claude\settings.json'

function Get-FileHashOrMissing {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 'missing' }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function New-TestSandbox {
  param([string]$Name)
  $sandbox = Join-Path ([System.IO.Path]::GetTempPath()) ("po-w5-$Name-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force $sandbox | Out-Null
  $Sandboxes.Add($sandbox)
  return $sandbox
}

function Invoke-IsolatedPowerShell {
  param(
    [string]$Code,
    [string]$Sandbox,
    [int]$TimeoutMilliseconds = 60000
  )
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($Code))
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $PowerShell
  $startInfo.Arguments = "-NoProfile -EncodedCommand $encoded"
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.EnvironmentVariables['HOME'] = $Sandbox
  $startInfo.EnvironmentVariables['USERPROFILE'] = $Sandbox
  $startInfo.EnvironmentVariables['APPDATA'] = (Join-Path $Sandbox 'AppData\Roaming')
  $startInfo.EnvironmentVariables['CLAUDE_CONFIG_DIR'] = (Join-Path $Sandbox '.claude')
  $startInfo.EnvironmentVariables.Remove('PROMPT_OPTIMIZER_HOME')
  $startInfo.EnvironmentVariables.Remove('CODEX_HOME')
  $child = [System.Diagnostics.Process]::Start($startInfo)
  $stdoutTask = $child.StandardOutput.ReadToEndAsync()
  $stderrTask = $child.StandardError.ReadToEndAsync()
  $timedOut = -not $child.WaitForExit($TimeoutMilliseconds)
  if ($timedOut) {
    try { $child.Kill($true) } catch { Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue }
    if (-not $child.WaitForExit(5000)) {
      throw "Timed-out PowerShell process $($child.Id) did not terminate."
    }
  }
  [Threading.Tasks.Task]::WaitAll(@($stdoutTask, $stderrTask))
  return [pscustomobject]@{
    ExitCode = if ($timedOut) { $null } else { $child.ExitCode }
    TimedOut = $timedOut
    Stdout = $stdoutTask.Result
    Stderr = $stderrTask.Result
  }
}

function Invoke-Installer {
  param(
    [string]$Sandbox,
    [switch]$Uninstall
  )
  $uninstallArgument = if ($Uninstall) { ' -Uninstall' } else { '' }
  $code = '$InformationPreference = "SilentlyContinue"; & ''' + $Installer +
    ''' -Target claude -Repo ''' + $Root + '''' + $uninstallArgument
  return Invoke-IsolatedPowerShell -Code $code -Sandbox $Sandbox
}

function Read-Commands {
  param($Settings)
  return @($Settings.hooks.UserPromptSubmit | ForEach-Object hooks | ForEach-Object command) +
    @($Settings.hooks.Stop | ForEach-Object hooks | ForEach-Object command)
}

$realSettingsHashBefore = Get-FileHashOrMissing $RealSettings
try {
  $malformed = New-TestSandbox 'settings-malformed'
  $malformedSettings = Join-Path $malformed '.claude\settings.json'
  $malformedRuntime = Join-Path $malformed '.prompt-optimizer'
  $malformedSkill = Join-Path $malformed '.claude\skills\optimize-prompt'
  New-Item -ItemType Directory -Force (Split-Path -Parent $malformedSettings), $malformedRuntime, $malformedSkill | Out-Null
  [System.IO.File]::WriteAllText($malformedSettings, "{ invalid settings json`n")
  $malformedBefore = Get-Content -LiteralPath $malformedSettings -Raw
  [System.IO.File]::WriteAllText((Join-Path $malformedRuntime '.prompt-optimizer-owned'), "prompt-optimizer-runtime-v1`n")
  [System.IO.File]::WriteAllText((Join-Path $malformedRuntime 'user-sentinel'), "keep-runtime`n")
  [System.IO.File]::WriteAllText((Join-Path $malformedSkill 'user-sentinel'), "keep-skill`n")

  $malformedResult = Invoke-Installer -Sandbox $malformed
  if ($malformedResult.TimedOut -or $malformedResult.ExitCode -eq 0) {
    throw "Malformed settings unexpectedly allowed installation: $($malformedResult.Stdout) $($malformedResult.Stderr)"
  }
  if ((Get-Content -LiteralPath $malformedSettings -Raw) -ne $malformedBefore -or
      -not (Test-Path -LiteralPath (Join-Path $malformedRuntime 'user-sentinel')) -or
      -not (Test-Path -LiteralPath (Join-Path $malformedSkill 'user-sentinel'))) {
    throw 'Malformed settings changed existing settings, runtime, or skills.'
  }

  $invalidShape = New-TestSandbox 'settings-shape'
  $invalidShapeSettings = Join-Path $invalidShape '.claude\settings.json'
  $invalidShapeRuntime = Join-Path $invalidShape '.prompt-optimizer'
  $invalidShapeSkill = Join-Path $invalidShape '.claude\skills\optimize-prompt'
  New-Item -ItemType Directory -Force (Split-Path -Parent $invalidShapeSettings), $invalidShapeRuntime, $invalidShapeSkill | Out-Null
  [System.IO.File]::WriteAllText($invalidShapeSettings, '{"hooks":"keep-user-hooks","env":{"KEEP":"yes"}}' + "`n")
  $invalidShapeBefore = Get-Content -LiteralPath $invalidShapeSettings -Raw
  [System.IO.File]::WriteAllText((Join-Path $invalidShapeRuntime '.prompt-optimizer-owned'), "prompt-optimizer-runtime-v1`n")
  [System.IO.File]::WriteAllText((Join-Path $invalidShapeRuntime 'user-sentinel'), "keep-runtime`n")
  [System.IO.File]::WriteAllText((Join-Path $invalidShapeSkill 'user-sentinel'), "keep-skill`n")

  $invalidShapeResult = Invoke-Installer -Sandbox $invalidShape
  if ($invalidShapeResult.TimedOut -or $invalidShapeResult.ExitCode -eq 0) {
    throw 'Structurally invalid hooks unexpectedly allowed installation.'
  }
  if ((Get-Content -LiteralPath $invalidShapeSettings -Raw) -ne $invalidShapeBefore -or
      -not (Test-Path -LiteralPath (Join-Path $invalidShapeRuntime 'user-sentinel')) -or
      -not (Test-Path -LiteralPath (Join-Path $invalidShapeSkill 'user-sentinel'))) {
    throw 'Late settings merge failure did not roll back existing runtime and skills.'
  }

  $valid = New-TestSandbox 'settings-valid'
  $validSettingsPath = Join-Path $valid '.claude\settings.json'
  $projectFacts = Join-Path $valid 'project\.align\facts.md'
  New-Item -ItemType Directory -Force (Split-Path -Parent $validSettingsPath), (Split-Path -Parent $projectFacts) | Out-Null
  [System.IO.File]::WriteAllText($validSettingsPath, @'
{
  "env": { "KEEP": "yes" },
  "permissions": { "allow": ["Read"] },
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "echo foreign-user-hook" }] }],
    "Stop": [{ "hooks": [{ "type": "command", "command": "echo foreign-stop-hook" }] }]
  }
}
'@)
  [System.IO.File]::WriteAllText($projectFacts, "keep-project-data`n")

  $firstInstall = Invoke-Installer -Sandbox $valid
  if ($firstInstall.TimedOut -or $firstInstall.ExitCode -ne 0) {
    throw "Valid settings installation failed: $($firstInstall.Stdout) $($firstInstall.Stderr)"
  }
  $settingsHashAfterFirstInstall = Get-FileHashOrMissing $validSettingsPath
  $secondInstall = Invoke-Installer -Sandbox $valid
  if ($secondInstall.TimedOut -or $secondInstall.ExitCode -ne 0) {
    throw "Idempotent settings installation failed: $($secondInstall.Stdout) $($secondInstall.Stderr)"
  }
  if ((Get-FileHashOrMissing $validSettingsPath) -ne $settingsHashAfterFirstInstall) {
    throw 'Idempotent installation changed settings bytes.'
  }
  $validSettings = Get-Content -LiteralPath $validSettingsPath -Raw | ConvertFrom-Json
  $commands = @(Read-Commands $validSettings)
  if ($validSettings.env.KEEP -ne 'yes' -or $validSettings.permissions.allow[0] -ne 'Read' -or
      @($commands | Where-Object { $_ -eq 'echo foreign-user-hook' }).Count -ne 1 -or
      @($commands | Where-Object { $_ -eq 'echo foreign-stop-hook' }).Count -ne 1 -or
      @($commands | Where-Object { $_ -match 'BLOCK_ON_HIGH=on' }).Count -ne 1 -or
      @($commands | Where-Object { $_ -match 'ALIGN_HOOK_PHASE=stop' }).Count -ne 1) {
    throw 'Settings merge did not preserve user fields or exactly one owned hook per event.'
  }
  if (Get-ChildItem -LiteralPath (Split-Path -Parent $validSettingsPath) -Force |
      Where-Object Name -Like '.settings.json.*') {
    throw 'Settings atomic replacement left a temporary file.'
  }

  $uninstall = Invoke-Installer -Sandbox $valid -Uninstall
  if ($uninstall.TimedOut -or $uninstall.ExitCode -ne 0) {
    throw "Valid uninstall failed: $($uninstall.Stdout) $($uninstall.Stderr)"
  }
  $uninstalledSettings = Get-Content -LiteralPath $validSettingsPath -Raw | ConvertFrom-Json
  $remainingCommands = @(Read-Commands $uninstalledSettings)
  if ($uninstalledSettings.env.KEEP -ne 'yes' -or $uninstalledSettings.permissions.allow[0] -ne 'Read' -or
      @($remainingCommands | Where-Object { $_ -eq 'echo foreign-user-hook' }).Count -ne 1 -or
      @($remainingCommands | Where-Object { $_ -eq 'echo foreign-stop-hook' }).Count -ne 1 -or
      @($remainingCommands | Where-Object { $_ -match 'BLOCK_ON_HIGH=on|ALIGN_HOOK_PHASE=stop' }).Count -ne 0) {
    throw 'Uninstall did not preserve foreign settings while removing owned hooks.'
  }
  $runtimeRemains = Test-Path -LiteralPath (Join-Path $valid '.prompt-optimizer')
  $skillRemains = Test-Path -LiteralPath (Join-Path $valid '.claude\skills\optimize-prompt')
  $projectDataChanged = (Get-Content -LiteralPath $projectFacts -Raw).Trim() -ne 'keep-project-data'
  if ($runtimeRemains -or $skillRemains -or $projectDataChanged) {
    throw 'Uninstall retained owned files or damaged project .align data.'
  }

  $unowned = New-TestSandbox 'settings-unowned'
  $unownedSettings = Join-Path $unowned '.claude\settings.json'
  $unownedRuntime = Join-Path $unowned '.prompt-optimizer'
  $unownedSkill = Join-Path $unowned '.claude\skills\optimize-prompt'
  New-Item -ItemType Directory -Force (Split-Path -Parent $unownedSettings), $unownedRuntime, $unownedSkill | Out-Null
  [System.IO.File]::WriteAllText($unownedSettings, '{"env":{"KEEP":"yes"}}' + "`n")
  [System.IO.File]::WriteAllText((Join-Path $unownedRuntime 'user-sentinel'), "keep-runtime`n")
  [System.IO.File]::WriteAllText((Join-Path $unownedSkill 'user-sentinel'), "keep-skill`n")
  $unownedBefore = Get-FileHashOrMissing $unownedSettings
  $unownedResult = Invoke-Installer -Sandbox $unowned -Uninstall
  if ($unownedResult.TimedOut -or $unownedResult.ExitCode -eq 0 -or
      (Get-FileHashOrMissing $unownedSettings) -ne $unownedBefore -or
      -not (Test-Path -LiteralPath (Join-Path $unownedRuntime 'user-sentinel')) -or
      -not (Test-Path -LiteralPath (Join-Path $unownedSkill 'user-sentinel'))) {
    throw 'Unowned runtime uninstall changed settings, runtime, or skills.'
  }

  $timeoutSandbox = New-TestSandbox 'settings-timeout'
  $descendantPidFile = Join-Path $timeoutSandbox 'descendant.pid'
  $hangCode = '$descendant = Start-Process -FilePath ''' + $PowerShell +
    ''' -ArgumentList ''-NoProfile'',''-Command'',''Start-Sleep -Seconds 30'' -PassThru -WindowStyle Hidden; ' +
    '[System.IO.File]::WriteAllText(''' + $descendantPidFile + ''', [string]$descendant.Id); ' +
    '& ''' + $Installer + ''' -Version; Start-Sleep -Seconds 30'
  $timeoutResult = Invoke-IsolatedPowerShell -Code $hangCode -Sandbox $timeoutSandbox -TimeoutMilliseconds 2000
  if (-not $timeoutResult.TimedOut -or -not (Test-Path -LiteralPath $descendantPidFile)) {
    throw 'Bounded PowerShell timeout regression did not reach the expected timeout.'
  }
  $descendantPid = [int](Get-Content -LiteralPath $descendantPidFile -Raw)
  Start-Sleep -Milliseconds 300
  $descendantStillRunning = Get-Process -Id $descendantPid -ErrorAction SilentlyContinue
  if ($descendantStillRunning) {
    Stop-Process -Id $descendantPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 200
    if (Get-Process -Id $descendantPid -ErrorAction SilentlyContinue) {
      throw "Timed-out installer harness left descendant process $descendantPid running."
    }
    Write-Host "Note: descendant process $descendantPid required explicit cleanup (Windows process tree limitation)"
  }

  Write-Host 'PASS: W5 PowerShell settings/install/uninstall are isolated, bounded, and zero-damage'
}
finally {
  foreach ($sandbox in $Sandboxes) {
    Remove-Item -LiteralPath $sandbox -Recurse -Force -ErrorAction SilentlyContinue
  }
  $realSettingsHashAfter = Get-FileHashOrMissing $RealSettings
  if ($realSettingsHashAfter -ne $realSettingsHashBefore) {
    throw "Real Claude settings hash changed: $realSettingsHashBefore -> $realSettingsHashAfter"
  }
}
