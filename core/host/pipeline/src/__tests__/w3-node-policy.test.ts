import * as fs from 'fs';
import * as path from 'path';
import { analyzeInstruction, AnalysisResult } from '../analyzer';
import { buildAlignmentDecision } from '../contract-builder';
import { decideRoute } from '../decision-engine';
import { evaluateDecisionPolicy } from '../policy-evaluator';

const contractsRoot = path.resolve(__dirname, '../../../../contracts');
const policy = JSON.parse(fs.readFileSync(path.join(contractsRoot, 'decision-policy.json'), 'utf8')) as unknown;
const registry = JSON.parse(fs.readFileSync(path.join(contractsRoot, 'reason-registry.json'), 'utf8')) as unknown;

describe('W3 Node Decision Kernel integration', () => {
  test('keeps the legacy decideRoute projection while production policy owns the decision', () => {
    const analysis = analyzeInstruction(
      '只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。'
    );

    expect(decideRoute(analysis)).toEqual({ route: 'pass', action: 'execute' });
  });

  test('publishes canonical, de-duplicated reasons from the registry', () => {
    const complete = { d1: 2, d2: 2, d3: 2, d4: 1, d5: 1, total: 8 };
    const analysis: AnalysisResult = {
      text: '[直出] 在开发 fixture 中删除 3 个已列名的废弃测试用户，运行 fixture 测试；已授权。',
      contextText: '',
      presentationMode: 'direct_output',
      reasons: [
        'override.explicit_direct_output',
        'requirements.needs_enrichment',
        'risk.data_mutation',
        'risk.data_mutation',
      ],
      observed: complete,
      effective: { ...complete },
      assumptionCount: 0,
      gap: 'none',
      contextEvidence: [],
      effectiveScoreSources: [],
      appliedContext: [],
    };

    expect(buildAlignmentDecision(analysis).reasons).toEqual([
      'risk.data_mutation',
      'requirements.needs_enrichment',
      'override.explicit_direct_output',
    ]);
  });

  test('routes an unrelated README command through policy with an unresolved acceptance score', () => {
    const analysis = analyzeInstruction(
      '把 README.md 的一个错别字改掉；完成后运行 bash -n build/build.sh。',
      [{ kind: 'project', ref: '.align/spec.md' }],
      'Documentation is Chinese Markdown. Do not skip heading levels.'
    );

    const decision = buildAlignmentDecision(analysis, {
      verificationCommands: ['bash -n build/build.sh'],
    });

    expect(decision.route).toBe('clarify');
    expect(decision.next.action).toBe('ask');
    expect(decision.scores.effective.d5).toBe(0);
    expect(decision.reasons).toContain('verification.missing');
    expect(decision.reasons).not.toContain('runtime.degraded');
    expect(decision.acceptance).toEqual([]);
  });

  test.each([null, { schemaVersion: '1.0.0' }])(
    'fails closed when the policy schema is missing or untrusted',
    schema => {
      const complete = { d1: 2, d2: 2, d3: 2, d4: 1, d5: 1, total: 8 };

      expect(evaluateDecisionPolicy({
        reasons: ['requirements.sufficient'],
        scores: { observed: complete, effective: { ...complete } },
        assumptionCount: 0,
      }, { policy, registry, schema })).toEqual({
        route: 'clarify',
        action: 'ask',
        reasons: ['runtime.degraded'],
        matchedRule: null,
        degraded: true,
      });
    }
  );

  test('fails closed when route rules have duplicate priorities', () => {
    const fixture = JSON.parse(JSON.stringify(policy)) as {
      routePrecedence: Array<{ priority: number }>;
    };
    fixture.routePrecedence[1].priority = fixture.routePrecedence[0].priority;
    const complete = { d1: 2, d2: 2, d3: 2, d4: 1, d5: 1, total: 8 };

    expect(evaluateDecisionPolicy({
      reasons: ['requirements.sufficient'],
      scores: { observed: complete, effective: { ...complete } },
      assumptionCount: 0,
    }, { policy: fixture, registry })).toEqual({
      route: 'clarify',
      action: 'ask',
      reasons: ['runtime.degraded'],
      matchedRule: null,
      degraded: true,
    });
  });
});
