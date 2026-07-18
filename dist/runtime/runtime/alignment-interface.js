// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alignInstruction = alignInstruction;
const pipeline_1 = require("./pipeline");
/**
 * Primary caller seam for the runtime. Context loading, acceptance planning,
 * and compatibility presentation stay behind this small interface.
 */
function alignInstruction(instruction, projectDir, options = {}) {
    const result = (0, pipeline_1.processInstruction)(instruction, projectDir, options);
    const projection = result.hostProjection;
    return {
        decision: result.alignmentDecision,
        host: {
            nextAction: projection.nextAction,
            shouldBlock: projection.shouldBlock,
            instructions: projection.instructions
        }
    };
}
//# sourceMappingURL=alignment-interface.js.map
