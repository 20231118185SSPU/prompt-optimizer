// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: classifier → router → enricher → verifier
 * Converts user instructions into aligned, verifiable task contracts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInstruction = processInstruction;
const classifier_1 = require("./classifier");
const router_1 = require("./router");
const enricher_1 = require("./enricher");
const verifier_1 = require("./verifier");
const analyzer_1 = require("./analyzer");
const contract_builder_1 = require("./contract-builder");
const matt_handoff_1 = require("./matt-handoff");
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
function processInstruction(instruction, projectDir, options = {}) {
    const normalizedInstruction = instruction.trimStart();
    const presentationMode = options.bypass || normalizedInstruction.startsWith('[直出]') || normalizedInstruction.startsWith('直出')
        ? 'direct_output'
        : 'default';
    // Step 1: Classify signals
    const classification = (0, classifier_1.classify)(instruction);
    // Step 2: Route based on classification
    const { verdict, instructions } = (0, router_1.route)(classification);
    // Step 3: Enrich message with .align/ context
    const { enrichedMessage, context } = (0, enricher_1.enrich)(instruction, projectDir);
    // Step 4: Build the completion verification plan. Execution happens only
    // after an execution receipt is registered by the lifecycle coordinator.
    const verificationCommands = (0, verifier_1.getVerificationCommands)(projectDir);
    const appliedContext = context.spec || context.facts || context.glossary || context.state || context.context || context.lessons || context.decisions
        ? [{ kind: 'project', ref: '.align/' }]
        : [];
    const contextText = [context.spec, context.facts, context.glossary, context.state, context.context]
        .filter(Boolean)
        .join('\n');
    const analysis = (0, analyzer_1.analyzeInstruction)(instruction, appliedContext, contextText);
    const alignmentDecision = (0, contract_builder_1.buildAlignmentDecision)(analysis, { verificationCommands });
    const result = {
        verdict,
        presentationMode,
        instructions,
        enrichedMessage,
        context,
        verificationCommands,
        alignmentDecision
    };
    if (options.ecosystem === 'matt-pocock-skills') {
        result.handoff = (0, matt_handoff_1.buildMattHandoff)(alignmentDecision, (0, matt_handoff_1.discoverMattEnvironment)(projectDir));
    }
    return result;
}
//# sourceMappingURL=pipeline.js.map
