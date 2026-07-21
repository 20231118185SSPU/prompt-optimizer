#!/usr/bin/env node
// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
/**
 * Universal Align Pipeline
 *
 * Agent intent alignment for AI coding assistants.
 * Converts rough user ideas into executable, verifiable, precipitable task contracts.
 */
export declare const VERSION = "3.2.0-rc.1";
/** @deprecated Use alignInstruction(...).decision. */
export { classify, Classification } from './classifier';
/** @deprecated Use alignInstruction(...).decision and .host. */
export { route, Verdict, RoutingResult } from './router';
export { alignInstruction, AlignmentHostCapabilities, AlignmentInterfaceOptions, AlignmentInterfaceResult, AlignmentTraceAppendix, BriefHandoff } from './alignment-interface';
export { BriefAcceptance, BriefSections, ExecutionBrief } from './brief-engine';
export { AlignmentMode, AlignmentModelInput, DegradedReason, TaskFamily, TaskRoute, TaskRouteRationale } from './task-route';
export { AlignmentDecision } from './contract-builder';
export { projectAlignmentDecision, CompatibilityVerdict, EnrichmentReceipt, EnrichmentReceiptItem, HostNextAction, HostProjection } from './host-projection';
export { writeContextProjection, ProjectionResult } from './context-projection';
export { probeHostFeasibility, FeasibilityStatus, HostFeasibilityOptions, HostFeasibilityReport } from './host-feasibility';
export { activateClaudeSession, readClaudeSessionActivation, ClaudeSessionActivationOptions, ClaudeSessionActivationRecord, ClaudeSessionActivationResult } from './session-activation';
//# sourceMappingURL=index.d.ts.map
