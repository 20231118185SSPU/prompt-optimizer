import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getVerificationCommands } from './acceptance-plan';

/** @deprecated Importing the verifier is a compatibility path. The core pipeline only plans acceptance. */
export { getVerificationCommands } from './acceptance-plan';

export interface VerificationResult {
  commands: string[];
  results: {
    command: string;
    success: boolean;
    output: string;
  }[];
}

export interface VerificationLimits {
  commandTimeoutMs?: number;
  totalTimeoutMs?: number;
}

const SHELL_OPERATOR = /[;&|<>`$()\r\n]/;
const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/;
const SHELL_EVALUATION_FLAG = /^(?:-c|\/c|--command|-command|-encodedcommand|\/encodedcommand|-e|--eval)$/i;

function isInsideProject(candidate: string, projectDir: string): boolean {
  const relative = path.relative(path.resolve(projectDir), candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function resolveExecutable(executable: string, projectDir: string): string | undefined {
  const pathEntries = (process.env.PATH ?? '').split(path.delimiter).filter(entry => path.isAbsolute(entry));
  const extensions = process.platform === 'win32'
    ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')]
    : [''];
  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, `${executable}${extension}`);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        const resolved = fs.realpathSync(candidate);
        if (!isInsideProject(resolved, projectDir)) return resolved;
      } catch {
        // Keep looking through trusted absolute PATH entries.
      }
    }
  }
  return undefined;
}

function parseSafeCommand(command: string, projectDir: string): string[] | undefined {
  if (SHELL_OPERATOR.test(command)) return undefined;

  const args: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote) {
      if (character === quote) quote = undefined;
      else current += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/.test(character)) {
      if (current) {
        args.push(current);
        current = '';
      }
    } else {
      current += character;
    }
  }
  if (quote) return undefined;
  if (current) args.push(current);
  if (args.length === 0) return undefined;

  const executable = args[0];
  if (path.isAbsolute(executable) || /^\//.test(executable) || WINDOWS_ABSOLUTE_PATH.test(executable)) {
    return undefined;
  }
  if (executable.includes('/') || executable.includes('\\')) return undefined;
  if (args.some(argument => SHELL_EVALUATION_FLAG.test(argument))) return undefined;
  if (args.some(argument => path.isAbsolute(argument) || /^\//.test(argument) || WINDOWS_ABSOLUTE_PATH.test(argument))) return undefined;
  if (args.some(argument => /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(argument))) return undefined;
  const resolvedExecutable = resolveExecutable(executable, projectDir);
  return resolvedExecutable ? [resolvedExecutable, ...args.slice(1)] : undefined;
}

export function runVerificationCommands(
  projectDir: string,
  commands: string[],
  limits: VerificationLimits = {}
): VerificationResult {
  const results: VerificationResult['results'] = [];
  const startedAt = Date.now();
  const commandTimeoutMs = limits.commandTimeoutMs ?? 60000;

  for (const command of commands) {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = limits.totalTimeoutMs === undefined
      ? commandTimeoutMs
      : limits.totalTimeoutMs - elapsedMs;
    if (remainingMs <= 0) {
      results.push({
        command,
        success: false,
        output: 'Verification deadline exceeded before this command could run'
      });
      continue;
    }
    const args = parseSafeCommand(command, projectDir);
    if (!args) {
      results.push({
        command,
        success: false,
        output: 'Verification command rejected: shell operators or unsafe command paths are not allowed'
      });
      continue;
    }
    try {
      const output = execFileSync(args[0], args.slice(1), {
        cwd: projectDir,
        encoding: 'utf-8',
        timeout: Math.min(commandTimeoutMs, remainingMs),
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      results.push({ command, success: true, output: output.trim() });
    } catch (error: any) {
      results.push({
        command,
        success: false,
        output: error.message || 'Command failed'
      });
    }
  }

  return { commands, results };
}

/** @deprecated Completion verification is only valid after an execution receipt. */
export function runVerification(projectDir: string): VerificationResult {
  const commands = getVerificationCommands(projectDir);
  return runVerificationCommands(projectDir, commands);
}
