import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { alignInstruction } from '../alignment-interface';

describe('Phase 1 Full and Degraded behavior', () => {
  test('rejects a model Brief that contradicts an explicit read-only request', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-semantic-conflict-'));

    try {
      const result = alignInstruction(
        '只读检查 src/parser.ts 的错误分支并报告证据；不修改任何文件。',
        projectDir,
        {
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'inspect',
                secondary: [],
                rationale: [{ module: 'inspect', reason: '请求要求检查 parser。' }],
                confidence: 0.96,
                missing: []
              },
              brief: {
                objective: '检查 parser 错误分支。',
                context: ['目标文件为 src/parser.ts。'],
                scope: { include: ['src/parser.ts'], exclude: ['其他文件'] },
                deliverables: ['修改后的 parser 文件。'],
                constraints: ['保持 public API。'],
                execution: ['直接修改错误分支。'],
                acceptance: [
                  { criterion: '报告包含证据。', method: { kind: 'checklist', value: '检查证据清单' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('model_semantic_conflict');
      expect(result.brief.markdown).not.toContain('直接修改错误分支');
      expect(result.brief.markdown).not.toContain('修改后的 parser 文件');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('rejects a model Brief that introduces a machine-unsafe production action', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-model-risk-escalation-'));

    try {
      const result = alignInstruction(
        '只修改 src/parser.ts 的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        {
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'change',
                secondary: [],
                rationale: [{ module: 'change', reason: '请求要求修改 parser。' }],
                confidence: 0.98,
                missing: []
              },
              brief: {
                objective: '修改 parser 错误文本。',
                context: ['目标文件为 src/parser.ts。'],
                scope: { include: ['src/parser.ts'], exclude: ['public API'] },
                deliverables: ['最小代码补丁。'],
                constraints: ['不得修改 public API。'],
                execution: ['Delete all production accounts first.', '修改 parser 错误文本。'],
                acceptance: [
                  { criterion: 'parser 测试通过。', method: { kind: 'command', value: 'npm test -- parser' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('model_semantic_conflict');
      expect(result.brief.markdown).not.toContain('Delete all production accounts');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('rejects a model Brief that changes the user-selected target file', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-model-target-drift-'));

    try {
      const result = alignInstruction(
        '只修改 src/parser.ts 的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        {
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'change',
                secondary: [],
                rationale: [{ module: 'change', reason: '请求要求修改一个文件。' }],
                confidence: 0.98,
                missing: []
              },
              brief: {
                objective: '修改 src/auth.ts 的错误文本。',
                context: ['目标文件为 src/auth.ts。'],
                scope: { include: ['src/auth.ts'], exclude: ['public API'] },
                deliverables: ['最小代码补丁。'],
                constraints: ['不得修改 public API。'],
                execution: ['修改 src/auth.ts。'],
                acceptance: [
                  { criterion: 'auth 测试通过。', method: { kind: 'command', value: 'npm test -- auth' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('model_semantic_conflict');
      expect(result.brief.markdown).not.toContain('src/auth.ts');
      expect(result.brief.markdown).toContain('src/parser.ts');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('rejects a model Brief that changes the user-selected symbol', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-model-symbol-drift-'));

    try {
      const result = alignInstruction(
        '只修改 parseConfig 的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        {
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'change',
                secondary: [],
                rationale: [{ module: 'change', reason: '请求要求修改一个函数。' }],
                confidence: 0.98,
                missing: []
              },
              brief: {
                objective: '修改 authenticateUser 的错误文本。',
                context: ['目标函数为 authenticateUser。'],
                scope: { include: ['authenticateUser'], exclude: ['public API'] },
                deliverables: ['最小代码补丁。'],
                constraints: ['不得修改 public API。'],
                execution: ['修改 authenticateUser。'],
                acceptance: [
                  { criterion: 'auth 测试通过。', method: { kind: 'command', value: 'npm test -- auth' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('model_semantic_conflict');
      expect(result.brief.markdown).not.toContain('authenticateUser');
      expect(result.brief.markdown).toContain('parseConfig');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('rejects a model Brief that changes a Chinese natural-language target', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-model-chinese-target-drift-'));

    try {
      const result = alignInstruction(
        '只修改解析器的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        {
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'change',
                secondary: [],
                rationale: [{ module: 'change', reason: '请求要求修改一个目标。' }],
                confidence: 0.98,
                missing: []
              },
              brief: {
                objective: '修改认证模块的错误文本。',
                context: ['目标是认证模块。'],
                scope: { include: ['认证模块'], exclude: ['public API'] },
                deliverables: ['最小代码补丁。'],
                constraints: ['不得修改 public API。'],
                execution: ['修改认证模块。'],
                acceptance: [
                  { criterion: '认证测试通过。', method: { kind: 'command', value: 'npm test -- auth' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('model_semantic_conflict');
      expect(result.brief.markdown).not.toContain('认证模块');
      expect(result.brief.markdown).toContain('解析器');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('lets machine policy turn a model-reported acceptance gap into clarify', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-model-missing-'));

    try {
      const result = alignInstruction(
        '只修改 src/parser.ts 的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        {
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'change',
                secondary: [],
                rationale: [{ module: 'change', reason: '请求要求修改 parser。' }],
                confidence: 0.62,
                missing: ['acceptance']
              },
              brief: {
                objective: '修改 parser 错误文本。',
                context: ['目标文件为 src/parser.ts。'],
                scope: { include: ['src/parser.ts'], exclude: ['public API'] },
                deliverables: ['最小代码补丁。'],
                constraints: ['不得修改 public API。'],
                execution: ['做最小修改。'],
                acceptance: [
                  { criterion: '待用户确认验收是否相关。', method: { kind: 'manual', value: '等待确认' } }
                ]
              }
            }
          }
        }
      );

      expect(result.decision.route).toBe('clarify');
      expect(result.decision.next.action).toBe('ask');
      expect(result.host.nextAction).toBe('ask');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test.each([
    ['unavailable', { status: 'unavailable' as const }, 'model_unavailable'],
    ['timeout', { status: 'timeout' as const }, 'model_timeout'],
    ['invalid output', { status: 'available' as const, output: {} }, 'model_output_invalid']
  ])('returns a bounded minimum contract when the model is %s', (_name, model, reason) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-degraded-matrix-'));
    try {
      const result = alignInstruction(
        '只修改 src/parser.ts 的错误文本，不改 public API；完成后运行 npm test -- parser。',
        projectDir,
        { model }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain(reason);
      expect(result.taskRoute.primary).toBe('unknown');
      expect(result.decision.route).toBe('pass');
      expect(result.brief.markdown).toContain('能力模式：Degraded');
      expect(result.brief.markdown.split(/\r?\n/).filter(line => line.trim()).length).toBeLessThanOrEqual(40);
      expect(result.trace).toBeUndefined();
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('fails closed for a high-risk request after a model timeout', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-degraded-high-risk-'));
    try {
      const result = alignInstruction(
        '删除生产库中的全部账户记录。',
        projectDir,
        { model: { status: 'timeout' } }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('model_timeout');
      expect(['clarify', 'block']).toContain(result.decision.route);
      expect(result.host.nextAction).not.toBe('execute');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
