import { analyzeInstruction, SourceRef } from '../analyzer';
import { AlignmentDecision, buildAlignmentDecision } from '../contract-builder';
import { projectAlignmentDecision } from '../host-projection';

function decisionFor(request: string, context: SourceRef[] = []): AlignmentDecision {
  return buildAlignmentDecision(analyzeInstruction(request, context));
}

describe('W2 Host Projection conformance', () => {
  test('projects only adopted context evidence into the enrichment receipt', () => {
    const adopted = { kind: 'project' as const, ref: '.align/spec.md#parser-boundary' };
    const unused = { kind: 'project' as const, ref: '.align/facts.md#production-migration' };
    const decision = decisionFor('修复 src/parser.ts 的错误提示，保持 public API 不变。', [adopted, unused]);

    decision.appliedContext = [adopted];
    decision.claims = [
      {
        id: 'claim-user-request',
        type: 'fact',
        statement: decision.scope.include[0],
        sources: [{ kind: 'user', ref: 'request:text' }]
      },
      {
        id: 'context-parser-boundary',
        type: 'fact',
        statement: '只采用 parser 的 public API 兼容规则。',
        sources: [adopted]
      },
      {
        id: 'context-production-warning',
        type: 'fact',
        statement: '生产迁移需要备份、dry-run 和回滚条件。',
        sources: [unused]
      },
      {
        id: 'receipt-acceptance',
        type: 'fact',
        statement: '命令通过：npm test -- parser',
        sources: [unused]
      }
    ];

    const projection = projectAlignmentDecision(decision);
    const receiptText = JSON.stringify(projection.enrichmentReceipt);

    expect(projection.enrichmentReceipt?.items[0]).toEqual(expect.objectContaining({
      addition: expect.stringContaining('只采用 parser 的 public API 兼容规则。'),
      sources: [adopted]
    }));
    expect(receiptText).not.toContain('production-migration');
    expect(receiptText).not.toContain('生产迁移需要备份');
    expect(receiptText).not.toContain('.align/facts.md');
    expect(projection.instructions).not.toContain('.align/facts.md');
  });

  test('keeps the Alignment Decision route and action as the host projection source of truth', () => {
    const clarify = decisionFor('帮我优化这个项目，让 AI 更懂我');
    const clarifyProjection = projectAlignmentDecision(clarify);

    expect(clarify.route).toBe('clarify');
    expect(clarify.next.action).toBe('ask');
    expect(clarifyProjection.nextAction).toBe('ask');
    expect(clarifyProjection.verdict).toBe('VAGUE');
    expect(clarifyProjection.instructions).toContain('route=clarify next.action=ask');
    expect(clarifyProjection.instructions).toContain('停止执行');
    expect(clarifyProjection.instructions).not.toContain('route=enrich');
  });

  test('does not lower a block decision when the adapter has advisory blocking only', () => {
    const decision = buildAlignmentDecision(analyzeInstruction(
      '删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。'
    ));
    const projection = projectAlignmentDecision({
      ...decision,
      host: {
        ...decision.host,
        enforcement: { ...decision.host.enforcement, block: 'advisory' }
      }
    });

    expect(decision.route).toBe('block');
    expect(decision.next.action).toBe('wait_confirmation');
    expect(projection.nextAction).toBe('wait_confirmation');
    expect(projection.instructions).toContain('route=block next.action=wait_confirmation');
    expect(projection.instructions).toContain('停止执行并等待明确确认');
    expect(projection.instructions).not.toContain('next.action=execute');
    expect(projection.shouldBlock).toBe(false);
  });

  test('keeps a fully authorized high-risk request executable without completion evidence', () => {
    const decision = buildAlignmentDecision(analyzeInstruction(
      '在开发 fixture 中删除 3 个已列名的废弃测试用户，运行 fixture 测试；已授权。'
    ), { nativeHook: true });
    const projection = projectAlignmentDecision(decision);

    expect(decision.route).toBe('enrich');
    expect(decision.next.action).toBe('execute');
    expect(projection.nextAction).toBe('execute');
    expect(projection.shouldBlock).toBe(false);
    expect(projection.instructions).toContain('route=enrich next.action=execute');
    expect(projection.instructions).not.toContain('停止执行');
    expect(projection).not.toHaveProperty('completionEvidence');
  });
});
