/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: classifier → router → enricher → verifier
 * Converts user instructions into aligned, verifiable task contracts.
 */

import { classify } from './classifier';
import { route, Verdict } from './router';
import { enrich, AlignContext } from './enricher';
import { getVerificationCommands, VerificationResult } from './verifier';

export interface PipelineResult {
  verdict: Verdict | 'BYPASS';
  instructions: string;
  enrichedMessage: string;
  context: AlignContext;
  verificationCommands: string[];
  verificationResults: VerificationResult['results'];
}

/**
 * Process a user instruction through the align pipeline.
 *
 * Steps:
 * 1. Check for bypass conditions ([直出] prefix or options.bypass)
 * 2. Classify signals in the instruction
 * 3. Route based on classification
 * 4. Enrich message with .align/ context
 * 5. Get verification commands
 */
export function processInstruction(
  instruction: string,
  projectDir: string,
  options: { bypass?: boolean } = {}
): PipelineResult {
  // Check for bypass
  if (options.bypass || instruction.startsWith('[直出]') || instruction.startsWith('直出')) {
    return {
      verdict: 'BYPASS',
      instructions: '[对齐] [直出] 模式，跳过路由。',
      enrichedMessage: instruction,
      context: { lessons: '', spec: '', context: '', decisions: '' },
      verificationCommands: [],
      verificationResults: []
    };
  }

  // Step 1: Classify signals
  const classification = classify(instruction);

  // Step 2: Route based on classification
  const { verdict, instructions } = route(classification);

  // Step 3: Enrich message with .align/ context
  const { enrichedMessage, context } = enrich(instruction, projectDir);

  // Step 4: Get verification commands
  const verificationCommands = getVerificationCommands(projectDir);

  return {
    verdict,
    instructions,
    enrichedMessage,
    context,
    verificationCommands,
    verificationResults: [] // Will be filled after execution
  };
}
