// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alignInstruction = alignInstruction;
const node_crypto_1 = require("node:crypto");
const analyzer_1 = require("./analyzer");
const brief_engine_1 = require("./brief-engine");
const contract_builder_1 = require("./contract-builder");
const context_resolver_1 = require("./context-resolver");
const host_projection_1 = require("./host-projection");
const privacy_1 = require("./privacy");
const task_route_1 = require("./task-route");
function contextDegradedReasons(issues) {
    const reasons = [];
    if (issues.includes('budget_exceeded'))
        reasons.push('context_budget_exceeded');
    if (issues.includes('source_outside_align') || issues.includes('source_too_large')) {
        reasons.push('context_source_invalid');
    }
    if (issues.includes('stale_evidence'))
        reasons.push('context_stale');
    if (issues.includes('source_conflict'))
        reasons.push('context_conflict');
    return reasons;
}
function traceMarkdown(taskRoute, decision, evidence, issues) {
    const lines = [
        '# Trace Appendix',
        '',
        `- Task route: ${taskRoute.primary}${taskRoute.secondary.length ? ` + ${taskRoute.secondary.join(', ')}` : ''}`,
        `- Confidence: ${taskRoute.confidence}`,
        `- Missing: ${taskRoute.missing.length ? taskRoute.missing.join(', ') : 'none'}`,
        `- Machine decision: ${decision.route}/${String(decision.next.action)}`,
        `- Context issues: ${issues.length ? issues.join(', ') : 'none'}`,
        '',
        '## Evidence',
        ...evidence.map(item => `- ${item.statement} [${item.source.ref} ${item.location}; ${item.freshness}; ${item.appliesTo.join(',')}]`)
    ];
    return lines.join('\n').trim();
}
function redactTaskRoute(taskRoute) {
    let redacted = false;
    const rationale = taskRoute.rationale.map(item => {
        const result = (0, privacy_1.redactSensitiveText)(item.reason);
        redacted = redacted || result.redacted;
        return { ...item, reason: result.text };
    });
    return { taskRoute: { ...taskRoute, rationale }, redacted };
}
function redactEvidence(evidence) {
    let redacted = false;
    const safeEvidence = evidence.map(item => {
        const result = (0, privacy_1.redactSensitiveText)(item.statement);
        redacted = redacted || result.redacted;
        return { ...item, statement: result.text };
    });
    return { evidence: safeEvidence, redacted };
}
function scoresWithMissing(scores, dimensions) {
    const next = { ...scores };
    for (const dimension of dimensions)
        next[dimension] = 0;
    next.total = next.d1 + next.d2 + next.d3 + next.d4 + next.d5;
    return next;
}
function applySemanticMissing(analysis, taskRoute) {
    const dimensions = [];
    if (taskRoute.missing.includes('objective'))
        dimensions.push('d1');
    if (taskRoute.missing.some(field => ['scope', 'constraints', 'authorization', 'recovery'].includes(field))) {
        dimensions.push('d2');
    }
    if (taskRoute.missing.includes('acceptance'))
        dimensions.push('d5');
    if (dimensions.length === 0)
        return analysis;
    const reasons = analysis.reasons.filter(reason => ![
        'requirements.sufficient',
        'requirements.needs_enrichment',
        'context.resolvable_from_project'
    ].includes(reason));
    if (dimensions.includes('d1'))
        reasons.push('intent.ambiguous_goal');
    if (dimensions.includes('d2'))
        reasons.push('scope.impact_unknown');
    if (dimensions.includes('d5'))
        reasons.push('verification.missing');
    const observed = scoresWithMissing(analysis.observed, dimensions);
    const effective = scoresWithMissing(analysis.effective, dimensions);
    if (effective.total < 6)
        reasons.push('diagnosis.score_below_threshold');
    return { ...analysis, observed, effective, reasons: [...new Set(reasons)] };
}
/**
 * Primary caller seam for the runtime. Context loading, acceptance planning,
 * and compatibility presentation stay behind this small interface.
 */
function alignInstruction(instruction, projectDir, options = {}) {
    const semantic = (0, task_route_1.resolveTaskRoute)(options.model);
    const safeSemantic = redactTaskRoute(semantic.taskRoute);
    const taskRoute = safeSemantic.taskRoute;
    const context = (0, context_resolver_1.resolveAlignmentContext)(projectDir, instruction, semantic.taskRoute);
    const verificationCommands = context.evidence
        .filter(item => item.source.ref === '.align/check-commands.txt')
        .map(item => item.statement);
    const semanticContext = [...new Map(context.evidence.map(item => [`${item.source.kind}:${item.source.ref}`, item.source])).values()];
    const contextText = context.evidence.map(item => item.statement).join('\n');
    const analysisInstruction = options.directOutput && !/^\s*(?:\[直出\]|直出)/.test(instruction)
        ? `[直出] ${instruction}`
        : instruction;
    const analyzed = (0, analyzer_1.analyzeInstruction)(analysisInstruction, semanticContext, contextText);
    const withSemanticMissing = semantic.mode === 'full'
        ? applySemanticMissing(analyzed, taskRoute)
        : analyzed;
    const analysis = context.issues.includes('policy_conflict')
        ? { ...withSemanticMissing, reasons: [...new Set([...withSemanticMissing.reasons, 'policy.operation_prohibited'])] }
        : withSemanticMissing;
    const decision = (0, contract_builder_1.buildAlignmentDecision)(analysis, {
        verificationCommands,
        adapter: options.hostCapabilities?.adapter,
        nativeHook: options.hostCapabilities?.nativeBlocking
    });
    const projection = (0, host_projection_1.projectAlignmentDecision)(decision);
    const modelOutput = options.model?.status === 'available' ? options.model.output : undefined;
    const contextReasons = contextDegradedReasons(context.issues);
    const preBriefMode = semantic.mode === 'degraded' || contextReasons.length > 0 || safeSemantic.redacted
        ? 'degraded'
        : 'full';
    const briefResult = (0, brief_engine_1.buildExecutionBrief)(instruction, modelOutput, preBriefMode, taskRoute, decision, context);
    const degradedReasons = [...new Set([
            ...semantic.degradedReasons,
            ...contextReasons,
            ...(briefResult.modelBriefStatus === 'semantic_conflict' ? ['model_semantic_conflict'] : []),
            ...(briefResult.modelBriefStatus === 'invalid' && semantic.mode === 'full' ? ['model_output_invalid'] : []),
            ...(safeSemantic.redacted || briefResult.privacyRedacted ? ['privacy_redaction_required'] : [])
        ])];
    const mode = degradedReasons.length > 0 ? 'degraded' : 'full';
    const safeContext = redactEvidence(context.evidence);
    const trace = options.includeTrace
        ? {
            schemaVersion: '1.0.0',
            kind: 'alignment.trace',
            taskRoute,
            decision: {
                route: decision.route,
                action: String(decision.next.action),
                reasons: [...decision.reasons]
            },
            evidence: safeContext.evidence,
            contextIssues: context.issues,
            totalEvidenceCharacters: context.totalCharacters,
            markdown: traceMarkdown(taskRoute, decision, safeContext.evidence, context.issues)
        }
        : undefined;
    if (safeContext.redacted && !degradedReasons.includes('privacy_redaction_required')) {
        degradedReasons.push('privacy_redaction_required');
    }
    const handoff = options.includeHandoff
        ? {
            schemaVersion: '1.0.0',
            kind: 'alignment.brief-handoff',
            summaryHash: `sha256:${(0, node_crypto_1.createHash)('sha256').update(briefResult.brief.markdown).digest('hex')}`,
            executionBrief: briefResult.brief.markdown
        }
        : undefined;
    return {
        mode: degradedReasons.length > 0 ? 'degraded' : mode,
        degradedReasons,
        taskRoute,
        brief: briefResult.brief,
        ...(trace ? { trace } : {}),
        ...(handoff ? { handoff } : {}),
        decision,
        host: projection
    };
}
//# sourceMappingURL=alignment-interface.js.map
