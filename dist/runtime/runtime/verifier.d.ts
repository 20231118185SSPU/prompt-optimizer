// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
/** @deprecated Importing the verifier is a compatibility path. The core pipeline only plans acceptance. */
export { getVerificationCommands } from './acceptance-plan';
export interface VerificationResult {
    commands: string[];
    results: {
        command: string;
        success: boolean;
        output: string;
    }[];
}
export interface VerificationLimits {
    commandTimeoutMs?: number;
    totalTimeoutMs?: number;
}
export declare function runVerificationCommands(projectDir: string, commands: string[], limits?: VerificationLimits): VerificationResult;
/** @deprecated Completion verification is only valid after an execution receipt. */
export declare function runVerification(projectDir: string): VerificationResult;
//# sourceMappingURL=verifier.d.ts.map
