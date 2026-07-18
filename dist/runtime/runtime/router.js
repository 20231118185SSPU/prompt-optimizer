// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.route = route;
const host_projection_1 = require("./host-projection");
/**
 * @deprecated Compatibility projection for consumers of the former router
 * API. The Alignment Decision is the only route source; prefer alignInstruction().
 */
function route(decision) {
    const projection = (0, host_projection_1.projectAlignmentDecision)(decision);
    return {
        verdict: projection.verdict,
        instructions: projection.instructions
    };
}
//# sourceMappingURL=router.js.map
