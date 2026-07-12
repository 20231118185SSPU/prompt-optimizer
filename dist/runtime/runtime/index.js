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
exports.generateWindsurfRules = exports.generateAiderRules = exports.generateCopilotRules = exports.MATT_SKILLS = exports.discoverMattEnvironment = exports.buildMattHandoff = exports.writeContextProjection = exports.LifecycleCoordinator = exports.projectAlignmentDecision = exports.buildAlignmentDecision = exports.decideRoute = exports.analyzeInstruction = exports.processInstruction = exports.runVerification = exports.getVerificationCommands = exports.enrich = exports.route = exports.classify = exports.VERSION = void 0;
exports.VERSION = '3.2.0-rc.1';
// Re-export pipeline components
var classifier_1 = require("./classifier");
Object.defineProperty(exports, "classify", { enumerable: true, get: function () { return classifier_1.classify; } });
var router_1 = require("./router");
Object.defineProperty(exports, "route", { enumerable: true, get: function () { return router_1.route; } });
var enricher_1 = require("./enricher");
Object.defineProperty(exports, "enrich", { enumerable: true, get: function () { return enricher_1.enrich; } });
var verifier_1 = require("./verifier");
Object.defineProperty(exports, "getVerificationCommands", { enumerable: true, get: function () { return verifier_1.getVerificationCommands; } });
Object.defineProperty(exports, "runVerification", { enumerable: true, get: function () { return verifier_1.runVerification; } });
var pipeline_1 = require("./pipeline");
Object.defineProperty(exports, "processInstruction", { enumerable: true, get: function () { return pipeline_1.processInstruction; } });
var analyzer_1 = require("./analyzer");
Object.defineProperty(exports, "analyzeInstruction", { enumerable: true, get: function () { return analyzer_1.analyzeInstruction; } });
var decision_engine_1 = require("./decision-engine");
Object.defineProperty(exports, "decideRoute", { enumerable: true, get: function () { return decision_engine_1.decideRoute; } });
var contract_builder_1 = require("./contract-builder");
Object.defineProperty(exports, "buildAlignmentDecision", { enumerable: true, get: function () { return contract_builder_1.buildAlignmentDecision; } });
var host_projection_1 = require("./host-projection");
Object.defineProperty(exports, "projectAlignmentDecision", { enumerable: true, get: function () { return host_projection_1.projectAlignmentDecision; } });
var lifecycle_1 = require("./lifecycle");
Object.defineProperty(exports, "LifecycleCoordinator", { enumerable: true, get: function () { return lifecycle_1.LifecycleCoordinator; } });
var context_projection_1 = require("./context-projection");
Object.defineProperty(exports, "writeContextProjection", { enumerable: true, get: function () { return context_projection_1.writeContextProjection; } });
var matt_handoff_1 = require("./matt-handoff");
Object.defineProperty(exports, "buildMattHandoff", { enumerable: true, get: function () { return matt_handoff_1.buildMattHandoff; } });
Object.defineProperty(exports, "discoverMattEnvironment", { enumerable: true, get: function () { return matt_handoff_1.discoverMattEnvironment; } });
Object.defineProperty(exports, "MATT_SKILLS", { enumerable: true, get: function () { return matt_handoff_1.MATT_SKILLS; } });
var generate_1 = require("./rules/generate");
Object.defineProperty(exports, "generateCopilotRules", { enumerable: true, get: function () { return generate_1.generateCopilotRules; } });
Object.defineProperty(exports, "generateAiderRules", { enumerable: true, get: function () { return generate_1.generateAiderRules; } });
Object.defineProperty(exports, "generateWindsurfRules", { enumerable: true, get: function () { return generate_1.generateWindsurfRules; } });
// ── CLI Entry Point ──
// Import for CLI use
const pipeline_2 = require("./pipeline");
const context_projection_2 = require("./context-projection");
// Tool-specific output modes
const toolModes = {
    'claude-code': (instruction, projectDir) => {
        // Claude Code hook mode: output hook-compatible format
        const result = (0, pipeline_2.processInstruction)(instruction, projectDir, {
            hostCapabilities: {
                adapter: 'claude-code',
                nativeBlocking: process.env.BLOCK_ON_HIGH === 'on'
            }
        });
        console.log(result.instructions);
        if (result.hostProjection.shouldBlock) {
            process.exit(2);
        }
    },
    'codex': (instruction, projectDir) => {
        // Codex CLI wrapper mode: inject alignment context
        const result = (0, pipeline_2.processInstruction)(instruction, projectDir, {
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
        const result = (0, pipeline_2.processInstruction)(instruction, projectDir, {
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
        const result = (0, pipeline_2.processInstruction)(instruction, projectDir);
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
        const result = (0, pipeline_2.processInstruction)(instruction, projectDir);
        console.error(`[alignment] route=${result.alignmentDecision.route} reasons=${result.alignmentDecision.reasons.join(',')}`);
        process.stdout.write(`${JSON.stringify(result.alignmentDecision)}\n`);
    },
    'matt': (instruction, projectDir) => {
        const result = (0, pipeline_2.processInstruction)(instruction, projectDir, { ecosystem: 'matt-pocock-skills' });
        if (!result.handoff) {
            throw new Error('Matt handoff was not generated.');
        }
        console.error(`[alignment] route=${result.alignmentDecision.route} status=${result.handoff.status}`);
        process.stdout.write(`${JSON.stringify(result.handoff)}\n`);
    },
    'context-project': (instruction, projectDir) => {
        const result = (0, context_projection_2.writeContextProjection)(projectDir, instruction === '--force');
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
    }
    else {
        console.error(`Unknown tool: ${tool}`);
        console.error('Supported tools: ' + Object.keys(toolModes).join(', '));
        process.exit(1);
    }
}
//# sourceMappingURL=index.js.map
