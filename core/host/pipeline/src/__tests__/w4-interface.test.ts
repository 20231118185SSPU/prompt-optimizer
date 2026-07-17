import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as runtime from '../index';

describe('W4 Alignment Decision interface', () => {
  test('keeps the public seam centered on the decision and host projection', () => {
    expect(typeof runtime.alignInstruction).toBe('function');
    expect(typeof runtime.projectAlignmentDecision).toBe('function');

    for (const internalExport of [
      'processInstruction',
      'enrich',
      'getVerificationCommands',
      'runVerification',
      'analyzeInstruction',
      'decideRoute',
      'LifecycleCoordinator',
      'buildMattHandoff',
      'generateCopilotRules'
    ]) {
      expect(Object.prototype.hasOwnProperty.call(runtime, internalExport)).toBe(false);
    }

    // The one-minor compatibility window keeps classifier/router readable but
    // does not make them the core route source.
    expect(typeof runtime.classify).toBe('function');
    expect(typeof runtime.route).toBe('function');
  });

  test('ordinary pipeline results do not load an ecosystem handoff', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w4-interface-'));
    try {
      const result = runtime.alignInstruction(
        '只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。',
        projectDir
      );

      expect(result.decision.kind).toBe('alignment.decision');
      expect(result.host.nextAction).toBe('execute');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
