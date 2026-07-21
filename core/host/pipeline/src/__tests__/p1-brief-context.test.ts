import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { alignInstruction } from '../alignment-interface';

describe('Phase 1 Brief and context budgets', () => {
  test('keeps a simple self-contained Brief within 40 non-empty lines and leaves Trace separate', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-brief-budget-'));
    const items = Array.from({ length: 10 }, (_, index) => `事项 ${index + 1}`);

    try {
      const result = alignInstruction(
        '修改 src/parser.ts 的错误信息，不改 public API，完成后运行 npm test -- parser。',
        projectDir,
        {
          includeTrace: true,
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'change',
                secondary: [],
                rationale: [{ module: 'change', reason: '修改 parser 错误信息。' }],
                confidence: 0.99,
                missing: []
              },
              brief: {
                objective: '更新 parser 错误信息。\n不得改变公开 API。',
                context: items,
                scope: { include: items, exclude: items },
                deliverables: items,
                constraints: items,
                execution: items,
                acceptance: items.map(item => ({
                  criterion: `${item} 已完成。`,
                  method: { kind: 'checklist', value: item }
                }))
              }
            }
          }
        }
      );

      expect(result.brief.markdown.split(/\r?\n/).filter(line => line.trim()).length).toBeLessThanOrEqual(40);
      expect(result.brief.markdown).not.toContain('# Trace Appendix');
      expect(result.trace?.markdown).toContain('# Trace Appendix');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('keeps a complex operate Brief within 100 non-empty lines and leaves Trace outside the budget', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-complex-brief-budget-'));

    try {
      const result = alignInstruction(
        '在生产环境执行数据库迁移：先检查迁移状态，再执行迁移，完成后验证服务健康并记录回滚步骤。',
        projectDir,
        {
          includeTrace: true,
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'operate',
                secondary: ['inspect'],
                rationale: [
                  { module: 'operate', reason: '请求要求执行生产环境迁移。' },
                  { module: 'inspect', reason: '执行前必须检查迁移状态。' }
                ],
                confidence: 0.99,
                missing: []
              },
              brief: {
                objective: '执行已批准的生产数据库迁移，并验证服务健康。',
                context: ['迁移前需要确认当前数据库迁移状态。'],
                scope: {
                  include: ['已批准的数据库迁移和服务健康检查。'],
                  exclude: ['未批准的数据库结构变更。']
                },
                deliverables: ['迁移执行结果、健康检查结果和回滚步骤记录。'],
                constraints: ['仅执行已批准的迁移；异常时停止并按既定回滚步骤处理。'],
                execution: ['检查迁移状态。', '执行已批准的迁移。', '验证服务健康并记录结果。'],
                acceptance: [
                  {
                    criterion: '迁移完成且服务健康检查通过。',
                    method: { kind: 'checklist', value: '核对迁移状态与服务健康检查结果。' }
                  }
                ]
              }
            }
          }
        }
      );

      expect(result.brief.markdown.split(/\r?\n/).filter(line => line.trim()).length).toBeLessThanOrEqual(100);
      expect(result.brief.markdown).not.toContain('# Trace Appendix');
      for (const section of ['目标', '相关上下文', '对象与范围', '交付物', '约束', '执行方式', '验收']) {
        expect(result.brief.markdown).toContain(`## ${section}`);
      }
      expect(result.trace?.markdown).toContain('# Trace Appendix');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('does not treat negated write constraints in an inspect Brief as proposed writes', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-read-only-brief-'));

    try {
      const result = alignInstruction(
        '只读检查 src/config.ts，输出证据清单，不修改文件。',
        projectDir,
        {
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'inspect',
                secondary: [],
                rationale: [{ module: 'inspect', reason: '请求限定为只读检查。' }],
                confidence: 0.99,
                missing: []
              },
              brief: {
                objective: '只读检查 src/config.ts。',
                context: ['用户要求输出证据清单。'],
                scope: { include: ['src/config.ts'], exclude: ['任何文件修改'] },
                deliverables: ['src/config.ts 的证据清单。'],
                constraints: ['不得修改、写入或删除任何文件。'],
                execution: ['只读取配置并报告观察结果。'],
                acceptance: [{
                  criterion: '证据清单覆盖观察到的配置差异。',
                  method: { kind: 'checklist', value: '逐项核对证据清单。' }
                }]
              }
            }
          }
        }
      );

      expect(result.degradedReasons).not.toContain('model_semantic_conflict');
      expect(result.brief.objective).toBe('只读检查 src/config.ts。');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
