import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { analyzeInstruction } from '../analyzer';
import { buildAlignmentDecision } from '../contract-builder';
import { buildMattHandoff, MATT_SKILLS, MattEnvironment } from '../matt-handoff';

type JsonObject = Record<string, any>;

const schemaPath = path.resolve(__dirname, '../../../../contracts/ecosystem-handoff.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as JsonObject;
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

function decision(request: string, executable = true) {
  const input = executable
    ? '只读检查 `package.json` 的 scripts 字段，不修改文件；输出字段清单。'
    : '优化一下这个项目';
  const value = buildAlignmentDecision(analyzeInstruction(input));
  return executable
    ? {
      ...value,
      claims: [{
        id: 'claim-user-request',
        type: 'fact' as const,
        statement: request,
        sources: [{ kind: 'user' as const, ref: 'request:text' }]
      }]
    }
    : value;
}

function environment(skills: string[], setupComplete: boolean): MattEnvironment {
  return { availableSkills: new Set(skills), setupComplete };
}

describe('Ecosystem handoff public contract', () => {
  test('keeps the schema skill and invocation registry aligned with the runtime', () => {
    const selectedSkills = schema.properties.selectedSkill.enum.filter((value: unknown) => value !== null);
    const invocations = schema.properties.invocation.enum.filter((value: unknown) => value !== null);

    expect(selectedSkills).toEqual([...MATT_SKILLS]);
    expect(invocations).toEqual(MATT_SKILLS.map(skill => `/${skill}`));
  });

  test('accepts ready, setup_required, unavailable, and deferred Matt handoffs', () => {
    const executable = decision('实现已经确认的解析器行为');
    const cases = [
      buildMattHandoff(executable, environment(['implement'], true)),
      buildMattHandoff(executable, environment(['implement'], false)),
      buildMattHandoff(executable, environment([], false)),
      buildMattHandoff(decision('优化一下这个项目', false), environment(['ask-matt'], true))
    ];

    expect(cases.map(item => item.status)).toEqual([
      'ready',
      'setup_required',
      'unavailable',
      'deferred'
    ]);
    for (const handoff of cases) {
      expect(validate(handoff)).toBe(true);
    }
  });

  test.each([
    ['automatic invocation', (value: JsonObject) => { value.automatic = true; }],
    ['copied skill body', (value: JsonObject) => { value.skillBody = '# Implement'; }],
    ['skill and invocation mismatch', (value: JsonObject) => { value.invocation = '/tdd'; }],
    ['deferred execution target', (value: JsonObject) => {
      value.status = 'deferred';
      value.source.route = 'clarify';
    }],
    ['missing setup prerequisite', (value: JsonObject) => {
      value.status = 'setup_required';
      value.prerequisite = null;
    }],
    ['ready handoff from clarify', (value: JsonObject) => { value.source.route = 'clarify'; }]
  ])('rejects %s', (_name, mutate) => {
    const handoff = buildMattHandoff(
      decision('实现已经确认的解析器行为'),
      environment(['implement'], true)
    ) as unknown as JsonObject;
    mutate(handoff);

    expect(validate(handoff)).toBe(false);
  });
});
