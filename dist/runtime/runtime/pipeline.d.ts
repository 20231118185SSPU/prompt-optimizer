// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: context resolution → decision kernel → host projection.
 * Converts user instructions into aligned, verifiable task contracts.
 */
import { AlignContext } from './enricher';
import { AlignmentDecision } from './contract-builder';
import { CompatibilityVerdict, HostProjection } from './host-projection';
import { MattHandoff } from './matt-handoff';
export type PresentationMode = 'default' | 'direct_output';
export type PipelineEcosystem = 'matt-pocock-skills';
export interface PipelineOptions {
    bypass?: boolean;
    /**
     * @deprecated Use the explicit `align-cli matt` composition layer. This
     * compatibility option remains for the current minor migration window.
     */
    ecosystem?: PipelineEcosystem;
    hostCapabilities?: {
        adapter?: string;
        nativeBlocking?: boolean;
    };
}
/**
 * @deprecated Compatibility-shaped result. New callers should use
 * alignInstruction() for the Decision/host seam.
 */
export interface PipelineResult {
    verdict: CompatibilityVerdict;
    presentationMode: PresentationMode;
    instructions: string;
    enrichedMessage: string;
    context: AlignContext;
    verificationCommands: string[];
    alignmentDecision: AlignmentDecision;
    hostProjection: HostProjection;
    /** @deprecated Use the explicit `align-cli matt` composition layer. */
    handoff?: MattHandoff;
}
/**
 * Process a user instruction through the align pipeline.
 *
 * @deprecated This compatibility-shaped result exposes internal planning
 * details. New callers should use alignInstruction().
 *
 * Steps:
 * 1. Detect presentation preference without bypassing alignment
 * 2. Enrich message with .align/ context
 * 3. Produce one Alignment Decision
 * 4. Project that decision into host instructions and compatibility fields
 * 5. Return the completion verification plan without executing it
 */
export declare function processInstruction(instruction: string, projectDir: string, options?: PipelineOptions): PipelineResult;
//# sourceMappingURL=pipeline.d.ts.map
