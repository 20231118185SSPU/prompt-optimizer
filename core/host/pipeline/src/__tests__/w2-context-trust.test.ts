import { analyzeInstruction } from '../analyzer';
import { decideRoute } from '../decision-engine';

describe('W2 trusted context resolution', () => {
  test('marks an open-ended optimization request as directional and keeps scores observed', () => {
    const source = { kind: 'project' as const, ref: '.align/spec.md' };
    const analysis = analyzeInstruction(
      '帮我优化这个项目，让 AI 更懂我',
      [source],
      'Node.js + TypeScript；只改 core/，由 build 生成 dist；npm test。'
    );

    expect(analysis.gap).toBe('directional');
    expect(analysis.appliedContext).toEqual([]);
    expect(analysis.effective).toEqual(analysis.observed);
    expect(decideRoute(analysis)).toEqual({ route: 'clarify', action: 'ask' });
  });

  test('attributes structural score changes to the evidence that supplied them', () => {
    const source = { kind: 'project' as const, ref: '.align/spec.md' };
    const analysis = analyzeInstruction(
      '让 SearchBox 在按 Escape 时清空当前输入。',
      [source],
      'React frontend. Target component: src/components/SearchBox.tsx. Follow existing component patterns. Verify with npm test -- SearchBox.'
    );

    expect(analysis.gap).toBe('structural');
    expect(analysis.appliedContext).toEqual([source]);
    expect(analysis.effectiveScoreSources.length).toBeGreaterThan(0);
    for (const attribution of analysis.effectiveScoreSources) {
      expect(attribution.from).toBeLessThan(attribution.to);
      expect(attribution.source).toEqual(source);
      expect(attribution.evidence).toContain(source.ref);
    }
    expect(analysis.effectiveScoreSources.map(item => item.dimension)).toEqual(
      expect.arrayContaining(['d1', 'd2'])
    );
  });

  test('does not apply unrelated migration context to a README text edit', () => {
    const source = { kind: 'project' as const, ref: '.align/facts.md' };
    const analysis = analyzeInstruction(
      '修复 README.md 的一个错别字，完成后运行 markdownlint。',
      [source],
      '生产数据库迁移必须先备份，并提供回滚条件。'
    );

    expect(analysis.gap).toBe('none');
    expect(analysis.contextEvidence).toEqual([]);
    expect(analysis.appliedContext).toEqual([]);
    expect(analysis.effectiveScoreSources).toEqual([]);
  });

  test('does not treat an unrelated project check command as context evidence', () => {
    const source = { kind: 'project' as const, ref: '.align/check-commands.txt' };
    const analysis = analyzeInstruction(
      '修复 README.md 的一个错别字。',
      [source],
      'bash -n build/build.sh'
    );

    expect(analysis.appliedContext).toEqual([]);
    expect(analysis.contextEvidence).toEqual([]);
  });
});
