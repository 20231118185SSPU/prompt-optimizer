#!/usr/bin/env node

/**
 * Universal Align Pipeline
 *
 * Agent intent alignment for AI coding assistants.
 * Converts rough user ideas into executable, verifiable, precipitable task contracts.
 */

export const VERSION = '3.2.0-rc.1';

// Public seam: callers consume the Alignment Decision and host projection.
// The remaining compatibility exports are intentionally kept narrow while
// older consumers migrate to alignInstruction(...).
/** @deprecated Use alignInstruction(...).decision. */
export { classify, Classification } from './classifier';
/** @deprecated Use alignInstruction(...).decision and .host. */
export { route, Verdict, RoutingResult } from './router';
export { alignInstruction, AlignmentHostCapabilities, AlignmentInterfaceResult } from './alignment-interface';
export { AlignmentDecision } from './contract-builder';
export {
  projectAlignmentDecision,
  CompatibilityVerdict,
  EnrichmentReceipt,
  EnrichmentReceiptItem,
  HostNextAction,
  HostProjection
} from './host-projection';
// Legacy context projection remains an explicit CLI compatibility capability.
export { writeContextProjection, ProjectionResult } from './context-projection';

// ── CLI Entry Point ──

// Import for CLI use
import { processInstruction } from './pipeline';
import { alignInstruction as alignForHost } from './alignment-interface';
import { writeContextProjection } from './context-projection';
import { completeReferenceHostRun, recordReferenceHostHandoff } from './reference-host';
import { createMattHandoff } from './matt-cli';

// Tool-specific output modes
const toolModes: Record<string, (instruction: string, projectDir: string) => void> = {
  'claude-code': (instruction, projectDir) => {
    // Claude Code hook mode: output hook-compatible format
    const result = alignForHost(instruction, projectDir, {
      hostCapabilities: {
        adapter: 'claude-code',
        nativeBlocking: process.env.BLOCK_ON_HIGH === 'on'
      }
    });
    const lifecycleInvocation = Object.prototype.hasOwnProperty.call(process.env, 'ALIGN_SESSION_REF');
    const sessionRef = process.env.ALIGN_SESSION_REF || undefined;
    const executable = result.decision.route === 'pass' || result.decision.route === 'enrich';
    let lifecycleStatus = 'not_observable';
    if (sessionRef) {
      try {
        lifecycleStatus = recordReferenceHostHandoff(projectDir, instruction, result.decision, sessionRef).status;
      } catch {
        lifecycleStatus = 'baseline_incomplete';
      }
    }
    if (executable && lifecycleInvocation && lifecycleStatus !== 'handoff_issued') {
      console.error(`[对齐] baseline=${lifecycleStatus}。未签发 execution handoff，已阻断执行。`);
      process.exit(2);
    }
    console.log(result.host.instructions);

    if (result.host.shouldBlock) {
      process.exit(2);
    }
  },

  'claude-stop': (_instruction, projectDir) => {
    const sessionRef = process.env.ALIGN_SESSION_REF || undefined;
    const lifecycle = sessionRef
      ? completeReferenceHostRun(projectDir, { kind: 'claude-code.stop' }, sessionRef)
      : { status: 'not_observable' as const };
    console.log(
      `[对齐] execution receipt/completion status=${lifecycle.status} ` +
      'failed/cancelled=enforcement_unavailable'
    );
  },

  'codex': (instruction, projectDir) => {
    // Codex CLI wrapper mode: inject alignment context
    const result = processInstruction(instruction, projectDir, {
      hostCapabilities: { adapter: 'codex' }
    });
    console.log('=== Alignment Context ===');
    console.log(result.instructions);
    console.log('');
    console.log('=== Original Instruction ===');
    console.log(result.enrichedMessage);
  },

  'cursor': (instruction, projectDir) => {
    // Cursor CLI wrapper mode: inject alignment context
    const result = processInstruction(instruction, projectDir, {
      hostCapabilities: { adapter: 'cursor' }
    });
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
  },

  'json': (instruction, projectDir) => {
    // Thin adapters may identify their host without creating a second route.
    const hostCapabilities = process.env.ALIGN_HOST_ADAPTER === 'codex'
      ? { adapter: 'codex' }
      : undefined;
    const result = processInstruction(instruction, projectDir, { hostCapabilities });
    console.error(`[alignment] route=${result.alignmentDecision.route} reasons=${result.alignmentDecision.reasons.join(',')}`);
    process.stdout.write(`${JSON.stringify(result.alignmentDecision)}\n`);
  },

  'matt': (instruction, projectDir) => {
    const handoff = createMattHandoff(instruction, projectDir);
    console.error(`[alignment] route=${handoff.source.route} status=${handoff.status}`);
    process.stdout.write(`${JSON.stringify(handoff)}\n`);
  },

  'context-project': (instruction, projectDir) => {
    const result = writeContextProjection(projectDir, instruction === '--force');
    process.stdout.write(`${JSON.stringify(result)}\n`);
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
    console.error('  json           Alignment Decision JSON on stdout; disclosure on stderr');
    console.error('  matt           Matt Pocock Skills handoff JSON on stdout; route/status on stderr');
    console.error('  context-project  Generate legacy context.md from classified SSOT; instruction may be --force');
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
