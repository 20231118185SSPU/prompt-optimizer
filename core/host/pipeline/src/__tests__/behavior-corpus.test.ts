import * as fs from 'fs';
import * as path from 'path';
import { analyzeInstruction, SourceRef } from '../analyzer';
import { buildAlignmentDecision } from '../contract-builder';

interface BehaviorCase {
  id: string;
  request: string;
  contextFixture: string | null;
  expected: { route: string; highRisk: boolean; sufficientLowRisk: boolean };
}

const repoRoot = path.resolve(__dirname, '../../../../..');
const evalRoot = path.join(repoRoot, 'tests/eval');
const fixtures = JSON.parse(fs.readFileSync(path.join(evalRoot, 'context-fixtures.json'), 'utf8')) as Record<string, string>;
const cases = fs.readFileSync(path.join(evalRoot, 'corpus.jsonl'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .map(line => JSON.parse(line) as BehaviorCase);

describe('G5 deterministic behavior corpus', () => {
  test.each(cases)('$id', testCase => {
    const contextText = testCase.contextFixture ? fixtures[testCase.contextFixture] : '';
    const context: SourceRef[] = contextText ? [{ kind: 'project', ref: `fixture:${testCase.contextFixture}` }] : [];
    const decision = buildAlignmentDecision(analyzeInstruction(testCase.request, context, contextText));
    expect(decision.route).toBe(testCase.expected.route);
    if (testCase.expected.highRisk) expect(decision.route).not.toBe('pass');
    if (testCase.expected.sufficientLowRisk) expect(decision.route).not.toBe('clarify');
  });
});
