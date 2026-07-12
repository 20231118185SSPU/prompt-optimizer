// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AlignmentDecision } from './contract-builder';
import { VerificationResult } from './verifier';
export type LifecycleState = 'decided' | 'baseline_passed' | 'executing' | 'executed' | 'verified' | 'verification_failed';
export declare class LifecycleCoordinator {
    readonly decision: AlignmentDecision;
    private state;
    constructor(decision: AlignmentDecision);
    currentState(): LifecycleState;
    recordBaseline(passed: boolean): void;
    handoffExecution(): void;
    recordExecution(status: 'completed' | 'failed' | 'cancelled'): void;
    recordCompletion(verification: VerificationResult): 'verified' | 'verification_failed';
}
//# sourceMappingURL=lifecycle.d.ts.map
