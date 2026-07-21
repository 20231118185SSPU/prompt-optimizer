/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: context resolution → decision kernel → host projection.
 * Converts user instructions into aligned, verifiable task contracts.
 */

import type { AlignContext } from './enricher';
import {
  alignInstruction,
  AlignmentInterfaceOptions,
  AlignmentTraceAppendix,
  BriefHandoff
} from './alignment-interface';
import { ExecutionBrief } from './brief-engine';
import { AlignmentDecision } from './contract-builder';
import { CompatibilityVerdict, HostProjection } from './host-projection';
import { buildMattHandoff, discoverMattEnvironment, MattHandoff } from './matt-handoff';
import { AlignmentMode, DegradedReason, TaskRoute } from './task-route';

export type PresentationMode = 'default' | 'direct_output';
export type PipelineEcosystem = 'matt-pocock-skills';

export interface PipelineOptions extends AlignmentInterfaceOptions {
  bypass?: boolean;
  /**
   * @deprecated Use the explicit `align-cli matt` composition layer. This
   * compatibility option remains for the current minor migration window.
   */
  ecosystem?: PipelineEcosystem;
}

/**
 * @deprecated Compatibility-shaped result. New callers should use
 * alignInstruction() for the Decision/host seam.
 */
export interface PipelineResult {
  mode: AlignmentMode;
  degradedReasons: DegradedReason[];
  taskRoute: TaskRoute;
  brief: ExecutionBrief;
  trace?: AlignmentTraceAppendix;
  briefHandoff?: BriefHandoff;
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
 * 1. Delegate to the canonical interface
 * 2. Project its bounded evidence into deprecated compatibility fields
 * 3. Return the completion verification plan without executing it
 */
export function processInstruction(
  instruction: string,
  projectDir: string,
  options: PipelineOptions = {}
): PipelineResult {
  const coreResult = alignInstruction(instruction, projectDir, {
    hostCapabilities: options.hostCapabilities,
    model: options.model,
    directOutput: options.directOutput || options.bypass,
    includeTrace: true,
    includeHandoff: options.includeHandoff
  });
  const alignmentDecision = coreResult.decision;
  const hostProjection = coreResult.host;
  const context: AlignContext = {
    lessons: '',
    spec: '',
    facts: '',
    glossary: '',
    state: '',
    context: '',
    decisions: ''
  };
  const contextFieldByRef: Record<string, keyof AlignContext> = {
    '.align/lessons.md': 'lessons',
    '.align/spec.md': 'spec',
    '.align/facts.md': 'facts',
    '.align/glossary.md': 'glossary',
    '.align/state.md': 'state',
    '.align/context.md': 'context',
    '.align/decisions.log.md': 'decisions'
  };
  for (const evidence of coreResult.trace?.evidence ?? []) {
    const field = contextFieldByRef[evidence.source.ref];
    if (field) context[field] = [context[field], evidence.statement].filter(Boolean).join('\n');
  }
  const verificationCommands = [...new Set((coreResult.trace?.evidence ?? [])
    .filter(item => item.source.ref === '.align/check-commands.txt')
    .map(item => item.statement))];

  const result: PipelineResult = {
    mode: coreResult.mode,
    degradedReasons: coreResult.degradedReasons,
    taskRoute: coreResult.taskRoute,
    brief: coreResult.brief,
    ...(options.includeTrace && coreResult.trace ? { trace: coreResult.trace } : {}),
    ...(coreResult.handoff ? { briefHandoff: coreResult.handoff } : {}),
    verdict: hostProjection.verdict,
    presentationMode: alignmentDecision.presentation.mode === 'direct_output' ? 'direct_output' : 'default',
    instructions: hostProjection.instructions,
    enrichedMessage: coreResult.brief.markdown,
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
