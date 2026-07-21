// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AlignmentDecision } from './contract-builder';
import { ContextResolution } from './context-resolver';
import { AlignmentMode, TaskRoute } from './task-route';
export interface BriefAcceptance {
    criterion: string;
    method: {
        kind: 'command' | 'metric' | 'checklist' | 'manual';
        value: string;
    };
}
export interface BriefSections {
    objective: string;
    context: string[];
    scope: {
        include: string[];
        exclude: string[];
    };
    deliverables: string[];
    constraints: string[];
    execution: string[];
    acceptance: BriefAcceptance[];
}
export interface ExecutionBrief extends BriefSections {
    schemaVersion: '1.0.0';
    kind: 'alignment.execution-brief';
    mode: AlignmentMode;
    taskRoute: TaskRoute;
    decision: {
        route: AlignmentDecision['route'];
        action: string;
    };
    markdown: string;
}
export interface BriefBuildResult {
    brief: ExecutionBrief;
    modelBriefValid: boolean;
    modelBriefStatus: 'valid' | 'invalid' | 'semantic_conflict';
    privacyRedacted: boolean;
}
export declare function buildExecutionBrief(instruction: string, modelOutput: unknown, mode: AlignmentMode, taskRoute: TaskRoute, decision: AlignmentDecision, context: ContextResolution): BriefBuildResult;
//# sourceMappingURL=brief-engine.d.ts.map
