import { analyzeInstruction, SourceRef } from '../analyzer';
import { buildAlignmentDecision } from '../contract-builder';
import { route } from '../router';

function decisionFor(text: string, context: SourceRef[] = []) {
  return buildAlignmentDecision(analyzeInstruction(text, context));
}

describe('route compatibility projection', () => {
  it.each([
    [
      '只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。',
      [],
      'pass',
      'CLEAR',
      'next.action=execute'
    ],
    [
      '把 src/parser.ts 的 parseUser 重命名为 parseAccount，不改 public API。',
      [{ kind: 'project', ref: '.align/spec.md#测试与验证命令' }],
      'enrich',
      'GRAY',
      'next.action=execute'
    ],
    ['删除旧用户数据。', [], 'clarify', 'VAGUE', 'next.action=ask'],
    [
      '删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。',
      [],
      'block',
      'HIGH',
      'next.action=wait_confirmation'
    ]
  ] as const)('derives %s from the Alignment Decision', (text, context, expectedRoute, expectedVerdict, instructionMarker) => {
    const decision = decisionFor(text, [...context]);
    const result = route(decision);

    expect(decision.route).toBe(expectedRoute);
    expect(result.verdict).toBe(expectedVerdict);
    expect(result.instructions).toContain(instructionMarker);
  });
});
