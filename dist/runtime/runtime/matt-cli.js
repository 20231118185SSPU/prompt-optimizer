// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMattHandoff = createMattHandoff;
const pipeline_1 = require("./pipeline");
const matt_handoff_1 = require("./matt-handoff");
/**
 * Compose the optional Matt Pocock Skills envelope outside the core pipeline.
 * The Alignment Decision is computed first and remains the only route source.
 */
function createMattHandoff(instruction, projectDir) {
    const result = (0, pipeline_1.processInstruction)(instruction, projectDir);
    return (0, matt_handoff_1.buildMattHandoff)(result.alignmentDecision, (0, matt_handoff_1.discoverMattEnvironment)(projectDir));
}
//# sourceMappingURL=matt-cli.js.map
