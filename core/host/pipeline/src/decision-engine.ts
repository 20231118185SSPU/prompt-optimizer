import { AnalysisResult } from './analyzer';

export type DecisionRoute = 'pass' | 'enrich' | 'clarify' | 'block';

export interface RouteDecision {
  route: DecisionRoute;
  action: 'execute' | 'ask' | 'wait_confirmation' | 'stop';
}

export function decideRoute(analysis: AnalysisResult): RouteDecision {
  const reasons = new Set(analysis.reasons);
  if (reasons.has('policy.operation_prohibited')) return { route: 'block', action: 'stop' };
  if (
    analysis.effective.total < 6 ||
    Math.min(analysis.effective.d1, analysis.effective.d2, analysis.effective.d3, analysis.effective.d4, analysis.effective.d5) < 1 ||
    analysis.assumptionCount > 2 ||
    ['intent.ambiguous_goal', 'scope.impact_unknown', 'scope.too_broad'].some(reason => reasons.has(reason))
  ) {
    return { route: 'clarify', action: 'ask' };
  }
  if (reasons.has('authorization.confirmation_missing')) return { route: 'block', action: 'wait_confirmation' };
  if (
    [...reasons].some(reason => reason.startsWith('risk.')) ||
    reasons.has('context.resolvable_from_project') ||
    reasons.has('requirements.needs_enrichment') ||
    analysis.observed.total < 8
  ) {
    return { route: 'enrich', action: 'execute' };
  }
  return { route: 'pass', action: 'execute' };
}
