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
});
