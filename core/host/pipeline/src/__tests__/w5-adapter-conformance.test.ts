import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { alignInstruction } from '../alignment-interface';

describe('W5 adapter decision conformance', () => {
  test('keeps project verification out of observed completeness until enrichment', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w5-adapter-conformance-'));
    try {
      fs.mkdirSync(path.join(projectDir, '.align'), { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, '.align', 'spec.md'),
        'Parser target and public API constraints are available.\n',
        'utf8'
      );
      fs.writeFileSync(path.join(projectDir, '.align', 'check-commands.txt'), 'npm test -- parser\n', 'utf8');

      const result = alignInstruction(
        '把 src/parser.ts 的 parseUser 重命名为 parseAccount，不改 public API。',
        projectDir,
        { hostCapabilities: { adapter: 'claude-code', nativeBlocking: false } }
      );

      expect(result.decision.route).toBe('enrich');
      expect(result.decision.next.action).toBe('execute');
      expect(result.decision.scores.observed.d5).toBe(0);
      expect(result.decision.scores.effective.d5).toBe(1);
      expect(result.decision.reasons).toEqual(expect.arrayContaining([
        'verification.missing',
        'context.resolvable_from_project'
      ]));
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
