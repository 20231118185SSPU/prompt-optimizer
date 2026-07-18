// Generated from core/host/pipeline/src/
// Generated from core/
// Do not edit dist/ manually
"use strict";
/**
 * Rule File Generators for the Universal Align Pipeline.
 *
 * Generates alignment rules for tools without hooks (Copilot, Aider, Windsurf).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCopilotRules = generateCopilotRules;
exports.generateAiderRules = generateAiderRules;
exports.generateWindsurfRules = generateWindsurfRules;
exports.writeRuleFiles = writeRuleFiles;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** @deprecated No production Adapter consumes these frozen rule-file generators. */
const ALIGNMENT_RULES = `
# Alignment Protocol

This project uses an alignment pipeline to ensure AI coding tools understand user instructions correctly.

## Three-Tier Routing

Every instruction is classified into one of three tiers:

### HIGH (High Risk)
- Contains irreversible operations (delete, deploy, reset, etc.)
- Must list all affected files/data/environments
- Must present execution plan with rollback conditions
- Must wait for explicit user confirmation before executing
- Cannot proceed without confirmation

### VAGUE (Unclear Target)
- Contains vague verbs (optimize, improve, fix, etc.) without specific targets
- Must read project context from .align/ files first
- Must ask one clarifying question with recommended answer
- Cannot proceed without alignment

### CLEAR (Clear Instruction)
- Has specific targets and clear requirements
- Can proceed with execution
- Must verify after completion
- Must record lessons learned

## Required Behavior

1. ALWAYS read .align/lessons.md and .align/spec.md, then facts/glossary/state; while any classified file is missing, also read legacy context.md
2. ALWAYS classify instructions into HIGH/VAGUE/CLEAR
3. ALWAYS follow the routing protocol for each tier
4. NEVER skip verification after completion
5. NEVER execute HIGH-risk operations without confirmation

## Verification

After completing any task:
1. Run verification commands from .align/check-commands.txt
2. Verify core functionality is not broken
3. Record any lessons learned to .align/lessons.md
`;
function generateCopilotRules(_projectDir) {
    return ALIGNMENT_RULES;
}
function generateAiderRules(_projectDir) {
    return ALIGNMENT_RULES;
}
function generateWindsurfRules(_projectDir) {
    return ALIGNMENT_RULES;
}
function writeRuleFiles(projectDir) {
    // Write Copilot rules
    const copilotDir = path.join(projectDir, '.github');
    if (!fs.existsSync(copilotDir)) {
        fs.mkdirSync(copilotDir, { recursive: true });
    }
    fs.writeFileSync(path.join(copilotDir, 'copilot-instructions.md'), generateCopilotRules(projectDir));
    // Write Aider rules
    fs.writeFileSync(path.join(projectDir, 'CONVENTIONS.md'), generateAiderRules(projectDir));
    // Write Windsurf rules
    fs.writeFileSync(path.join(projectDir, '.windsurfrules'), generateWindsurfRules(projectDir));
}
//# sourceMappingURL=generate.js.map
