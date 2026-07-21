import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type FeasibilityStatus = 'supported' | 'available' | 'blocked' | 'unknown';

export interface FeasibilityItem {
  status: FeasibilityStatus;
  detail: string;
}

export interface HostFeasibilityReport {
  schemaVersion: '1.0.0';
  kind: 'alignment.host-feasibility';
  readOnly: true;
  host: { name: string; version: string; status: FeasibilityStatus };
  configuration: Array<FeasibilityItem & { path: string }>;
  capabilities: {
    promptIngress: FeasibilityItem;
    mechanicalBlocking: FeasibilityItem;
    completion: FeasibilityItem;
    session: FeasibilityItem;
  };
  conflicts: Array<FeasibilityItem & {
    kind: 'project_policy' | 'permission' | 'invalid_configuration' | 'parallel_router';
    ref: string;
  }>;
  dependencies: Array<FeasibilityItem & { name: string; version?: string }>;
  degradedPath: FeasibilityItem & { mode: 'explicit'; activationLevel: 'advisory' | 'none' };
  plannedChanges: [];
}

export interface HostFeasibilityOptions {
  host?: { name: string; version?: string };
  requestedIngress?: 'hook' | 'explicit';
  homeDir?: string;
}

function readText(file: string): string {
  try {
    if (!fs.statSync(file).isFile() || fs.statSync(file).size > 128 * 1024) return '';
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function isCanonicalRouterWrapper(file: string): boolean {
  const text = readText(file);
  return text.includes('# prompt-optimizer: canonical-router-wrapper v1') &&
    text.includes('CANONICAL_ROUTER="$SCRIPT_DIR/host/align-route.sh"') &&
    text.includes('exec bash "$CANONICAL_ROUTER" "$@"');
}

function relative(projectDir: string, file: string): string {
  return path.relative(projectDir, file).replace(/\\/g, '/');
}

function existingFileStatus(file: string): FeasibilityStatus {
  try {
    return fs.statSync(file).isFile() ? 'available' : 'unknown';
  } catch {
    return 'unknown';
  }
}

function existingPathStatus(target: string): FeasibilityStatus {
  try {
    fs.statSync(target);
    return 'available';
  } catch {
    return 'unknown';
  }
}

function commandTokens(command: string): string[] {
  return [...command.matchAll(/"([^"]*)"|'([^']*)'|([^\s]+)/g)]
    .map(match => match[1] ?? match[2] ?? match[3]);
}

function resolveProjectToken(projectDir: string, homeDir: string, token: string): string | undefined {
  const expanded = token
    .replace(/\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR/g, projectDir)
    .replace(/\$\{HOME\}|\$HOME/g, homeDir)
    .replace(/%CLAUDE_PROJECT_DIR%/gi, projectDir);
  if (/[$%][A-Za-z_{]/.test(expanded)) return undefined;
  return path.isAbsolute(expanded) ? expanded : path.resolve(projectDir, expanded);
}

function canonicalClaudeAdapterCommandAvailable(command: string, homeDir: string): boolean {
  const adapter = '$HOME/.prompt-optimizer/adapters/claude-code.sh';
  const escapedAdapter = adapter.replace(/[$.]/g, '\\$&');
  const canonicalStructure = new RegExp(
    `^\\s*if\\s+\\[\\s+-f\\s+"${escapedAdapter}"\\s+\\];\\s*then\\s+.*?\\bbash\\s+"${escapedAdapter}";\\s*elif\\s+\\[\\s+-f\\s+"\\$CLAUDE_PROJECT_DIR/\\.align/align-route\\.sh"\\s+\\];\\s*then\\s+bash\\s+"\\$CLAUDE_PROJECT_DIR/\\.align/align-route\\.sh";\\s*elif\\s+\\[\\s+-f\\s+"\\$CLAUDE_PROJECT_DIR/\\.align/HOOK-REMINDER\\.txt"`,
    's'
  );
  return canonicalStructure.test(command) &&
    existingFileStatus(path.join(homeDir, '.prompt-optimizer', 'adapters', 'claude-code.sh')) === 'available';
}

function commandAvailable(projectDir: string, homeDir: string, command: string): boolean {
  if (/^\s*if\s+\[/.test(command)) return canonicalClaudeAdapterCommandAvailable(command, homeDir);
  const tokens = commandTokens(command).filter(token => !/^[A-Za-z_][A-Za-z0-9_]*=[^\s]*$/.test(token));
  if (tokens.length === 0) return false;
  const executable = tokens[0];
  let executableAvailable = false;
  if (executable === 'node' || path.basename(executable).toLowerCase() === path.basename(process.execPath).toLowerCase()) {
    executableAvailable = true;
  } else if (/[\\/]/.test(executable) || path.isAbsolute(executable)) {
    const resolved = resolveProjectToken(projectDir, homeDir, executable);
    executableAvailable = Boolean(resolved && existingFileStatus(resolved) === 'available');
  } else {
    const extensions = process.platform === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')
      : [''];
    executableAvailable = (process.env.PATH || '').split(path.delimiter).some(directory =>
      extensions.some(extension => existingFileStatus(path.join(directory, `${executable}${extension}`)) === 'available')
    );
  }
  if (!executableAvailable) return false;

  const localArtifact = tokens.slice(1).find(token =>
    !token.startsWith('-') && /(?:[\\/]|\.(?:sh|js|cjs|mjs|ps1)$)/i.test(token)
  );
  if (!localArtifact) return true;
  const resolvedArtifact = resolveProjectToken(projectDir, homeDir, localArtifact);
  return Boolean(resolvedArtifact && existingFileStatus(resolvedArtifact) === 'available');
}

function hasSessionActivation(command: string): boolean {
  return commandTokens(command).includes('ALIGN_SESSION_ACTIVATION=on');
}

function isCanonicalClaudePromptCommand(command: string): boolean {
  return commandTokens(command).includes('BLOCK_ON_HIGH=on') &&
    /^\s*if\s+\[/.test(command);
}

function isSessionActivationClaudePromptCommand(command: string): boolean {
  return isCanonicalClaudePromptCommand(command) && hasSessionActivation(command);
}

function hasCommandHook(
  settings: unknown,
  event: 'UserPromptSubmit' | 'Stop',
  projectDir: string,
  homeDir: string,
  matchesCommand: (command: string) => boolean = () => true
): boolean {
  if (!settings || typeof settings !== 'object') return false;
  const hooks = (settings as Record<string, unknown>).hooks;
  if (!hooks || typeof hooks !== 'object') return false;
  const entries = (hooks as Record<string, unknown>)[event];
  return Array.isArray(entries) && entries.some(entry => {
    if (!entry || typeof entry !== 'object') return false;
    const commands = (entry as Record<string, unknown>).hooks;
    return Array.isArray(commands) && commands.some(command =>
      Boolean(command) && typeof command === 'object' &&
      (command as Record<string, unknown>).type === 'command' &&
      typeof (command as Record<string, unknown>).command === 'string' &&
      matchesCommand((command as Record<string, unknown>).command as string) &&
      commandAvailable(projectDir, homeDir, (command as Record<string, unknown>).command as string)
    );
  });
}

function detectHost(options: HostFeasibilityOptions): { name: string; version: string; status: FeasibilityStatus } {
  const name = options.host?.name || process.env.ALIGN_HOST_ADAPTER || 'unknown';
  const version = options.host?.version || process.env.ALIGN_HOST_VERSION || 'unknown';
  const status: FeasibilityStatus = ['claude-code', 'codex', 'cursor', 'universal'].includes(name)
    ? 'supported'
    : 'unknown';
  return { name, version, status };
}

export function probeHostFeasibility(
  projectDir: string,
  options: HostFeasibilityOptions = {}
): HostFeasibilityReport {
  const host = detectHost(options);
  const requestedIngress = options.requestedIngress ?? 'explicit';
  const homeDir = options.homeDir ?? os.homedir();
  const projectSettingsFile = path.join(projectDir, '.claude', 'settings.json');
  const globalSettingsFile = path.join(homeDir, '.claude', 'settings.json');
  const specFile = path.join(projectDir, '.align', 'spec.md');
  const existingHookFile = path.join(projectDir, 'scripts', 'generic-hook.sh');
  const configuration: HostFeasibilityReport['configuration'] = [];
  const conflicts: HostFeasibilityReport['conflicts'] = [];

  if (host.name === 'claude-code') {
    configuration.push({
      path: '.claude/settings.json',
      status: existingFileStatus(projectSettingsFile),
      detail: 'Claude Code project hook configuration.'
    });
    configuration.push({
      path: '~/.claude/settings.json',
      status: existingFileStatus(globalSettingsFile),
      detail: 'Claude Code user-level hook configuration.'
    });
  } else if (host.name === 'codex') {
    const agentsFile = path.join(projectDir, 'AGENTS.md');
    configuration.push({
      path: 'AGENTS.md',
      status: existingFileStatus(agentsFile),
      detail: 'Codex project instruction configuration.'
    });
  } else if (host.name === 'cursor') {
    const rulesDir = path.join(projectDir, '.cursor', 'rules');
    configuration.push({
      path: '.cursor/rules',
      status: existingPathStatus(rulesDir),
      detail: 'Cursor project rules configuration.'
    });
  } else if (host.name === 'universal') {
    const alignDir = path.join(projectDir, '.align');
    configuration.push({
      path: '.align',
      status: existingPathStatus(alignDir),
      detail: 'Host-neutral alignment configuration.'
    });
  } else {
    configuration.push({
      path: '(unknown)',
      status: 'unknown',
      detail: 'No host-specific configuration location is known.'
    });
  }
  if (existingFileStatus(existingHookFile) === 'available') {
    configuration.push({
      path: relative(projectDir, existingHookFile),
      status: 'available',
      detail: 'An existing project hook experiment is present.'
    });
  }

  const spec = readText(specFile);
  const policyBlocksHook = /(?:禁止|不得|不允许).{0,30}(?:hook|钩子)|(?:hook|hooks).{0,30}(?:forbidden|prohibited|not allowed)/i.test(spec);
  if (policyBlocksHook) {
    conflicts.push({
      kind: 'project_policy',
      ref: '.align/spec.md',
      status: 'blocked',
      detail: 'Project policy prohibits installing, changing, or replacing hooks.'
    });
  }

  const settings: unknown[] = [];
  const claudeSettings = host.name === 'claude-code'
    ? [
        [projectSettingsFile, '.claude/settings.json'],
        [globalSettingsFile, '~/.claude/settings.json']
      ] as const
    : [] as const;
  for (const [file, ref] of claudeSettings) {
    const settingsText = readText(file);
    if (!settingsText) continue;
    try {
      settings.push(JSON.parse(settingsText) as unknown);
    } catch {
      conflicts.push({
        kind: 'invalid_configuration',
        ref,
        status: 'blocked',
        detail: 'Existing settings.json is not valid JSON.'
      });
    }
    try {
      fs.accessSync(file, fs.constants.W_OK);
    } catch {
      conflicts.push({
        kind: 'permission',
        ref,
        status: 'blocked',
        detail: 'Current process cannot write the host configuration.'
      });
    }
  }

  const standaloneRouter = path.join(projectDir, 'core', 'hook-router.sh');
  const canonicalShellRouter = path.join(projectDir, 'core', 'host', 'align-route.sh');
  const parallelRouter = existingFileStatus(standaloneRouter) === 'available' &&
    existingFileStatus(canonicalShellRouter) === 'available' &&
    !isCanonicalRouterWrapper(standaloneRouter);
  if (parallelRouter) {
    conflicts.push({
      kind: 'parallel_router',
      ref: 'core/hook-router.sh',
      status: 'blocked',
      detail: 'A standalone router duplicates route/action behavior outside the canonical core.'
    });
  }

  const hookBlocked = requestedIngress === 'hook' && (
    policyBlocksHook || parallelRouter || conflicts.some(item =>
      item.kind === 'permission' || item.kind === 'invalid_configuration'
    )
  );
  const promptHookAvailable = host.name === 'claude-code' && settings.some(setting => hasCommandHook(
    setting,
    'UserPromptSubmit',
    projectDir,
    homeDir,
    isCanonicalClaudePromptCommand
  ));
  const sessionActivationAvailable = host.name === 'claude-code' && settings.some(setting => hasCommandHook(
    setting,
    'UserPromptSubmit',
    projectDir,
    homeDir,
    isSessionActivationClaudePromptCommand
  ));
  const stopHookAvailable = settings.some(setting => hasCommandHook(setting, 'Stop', projectDir, homeDir));
  const promptIngress: FeasibilityItem = hookBlocked
    ? { status: 'blocked', detail: 'Requested hook ingress is blocked by current project evidence.' }
    : requestedIngress === 'explicit'
      ? { status: 'available', detail: 'Explicit /align invocation is available without project mutation.' }
      : promptHookAvailable
        ? { status: 'available', detail: 'A UserPromptSubmit hook is already configured.' }
        : { status: 'unknown', detail: 'Mechanical prompt ingress is not observable for this host.' };
  const mechanicalBlocking: FeasibilityItem = hookBlocked
    ? { status: 'blocked', detail: 'Mechanical blocking cannot be wired under the current policy or configuration.' }
    : { status: 'unknown', detail: 'Blocking behavior was not executed or otherwise observed.' };
  const completion: FeasibilityItem = stopHookAvailable
    ? { status: 'available', detail: 'A Stop hook is configured.' }
    : { status: 'unknown', detail: 'No observable completion callback is configured.' };
  const session: FeasibilityItem = sessionActivationAvailable
    ? {
        status: 'available',
        detail: 'A UserPromptSubmit command explicitly enables ALIGN_SESSION_ACTIVATION=on; strong activation still requires a runtime session_id.'
      }
    : {
        status: 'unknown',
        detail: 'Session persistence capability was not observed.'
      };

  return {
    schemaVersion: '1.0.0',
    kind: 'alignment.host-feasibility',
    readOnly: true,
    host,
    configuration,
    capabilities: { promptIngress, mechanicalBlocking, completion, session },
    conflicts,
    dependencies: [
      {
        name: 'node',
        version: process.versions.node,
        status: process.versions.node ? 'available' : 'unknown',
        detail: process.versions.node ? 'Current Node.js runtime is available.' : 'Node.js was not detected.'
      },
      {
        name: 'shell',
        status: 'unknown',
        detail: 'Shell availability is not inferred without executing an external command.'
      }
    ],
    degradedPath: {
      status: 'available',
      mode: 'explicit',
      activationLevel: host.status === 'supported' ? 'advisory' : 'none',
      detail: 'Use explicit /align <request>; no hook, wrapper, or proxy is required.'
    },
    plannedChanges: []
  };
}
