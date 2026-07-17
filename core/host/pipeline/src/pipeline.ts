/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: context resolution → decision kernel → host projection.
 * Converts user instructions into aligned, verifiable task contracts.
 */

import { enrich, AlignContext } from './enricher';
import { getVerificationCommands } from './acceptance-plan';
import { analyzeInstruction } from './analyzer';
import { AlignmentDecision, buildAlignmentDecision } from './contract-builder';
import { CompatibilityVerdict, HostProjection, projectAlignmentDecision } from './host-projection';
import { buildMattHandoff, discoverMattEnvironment, MattHandoff } from './matt-handoff';

export type PresentationMode = 'default' | 'direct_output';
export type PipelineEcosystem = 'matt-pocock-skills';

export interface PipelineOptions {
  bypass?: boolean;
  /**
   * @deprecated Use the explicit `align-cli matt` composition layer. This
   * compatibility option remains for the current minor migration window.
   */
  ecosystem?: PipelineEcosystem;
  hostCapabilities?: {
    adapter?: string;
    nativeBlocking?: boolean;
  };
}

/**
 * @deprecated Compatibility-shaped result. New callers should use
 * alignInstruction() for the Decision/host seam.
 */
export interface PipelineResult {
  verdict: CompatibilityVerdict;
  presentationMode: PresentationMode;
  instructions: string;
  enrichedMessage: string;
  context: AlignContext;
  verificationCommands: string[];
  alignmentDecision: AlignmentDecision;
  hostProjection: HostProjection;
  /** @deprecated Use the explicit `align-cli matt` composition layer. */
  handoff?: MattHandoff;
}

/**
 * Process a user instruction through the align pipeline.
 *
 * @deprecated This compatibility-shaped result exposes internal planning
 * details. New callers should use alignInstruction().
 *
 * Steps:
 * 1. Detect presentation preference without bypassing alignment
 * 2. Enrich message with .align/ context
 * 3. Produce one Alignment Decision
 * 4. Project that decision into host instructions and compatibility fields
 * 5. Return the completion verification plan without executing it
 */
export function processInstruction(
  instruction: string,
  projectDir: string,
  options: PipelineOptions = {}
): PipelineResult {
  const normalizedInstruction = instruction.trimStart();
  const presentationMode: PresentationMode =
    options.bypass || normalizedInstruction.startsWith('[直出]') || normalizedInstruction.startsWith('直出')
      ? 'direct_output'
      : 'default';

  // Step 1: Enrich message with .align/ context
  const { enrichedMessage, context } = enrich(instruction, projectDir);

  // Step 2: Build the completion verification plan. Execution happens only
  // after an execution receipt is registered by the lifecycle coordinator.
  const verificationCommands = getVerificationCommands(projectDir);
  const contextEntries = [
    ['lessons', context.lessons],
    ['spec', context.spec],
    ['facts', context.facts],
    ['glossary', context.glossary],
    ['state', context.state],
    ['context', context.context],
    ['decisions.log', context.decisions]
  ].filter(([, content]) => Boolean(content));
  if (verificationCommands.length > 0) {
    contextEntries.push(['check-commands', verificationCommands.join('\n')]);
  }
  const semanticContext = contextEntries.map(([name]) => ({
    kind: 'project' as const,
    ref: name === 'check-commands' ? '.align/check-commands.txt' : `.align/${name}.md`
  }));
  const contextText = [context.spec, context.facts, context.glossary, context.state, context.context]
    .filter(Boolean)
    .concat(verificationCommands)
    .join('\n');
  const analysis = analyzeInstruction(instruction, semanticContext, contextText);
  const alignmentDecision = buildAlignmentDecision(analysis, {
    verificationCommands,
    adapter: options.hostCapabilities?.adapter,
    nativeHook: options.hostCapabilities?.nativeBlocking
  });
  const hostProjection = projectAlignmentDecision(alignmentDecision);

  const result: PipelineResult = {
    verdict: hostProjection.verdict,
    presentationMode,
    instructions: hostProjection.instructions,
    enrichedMessage,
    context,
    verificationCommands,
    alignmentDecision,
    hostProjection
  };

  if (options.ecosystem === 'matt-pocock-skills') {
    result.handoff = buildMattHandoff(alignmentDecision, discoverMattEnvironment(projectDir));
  }

  return result;
}
