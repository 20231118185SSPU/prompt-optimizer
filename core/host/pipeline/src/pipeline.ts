/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: classifier → router → enricher → verifier
 * Converts user instructions into aligned, verifiable task contracts.
 */

import { enrich, AlignContext } from './enricher';
import { getVerificationCommands } from './verifier';
import { analyzeInstruction } from './analyzer';
import { AlignmentDecision, buildAlignmentDecision, ContextContribution } from './contract-builder';
import {
  CompatibilityVerdict,
  HostProjection,
  projectAlignmentDecision,
  projectEnrichmentUndo
} from './host-projection';
import { buildMattHandoff, discoverMattEnvironment, MattHandoff } from './matt-handoff';

export type PresentationMode = 'default' | 'direct_output';
export type PipelineEcosystem = 'matt-pocock-skills';

export interface PipelineOptions {
  bypass?: boolean;
  ecosystem?: PipelineEcosystem;
  hostCapabilities?: {
    adapter?: string;
    nativeBlocking?: boolean;
  };
}

export interface PipelineResult {
  verdict: CompatibilityVerdict;
  presentationMode: PresentationMode;
  instructions: string;
  enrichedMessage: string;
  context: AlignContext;
  verificationCommands: string[];
  alignmentDecision: AlignmentDecision;
  hostProjection: HostProjection;
  handoff?: MattHandoff;
}

function contextExcerpt(content: string): string {
  const line = content
    .split(/\r?\n/)
    .map(item => item.trim())
    .find(item => item && !item.startsWith('#') && !item.startsWith('<!--') && !item.startsWith('```'));
  return (line ?? content.trim()).replace(/^-\s+/, '').slice(0, 240);
}

/**
 * Process a user instruction through the align pipeline.
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
  const semanticContext = contextEntries.map(([name]) => ({
    kind: 'project' as const,
    ref: `.align/${name}.md`
  }));
  const contextContributions: ContextContribution[] = contextEntries.map(([name, content]) => ({
    statement: contextExcerpt(content),
    source: { kind: 'project', ref: `.align/${name}.md` }
  }));
  const contextText = [context.spec, context.facts, context.glossary, context.state, context.context]
    .filter(Boolean)
    .join('\n');
  const analysis = analyzeInstruction(instruction, semanticContext, contextText);
  const alignmentDecision = buildAlignmentDecision(analysis, {
    verificationCommands,
    contextContributions,
    adapter: options.hostCapabilities?.adapter,
    nativeHook: options.hostCapabilities?.nativeBlocking
  });
  const hostProjection = analysis.enrichmentUndoIds.length > 0
    ? projectEnrichmentUndo(alignmentDecision, analysis.enrichmentUndoIds)
    : projectAlignmentDecision(alignmentDecision);

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
