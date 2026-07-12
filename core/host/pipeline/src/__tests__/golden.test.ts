import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import { analyzeInstruction, SourceRef } from '../analyzer';
import { buildAlignmentDecision } from '../contract-builder';

interface GoldenCase {
  id: string;
  input: { text: string; context: SourceRef[] };
  expect: {
    route: string;
    reasons: string[];
    scores: { observed: object; effective: object };
    next: { action: string };
  };
}

const contractsDir = path.resolve(__dirname, '../../../../contracts');
const schema = JSON.parse(fs.readFileSync(path.join(contractsDir, 'alignment-decision.schema.json'), 'utf8'));
const cases = fs.readFileSync(path.join(contractsDir, 'golden/alignment-cases.jsonl'), 'utf8')
  .trim()
  .split(/\r?\n/)
  .map(line => JSON.parse(line) as GoldenCase);

describe('Alignment Decision golden corpus', () => {
  const validate = new Ajv2020({ strict: false }).compile(schema);

  test.each(cases)('$id', golden => {
    const analysis = analyzeInstruction(golden.input.text, golden.input.context);
    const decision = buildAlignmentDecision(analysis);

    expect(decision.route).toBe(golden.expect.route);
    expect(decision.reasons).toEqual(golden.expect.reasons);
    expect(decision.scores).toEqual(golden.expect.scores);
    expect(decision.next.action).toBe(golden.expect.next.action);
    expect(validate(decision)).toBe(true);
  });
});
