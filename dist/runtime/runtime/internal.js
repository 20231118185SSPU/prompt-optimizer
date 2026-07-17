// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWindsurfRules = exports.generateAiderRules = exports.generateCopilotRules = exports.MATT_SKILLS = exports.discoverMattEnvironment = exports.buildMattHandoff = exports.writeContextProjection = exports.recordReferenceHostHandoff = exports.completeReferenceHostRun = exports.LifecycleCoordinator = exports.decideRoute = exports.buildAlignmentDecision = exports.analyzeInstruction = exports.runVerificationCommands = exports.runVerification = exports.getVerificationCommands = exports.processInstruction = exports.enrich = void 0;
/**
 * Internal compatibility surface for consumers that have not migrated to the
 * Alignment Decision interface. This module is intentionally outside the
 * package root export and may change or be removed at the next major.
 */
var enricher_1 = require("./enricher");
Object.defineProperty(exports, "enrich", { enumerable: true, get: function () { return enricher_1.enrich; } });
var pipeline_1 = require("./pipeline");
Object.defineProperty(exports, "processInstruction", { enumerable: true, get: function () { return pipeline_1.processInstruction; } });
var verifier_1 = require("./verifier");
Object.defineProperty(exports, "getVerificationCommands", { enumerable: true, get: function () { return verifier_1.getVerificationCommands; } });
Object.defineProperty(exports, "runVerification", { enumerable: true, get: function () { return verifier_1.runVerification; } });
Object.defineProperty(exports, "runVerificationCommands", { enumerable: true, get: function () { return verifier_1.runVerificationCommands; } });
var analyzer_1 = require("./analyzer");
Object.defineProperty(exports, "analyzeInstruction", { enumerable: true, get: function () { return analyzer_1.analyzeInstruction; } });
var contract_builder_1 = require("./contract-builder");
Object.defineProperty(exports, "buildAlignmentDecision", { enumerable: true, get: function () { return contract_builder_1.buildAlignmentDecision; } });
var decision_engine_1 = require("./decision-engine");
Object.defineProperty(exports, "decideRoute", { enumerable: true, get: function () { return decision_engine_1.decideRoute; } });
var lifecycle_1 = require("./lifecycle");
Object.defineProperty(exports, "LifecycleCoordinator", { enumerable: true, get: function () { return lifecycle_1.LifecycleCoordinator; } });
var reference_host_1 = require("./reference-host");
Object.defineProperty(exports, "completeReferenceHostRun", { enumerable: true, get: function () { return reference_host_1.completeReferenceHostRun; } });
Object.defineProperty(exports, "recordReferenceHostHandoff", { enumerable: true, get: function () { return reference_host_1.recordReferenceHostHandoff; } });
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
//# sourceMappingURL=internal.js.map
