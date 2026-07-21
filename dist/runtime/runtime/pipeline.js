// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
/**
 * Core Pipeline Integration for the Universal Align Pipeline.
 *
 * Integrates: context resolution → decision kernel → host projection.
 * Converts user instructions into aligned, verifiable task contracts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInstruction = processInstruction;
const alignment_interface_1 = require("./alignment-interface");
const matt_handoff_1 = require("./matt-handoff");
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
function processInstruction(instruction, projectDir, options = {}) {
    const coreResult = (0, alignment_interface_1.alignInstruction)(instruction, projectDir, {
        hostCapabilities: options.hostCapabilities,
        model: options.model,
        directOutput: options.directOutput || options.bypass,
        includeTrace: true,
        includeHandoff: options.includeHandoff
    });
    const alignmentDecision = coreResult.decision;
    const hostProjection = coreResult.host;
    const context = {
        lessons: '',
        spec: '',
        facts: '',
        glossary: '',
        state: '',
        context: '',
        decisions: ''
    };
    const contextFieldByRef = {
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
        if (field)
            context[field] = [context[field], evidence.statement].filter(Boolean).join('\n');
    }
    const verificationCommands = [...new Set((coreResult.trace?.evidence ?? [])
            .filter(item => item.source.ref === '.align/check-commands.txt')
            .map(item => item.statement))];
    const result = {
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
        result.handoff = (0, matt_handoff_1.buildMattHandoff)(alignmentDecision, (0, matt_handoff_1.discoverMattEnvironment)(projectDir));
    }
    return result;
}
//# sourceMappingURL=pipeline.js.map
