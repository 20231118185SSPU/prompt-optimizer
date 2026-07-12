// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AlignmentDecision } from './contract-builder';
export type CompatibilityVerdict = 'HIGH' | 'VAGUE' | 'GRAY' | 'CLEAR';
export type HostNextAction = 'execute' | 'ask' | 'wait_confirmation' | 'stop';
export interface HostProjection {
    verdict: CompatibilityVerdict;
    instructions: string;
    nextAction: HostNextAction;
    shouldBlock: boolean;
}
export declare function projectAlignmentDecision(decision: AlignmentDecision): HostProjection;
//# sourceMappingURL=host-projection.d.ts.map
