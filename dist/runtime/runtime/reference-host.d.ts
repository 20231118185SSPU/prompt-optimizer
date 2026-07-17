// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AlignmentDecision } from './contract-builder';
type PendingPhase = 'ready_for_baseline' | 'ready_for_handoff' | 'baseline_failed' | 'baseline_incomplete' | 'handoff_issued' | 'receipt_recorded' | 'execution_failed' | 'execution_cancelled';
type TerminalPhase = 'verified' | 'verification_failed' | 'verification_inconclusive';
export interface ExecutionReceiptArtifact {
    schemaVersion: '1.0.0';
    requestId: string;
    decisionId: string;
    runId: string;
    revision: number;
    kind: 'alignment.execution-receipt';
    phase: 'execution';
    handoffId: string;
    status: 'completed' | 'failed' | 'cancelled';
    executionRef: string;
}
interface CompletionCheck {
    acceptanceId: string;
    status: 'passed' | 'failed' | 'not_observed';
    evidenceRefs: Array<{
        kind: 'local' | 'artifact' | 'command' | 'manual' | 'external';
        ref: string;
    }>;
}
export interface CompletionReportArtifact {
    schemaVersion: '1.0.0';
    requestId: string;
    decisionId: string;
    runId: string;
    revision: number;
    kind: 'alignment.completion-report';
    phase: 'completion';
    executionRef: string;
    status: TerminalPhase;
    reasons: string[];
    checks: CompletionCheck[];
}
export type ReferenceHostStatus = PendingPhase | TerminalPhase | 'not_executable' | 'not_observable' | 'invalid_transition';
export interface ReferenceHostTransitionToken {
    runId: string;
    expectedRevision: number;
}
export interface ReferenceHostResult {
    status: ReferenceHostStatus;
    evidenceCount?: number;
    artifactRef?: string;
    transition?: ReferenceHostTransitionToken;
}
export interface ReferenceHostExecutionObservation {
    kind: 'claude-code.stop';
}
export declare function prepareReferenceHostBaseline(projectDir: string, requestText: string, decision: AlignmentDecision, sessionRef?: string): ReferenceHostResult;
export declare function checkReferenceHostBaseline(projectDir: string, decision: AlignmentDecision, transition: ReferenceHostTransitionToken, sessionRef?: string): ReferenceHostResult;
export declare function issueReferenceHostHandoff(projectDir: string, decision: AlignmentDecision, transition: ReferenceHostTransitionToken, sessionRef?: string): ReferenceHostResult;
/**
 * Record the Claude UserPromptSubmit decision and issue an execution handoff.
 * Public lifecycle artifacts stay separate from the redacted audit log.
 */
export declare function recordReferenceHostHandoff(projectDir: string, requestText: string, decision: AlignmentDecision, sessionRef?: string): ReferenceHostResult;
/** Persist an explicit, schema-valid execution receipt for an issued handoff. */
export declare function reportExecution(projectDir: string, receipt: ExecutionReceiptArtifact, transition: ReferenceHostTransitionToken, sessionRef?: string): ReferenceHostResult;
/** Run acceptance only after a completed receipt has been durably registered. */
export declare function completionVerify(projectDir: string, transition: ReferenceHostTransitionToken, sessionRef?: string): ReferenceHostResult;
/**
 * Convenience seam for a normal Claude Stop observation. A missing observation
 * is not an execution receipt and therefore cannot trigger completion checks.
 */
export declare function completeReferenceHostRun(projectDir: string, observation?: ReferenceHostExecutionObservation, sessionRef?: string): ReferenceHostResult;
export {};
//# sourceMappingURL=reference-host.d.ts.map
