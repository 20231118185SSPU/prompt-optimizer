#!/usr/bin/env node
// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
/**
 * Universal Align Pipeline
 *
 * Agent intent alignment for AI coding assistants.
 * Converts rough user ideas into executable, verifiable, precipitable task contracts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.readClaudeSessionActivation = exports.activateClaudeSession = exports.probeHostFeasibility = exports.writeContextProjection = exports.projectAlignmentDecision = exports.alignInstruction = exports.route = exports.classify = exports.VERSION = void 0;
exports.VERSION = '3.2.0-rc.1';
// Public seam: callers consume the Alignment Decision and host projection.
// The remaining compatibility exports are intentionally kept narrow while
// older consumers migrate to alignInstruction(...).
/** @deprecated Use alignInstruction(...).decision. */
var classifier_1 = require("./classifier");
Object.defineProperty(exports, "classify", { enumerable: true, get: function () { return classifier_1.classify; } });
/** @deprecated Use alignInstruction(...).decision and .host. */
var router_1 = require("./router");
Object.defineProperty(exports, "route", { enumerable: true, get: function () { return router_1.route; } });
var alignment_interface_1 = require("./alignment-interface");
Object.defineProperty(exports, "alignInstruction", { enumerable: true, get: function () { return alignment_interface_1.alignInstruction; } });
var host_projection_1 = require("./host-projection");
Object.defineProperty(exports, "projectAlignmentDecision", { enumerable: true, get: function () { return host_projection_1.projectAlignmentDecision; } });
// Legacy context projection remains an explicit CLI compatibility capability.
var context_projection_1 = require("./context-projection");
Object.defineProperty(exports, "writeContextProjection", { enumerable: true, get: function () { return context_projection_1.writeContextProjection; } });
var host_feasibility_1 = require("./host-feasibility");
Object.defineProperty(exports, "probeHostFeasibility", { enumerable: true, get: function () { return host_feasibility_1.probeHostFeasibility; } });
var session_activation_1 = require("./session-activation");
Object.defineProperty(exports, "activateClaudeSession", { enumerable: true, get: function () { return session_activation_1.activateClaudeSession; } });
Object.defineProperty(exports, "readClaudeSessionActivation", { enumerable: true, get: function () { return session_activation_1.readClaudeSessionActivation; } });
// ── CLI Entry Point ──
// Import for CLI use
const alignment_interface_2 = require("./alignment-interface");
const context_projection_2 = require("./context-projection");
const reference_host_1 = require("./reference-host");
const matt_cli_1 = require("./matt-cli");
const host_feasibility_2 = require("./host-feasibility");
const session_activation_2 = require("./session-activation");
function claudeSessionStateHome() {
    return process.env.PROMPT_OPTIMIZER_STATE_HOME || undefined;
}
// Tool-specific output modes
const toolModes = {
    'claude-code': (instruction, projectDir) => {
        // Claude Code hook mode: output hook-compatible format
        const result = (0, alignment_interface_2.alignInstruction)(instruction, projectDir, {
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
                lifecycleStatus = (0, reference_host_1.recordReferenceHostHandoff)(projectDir, instruction, result.decision, sessionRef).status;
            }
            catch {
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
            ? (0, reference_host_1.completeReferenceHostRun)(projectDir, { kind: 'claude-code.stop' }, sessionRef)
            : { status: 'not_observable' };
        console.log(`[对齐] execution receipt/completion status=${lifecycle.status} ` +
            'failed/cancelled=enforcement_unavailable');
    },
    'codex': (instruction, projectDir) => {
        const result = (0, alignment_interface_2.alignInstruction)(instruction, projectDir, {
            hostCapabilities: { adapter: 'codex' }
        });
        console.log(result.brief.markdown);
    },
    'cursor': (instruction, projectDir) => {
        const result = (0, alignment_interface_2.alignInstruction)(instruction, projectDir, {
            hostCapabilities: { adapter: 'cursor' }
        });
        console.log(result.brief.markdown);
    },
    'generic': (instruction, projectDir) => {
        const result = (0, alignment_interface_2.alignInstruction)(instruction, projectDir);
        console.log(result.brief.markdown);
    },
    'json': (instruction, projectDir) => {
        // Thin adapters may identify their host without creating a second route.
        const hostCapabilities = process.env.ALIGN_HOST_ADAPTER === 'codex'
            ? { adapter: 'codex' }
            : undefined;
        const result = (0, alignment_interface_2.alignInstruction)(instruction, projectDir, { hostCapabilities });
        console.error(`[alignment] route=${result.decision.route} reasons=${result.decision.reasons.join(',')}`);
        process.stdout.write(`${JSON.stringify(result.decision)}\n`);
    },
    'matt': (instruction, projectDir) => {
        const handoff = (0, matt_cli_1.createMattHandoff)(instruction, projectDir);
        console.error(`[alignment] route=${handoff.source.route} status=${handoff.status}`);
        process.stdout.write(`${JSON.stringify(handoff)}\n`);
    },
    'context-project': (instruction, projectDir) => {
        const result = (0, context_projection_2.writeContextProjection)(projectDir, instruction === '--force');
        process.stdout.write(`${JSON.stringify(result)}\n`);
    },
    'probe': (instruction, projectDir) => {
        const requestedIngress = process.env.ALIGN_PROBE_INGRESS === 'hook' ? 'hook' : 'explicit';
        const result = (0, host_feasibility_2.probeHostFeasibility)(projectDir, {
            host: { name: instruction, version: process.env.ALIGN_HOST_VERSION },
            requestedIngress
        });
        process.stdout.write(`${JSON.stringify(result)}\n`);
    },
    'claude-session': (instruction, projectDir) => {
        const sessionRef = process.env.ALIGN_SESSION_REF || '';
        const options = { stateHome: claudeSessionStateHome() };
        const result = instruction === 'activate'
            ? (0, session_activation_2.activateClaudeSession)(projectDir, sessionRef, options)
            : instruction === 'status'
                ? (0, session_activation_2.readClaudeSessionActivation)(projectDir, sessionRef, options)
                : { status: 'inactive', reason: 'invalid_command' };
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
    }
    else {
        console.error(`Unknown tool: ${tool}`);
        console.error('Supported tools: ' + Object.keys(toolModes).join(', '));
        process.exit(1);
    }
}
//# sourceMappingURL=index.js.map
