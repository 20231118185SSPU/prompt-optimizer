// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRouteDecision = evaluateRouteDecision;
exports.decideRoute = decideRoute;
const policy_evaluator_1 = require("./policy-evaluator");
function policyReasons(analysis) {
    const reasons = [...analysis.reasons];
    const applied = new Set(analysis.appliedContext.map(source => `${source.kind}:${source.ref}`));
    const hasAppliedEvidence = analysis.contextEvidence.some(evidence => applied.has(`${evidence.source.kind}:${evidence.source.ref}`));
    if (hasAppliedEvidence && reasons.includes('requirements.needs_enrichment')) {
        reasons.push('context.resolvable_from_project');
    }
    return [...new Set(reasons)];
}
function evaluateRouteDecision(analysis) {
    return (0, policy_evaluator_1.evaluateDecisionPolicy)({
        reasons: policyReasons(analysis),
        scores: {
            observed: analysis.observed,
            effective: analysis.effective,
        },
        assumptionCount: analysis.assumptionCount,
    });
}
function decideRoute(analysis) {
    const decision = evaluateRouteDecision(analysis);
    return { route: decision.route, action: decision.action };
}
//# sourceMappingURL=decision-engine.js.map
