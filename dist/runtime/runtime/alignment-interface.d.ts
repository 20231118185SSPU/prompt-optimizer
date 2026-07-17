// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
import { AlignmentDecision } from './contract-builder';
import { HostNextAction } from './host-projection';
export interface AlignmentHostCapabilities {
    adapter?: string;
    nativeBlocking?: boolean;
}
export interface AlignmentInterfaceResult {
    decision: AlignmentDecision;
    host: {
        nextAction: HostNextAction;
        shouldBlock: boolean;
        instructions: string;
    };
}
/**
 * Primary caller seam for the runtime. Context loading, acceptance planning,
 * and compatibility presentation stay behind this small interface.
 */
export declare function alignInstruction(instruction: string, projectDir: string, options?: {
    hostCapabilities?: AlignmentHostCapabilities;
}): AlignmentInterfaceResult;
//# sourceMappingURL=alignment-interface.d.ts.map
