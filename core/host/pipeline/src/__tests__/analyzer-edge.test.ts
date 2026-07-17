import { analyzeInstruction } from '../analyzer';
import { decideRoute } from '../decision-engine';

describe('structured analyzer edge cases', () => {
  test('empty input fails closed to clarify', () => {
    const analysis = analyzeInstruction('');
    expect(decideRoute(analysis).route).toBe('clarify');
    expect(analysis.reasons).toContain('intent.ambiguous_goal');
    expect(analysis.reasons).toContain('diagnosis.score_below_threshold');
  });

  test.each([
    '不要删除生产环境数据，只解释风险。',
    'Do not delete production data; explain the risk.',
    '解释 `delete production data` 这段命令。',
    '文档写着“删除生产库”，请翻译。'
  ])('does not treat negated or quoted risk as execution: %s', input => {
    const analysis = analyzeInstruction(input);
    expect(analysis.reasons).not.toContain('risk.production_change');
    expect(analysis.reasons).not.toContain('risk.data_mutation');
  });

  test('detects an English production data mutation', () => {
    const analysis = analyzeInstruction('Delete all production users; rollback and tests are defined, without confirmation.');
    expect(analysis.reasons).toEqual(expect.arrayContaining([
      'authorization.confirmation_missing',
      'risk.production_change',
      'risk.data_mutation'
    ]));
  });

  test('I-01: project context cannot choose the real goal for a vague request', () => {
    const analysis = analyzeInstruction(
      '帮我优化这个项目，让 AI 更懂我',
      [{ kind: 'project', ref: '.align/spec.md' }],
      '技术栈：Node.js + TypeScript。现有测试命令：npm test。'
    );

    expect(decideRoute(analysis)).toEqual({ route: 'clarify', action: 'ask' });
  });

  test('I-02: technical context may describe structure but cannot fill the directional gap', () => {
    const analysis = analyzeInstruction(
      '帮我优化这个项目，让 AI 更懂我',
      [{ kind: 'project', ref: '.align/facts.md' }],
      '项目使用 Node.js 和 TypeScript；目录为 src/，测试命令为 npm test。'
    );

    expect(analysis.effective.d1).toBe(analysis.observed.d1);
    expect(decideRoute(analysis).route).toBe('clarify');
  });

  test('I-03: ordinary project facts cannot turn a directional gap into executable work', () => {
    const analysis = analyzeInstruction(
      '帮我改进这个项目，让它更适合团队',
      [{ kind: 'project', ref: '.align/facts.md' }],
      '团队使用 Node.js + TypeScript；现有测试命令为 npm test。'
    );

    expect(decideRoute(analysis)).toEqual({ route: 'clarify', action: 'ask' });
  });

  test('I-04: loaded but irrelevant context is excluded from appliedContext', () => {
    const irrelevant = { kind: 'project' as const, ref: '.align/facts.md' };
    const analysis = analyzeInstruction(
      '修复 `README.md` 的一个错别字，完成后运行 `markdownlint .`。',
      [irrelevant],
      '项目使用 PostgreSQL；生产迁移必须先备份并提供回滚条件。'
    );

    expect(analysis.appliedContext).not.toContainEqual(irrelevant);
  });

  test('action verb without context stays clarify', () => {
    const analysis = analyzeInstruction('修复登录 bug');
    expect(analysis.observed.d5).toBe(0);
    expect(analysis.observed.total).toBeLessThan(6);
    expect(decideRoute(analysis).route).toBe('clarify');
  });

  test('short action verb with project context stays clarify when no user verification signal', () => {
    // "修复登录 bug" is short (< 10 chars normalized) and has no user verification.
    // Context should not fill d5 acceptance for bare requests.
    const analysis = analyzeInstruction(
      '修复登录 bug',
      [{ kind: 'project', ref: '.align/spec.md' }],
      '技术栈：Node.js + TypeScript。测试命令：npm test。'
    );
    expect(decideRoute(analysis).route).toBe('clarify');
  });

  test('contradictory requirements stay clarify', () => {
    const analysis = analyzeInstruction('只看不改，但要修复所有问题');
    expect(decideRoute(analysis).route).toBe('clarify');
  });

  test('bulk production mutation without confirmation stays clarify', () => {
    const analysis = analyzeInstruction(
      '把所有用户的邮箱地址批量替换为 test@example.com，不确认直接执行。'
    );
    expect(analysis.reasons).toContain('risk.data_mutation');
    expect(decideRoute(analysis).route).not.toBe('enrich');
  });
});
