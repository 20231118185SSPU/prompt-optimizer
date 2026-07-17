// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
/**
 * Internal compatibility surface for consumers that have not migrated to the
 * Alignment Decision interface. This module is intentionally outside the
 * package root export and may change or be removed at the next major.
 */
export { enrich, AlignContext, EnrichmentResult } from './enricher';
export { processInstruction, PipelineEcosystem, PipelineOptions, PipelineResult } from './pipeline';
export { getVerificationCommands, runVerification, runVerificationCommands, VerificationResult } from './verifier';
export { analyzeInstruction, AnalysisResult, DimensionScores, SourceRef } from './analyzer';
export { buildAlignmentDecision } from './contract-builder';
export { decideRoute, DecisionRoute, RouteDecision } from './decision-engine';
export { ExecutionReceipt, LifecycleCoordinator, LifecycleState } from './lifecycle';
export { completeReferenceHostRun, recordReferenceHostHandoff, ReferenceHostResult, ReferenceHostStatus } from './reference-host';
export { writeContextProjection, ProjectionResult } from './context-projection';
export { buildMattHandoff, discoverMattEnvironment, MATT_SKILLS, MattEnvironment, MattEnvironmentDiscoveryOptions, MattHandoff, MattSkill } from './matt-handoff';
export { generateCopilotRules, generateAiderRules, generateWindsurfRules } from './rules/generate';
//# sourceMappingURL=internal.d.ts.map
