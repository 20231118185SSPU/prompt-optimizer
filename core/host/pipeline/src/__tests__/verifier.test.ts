import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getVerificationCommands, runVerification, VerificationResult } from '../verifier';

describe('verifier', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verifier-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createCheckCommands(content: string) {
    const alignDir = path.join(tmpDir, '.align');
    fs.mkdirSync(alignDir, { recursive: true });
    fs.writeFileSync(path.join(alignDir, 'check-commands.txt'), content, 'utf-8');
  }

  // ── getVerificationCommands ──

  describe('getVerificationCommands', () => {
    it('reads verification commands from check-commands.txt', () => {
      createCheckCommands('npm test\nnpm run lint');

      const commands = getVerificationCommands(tmpDir);

      expect(commands).toEqual(['npm test', 'npm run lint']);
    });

    it('returns empty array when file does not exist', () => {
      const commands = getVerificationCommands(tmpDir);

      expect(commands).toEqual([]);
    });

    it('skips comments and empty lines', () => {
      createCheckCommands(
        '# This is a comment\nnpm test\n\n# Another comment\nnpm run lint\n'
      );

      const commands = getVerificationCommands(tmpDir);

      expect(commands).toEqual(['npm test', 'npm run lint']);
    });

    it('handles single command', () => {
      createCheckCommands('echo hello');

      const commands = getVerificationCommands(tmpDir);

      expect(commands).toEqual(['echo hello']);
    });

    it('returns empty array for empty file', () => {
      createCheckCommands('');

      const commands = getVerificationCommands(tmpDir);

      expect(commands).toEqual([]);
    });

    it('trims whitespace from commands', () => {
      createCheckCommands('  npm test  \n  npm run lint  ');

      const commands = getVerificationCommands(tmpDir);

      expect(commands).toEqual(['npm test', 'npm run lint']);
    });
  });

  // ── runVerification ──

  describe('runVerification', () => {
    it('returns empty results when no commands', () => {
      const result = runVerification(tmpDir);

      expect(result.commands).toEqual([]);
      expect(result.results).toEqual([]);
    });

    it('runs commands and captures success', () => {
      createCheckCommands('echo "test passed"');

      const result = runVerification(tmpDir);

      expect(result.commands).toEqual(['echo "test passed"']);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].command).toBe('echo "test passed"');
      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output).toContain('test passed');
    });

    it('captures command failure', () => {
      createCheckCommands('exit 1');

      const result = runVerification(tmpDir);

      expect(result.commands).toEqual(['exit 1']);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].command).toBe('exit 1');
      expect(result.results[0].success).toBe(false);
    });

    it('runs multiple commands', () => {
      createCheckCommands('echo "first"\necho "second"');

      const result = runVerification(tmpDir);

      expect(result.commands).toHaveLength(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(true);
    });

    it('sets working directory for commands', () => {
      // Create a file in tmpDir to verify cwd
      fs.writeFileSync(path.join(tmpDir, 'test.txt'), 'hello', 'utf-8');
      createCheckCommands('cat test.txt');

      const result = runVerification(tmpDir);

      expect(result.results[0].success).toBe(true);
      expect(result.results[0].output).toBe('hello');
    });
  });
});
