// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { SourceRef } from './analyzer';
import { TaskRoute } from './task-route';
export type BriefField = 'objective' | 'context' | 'scope' | 'deliverables' | 'constraints' | 'execution' | 'acceptance';
export type EvidenceFreshness = 'current' | 'stale' | 'unknown';
export type ContextIssue = 'budget_exceeded' | 'source_outside_align' | 'source_too_large' | 'stale_evidence' | 'source_conflict' | 'policy_conflict';
export interface ResolvedContextEvidence {
    source: SourceRef;
    location: string;
    appliesTo: BriefField[];
    freshness: EvidenceFreshness;
    statement: string;
}
export interface ContextResolution {
    evidence: ResolvedContextEvidence[];
    issues: ContextIssue[];
    inspectedFiles: string[];
    totalCharacters: number;
}
export declare function resolveAlignmentContext(projectDir: string, instruction: string, route: TaskRoute, now?: Date): ContextResolution;
//# sourceMappingURL=context-resolver.d.ts.map
