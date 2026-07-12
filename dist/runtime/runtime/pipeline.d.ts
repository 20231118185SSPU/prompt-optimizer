// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: classifier → router → enricher → verifier
 * Converts user instructions into aligned, verifiable task contracts.
 */
import { Verdict } from './router';
import { AlignContext } from './enricher';
import { AlignmentDecision } from './contract-builder';
import { MattHandoff } from './matt-handoff';
export type PresentationMode = 'default' | 'direct_output';
export type PipelineEcosystem = 'matt-pocock-skills';
export interface PipelineOptions {
    bypass?: boolean;
    ecosystem?: PipelineEcosystem;
}
export interface PipelineResult {
    verdict: Verdict;
    presentationMode: PresentationMode;
    instructions: string;
    enrichedMessage: string;
    context: AlignContext;
    verificationCommands: string[];
    alignmentDecision: AlignmentDecision;
    handoff?: MattHandoff;
}
/**
 * Process a user instruction through the align pipeline.
 *
 * Steps:
 * 1. Detect presentation preference without bypassing alignment
 * 2. Classify signals in the instruction
 * 3. Route based on classification
 * 4. Enrich message with .align/ context
 * 5. Return the completion verification plan without executing it
 */
export declare function processInstruction(instruction: string, projectDir: string, options?: PipelineOptions): PipelineResult;
//# sourceMappingURL=pipeline.d.ts.map
