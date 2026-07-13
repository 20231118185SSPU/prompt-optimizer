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
export { classify, Classification } from './classifier';
export { route, Verdict, RoutingResult } from './router';
export { enrich, AlignContext, EnrichmentResult } from './enricher';
export { getVerificationCommands, runVerification, VerificationResult } from './verifier';
export { processInstruction, PipelineEcosystem, PipelineOptions, PipelineResult } from './pipeline';
export { analyzeInstruction, AnalysisResult, DimensionScores, SourceRef } from './analyzer';
export { decideRoute, DecisionRoute, RouteDecision } from './decision-engine';
export { buildAlignmentDecision, AlignmentDecision } from './contract-builder';
export { projectAlignmentDecision, CompatibilityVerdict, EnrichmentReceipt, EnrichmentReceiptItem, HostNextAction, HostProjection } from './host-projection';
export { LifecycleCoordinator, LifecycleState } from './lifecycle';
export { writeContextProjection, ProjectionResult } from './context-projection';
export { buildMattHandoff, discoverMattEnvironment, MATT_SKILLS, MattEnvironment, MattEnvironmentDiscoveryOptions, MattHandoff, MattSkill } from './matt-handoff';
export { generateCopilotRules, generateAiderRules, generateWindsurfRules } from './rules/generate';
//# sourceMappingURL=index.d.ts.map
