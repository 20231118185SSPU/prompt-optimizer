// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AnalysisResult } from './analyzer';
import { PolicyEvaluationResult } from './policy-evaluator';
export type DecisionRoute = 'pass' | 'enrich' | 'clarify' | 'block';
export interface RouteDecision {
    route: DecisionRoute;
    action: 'execute' | 'ask' | 'wait_confirmation' | 'stop';
}
export declare function evaluateRouteDecision(analysis: AnalysisResult): PolicyEvaluationResult;
export declare function decideRoute(analysis: AnalysisResult): RouteDecision;
//# sourceMappingURL=decision-engine.d.ts.map
