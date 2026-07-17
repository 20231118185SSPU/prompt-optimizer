import { AlignmentDecision } from './contract-builder';
import { HostNextAction } from './host-projection';
import { processInstruction } from './pipeline';

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
export function alignInstruction(
  instruction: string,
  projectDir: string,
  options: { hostCapabilities?: AlignmentHostCapabilities } = {}
): AlignmentInterfaceResult {
  const result = processInstruction(instruction, projectDir, options);
  const projection = result.hostProjection;
  return {
    decision: result.alignmentDecision,
    host: {
      nextAction: projection.nextAction,
      shouldBlock: projection.shouldBlock,
      instructions: projection.instructions
    }
  };
}
