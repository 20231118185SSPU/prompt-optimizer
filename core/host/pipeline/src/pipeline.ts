/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: classifier → router → enricher → verifier
 * Converts user instructions into aligned, verifiable task contracts.
 */

import { classify } from './classifier';
import { route, Verdict } from './router';
import { enrich, AlignContext } from './enricher';
import { getVerificationCommands } from './verifier';
import { analyzeInstruction } from './analyzer';
import { AlignmentDecision, buildAlignmentDecision } from './contract-builder';
import { buildMattHandoff, discoverMattEnvironment, MattHandoff } from './matt-handoff';

export type PresentationMode = 'default' | 'direct_output';
export type PipelineEcosystem = 'matt-pocock-skills';

export interface PipelineOptions {
  bypass?: boolean;
  ecosystem?: PipelineEcosystem;
}

export interface PipelineResult {
  verdict: Verdict;
  presentationMode: PresentationMode;
  instructions: string;
  enrichedMessage: string;
  context: AlignContext;
  verificationCommands: string[];
  alignmentDecision: AlignmentDecision;
  handoff?: MattHandoff;
}

/**
 * Process a user instruction through the align pipeline.
 *
 * Steps:
 * 1. Detect presentation preference without bypassing alignment
 * 2. Classify signals in the instruction
 * 3. Route based on classification
 * 4. Enrich message with .align/ context
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

  // Step 1: Classify signals
  const classification = classify(instruction);

  // Step 2: Route based on classification
  const { verdict, instructions } = route(classification);

  // Step 3: Enrich message with .align/ context
  const { enrichedMessage, context } = enrich(instruction, projectDir);

  // Step 4: Build the completion verification plan. Execution happens only
  // after an execution receipt is registered by the lifecycle coordinator.
  const verificationCommands = getVerificationCommands(projectDir);
  const appliedContext = context.spec || context.facts || context.glossary || context.state || context.context || context.lessons || context.decisions
    ? [{ kind: 'project' as const, ref: '.align/' }]
    : [];
  const contextText = [context.spec, context.facts, context.glossary, context.state, context.context]
    .filter(Boolean)
    .join('\n');
  const analysis = analyzeInstruction(instruction, appliedContext, contextText);
  const alignmentDecision = buildAlignmentDecision(analysis, { verificationCommands });

  const result: PipelineResult = {
    verdict,
    presentationMode,
    instructions,
    enrichedMessage,
    context,
    verificationCommands,
    alignmentDecision
  };

  if (options.ecosystem === 'matt-pocock-skills') {
    result.handoff = buildMattHandoff(alignmentDecision, discoverMattEnvironment(projectDir));
  }

  return result;
}
