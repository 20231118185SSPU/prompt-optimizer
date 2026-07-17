import * as fs from 'fs';
import * as path from 'path';

/**
 * Read the project's declared verification plan without executing it.
 *
 * This is an internal acceptance-planning seam. Runtime callers receive the
 * resulting commands through Alignment Decision; command execution remains a
 * separate lifecycle concern.
 */
export function getVerificationCommands(projectDir: string): string[] {
  const commandsFile = path.join(projectDir, '.align', 'check-commands.txt');

  if (!fs.existsSync(commandsFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(commandsFile, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch {
    return [];
  }
}
