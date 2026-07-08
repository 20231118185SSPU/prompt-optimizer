/**
 * Rule File Generators for the Universal Align Pipeline.
 *
 * Generates alignment rules for tools without hooks (Copilot, Aider, Windsurf).
 */

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

1. ALWAYS read .align/lessons.md, .align/spec.md, .align/context.md before executing
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

export function generateCopilotRules(_projectDir: string): string {
  return ALIGNMENT_RULES;
}

export function generateAiderRules(_projectDir: string): string {
  return ALIGNMENT_RULES;
}

export function generateWindsurfRules(_projectDir: string): string {
  return ALIGNMENT_RULES;
}
