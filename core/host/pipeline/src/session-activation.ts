import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const SESSION_REF = /^[a-f0-9]{24}$/;
const TTL_MS = 8 * 60 * 60 * 1000;
const MAX_RECORD_BYTES = 4096;

export interface ClaudeSessionActivationOptions {
  now?: number;
  stateHome?: string;
}

export interface ClaudeSessionActivationRecord {
  kind: 'alignment.claude-session-activation';
  schemaVersion: '1.0.0';
  activatedAtMs: number;
  expiresAtMs: number;
}

export type ClaudeSessionActivationResult =
  | { status: 'active'; expiresAtMs: number }
  | { status: 'inactive'; reason?: 'invalid_session_ref' | 'storage_unavailable' };

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function defaultStateHome(): string {
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'prompt-optimizer');
  }
  if (process.platform !== 'win32' && process.env.XDG_STATE_HOME) {
    return path.join(process.env.XDG_STATE_HOME, 'prompt-optimizer');
  }
  return path.join(os.homedir(), '.prompt-optimizer', 'state');
}

function configuredStateHome(options: ClaudeSessionActivationOptions): string {
  return options.stateHome ?? defaultStateHome();
}

function activationFile(projectDir: string, sessionRef: string, stateHome: string): string {
  const projectPath = fs.realpathSync(projectDir);
  return path.join(stateHome, `activation-${sha256(projectPath)}-${sha256(sessionRef)}.json`);
}

function isSafeStateHome(stateHome: string): boolean {
  try {
    const stat = fs.lstatSync(stateHome);
    return stat.isDirectory() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidRecord(value: unknown): value is ClaudeSessionActivationRecord {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== 4 || keys.join(',') !== 'activatedAtMs,expiresAtMs,kind,schemaVersion') return false;
  if (value.kind !== 'alignment.claude-session-activation' || value.schemaVersion !== '1.0.0') return false;
  const activatedAtMs = value.activatedAtMs;
  const expiresAtMs = value.expiresAtMs;
  if (typeof activatedAtMs !== 'number' || typeof expiresAtMs !== 'number' ||
      !Number.isSafeInteger(activatedAtMs) || !Number.isSafeInteger(expiresAtMs)) return false;
  return activatedAtMs >= 0 && expiresAtMs === activatedAtMs + TTL_MS;
}

function nowMs(options: ClaudeSessionActivationOptions): number {
  return options.now ?? Date.now();
}

function inactive(reason?: 'invalid_session_ref' | 'storage_unavailable'): ClaudeSessionActivationResult {
  return reason ? { status: 'inactive', reason } : { status: 'inactive' };
}

export function activateClaudeSession(
  projectDir: string,
  sessionRef: string,
  options: ClaudeSessionActivationOptions = {}
): ClaudeSessionActivationResult {
  if (!SESSION_REF.test(sessionRef)) return inactive('invalid_session_ref');

  const activatedAtMs = nowMs(options);
  if (!Number.isSafeInteger(activatedAtMs) || activatedAtMs < 0) return inactive('storage_unavailable');
  const expiresAtMs = activatedAtMs + TTL_MS;
  if (!Number.isSafeInteger(expiresAtMs)) return inactive('storage_unavailable');
  const record: ClaudeSessionActivationRecord = {
    kind: 'alignment.claude-session-activation',
    schemaVersion: '1.0.0',
    activatedAtMs,
    expiresAtMs
  };

  let file: string;
  try {
    const stateHome = configuredStateHome(options);
    fs.mkdirSync(stateHome, { recursive: true, mode: 0o700 });
    if (!isSafeStateHome(stateHome)) return inactive('storage_unavailable');
    try { fs.chmodSync(stateHome, 0o700); } catch { /* Windows does not expose Unix modes. */ }
    file = activationFile(projectDir, sessionRef, stateHome);
    const directory = path.dirname(file);
    try {
      if (fs.lstatSync(file).isSymbolicLink()) return inactive('storage_unavailable');
    } catch (error) {
      if (!(isRecord(error) && error.code === 'ENOENT')) return inactive('storage_unavailable');
    }

    const temporary = path.join(directory, `.${path.basename(file)}.${crypto.randomBytes(12).toString('hex')}.tmp`);
    try {
      fs.writeFileSync(temporary, JSON.stringify(record), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      try { fs.chmodSync(temporary, 0o600); } catch { /* Windows does not expose Unix modes. */ }
      fs.renameSync(temporary, file);
    } finally {
      try { fs.rmSync(temporary, { force: true }); } catch { /* Best-effort temporary cleanup. */ }
    }
    return { status: 'active', expiresAtMs: record.expiresAtMs };
  } catch {
    return inactive('storage_unavailable');
  }
}

export function readClaudeSessionActivation(
  projectDir: string,
  sessionRef: string,
  options: ClaudeSessionActivationOptions = {}
): ClaudeSessionActivationResult {
  if (!SESSION_REF.test(sessionRef)) return inactive('invalid_session_ref');

  try {
    const stateHome = configuredStateHome(options);
    if (!isSafeStateHome(stateHome)) return inactive();
    const file = activationFile(projectDir, sessionRef, stateHome);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(file);
    } catch (error) {
      return isRecord(error) && error.code === 'ENOENT' ? inactive() : inactive('storage_unavailable');
    }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RECORD_BYTES) return inactive();
    const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isValidRecord(value) || value.expiresAtMs <= nowMs(options)) return inactive();
    return { status: 'active', expiresAtMs: value.expiresAtMs };
  } catch {
    return inactive();
  }
}
