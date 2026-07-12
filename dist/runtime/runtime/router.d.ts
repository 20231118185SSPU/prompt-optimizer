// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { Classification } from './classifier';
export type Verdict = 'HIGH' | 'VAGUE' | 'GRAY' | 'CLEAR';
export interface RoutingResult {
    verdict: Verdict;
    instructions: string;
}
export declare function route(classification: Classification): RoutingResult;
//# sourceMappingURL=router.d.ts.map
