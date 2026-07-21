import { alignInstruction } from './alignment-interface';
import {
  buildMattHandoff,
  discoverMattEnvironment,
  MattHandoff
} from './matt-handoff';

/**
 * Compose the optional Matt Pocock Skills envelope outside the core pipeline.
 * The Alignment Decision is computed first and remains the only route source.
 */
export function createMattHandoff(instruction: string, projectDir: string): MattHandoff {
  const result = alignInstruction(instruction, projectDir);
  return buildMattHandoff(result.decision, discoverMattEnvironment(projectDir));
}
