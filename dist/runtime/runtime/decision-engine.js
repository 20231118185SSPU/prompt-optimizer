// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideRoute = decideRoute;
function decideRoute(analysis) {
    const reasons = new Set(analysis.reasons);
    if (reasons.has('policy.operation_prohibited'))
        return { route: 'block', action: 'stop' };
    if (analysis.effective.total < 6 ||
        Math.min(analysis.effective.d1, analysis.effective.d2, analysis.effective.d3, analysis.effective.d4, analysis.effective.d5) < 1 ||
        analysis.assumptionCount > 2 ||
        ['intent.ambiguous_goal', 'scope.impact_unknown', 'scope.too_broad'].some(reason => reasons.has(reason))) {
        return { route: 'clarify', action: 'ask' };
    }
    if (reasons.has('authorization.confirmation_missing'))
        return { route: 'block', action: 'wait_confirmation' };
    if ([...reasons].some(reason => reason.startsWith('risk.')) ||
        reasons.has('context.resolvable_from_project') ||
        reasons.has('requirements.needs_enrichment') ||
        analysis.observed.total < 8) {
        return { route: 'enrich', action: 'execute' };
    }
    return { route: 'pass', action: 'execute' };
}
//# sourceMappingURL=decision-engine.js.map
