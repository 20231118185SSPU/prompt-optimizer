// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LifecycleCoordinator = void 0;
class LifecycleCoordinator {
    constructor(decision) {
        this.decision = decision;
        this.state = 'decided';
    }
    currentState() {
        return this.state;
    }
    recordBaseline(passed) {
        if (this.state !== 'decided')
            throw new Error(`baseline is invalid from ${this.state}`);
        if (!passed)
            throw new Error('lifecycle.baseline_failed');
        this.state = 'baseline_passed';
    }
    handoffExecution() {
        if (this.state !== 'baseline_passed')
            throw new Error(`execution handoff is invalid from ${this.state}`);
        this.state = 'executing';
    }
    recordExecution(status) {
        if (this.state !== 'executing')
            throw new Error(`execution receipt is invalid from ${this.state}`);
        if (status !== 'completed')
            throw new Error(`execution ${status}`);
        this.state = 'executed';
    }
    recordCompletion(verification) {
        if (this.state !== 'executed')
            throw new Error('completion verification requires an execution receipt');
        const status = verification.results.every(result => result.success) ? 'verified' : 'verification_failed';
        this.state = status;
        return status;
    }
}
exports.LifecycleCoordinator = LifecycleCoordinator;
//# sourceMappingURL=lifecycle.js.map
