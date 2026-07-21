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
export {
  alignInstruction,
  AlignmentHostCapabilities,
  AlignmentInterfaceOptions,
  AlignmentInterfaceResult,
  AlignmentTraceAppendix,
  BriefHandoff
} from './alignment-interface';
export { BriefAcceptance, BriefSections, ExecutionBrief } from './brief-engine';
export {
  AlignmentMode,
  AlignmentModelInput,
  DegradedReason,
  TaskFamily,
  TaskRoute,
  TaskRouteRationale
} from './task-route';
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
export {
  probeHostFeasibility,
  FeasibilityStatus,
  HostFeasibilityOptions,
  HostFeasibilityReport
} from './host-feasibility';
export {
  activateClaudeSession,
  readClaudeSessionActivation,
  ClaudeSessionActivationOptions,
  ClaudeSessionActivationRecord,
  ClaudeSessionActivationResult
} from './session-activation';

// ── CLI Entry Point ──

// Import for CLI use
import { alignInstruction as alignForHost } from './alignment-interface';
import { writeContextProjection } from './context-projection';
import { completeReferenceHostRun, recordReferenceHostHandoff } from './reference-host';
import { createMattHandoff } from './matt-cli';
import { probeHostFeasibility as probeHost } from './host-feasibility';
import { activateClaudeSession, readClaudeSessionActivation } from './session-activation';

function claudeSessionStateHome(): string | undefined {
  return process.env.PROMPT_OPTIMIZER_STATE_HOME || undefined;
}

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
    const result = alignForHost(instruction, projectDir, {
      hostCapabilities: { adapter: 'codex' }
    });
    console.log(result.brief.markdown);
  },

  'cursor': (instruction, projectDir) => {
    const result = alignForHost(instruction, projectDir, {
      hostCapabilities: { adapter: 'cursor' }
    });
    console.log(result.brief.markdown);
  },

  'generic': (instruction, projectDir) => {
    const result = alignForHost(instruction, projectDir);
    console.log(result.brief.markdown);
  },

  'json': (instruction, projectDir) => {
    // Thin adapters may identify their host without creating a second route.
    const hostCapabilities = process.env.ALIGN_HOST_ADAPTER === 'codex'
      ? { adapter: 'codex' }
      : undefined;
    const result = alignForHost(instruction, projectDir, { hostCapabilities });
    console.error(`[alignment] route=${result.decision.route} reasons=${result.decision.reasons.join(',')}`);
    process.stdout.write(`${JSON.stringify(result.decision)}\n`);
  },

  'matt': (instruction, projectDir) => {
    const handoff = createMattHandoff(instruction, projectDir);
    console.error(`[alignment] route=${handoff.source.route} status=${handoff.status}`);
    process.stdout.write(`${JSON.stringify(handoff)}\n`);
  },

  'context-project': (instruction, projectDir) => {
    const result = writeContextProjection(projectDir, instruction === '--force');
    process.stdout.write(`${JSON.stringify(result)}\n`);
  },

  'probe': (instruction, projectDir) => {
    const requestedIngress = process.env.ALIGN_PROBE_INGRESS === 'hook' ? 'hook' : 'explicit';
    const result = probeHost(projectDir, {
      host: { name: instruction, version: process.env.ALIGN_HOST_VERSION },
      requestedIngress
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  },

  'claude-session': (instruction, projectDir) => {
    const sessionRef = process.env.ALIGN_SESSION_REF || '';
    const options = { stateHome: claudeSessionStateHome() };
    const result = instruction === 'activate'
      ? activateClaudeSession(projectDir, sessionRef, options)
      : instruction === 'status'
        ? readClaudeSessionActivation(projectDir, sessionRef, options)
        : { status: 'inactive' as const, reason: 'invalid_command' };
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
    console.error('  probe          Read-only host/project feasibility report; instruction is the host name');
    console.error('  claude-session  Read or activate hashed Claude session state; instruction is activate|status');
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
