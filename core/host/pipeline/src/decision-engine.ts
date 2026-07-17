import { AnalysisResult } from './analyzer';
import {
  evaluateDecisionPolicy,
  PolicyEvaluationResult,
} from './policy-evaluator';

export type DecisionRoute = 'pass' | 'enrich' | 'clarify' | 'block';

export interface RouteDecision {
  route: DecisionRoute;
  action: 'execute' | 'ask' | 'wait_confirmation' | 'stop';
}

function policyReasons(analysis: AnalysisResult): string[] {
  const reasons = [...analysis.reasons];
  const applied = new Set(analysis.appliedContext.map(source => `${source.kind}:${source.ref}`));
  const hasAppliedEvidence = analysis.contextEvidence.some(
    evidence => applied.has(`${evidence.source.kind}:${evidence.source.ref}`)
  );
  if (hasAppliedEvidence && reasons.includes('requirements.needs_enrichment')) {
    reasons.push('context.resolvable_from_project');
  }
  return [...new Set(reasons)];
}

export function evaluateRouteDecision(analysis: AnalysisResult): PolicyEvaluationResult {
  return evaluateDecisionPolicy({
    reasons: policyReasons(analysis),
    scores: {
      observed: analysis.observed,
      effective: analysis.effective,
    },
    assumptionCount: analysis.assumptionCount,
  });
}

export function decideRoute(analysis: AnalysisResult): RouteDecision {
  const decision = evaluateRouteDecision(analysis);
  return { route: decision.route, action: decision.action };
}
