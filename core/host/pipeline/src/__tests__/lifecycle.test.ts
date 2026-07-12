import { analyzeInstruction } from '../analyzer';
import { buildAlignmentDecision } from '../contract-builder';
import { LifecycleCoordinator } from '../lifecycle';

describe('LifecycleCoordinator', () => {
  const decision = buildAlignmentDecision(analyzeInstruction(
    '只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。'
  ));

  test('completion verification requires a completed execution receipt', () => {
    const lifecycle = new LifecycleCoordinator(decision);
    expect(() => lifecycle.recordCompletion({ commands: [], results: [] })).toThrow('execution receipt');
  });

  test('moves through baseline, handoff, receipt, and completion in order', () => {
    const lifecycle = new LifecycleCoordinator(decision);
    lifecycle.recordBaseline(true);
    lifecycle.handoffExecution();
    lifecycle.recordExecution('completed');
    expect(lifecycle.recordCompletion({
      commands: ['npm test'],
      results: [{ command: 'npm test', success: true, output: 'ok' }]
    })).toBe('verified');
    expect(lifecycle.currentState()).toBe('verified');
  });

  test('records failed completion as a distinct terminal state', () => {
    const lifecycle = new LifecycleCoordinator(decision);
    lifecycle.recordBaseline(true);
    lifecycle.handoffExecution();
    lifecycle.recordExecution('completed');
    expect(lifecycle.recordCompletion({
      commands: ['npm test'],
      results: [{ command: 'npm test', success: false, output: 'failed' }]
    })).toBe('verification_failed');
    expect(lifecycle.currentState()).toBe('verification_failed');
  });
});
