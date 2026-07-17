import { AlignmentDecision } from './contract-builder';
import type { VerificationResult } from './verifier';

/** @internal Lifecycle state machine used by explicit host execution receipts. */
export type LifecycleState =
  | 'decided'
  | 'baseline_passed'
  | 'executing'
  | 'executed'
  | 'verified'
  | 'verification_failed'
  | 'verification_inconclusive';

export interface ExecutionReceipt {
  executionRef: string;
  status: 'completed' | 'failed' | 'cancelled';
}

export class LifecycleCoordinator {
  private state: LifecycleState = 'decided';

  constructor(readonly decision: AlignmentDecision) {}

  currentState(): LifecycleState {
    return this.state;
  }

  recordBaseline(passed: boolean): void {
    if (this.state !== 'decided') throw new Error(`baseline is invalid from ${this.state}`);
    if (!passed) throw new Error('lifecycle.baseline_failed');
    this.state = 'baseline_passed';
  }

  handoffExecution(): void {
    if (this.state !== 'baseline_passed') throw new Error(`execution handoff is invalid from ${this.state}`);
    this.state = 'executing';
  }

  recordExecution(status: 'completed' | 'failed' | 'cancelled'): void {
    this.recordExecutionReceipt({ executionRef: 'compatibility:execution', status });
  }

  recordExecutionReceipt(receipt: ExecutionReceipt): void {
    if (this.state !== 'executing') throw new Error(`execution receipt is invalid from ${this.state}`);
    if (receipt.status !== 'completed') throw new Error(`execution ${receipt.status}`);
    this.state = 'executed';
  }

  recordCompletion(verification: VerificationResult): 'verified' | 'verification_failed' | 'verification_inconclusive' {
    if (this.state !== 'executed') throw new Error('completion verification requires an execution receipt');
    const status = verification.results.length === 0
      ? 'verification_inconclusive'
      : verification.results.every(result => result.success)
        ? 'verified'
        : 'verification_failed';
    this.state = status;
    return status;
  }
}
