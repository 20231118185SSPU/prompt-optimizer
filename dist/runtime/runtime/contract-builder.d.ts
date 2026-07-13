// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AnalysisResult, SourceRef } from './analyzer';
import { DecisionRoute } from './decision-engine';
export interface AlignmentDecision {
    schemaVersion: '1.0.0';
    kind: 'alignment.decision';
    policyVersion: '1.0.0';
    requestId: string;
    decisionId: string;
    route: DecisionRoute;
    reasons: string[];
    scores: {
        observed: AnalysisResult['observed'];
        effective: AnalysisResult['effective'];
    };
    claims: Array<Record<string, unknown>>;
    missing: string[];
    scope: {
        include: string[];
        exclude: string[];
    };
    acceptance: Array<{
        id: string;
        criterion: string;
        method: {
            kind: 'command' | 'manual';
            value: string;
        };
    }>;
    appliedContext?: SourceRef[];
    presentation: {
        mode: AnalysisResult['presentationMode'];
        tier: 'A' | 'B' | 'C';
    };
    next: Record<string, unknown>;
    lifecyclePlan: {
        baseline: 'required' | 'not_required';
        completion: 'required' | 'not_observable';
        precipitation: 'on_signal';
    };
    host: {
        adapter: string;
        level: 'L2' | 'L3';
        enforcement: {
            ingress: 'enforced';
            block: 'enforced' | 'advisory';
            completion: 'self_reported' | 'unavailable';
        };
    };
}
export interface ContextContribution {
    statement: string;
    source: SourceRef;
}
export declare function buildAlignmentDecision(analysis: AnalysisResult, options?: {
    adapter?: string;
    nativeHook?: boolean;
    verificationCommands?: string[];
    contextContributions?: ContextContribution[];
}): AlignmentDecision;
//# sourceMappingURL=contract-builder.d.ts.map
