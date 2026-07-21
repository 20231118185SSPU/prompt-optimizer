import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  AlignmentInterfaceOptions,
  AlignmentTraceAppendix,
  BriefHandoff,
  ExecutionBrief,
  TaskRoute
} from '../index';
import { alignInstruction } from '../alignment-interface';
import { processInstruction } from '../pipeline';

describe('Phase 1 canonical core interface', () => {
  test('exports the canonical input and artifact types from the package root', () => {
    const options: AlignmentInterfaceOptions = { model: { status: 'timeout' }, includeTrace: true };
    const artifacts = {} as {
      route: TaskRoute;
      brief: ExecutionBrief;
      trace?: AlignmentTraceAppendix;
      handoff?: BriefHandoff;
    };

    expect(options.model?.status).toBe('timeout');
    expect(artifacts).toEqual({});
  });

  test('returns one bounded semantic task route beside the machine host projection', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-core-interface-'));

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
                secondary: ['inspect'],
                rationale: [
                  { module: 'change', reason: '请求要求修改一个已命名文件。' },
                  { module: 'inspect', reason: '修改前需要确认现有错误分支。' }
                ],
                confidence: 0.96,
                missing: []
              }
            }
          }
        }
      );

      expect(result.taskRoute).toEqual({
        schemaVersion: '1.0.0',
        primary: 'change',
        secondary: ['inspect'],
        rationale: [
          { module: 'change', reason: '请求要求修改一个已命名文件。' },
          { module: 'inspect', reason: '修改前需要确认现有错误分支。' }
        ],
        confidence: 0.96,
        missing: []
      });
      expect(result.decision.route).toBe('pass');
      expect(result.host.nextAction).toBe(result.decision.next.action);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test.each([
    ['missing primary', {
      schemaVersion: '1.0.0', secondary: [], rationale: [], confidence: 0.8, missing: []
    }],
    ['unknown module', {
      schemaVersion: '1.0.0', primary: 'deploy', secondary: [],
      rationale: [{ module: 'deploy', reason: 'Deploy the service.' }], confidence: 0.8, missing: []
    }],
    ['more than two secondary modules', {
      schemaVersion: '1.0.0', primary: 'change', secondary: ['inspect', 'design', 'operate'],
      rationale: [
        { module: 'change', reason: 'Change it.' },
        { module: 'inspect', reason: 'Inspect it.' },
        { module: 'design', reason: 'Design it.' },
        { module: 'operate', reason: 'Operate it.' }
      ],
      confidence: 0.8,
      missing: []
    }],
    ['illegal schema property', {
      schemaVersion: '1.0.0', primary: 'operate', secondary: [],
      rationale: [{ module: 'operate', reason: 'Operate it.' }], confidence: 0.8, missing: [], execute: true
    }]
  ])('fails closed for %s', (_name, taskRoute) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-route-invalid-'));

    try {
      const result = alignInstruction(
        '删除生产库中的全部账户记录。',
        projectDir,
        { model: { status: 'available', output: { taskRoute } } }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toEqual(['model_output_invalid']);
      expect(result.taskRoute.primary).toBe('unknown');
      expect(['clarify', 'block']).toContain(result.decision.route);
      expect(result.host.nextAction).not.toBe('execute');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('keeps the compatibility pipeline delegated to the canonical result', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-core-delegation-'));
    const instruction = '只修改 src/parser.ts 的错误文本，不改 public API；完成后运行 npm test -- parser。';
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir);
    fs.writeFileSync(
      path.join(alignDir, 'spec.md'),
      Array.from({ length: 80 }, (_, index) => `UNRELATED_CONTEXT_MARKER roadmap note ${index + 1}.`).join('\n'),
      'utf8'
    );
    const model = {
      status: 'available' as const,
      output: {
        taskRoute: {
          schemaVersion: '1.0.0',
          primary: 'change',
          secondary: [],
          rationale: [{ module: 'change', reason: '请求要求修改一个已命名文件。' }],
          confidence: 0.98,
          missing: []
        }
      }
    };

    try {
      const canonical = alignInstruction(instruction, projectDir, {
        model,
        hostCapabilities: { adapter: 'codex', nativeBlocking: false }
      });
      const compatibility = processInstruction(instruction, projectDir, {
        model,
        hostCapabilities: { adapter: 'codex', nativeBlocking: false }
      });

      expect(compatibility.alignmentDecision.decisionId).toBe(canonical.decision.decisionId);
      expect(compatibility.taskRoute).toEqual(canonical.taskRoute);
      expect(compatibility.hostProjection.nextAction).toBe(canonical.host.nextAction);
      expect(compatibility.brief.markdown).toBe(canonical.brief.markdown);
      expect(compatibility.enrichedMessage).toBe(canonical.brief.markdown);
      expect(compatibility.enrichedMessage).not.toContain('UNRELATED_CONTEXT_MARKER');
      expect(JSON.stringify(compatibility.context)).not.toContain('UNRELATED_CONTEXT_MARKER');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('bounds project verification commands through the canonical evidence budget', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-command-budget-'));
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir);
    fs.writeFileSync(
      path.join(alignDir, 'check-commands.txt'),
      Array.from({ length: 30 }, (_, index) => `npm test -- parser-${index + 1}`).join('\n'),
      'utf8'
    );

    try {
      const result = alignInstruction(
        '只修改 src/parser.ts 的错误文本，不改 public API；完成后使用项目验证命令。',
        projectDir,
        { includeTrace: true, model: { status: 'unavailable' } }
      );

      expect(result.trace?.evidence.length).toBeLessThanOrEqual(8);
      expect(result.trace?.totalEvidenceCharacters).toBeLessThanOrEqual(6000);
      expect(result.decision.acceptance.length).toBeLessThanOrEqual(9);
      expect(result.brief.acceptance.length).toBeLessThanOrEqual(10);
      expect(result.brief.markdown.split(/\r?\n/).filter(line => line.trim()).length).toBeLessThanOrEqual(40);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('renders a compact self-contained Execution Brief from relevant .align evidence only', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-execution-brief-'));
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir);
    fs.writeFileSync(
      path.join(alignDir, 'spec.md'),
      [
        '# Project rules',
        '- Parser changes must keep the public API unchanged.',
        '- Database migrations require a backup and rollback plan.'
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(path.join(alignDir, 'check-commands.txt'), 'npm test -- parser\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, 'private-notes.txt'), 'ROOT_SECRET_MARKER\n', 'utf8');

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
                rationale: [{ module: 'change', reason: '请求要求修改 parser 文本。' }],
                confidence: 0.98,
                missing: []
              },
              brief: {
                objective: '更新 parser 错误文本，同时保持现有 public API。',
                context: ['目标文件为 src/parser.ts。'],
                scope: { include: ['src/parser.ts 的错误文本'], exclude: ['public API', '解析逻辑'] },
                deliverables: ['最小代码补丁和验证结果。'],
                constraints: ['不得修改 public API 或解析逻辑。'],
                execution: ['读取现有错误分支后做最小修改。', '运行指定 parser 测试。'],
                acceptance: [
                  { criterion: 'parser 测试通过。', method: { kind: 'command', value: 'npm test -- parser' } }
                ]
              }
            }
          }
        }
      );

      const markdown = result.brief.markdown;
      for (const heading of [
        '## 目标', '## 相关上下文', '## 对象与范围', '## 交付物', '## 约束', '## 执行方式', '## 验收'
      ]) {
        expect(markdown).toContain(heading);
      }
      expect(markdown).toContain('Parser changes must keep the public API unchanged.');
      expect(markdown).not.toContain('Database migrations require a backup');
      expect(markdown).not.toContain('ROOT_SECRET_MARKER');
      expect(markdown.split(/\r?\n/).filter(line => line.trim()).length).toBeLessThanOrEqual(40);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('degrades explicitly when relevant .align evidence exceeds the bounded context budget', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-context-budget-'));
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir);
    fs.writeFileSync(
      path.join(alignDir, 'spec.md'),
      Array.from({ length: 10 }, (_, index) =>
        `- Parser rule ${index + 1}: keep parser behavior ${index + 1} covered by a focused test.`
      ).join('\n'),
      'utf8'
    );

    try {
      const result = alignInstruction(
        '修改 src/parser.ts 的错误处理；不改 public API；完成后运行 npm test -- parser。',
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
                rationale: [{ module: 'change', reason: '请求要求修改 parser。' }],
                confidence: 0.97,
                missing: []
              },
              brief: {
                objective: '修改 parser 错误处理并保持 public API。',
                context: ['目标对象是 src/parser.ts。'],
                scope: { include: ['src/parser.ts'], exclude: ['public API'] },
                deliverables: ['最小代码补丁。'],
                constraints: ['不得修改 public API。'],
                execution: ['读取错误分支后做最小修改。'],
                acceptance: [
                  { criterion: 'parser 测试通过。', method: { kind: 'command', value: 'npm test -- parser' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('context_budget_exceeded');
      expect(result.trace?.evidence).toHaveLength(8);
      expect(result.trace?.totalEvidenceCharacters).toBeLessThanOrEqual(6000);
      expect(result.trace?.evidence[0]).toEqual(expect.objectContaining({
        source: { kind: 'project', ref: '.align/spec.md' },
        location: 'line:1',
        appliesTo: expect.arrayContaining(['context']),
        freshness: 'current'
      }));
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('degrades instead of choosing silently between conflicting .align sources', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-context-conflict-'));
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir);
    fs.writeFileSync(path.join(alignDir, 'spec.md'), '- Runtime: Node.js 20\n', 'utf8');
    fs.writeFileSync(path.join(alignDir, 'facts.md'), '- Runtime: Python 3.12\n', 'utf8');
    fs.writeFileSync(path.join(alignDir, 'glossary.md'), '# Terms\n', 'utf8');
    fs.writeFileSync(path.join(alignDir, 'state.md'), 'updatedAt: 2026-07-20\n', 'utf8');

    try {
      const result = alignInstruction(
        '只读检查 Runtime 配置差异，输出证据清单，不修改文件。',
        projectDir,
        {
          includeTrace: true,
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'inspect',
                secondary: [],
                rationale: [{ module: 'inspect', reason: '请求是只读配置检查。' }],
                confidence: 0.95,
                missing: []
              },
              brief: {
                objective: '只读检查 Runtime 配置差异。',
                context: ['仅使用已验证的项目证据。'],
                scope: { include: ['Runtime 配置'], exclude: ['任何文件修改'] },
                deliverables: ['带来源的差异清单。'],
                constraints: ['禁止写操作。'],
                execution: ['读取并比较相关配置证据。'],
                acceptance: [
                  { criterion: '每项差异都有来源。', method: { kind: 'checklist', value: '逐项检查来源引用' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('context_conflict');
      expect(result.trace?.contextIssues).toContain('source_conflict');
      expect(result.brief.markdown).not.toContain('Node.js 20');
      expect(result.brief.markdown).not.toContain('Python 3.12');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('excludes stale state evidence and discloses the context degradation', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-context-stale-'));
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir);
    fs.writeFileSync(path.join(alignDir, 'facts.md'), '# Facts\n', 'utf8');
    fs.writeFileSync(path.join(alignDir, 'glossary.md'), '# Terms\n', 'utf8');
    fs.writeFileSync(
      path.join(alignDir, 'state.md'),
      '- Runtime: obsolete-runtime-value\n- updatedAt: 2020-01-01\n',
      'utf8'
    );

    try {
      const result = alignInstruction(
        '只读报告 Runtime 当前值，不修改文件；答案列出证据。',
        projectDir,
        {
          includeTrace: true,
          model: {
            status: 'available',
            output: {
              taskRoute: {
                schemaVersion: '1.0.0',
                primary: 'inspect',
                secondary: [],
                rationale: [{ module: 'inspect', reason: '请求是只读状态检查。' }],
                confidence: 0.95,
                missing: []
              },
              brief: {
                objective: '只读报告 Runtime 当前值。',
                context: ['只采用当前有效的状态证据。'],
                scope: { include: ['Runtime 状态'], exclude: ['文件修改'] },
                deliverables: ['带来源的状态报告。'],
                constraints: ['禁止写操作。'],
                execution: ['读取当前有效证据。'],
                acceptance: [
                  { criterion: '报告列出证据。', method: { kind: 'checklist', value: '检查来源' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('context_stale');
      expect(result.trace?.contextIssues).toContain('stale_evidence');
      expect(result.brief.markdown).not.toContain('obsolete-runtime-value');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('blocks a model-authored change that conflicts with a relevant project hard rule', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-context-policy-'));
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir);
    fs.writeFileSync(path.join(alignDir, 'spec.md'), '- 禁止修改 dist/ 下任何文件。\n', 'utf8');

    try {
      const result = alignInstruction(
        '修改 dist/runtime/index.js 的标题；完成后运行 npm test。',
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
                rationale: [{ module: 'change', reason: '请求要求修改 dist 文件。' }],
                confidence: 0.99,
                missing: []
              },
              brief: {
                objective: '修改 dist/runtime/index.js 的标题。',
                context: ['目标文件位于 dist/runtime。'],
                scope: { include: ['dist/runtime/index.js'], exclude: ['其他文件'] },
                deliverables: ['标题修改。'],
                constraints: ['保持其他内容不变。'],
                execution: ['直接修改目标文件。'],
                acceptance: [
                  { criterion: '测试通过。', method: { kind: 'command', value: 'npm test' } }
                ]
              }
            }
          }
        }
      );

      expect(result.trace?.contextIssues).toContain('policy_conflict');
      expect(result.decision.route).toBe('block');
      expect(result.decision.next.action).toBe('stop');
      expect(result.host.nextAction).toBe('stop');
      expect(result.brief.markdown).toContain('停止写操作');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('applies a pure-Chinese project hard rule to the matching Chinese target', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-context-chinese-policy-'));
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir);
    fs.writeFileSync(path.join(alignDir, 'spec.md'), '- 禁止修改配置文件。\n', 'utf8');

    try {
      const result = alignInstruction(
        '把配置文件中的 foo 从 1 改为 2，不改其他内容；完成后运行 npm test。',
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
                rationale: [{ module: 'change', reason: '请求要求改配置文件。' }],
                confidence: 0.98,
                missing: []
              },
              brief: {
                objective: '把配置文件中的 foo 从 1 改为 2。',
                context: ['目标是配置文件。'],
                scope: { include: ['配置文件标题'], exclude: ['其他内容'] },
                deliverables: ['最小配置补丁。'],
                constraints: ['不改其他内容。'],
                execution: ['更新 foo。'],
                acceptance: [
                  { criterion: '测试通过。', method: { kind: 'command', value: 'npm test' } }
                ]
              }
            }
          }
        }
      );

      expect(result.trace?.contextIssues).toContain('policy_conflict');
      expect(result.decision.route).toBe('block');
      expect(result.decision.next.action).toBe('stop');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test.each([
    ['an unresolved placeholder', '[TODO] 更新 parser 错误文本。'],
    ['a hidden context reference', '.align/spec.md#parser'],
    ['an embedded hidden context reference', 'Follow .align/spec.md for constraints.'],
    ['an internal keyword log', 'matched keyword: parser; score=0.98']
  ])('rejects a model Brief containing %s', (_name, unsafeContext) => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-brief-content-gate-'));

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
                rationale: [{ module: 'change', reason: '请求要求修改 parser 文本。' }],
                confidence: 0.98,
                missing: []
              },
              brief: {
                objective: '更新 parser 错误文本。',
                context: [unsafeContext],
                scope: { include: ['src/parser.ts'], exclude: ['public API'] },
                deliverables: ['最小代码补丁。'],
                constraints: ['不得修改 public API。'],
                execution: ['做最小修改。'],
                acceptance: [
                  { criterion: 'parser 测试通过。', method: { kind: 'command', value: 'npm test -- parser' } }
                ]
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('model_output_invalid');
      expect(result.brief.markdown).not.toContain(unsafeContext);
      expect(result.brief.markdown.split(/\r?\n/).filter(line => line.trim()).length).toBeLessThanOrEqual(40);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('rejects a verbose simple-task Brief instead of silently treating it as complex', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-brief-line-limit-'));
    const items = (prefix: string, count = 10): string[] =>
      Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);

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
                rationale: [{ module: 'change', reason: '这是单一文件文本修改。' }],
                confidence: 0.99,
                missing: []
              },
              brief: {
                objective: '更新 parser 错误文本。',
                context: items('上下文', 8),
                scope: { include: items('包含'), exclude: items('排除') },
                deliverables: items('交付物'),
                constraints: items('约束'),
                execution: items('步骤'),
                acceptance: items('验收').map((criterion, index) => ({
                  criterion,
                  method: { kind: 'manual', value: `检查项 ${index + 1}` }
                }))
              }
            }
          }
        }
      );

      expect(result.mode).toBe('degraded');
      expect(result.degradedReasons).toContain('model_output_invalid');
      expect(result.brief.markdown.split(/\r?\n/).filter(line => line.trim()).length).toBeLessThanOrEqual(40);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
