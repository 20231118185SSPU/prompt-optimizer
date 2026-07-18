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
 * @deprecated Compatibility projection for consumers of the former router
 * API. The Alignment Decision is the only route source; prefer alignInstruction().
 */
export declare function route(decision: AlignmentDecision): RoutingResult;
//# sourceMappingURL=router.d.ts.map
