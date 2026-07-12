import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';

type JsonObject = Record<string, any>;

const contractRoot = path.resolve(__dirname, '../../../../contracts');

function loadJson(name: string): JsonObject {
  return JSON.parse(readFileSync(path.join(contractRoot, name), 'utf8')) as JsonObject;
}

function loadJsonLines(name: string): JsonObject[] {
  return readFileSync(path.join(contractRoot, name), 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line) as JsonObject);
}

const schema = loadJson('alignment-decision.schema.json');
const registry = loadJson('reason-registry.json');
const policy = loadJson('decision-policy.json');
const reasonByCode = new Map<string, JsonObject>(
  registry.reasons.map((reason: JsonObject) => [reason.code, reason])
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);
const validateLifecycleEvent = ajv.compile(loadJson('lifecycle-event.schema.json'));
const validatePolicy = ajv.compile(loadJson('decision-policy.schema.json'));

function passDecision(): JsonObject {
  return {
    schemaVersion: '1.0.0',
    kind: 'alignment.decision',
    policyVersion: '1.0.0',
    requestId: 'req-pass-001',
    decisionId: 'dec-pass-001',
    route: 'pass',
    reasons: ['requirements.sufficient'],
    scores: {
      observed: { d1: 2, d2: 2, d3: 2, d4: 1, d5: 1, total: 8 },
      effective: { d1: 2, d2: 2, d3: 2, d4: 1, d5: 1, total: 8 },
    },
    claims: [],
    missing: [],
    scope: { include: ['src/parser.ts'], exclude: ['public API'] },
    acceptance: [
      {
        id: 'ac-1',
        criterion: 'Parser tests pass.',
        method: { kind: 'command', value: 'npm test -- parser' },
      },
    ],
    presentation: { mode: 'default', tier: 'A' },
    next: { action: 'execute' },
    lifecyclePlan: {
      baseline: 'required',
      completion: 'required',
      precipitation: 'on_signal',
    },
    host: {
      adapter: 'codex',
      level: 'L1',
      enforcement: {
        ingress: 'advisory',
        block: 'advisory',
        completion: 'self_reported',
      },
    },
  };
}

function semanticErrors(decision: JsonObject): string[] {
  const errors: string[] = [];
  const dimensions = ['d1', 'd2', 'd3', 'd4', 'd5'];

  for (const scoreKind of ['observed', 'effective']) {
    const score = decision.scores[scoreKind];
    const sum = dimensions.reduce((total, key) => total + score[key], 0);
    if (score.total !== sum) errors.push(`${scoreKind}.total_mismatch`);
  }

  const reasonMetadata = decision.reasons.map((code: string) => reasonByCode.get(code));
  if (reasonMetadata.some((reason: JsonObject | undefined) => !reason)) {
    errors.push('reason.unknown');
  } else {
    for (const reason of reasonMetadata as JsonObject[]) {
      if (!reason.appliesTo.includes('decision')) errors.push(`reason.wrong_phase:${reason.code}`);
      if (!reason.allowedRoutes.includes(decision.route)) errors.push(`reason.route_mismatch:${reason.code}`);
    }

    const canonical = [...(reasonMetadata as JsonObject[])]
      .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code))
      .map(reason => reason.code);
    if (JSON.stringify(canonical) !== JSON.stringify(decision.reasons)) {
      errors.push('reason.non_canonical_order');
    }
  }

  const assumptions = decision.claims.filter((claim: JsonObject) => claim.type === 'assumption');
  const thresholds = policy.thresholds;
  if (assumptions.length > thresholds.maximumAssumptionsForExecution && decision.route !== 'clarify') {
    errors.push('assumption.route');
  }
  if (assumptions.length > thresholds.maximumAssumptionsForExecution && !decision.reasons.includes('assumption.too_many')) {
    errors.push('assumption.reason_missing');
  }

  if (decision.scores.effective.total < thresholds.executionMinimumTotal && decision.route !== 'clarify') {
    errors.push('score.route');
  }
  if (decision.scores.effective.total < thresholds.executionMinimumTotal && !decision.reasons.includes('diagnosis.score_below_threshold')) {
    errors.push('score.reason_missing');
  }
  if (decision.route === 'pass' && decision.scores.observed.total < thresholds.passMinimumTotal) {
    errors.push('pass.score_below_threshold');
  }
  if (['pass', 'enrich'].includes(decision.route) && dimensions.some(key => decision.scores.effective[key] < thresholds.executionMinimumDimension)) {
    errors.push('execution.dimension_unresolved');
  }
  if (decision.scores.effective.d5 === 0 && !decision.reasons.includes('verification.missing')) {
    errors.push('verification.reason_missing');
  }
  if (decision.route === 'pass' && JSON.stringify(decision.scores.observed) !== JSON.stringify(decision.scores.effective)) {
    errors.push('pass.scores_changed');
  }

  const claimIds = new Set<string>();
  for (const claim of decision.claims) {
    if (claimIds.has(claim.id)) errors.push(`claim.duplicate:${claim.id}`);
    claimIds.add(claim.id);
  }
  for (const claim of decision.claims.filter((item: JsonObject) => item.type === 'inference')) {
    for (const basedOn of claim.basedOn) {
      if (!claimIds.has(basedOn)) errors.push(`claim.missing_basis:${basedOn}`);
    }
  }

  return errors;
}

function lifecycleSemanticErrors(event: JsonObject): string[] {
  const errors: string[] = [];
  const metadata = event.reasons.map((code: string) => reasonByCode.get(code));
  if (metadata.some((reason: JsonObject | undefined) => !reason)) {
    errors.push('reason.unknown');
    return errors;
  }

  for (const reason of metadata as JsonObject[]) {
    if (!reason.appliesTo.includes(event.phase)) errors.push(`reason.wrong_phase:${reason.code}`);
  }
  const canonical = [...(metadata as JsonObject[])]
    .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code))
    .map(reason => reason.code);
  if (JSON.stringify(canonical) !== JSON.stringify(event.reasons)) errors.push('reason.non_canonical_order');
  return errors;
}

function evaluateCondition(condition: JsonObject, input: JsonObject): boolean {
  const dimensions = ['d1', 'd2', 'd3', 'd4', 'd5'];
  switch (condition.op) {
    case 'always':
      return true;
    case 'reason_any':
      return condition.codes.some((code: string) => input.reasons.includes(code));
    case 'score_total': {
      const total = input.scores[condition.source].total;
      if (condition.comparator === 'lt') return total < condition.value;
      if (condition.comparator === 'gte') return total >= condition.value;
      return total >= condition.min && total <= condition.max;
    }
    case 'minimum_dimension': {
      const minimum = Math.min(...dimensions.map(key => input.scores[condition.source][key]));
      return condition.comparator === 'lt' ? minimum < condition.value : minimum >= condition.value;
    }
    case 'assumption_count':
      return condition.comparator === 'gt'
        ? input.assumptionCount > condition.value
        : input.assumptionCount <= condition.value;
    case 'scores_equal':
      return (JSON.stringify(input.scores.observed) === JSON.stringify(input.scores.effective)) === condition.value;
    case 'safety_critical':
      return input.safetyCritical === condition.value;
    case 'all':
      return condition.conditions.every((item: JsonObject) => evaluateCondition(item, input));
    case 'any':
      return condition.conditions.some((item: JsonObject) => evaluateCondition(item, input));
    case 'not':
      return !evaluateCondition(condition.condition, input);
    default:
      throw new Error(`Unknown policy operator: ${condition.op}`);
  }
}

function evaluatePolicy(input: JsonObject): JsonObject {
  const orderedRules = [...policy.routePrecedence].sort(
    (a: JsonObject, b: JsonObject) => a.priority - b.priority
  );
  const match = orderedRules.find((rule: JsonObject) => evaluateCondition(rule.when, input));
  if (!match) throw new Error('Policy must contain a fail-closed terminal rule.');
  return match;
}

describe('Alignment Decision public contract', () => {
  test('accepts complete pass, clarify, and block decisions', () => {
    const pass = passDecision();
    const enrich = {
      ...passDecision(),
      requestId: 'req-enrich-001',
      decisionId: 'dec-enrich-001',
      route: 'enrich',
      reasons: ['requirements.needs_enrichment'],
      scores: {
        observed: { d1: 2, d2: 1, d3: 2, d4: 1, d5: 1, total: 7 },
        effective: { d1: 2, d2: 1, d3: 2, d4: 1, d5: 1, total: 7 },
      },
      appliedContext: [{ kind: 'default', ref: 'policy:contract-enrichment' }],
      presentation: { mode: 'default', tier: 'B' },
    };
    const authorizedRisk = {
      ...passDecision(),
      requestId: 'req-risk-001',
      decisionId: 'dec-risk-001',
      route: 'enrich',
      reasons: ['risk.production_change', 'requirements.needs_enrichment'],
      appliedContext: [{ kind: 'decision', ref: 'approval:production-change-001' }],
      presentation: { mode: 'default', tier: 'B' },
    };
    const clarify = {
      ...passDecision(),
      requestId: 'req-clarify-001',
      decisionId: 'dec-clarify-001',
      route: 'clarify',
      reasons: ['verification.missing', 'diagnosis.score_below_threshold'],
      scores: {
        observed: { d1: 1, d2: 0, d3: 1, d4: 1, d5: 0, total: 3 },
        effective: { d1: 1, d2: 0, d3: 1, d4: 1, d5: 0, total: 3 },
      },
      missing: ['target outcome'],
      acceptance: [],
      presentation: { mode: 'interview', tier: 'C' },
      lifecyclePlan: {
        baseline: 'not_required',
        completion: 'not_observable',
        precipitation: 'on_signal',
      },
      next: {
        action: 'ask',
        question: {
          id: 'q-1',
          prompt: '登录优化后必须改善哪个可观测结果？',
          why: '目标会改变实现范围和验收。',
          recommendedAnswer: '推荐：把登录失败率降到 1% 以下，并保持现有认证方式。',
        },
      },
    };
    const block = {
      ...passDecision(),
      requestId: 'req-block-001',
      decisionId: 'dec-block-001',
      route: 'block',
      reasons: [
        'authorization.confirmation_missing',
        'risk.production_change',
        'risk.data_mutation',
        'override.explicit_direct_output',
      ],
      presentation: { mode: 'direct_output', tier: 'C' },
      lifecyclePlan: {
        baseline: 'not_required',
        completion: 'not_observable',
        precipitation: 'on_signal',
      },
      next: {
        action: 'wait_confirmation',
        requirement: {
          id: 'confirm-production-delete',
          prompt: '请提供备份标识、回滚条件并明确确认生产删除。',
          impact: ['生产数据将被删除', '操作可能需要回滚'],
        },
      },
    };

    for (const decision of [pass, enrich, authorizedRisk, clarify, block]) {
      expect(validateSchema(decision)).toBe(true);
      expect(semanticErrors(decision)).toEqual([]);
    }
  });

  test.each([
    ['block cannot execute', () => ({ ...passDecision(), route: 'block', presentation: { mode: 'default', tier: 'C' } })],
    ['clarify requires one complete question', () => ({
      ...passDecision(),
      route: 'clarify',
      missing: ['goal'],
      presentation: { mode: 'interview', tier: 'C' },
      next: { action: 'ask', question: { id: 'q', prompt: '目标？', why: '范围依赖目标。' } },
    })],
    ['enrich requires applied project context', () => ({
      ...passDecision(),
      route: 'enrich',
      reasons: ['context.resolvable_from_project'],
      presentation: { mode: 'default', tier: 'B' },
    })],
    ['clarify cannot schedule baseline or completion', () => ({
      ...passDecision(),
      route: 'clarify',
      reasons: ['intent.ambiguous_goal'],
      missing: ['goal'],
      acceptance: [],
      presentation: { mode: 'interview', tier: 'C' },
      next: {
        action: 'ask',
        question: { id: 'q', prompt: '目标？', why: '范围依赖目标。', recommendedAnswer: '推荐：先定义可观测目标。' },
      },
    })],
    ['direct output without its audit reason', () => ({
      ...passDecision(),
      presentation: { mode: 'direct_output', tier: 'A' },
    })],
    ['direct output audit reason without direct presentation', () => ({
      ...passDecision(),
      reasons: ['requirements.sufficient', 'override.explicit_direct_output'],
    })],
  ])('schema rejects %s', (_name, createDecision) => {
    expect(validateSchema(createDecision())).toBe(false);
  });

  test.each([
    ['a false score total', () => {
      const decision = passDecision();
      decision.scores.effective.total = 9;
      return decision;
    }, 'effective.total_mismatch'],
    ['an unknown reason', () => {
      const decision = passDecision();
      decision.reasons = ['unknown.reason'];
      return decision;
    }, 'reason.unknown'],
    ['a low score routed to pass', () => {
      const decision = passDecision();
      decision.scores.observed = { d1: 1, d2: 1, d3: 1, d4: 1, d5: 1, total: 5 };
      decision.scores.effective = { ...decision.scores.observed };
      return decision;
    }, 'score.route'],
    ['a seven-point input routed to pass', () => {
      const decision = passDecision();
      decision.scores.observed = { d1: 2, d2: 1, d3: 2, d4: 1, d5: 1, total: 7 };
      decision.scores.effective = { ...decision.scores.observed };
      return decision;
    }, 'pass.score_below_threshold'],
  ])('semantic validation rejects %s', (_name, createDecision, expectedError) => {
    expect(semanticErrors(createDecision())).toContain(expectedError);
  });

  test('reason registry has unique codes and priorities usable for canonical ordering', () => {
    const codes = registry.reasons.map((reason: JsonObject) => reason.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(registry.ordering).toBe('priority_then_code');
  });

  test('completion evidence requires an execution receipt reference', () => {
    const completion: JsonObject = {
      schemaVersion: '1.0.0',
      requestId: 'req-pass-001',
      decisionId: 'dec-pass-001',
      runId: 'run-001',
      revision: 4,
      kind: 'alignment.completion-report',
      phase: 'completion',
      executionRef: 'execution://run-001/receipt',
      status: 'verified',
      reasons: [],
      checks: [
        {
          acceptanceId: 'ac-1',
          status: 'passed',
          evidenceRefs: [{ kind: 'command', ref: 'npm test -- parser:exit=0' }],
        },
      ],
    };

    expect(validateLifecycleEvent(completion)).toBe(true);
    delete completion.executionRef;
    expect(validateLifecycleEvent(completion)).toBe(false);
  });

  test('execution handoff binds the baseline, acceptance plan, and scope', () => {
    const handoff = {
      schemaVersion: '1.0.0',
      requestId: 'req-pass-001',
      decisionId: 'dec-pass-001',
      runId: 'run-001',
      revision: 3,
      kind: 'alignment.execution-handoff',
      phase: 'handoff',
      handoffId: 'handoff-001',
      baselineReportRef: 'baseline://run-001/revision-2',
      acceptancePlanRef: 'decision://dec-pass-001/acceptance',
      scopeFingerprint: 'sha256:0123456789abcdef',
    };
    expect(validateLifecycleEvent(handoff)).toBe(true);
  });

  test('a failed baseline carries its canonical lifecycle reason', () => {
    const baseline = {
      schemaVersion: '1.0.0',
      requestId: 'req-pass-001',
      decisionId: 'dec-pass-001',
      runId: 'run-001',
      revision: 2,
      kind: 'alignment.baseline-report',
      phase: 'baseline',
      status: 'failed',
      reasons: ['lifecycle.baseline_failed'],
      observations: [
        {
          conditionId: 'backup-exists',
          status: 'failed',
          evidenceRefs: [{ kind: 'command', ref: 'backup-check:exit=1' }],
        },
      ],
    };

    expect(validateLifecycleEvent(baseline)).toBe(true);
    expect(lifecycleSemanticErrors(baseline)).toEqual([]);
  });

  test.each([
    ['unknown reason', 'unknown.reason', 'reason.unknown'],
    ['wrong-phase reason', 'lifecycle.completion_failed', 'reason.wrong_phase:lifecycle.completion_failed'],
  ])('lifecycle semantic validation rejects %s', (_name, reason, expectedError) => {
    const baseline = {
      schemaVersion: '1.0.0',
      requestId: 'req-pass-001',
      decisionId: 'dec-pass-001',
      runId: 'run-001',
      revision: 2,
      kind: 'alignment.baseline-report',
      phase: 'baseline',
      status: 'failed',
      reasons: ['lifecycle.baseline_failed', reason],
      observations: [
        { conditionId: 'backup-exists', status: 'failed', evidenceRefs: [] },
      ],
    };
    expect(lifecycleSemanticErrors(baseline)).toContain(expectedError);
  });

  test('an intake decision cannot contain completion results', () => {
    const decision = { ...passDecision(), verificationResults: [] };
    expect(validateSchema(decision)).toBe(false);
  });

  test('golden corpus freezes one exact machine outcome per decision case', () => {
    const cases = loadJsonLines('golden/alignment-cases.jsonl');
    expect(cases.length).toBeGreaterThanOrEqual(7);

    for (const goldenCase of cases) {
      expect(goldenCase.stage).toBe('decision');
      expect(['pass', 'enrich', 'clarify', 'block']).toContain(goldenCase.expect.route);
      expect(['execute', 'ask', 'wait_confirmation', 'stop']).toContain(goldenCase.expect.next.action);
      expect(goldenCase.expect.scores).toHaveProperty('observed');
      expect(goldenCase.expect.scores).toHaveProperty('effective');
      expect(goldenCase.expect).toHaveProperty('lifecyclePlan');

      const metadata = goldenCase.expect.reasons.map((code: string) => reasonByCode.get(code));
      expect(metadata.every((reason: JsonObject | undefined) => reason !== undefined)).toBe(true);
      const canonical = (metadata as JsonObject[])
        .sort((a, b) => a.priority - b.priority || a.code.localeCompare(b.code))
        .map(reason => reason.code);
      expect(goldenCase.expect.reasons).toEqual(canonical);
    }
  });

  test('decision policy freezes route precedence and direct-output pairing', () => {
    expect(validatePolicy(policy)).toBe(true);
    expect(policy.routePrecedence.map((rule: JsonObject) => rule.id)).toEqual([
      'policy_block',
      'clarify_missing_contract',
      'authorization_block',
      'enrich_executable_contract',
      'pass_complete_input',
      'fail_closed_clarify',
    ]);
    expect(policy.annotationRules).toContainEqual(
      expect.objectContaining({
        id: 'direct_output_audit_pair',
        bidirectional: true,
        changesRoute: false,
      })
    );
  });

  test.each([
    ['six-point boundary', 6, [], false, 'enrich'],
    ['seven-point boundary', 7, [], false, 'enrich'],
    ['complete eight-point input', 8, [], false, 'pass'],
    ['incomplete high-risk request', 3, ['risk.data_mutation', 'intent.ambiguous_goal'], true, 'clarify'],
    ['incomplete request with missing confirmation', 3, ['intent.ambiguous_goal', 'authorization.confirmation_missing'], true, 'clarify'],
    ['complete request with missing confirmation', 8, ['authorization.confirmation_missing'], true, 'block'],
    ['policy prohibition outranks missing contract', 3, ['policy.operation_prohibited', 'intent.ambiguous_goal'], true, 'block'],
    ['authorized high-risk request', 8, ['risk.production_change'], true, 'enrich'],
  ])('policy evaluator routes %s deterministically', (_name, total, reasons, safetyCritical, expectedRoute) => {
    const scoreFixtures: Record<number, JsonObject> = {
      3: { d1: 0, d2: 0, d3: 1, d4: 1, d5: 1, total: 3 },
      6: { d1: 2, d2: 1, d3: 1, d4: 1, d5: 1, total: 6 },
      7: { d1: 2, d2: 1, d3: 2, d4: 1, d5: 1, total: 7 },
      8: { d1: 2, d2: 2, d3: 2, d4: 1, d5: 1, total: 8 },
    };
    const scores = scoreFixtures[total];
    const rule = evaluatePolicy({
      reasons,
      scores: { observed: scores, effective: { ...scores } },
      assumptionCount: 0,
      safetyCritical,
    });
    expect(rule.route).toBe(expectedRoute);
  });

  test('policy schema rejects unknown operators instead of guessing', () => {
    const invalidPolicy = JSON.parse(JSON.stringify(policy));
    invalidPolicy.routePrecedence[0].when = { op: 'maybe' };
    expect(validatePolicy(invalidPolicy)).toBe(false);
  });
});
