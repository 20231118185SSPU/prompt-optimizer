import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  evaluateDecisionPolicy,
  type PolicyEvaluationInput,
  type PolicyEvaluationResult,
} from '../policy-evaluator';

type JsonObject = Record<string, any>;

const contractRoot = path.resolve(__dirname, '../../../../contracts');

function loadJson(name: string): JsonObject {
  return JSON.parse(readFileSync(path.join(contractRoot, name), 'utf8')) as JsonObject;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const policy = loadJson('decision-policy.json');
const policySchema = loadJson('decision-policy.schema.json');
const registry = loadJson('reason-registry.json');

const scores = {
  low: { d1: 0, d2: 0, d3: 1, d4: 1, d5: 1, total: 3 },
  six: { d1: 2, d2: 1, d3: 1, d4: 1, d5: 1, total: 6 },
  seven: { d1: 2, d2: 1, d3: 2, d4: 1, d5: 1, total: 7 },
  complete: { d1: 2, d2: 2, d3: 2, d4: 1, d5: 1, total: 8 },
};

function input(
  score: JsonObject = scores.complete,
  overrides: Partial<PolicyEvaluationInput> = {}
): PolicyEvaluationInput {
  return {
    reasons: ['override.explicit_direct_output'],
    scores: { observed: clone(score), effective: clone(score) },
    assumptionCount: 0,
    safetyCritical: false,
    ...overrides,
  };
}

function evaluate(
  evaluationInput: PolicyEvaluationInput,
  policyFixture: unknown = policy,
  registryFixture: unknown = registry,
  schemaFixture: unknown = policySchema
): PolicyEvaluationResult {
  return evaluateDecisionPolicy(evaluationInput, {
    policy: policyFixture,
    registry: registryFixture,
    schema: schemaFixture,
  });
}

function expectFailClosed(result: PolicyEvaluationResult): void {
  expect(result).toEqual({
    route: 'clarify',
    action: 'ask',
    reasons: ['runtime.degraded'],
    matchedRule: null,
    degraded: true,
  });
}

describe('W3 production policy contract', () => {
  test('deleting the pass rule changes the production result to the terminal fallback', () => {
    const original = evaluate(input());
    const withoutPass = clone(policy);
    withoutPass.routePrecedence = withoutPass.routePrecedence.filter(
      (rule: JsonObject) => rule.id !== 'pass_complete_input'
    );

    const mutated = evaluate(input(), withoutPass);

    expect(original).toMatchObject({ route: 'pass', action: 'execute', matchedRule: 'pass_complete_input', degraded: false });
    expect(mutated).toMatchObject({ route: 'clarify', action: 'ask', matchedRule: 'fail_closed_clarify', degraded: false });
  });

  test('modifying a fixture rule condition directly changes the production result', () => {
    const raisedPassBoundary = clone(policy);
    const passRule = raisedPassBoundary.routePrecedence.find(
      (rule: JsonObject) => rule.id === 'pass_complete_input'
    );
    passRule.when.conditions.find(
      (condition: JsonObject) => condition.op === 'score_total'
    ).value = 9;

    expect(evaluate(input())).toMatchObject({ route: 'pass', matchedRule: 'pass_complete_input' });
    expect(evaluate(input(), raisedPassBoundary)).toMatchObject({ route: 'clarify', matchedRule: 'fail_closed_clarify' });
  });

  test('replacing a fixture rule directly changes the production result', () => {
    const productionRisk = input(scores.complete, {
      reasons: ['risk.production_change'],
      safetyCritical: true,
    });
    const replacedPolicyBlock = clone(policy);
    replacedPolicyBlock.routePrecedence[0] = {
      ...replacedPolicyBlock.routePrecedence[0],
      when: { op: 'reason_any', codes: ['risk.production_change'] },
    };

    expect(evaluate(productionRisk)).toMatchObject({ route: 'enrich', action: 'execute' });
    expect(evaluate(productionRisk, replacedPolicyBlock)).toMatchObject({
      route: 'block',
      action: 'stop',
      matchedRule: 'policy_block',
    });
  });

  test('priority order wins even when fixture rules are stored in reverse order', () => {
    const reversed = clone(policy);
    reversed.routePrecedence.reverse();
    const result = evaluate(input(scores.low, {
      reasons: ['intent.ambiguous_goal', 'policy.operation_prohibited'],
      safetyCritical: true,
    }), reversed);

    expect(result).toMatchObject({
      route: 'block',
      action: 'stop',
      matchedRule: 'policy_block',
      degraded: false,
    });
  });

  test('registry priority and code define canonical reason order', () => {
    const tiedRegistry = clone(registry);
    tiedRegistry.reasons.find(
      (reason: JsonObject) => reason.code === 'authorization.confirmation_missing'
    ).priority = 10;
    const result = evaluate(input(scores.complete, {
      reasons: ['policy.operation_prohibited', 'authorization.confirmation_missing'],
      safetyCritical: true,
    }), policy, tiedRegistry);

    expect(result.reasons).toEqual([
      'authorization.confirmation_missing',
      'policy.operation_prohibited',
    ]);
  });

  test('a rule with multiple allowed actions produces one deterministic action', () => {
    const result = evaluate(input(scores.complete, {
      reasons: ['authorization.confirmation_missing', 'risk.production_change'],
      safetyCritical: true,
    }));

    expect(result).toMatchObject({
      route: 'block',
      action: 'wait_confirmation',
      matchedRule: 'authorization_block',
      degraded: false,
    });
    expect(result).not.toHaveProperty('nextActions');
  });

  test('a reason disallowed for the selected route fails closed', () => {
    const mismatchedRegistry = clone(registry);
    mismatchedRegistry.reasons.find(
      (reason: JsonObject) => reason.code === 'requirements.sufficient'
    ).allowedRoutes = ['enrich'];

    expectFailClosed(evaluate(input(scores.complete, {
      reasons: ['requirements.sufficient'],
    }), policy, mismatchedRegistry));
  });

  test.each([
    ['unknown operator', () => {
      const fixture = clone(policy);
      fixture.routePrecedence[0].when = { op: 'maybe' };
      return { policy: fixture, registry };
    }],
    ['unknown reason in policy', () => {
      const fixture = clone(policy);
      fixture.routePrecedence[0].when.codes = ['unknown.reason'];
      return { policy: fixture, registry };
    }],
    ['unknown route', () => {
      const fixture = clone(policy);
      fixture.routePrecedence[0].route = 'defer';
      return { policy: fixture, registry };
    }],
    ['unknown action', () => {
      const fixture = clone(policy);
      fixture.routePrecedence[0].nextActions = ['launch'];
      return { policy: fixture, registry };
    }],
    ['illegal route/action combination', () => {
      const fixture = clone(policy);
      fixture.routePrecedence[0].route = 'clarify';
      fixture.routePrecedence[0].nextActions = ['execute'];
      return { policy: fixture, registry };
    }],
    ['missing policy', () => ({ policy: null, registry })],
    ['invalid policy', () => ({ policy: { schemaVersion: '1.0.0' }, registry })],
    ['missing policy schema', () => ({ policy, registry, schema: null })],
    ['invalid policy schema', () => ({
      policy,
      registry,
      schema: { schemaVersion: '1.0.0' },
    })],
    ['mutated policy schema constraint', () => {
      const fixture = clone(policySchema);
      fixture.properties.thresholds.properties.passMinimumTotal.type = 'string';
      return { policy, registry, schema: fixture };
    }],
    ['missing registry', () => ({ policy, registry: null })],
    ['invalid registry', () => ({ policy, registry: { schemaVersion: '1.0.0' } })],
    ['duplicate registry reason code', () => {
      const fixture = clone(registry);
      fixture.reasons.push(clone(fixture.reasons[0]));
      return { policy, registry: fixture };
    }],
    ['unknown registry allowed route', () => {
      const fixture = clone(registry);
      fixture.reasons[0].allowedRoutes = ['defer'];
      return { policy, registry: fixture };
    }],
    ['unknown registry lifecycle stage', () => {
      const fixture = clone(registry);
      fixture.reasons.find(
        (reason: JsonObject) => reason.code === 'requirements.sufficient'
      ).appliesTo = ['bogus'];
      return { policy, registry: fixture };
    }],
    ['registry without the degraded reason', () => {
      const fixture = clone(registry);
      fixture.reasons = fixture.reasons.filter(
        (reason: JsonObject) => reason.code !== 'runtime.degraded'
      );
      return { policy, registry: fixture };
    }],
  ])('%s fails closed', (_name, fixture) => {
    const options = fixture() as { policy: unknown; registry: unknown; schema?: unknown };
    expectFailClosed(evaluate(input(), options.policy, options.registry, options.schema));
  });

  test('an unknown input reason fails closed', () => {
    expectFailClosed(evaluate(input(scores.complete, {
      reasons: ['unknown.reason'],
    })));
  });

  test('a valid policy with no matching rule fails closed', () => {
    const noMatch = clone(policy);
    noMatch.routePrecedence = noMatch.routePrecedence.filter(
      (rule: JsonObject) => !['pass_complete_input', 'fail_closed_clarify'].includes(rule.id)
    );

    expectFailClosed(evaluate(input(), noMatch));
  });

  test('public policy versions, thresholds, precedence, and reason meanings stay frozen', () => {
    expect(policy).toMatchObject({
      schemaVersion: '1.0.0',
      kind: 'alignment.decision-policy',
      evaluation: 'first_match_wins',
      unknownOperator: 'fail_closed',
      thresholds: {
        passMinimumTotal: 8,
        executionMinimumTotal: 6,
        executionMinimumDimension: 1,
        maximumAssumptionsForExecution: 2,
      },
    });
    expect(policy.routePrecedence.map((rule: JsonObject) => [rule.id, rule.priority])).toEqual([
      ['policy_block', 10],
      ['clarify_missing_contract', 20],
      ['authorization_block', 30],
      ['enrich_executable_contract', 40],
      ['pass_complete_input', 50],
      ['fail_closed_clarify', 999],
    ]);
    expect(registry).toMatchObject({
      schemaVersion: '1.0.0',
      kind: 'alignment.reason-registry',
      ordering: 'priority_then_code',
    });
    expect(registry.reasons.find(
      (reason: JsonObject) => reason.code === 'runtime.degraded'
    )).toEqual({
      code: 'runtime.degraded',
      meaning: 'The runtime could not load or evaluate required alignment context.',
      priority: 150,
      appliesTo: ['decision', 'baseline', 'completion'],
      allowedRoutes: ['clarify', 'block'],
      safetyCritical: false,
    });
  });
});
