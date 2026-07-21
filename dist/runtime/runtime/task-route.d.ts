// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
export declare const TASK_FAMILIES: readonly ["change", "inspect", "design", "produce", "operate"];
export declare const TASK_ROUTE_MISSING_FIELDS: readonly ["objective", "context", "scope", "deliverables", "constraints", "execution", "acceptance", "authorization", "recovery", "semantic_task_route"];
export type TaskFamily = typeof TASK_FAMILIES[number];
export type TaskRoutePrimary = TaskFamily | 'unknown';
export interface TaskRouteRationale {
    module: TaskFamily;
    reason: string;
}
export interface TaskRoute {
    schemaVersion: '1.0.0';
    primary: TaskRoutePrimary;
    secondary: TaskFamily[];
    rationale: TaskRouteRationale[];
    confidence: number;
    missing: string[];
}
export type AlignmentModelInput = {
    status: 'available';
    output: unknown;
} | {
    status: 'unavailable';
} | {
    status: 'timeout';
};
export type AlignmentMode = 'full' | 'degraded';
export type DegradedReason = 'model_unavailable' | 'model_timeout' | 'model_output_invalid' | 'model_semantic_conflict' | 'context_budget_exceeded' | 'context_source_invalid' | 'context_stale' | 'context_conflict' | 'privacy_redaction_required';
export interface TaskRouteResolution {
    mode: AlignmentMode;
    degradedReasons: DegradedReason[];
    taskRoute: TaskRoute;
}
export declare function isTaskRoute(value: unknown): value is TaskRoute;
export declare function resolveTaskRoute(model: AlignmentModelInput | undefined): TaskRouteResolution;
//# sourceMappingURL=task-route.d.ts.map
