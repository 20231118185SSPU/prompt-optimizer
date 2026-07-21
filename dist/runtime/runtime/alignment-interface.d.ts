// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { ExecutionBrief } from './brief-engine';
import { AlignmentDecision } from './contract-builder';
import { ContextIssue, ResolvedContextEvidence } from './context-resolver';
import { HostProjection } from './host-projection';
import { AlignmentMode, AlignmentModelInput, DegradedReason, TaskRoute } from './task-route';
export interface AlignmentHostCapabilities {
    adapter?: string;
    nativeBlocking?: boolean;
}
export interface AlignmentInterfaceResult {
    mode: AlignmentMode;
    degradedReasons: DegradedReason[];
    taskRoute: TaskRoute;
    brief: ExecutionBrief;
    trace?: AlignmentTraceAppendix;
    handoff?: BriefHandoff;
    decision: AlignmentDecision;
    host: HostProjection;
}
export interface AlignmentInterfaceOptions {
    hostCapabilities?: AlignmentHostCapabilities;
    model?: AlignmentModelInput;
    directOutput?: boolean;
    includeTrace?: boolean;
    includeHandoff?: boolean;
}
export interface BriefHandoff {
    schemaVersion: '1.0.0';
    kind: 'alignment.brief-handoff';
    summaryHash: `sha256:${string}`;
    executionBrief: string;
}
export interface AlignmentTraceAppendix {
    schemaVersion: '1.0.0';
    kind: 'alignment.trace';
    taskRoute: TaskRoute;
    decision: {
        route: AlignmentDecision['route'];
        action: string;
        reasons: string[];
    };
    evidence: ResolvedContextEvidence[];
    contextIssues: ContextIssue[];
    totalEvidenceCharacters: number;
    markdown: string;
}
/**
 * Primary caller seam for the runtime. Context loading, acceptance planning,
 * and compatibility presentation stay behind this small interface.
 */
export declare function alignInstruction(instruction: string, projectDir: string, options?: AlignmentInterfaceOptions): AlignmentInterfaceResult;
//# sourceMappingURL=alignment-interface.d.ts.map
