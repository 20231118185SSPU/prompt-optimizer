// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AlignmentDecision } from './contract-builder';
import { CompatibilityVerdict } from './host-projection';
export type Verdict = CompatibilityVerdict;
export interface RoutingResult {
    verdict: Verdict;
    instructions: string;
}
/**
 * Compatibility projection for consumers of the former router API.
 * The Alignment Decision is the only route source; classifier signals are not accepted here.
 */
export declare function route(decision: AlignmentDecision): RoutingResult;
//# sourceMappingURL=router.d.ts.map
