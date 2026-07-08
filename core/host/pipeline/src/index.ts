/**
 * Universal Align Pipeline
 *
 * Agent intent alignment for AI coding assistants.
 * Converts rough user ideas into executable, verifiable, precipitable task contracts.
 */

export const VERSION = '0.1.0';

export function hello(): string {
  return 'Align Pipeline initialized';
}

// Re-export pipeline components
export { classify, Classification } from './classifier';
export { route, Verdict, RoutingResult } from './router';
export { enrich, AlignContext, EnrichmentResult } from './enricher';
export { getVerificationCommands, runVerification, VerificationResult } from './verifier';
export { processInstruction, PipelineResult } from './pipeline';
