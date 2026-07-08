import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface VerificationResult {
  commands: string[];
  results: {
    command: string;
    success: boolean;
    output: string;
  }[];
}

export function getVerificationCommands(projectDir: string): string[] {
  const commandsFile = path.join(projectDir, '.align', 'check-commands.txt');

  if (!fs.existsSync(commandsFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(commandsFile, 'utf-8');
    const lines = content.split('\n');

    // Filter comments and empty lines
    const commands = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    return commands;
  } catch {
    return [];
  }
}

export function runVerification(projectDir: string): VerificationResult {
  const commands = getVerificationCommands(projectDir);
  const results: VerificationResult['results'] = [];

  for (const command of commands) {
    try {
      const output = execSync(command, {
        cwd: projectDir,
        encoding: 'utf-8',
        timeout: 60000, // 1 minute timeout
        stdio: ['pipe', 'pipe', 'pipe']
      });

      results.push({
        command,
        success: true,
        output: output.trim()
      });
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
