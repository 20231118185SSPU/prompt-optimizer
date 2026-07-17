// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AlignmentDecision } from './contract-builder';
import type { VerificationResult } from './verifier';
/** @internal Lifecycle state machine used by explicit host execution receipts. */
export type LifecycleState = 'decided' | 'baseline_passed' | 'executing' | 'executed' | 'verified' | 'verification_failed' | 'verification_inconclusive';
export interface ExecutionReceipt {
    executionRef: string;
    status: 'completed' | 'failed' | 'cancelled';
}
export declare class LifecycleCoordinator {
    readonly decision: AlignmentDecision;
    private state;
    constructor(decision: AlignmentDecision);
    currentState(): LifecycleState;
    recordBaseline(passed: boolean): void;
    handoffExecution(): void;
    recordExecution(status: 'completed' | 'failed' | 'cancelled'): void;
    recordExecutionReceipt(receipt: ExecutionReceipt): void;
    recordCompletion(verification: VerificationResult): 'verified' | 'verification_failed' | 'verification_inconclusive';
}
//# sourceMappingURL=lifecycle.d.ts.map
