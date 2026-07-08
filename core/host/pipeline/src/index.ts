#!/usr/bin/env node

/**
 * Universal Align Pipeline
 *
 * Agent intent alignment for AI coding assistants.
 * Converts rough user ideas into executable, verifiable, precipitable task contracts.
 */

export const VERSION = '0.1.0';

// Re-export pipeline components
export { classify, Classification } from './classifier';
export { route, Verdict, RoutingResult } from './router';
export { enrich, AlignContext, EnrichmentResult } from './enricher';
export { getVerificationCommands, runVerification, VerificationResult } from './verifier';
export { processInstruction, PipelineResult } from './pipeline';
export { generateCopilotRules, generateAiderRules, generateWindsurfRules } from './rules/generate';

// ── CLI Entry Point ──

// Import for CLI use
import { processInstruction } from './pipeline';

// Tool-specific output modes
const toolModes: Record<string, (instruction: string, projectDir: string) => void> = {
  'claude-code': (instruction, projectDir) => {
    // Claude Code hook mode: output hook-compatible format
    const result = processInstruction(instruction, projectDir);
    console.log(result.instructions);

    // Exit with code 2 on HIGH verdict if BLOCK_ON_HIGH is enabled
    if (result.verdict === 'HIGH' && process.env.BLOCK_ON_HIGH === 'on') {
      process.exit(2);
    }
  },

  'codex': (instruction, projectDir) => {
    // Codex CLI wrapper mode: inject alignment context
    const result = processInstruction(instruction, projectDir);
    console.log('=== Alignment Context ===');
    console.log(result.instructions);
    console.log('');
    console.log('=== Original Instruction ===');
    console.log(result.enrichedMessage);
  },

  'cursor': (instruction, projectDir) => {
    // Cursor CLI wrapper mode: inject alignment context
    const result = processInstruction(instruction, projectDir);
    console.log('=== Alignment Context ===');
    console.log(result.instructions);
    console.log('');
    console.log('=== Original Instruction ===');
    console.log(result.enrichedMessage);
  },

  'generic': (instruction, projectDir) => {
    // Generic mode: output full alignment result
    const result = processInstruction(instruction, projectDir);
    console.log('=== Alignment Pipeline Result ===');
    console.log(`Verdict: ${result.verdict}`);
    console.log('');
    console.log('Instructions:');
    console.log(result.instructions);
    console.log('');
    console.log('Enriched Message:');
    console.log(result.enrichedMessage);

    if (result.verificationCommands.length > 0) {
      console.log('');
      console.log('Verification Commands:');
      result.verificationCommands.forEach(cmd => console.log(`  - ${cmd}`));
    }
  }
};

// Only run CLI when executed directly (not when imported as module)
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: align-cli <tool> <instruction> [--project-dir <dir>]');
    console.error('');
    console.error('Tools:');
    console.error('  claude-code    Claude Code (hook mode)');
    console.error('  codex          Codex (CLI wrapper)');
    console.error('  cursor         Cursor (CLI wrapper)');
    console.error('  generic        Generic tool (CLI wrapper)');
    process.exit(1);
  }

  const tool = args[0];
  const instruction = args[1];

  // Parse --project-dir with validation
  let projectDir = process.cwd();
  const projectDirIndex = args.indexOf('--project-dir');
  if (projectDirIndex !== -1) {
    if (projectDirIndex + 1 >= args.length) {
      console.error('Error: --project-dir requires a value');
      process.exit(1);
    }
    projectDir = args[projectDirIndex + 1];
  }

  // Tool-specific modes
  if (toolModes[tool]) {
    toolModes[tool](instruction, projectDir);
  } else {
    console.error(`Unknown tool: ${tool}`);
    console.error('Supported tools: ' + Object.keys(toolModes).join(', '));
    process.exit(1);
  }
}
