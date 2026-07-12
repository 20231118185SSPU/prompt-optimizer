// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
export interface VerificationResult {
    commands: string[];
    results: {
        command: string;
        success: boolean;
        output: string;
    }[];
}
export declare function getVerificationCommands(projectDir: string): string[];
export declare function runVerification(projectDir: string): VerificationResult;
//# sourceMappingURL=verifier.d.ts.map
