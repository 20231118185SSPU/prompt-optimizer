import { AlignmentDecision } from './contract-builder';
import { CompatibilityVerdict, projectAlignmentDecision } from './host-projection';

export type Verdict = CompatibilityVerdict;

export interface RoutingResult {
  verdict: Verdict;
  instructions: string;
}

/**
 * Compatibility projection for consumers of the former router API.
 * The Alignment Decision is the only route source; classifier signals are not accepted here.
 */
export function route(decision: AlignmentDecision): RoutingResult {
  const projection = projectAlignmentDecision(decision);
  return {
    verdict: projection.verdict,
    instructions: projection.instructions
  };
}
