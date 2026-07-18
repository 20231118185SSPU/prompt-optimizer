// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
export type PolicyRoute = 'pass' | 'enrich' | 'clarify' | 'block';
export type PolicyAction = 'execute' | 'ask' | 'wait_confirmation' | 'stop';
export interface PolicyDimensionScores {
    d1: number;
    d2: number;
    d3: number;
    d4: number;
    d5: number;
    total: number;
}
export interface PolicyEvaluationInput {
    reasons: string[];
    scores: {
        observed: unknown;
        effective: unknown;
    };
    assumptionCount: number;
    safetyCritical?: boolean;
}
export interface PolicyEvaluationOptions {
    policy?: unknown;
    registry?: unknown;
    schema?: unknown;
}
export interface PolicyEvaluationResult {
    route: PolicyRoute;
    action: PolicyAction;
    reasons: string[];
    matchedRule: string | null;
    degraded: boolean;
}
export declare function evaluateDecisionPolicy(input: PolicyEvaluationInput, options?: PolicyEvaluationOptions): PolicyEvaluationResult;
//# sourceMappingURL=policy-evaluator.d.ts.map
