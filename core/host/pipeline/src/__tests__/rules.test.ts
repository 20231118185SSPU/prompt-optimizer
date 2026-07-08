import { generateCopilotRules, generateAiderRules, generateWindsurfRules } from '../rules/generate';

describe('Rule File Generators', () => {
  describe('generateCopilotRules', () => {
    it('returns non-empty string', () => {
      const rules = generateCopilotRules('/test/project');
      expect(rules).toBeTruthy();
      expect(typeof rules).toBe('string');
    });

    it('contains alignment protocol header', () => {
      const rules = generateCopilotRules('/test/project');
      expect(rules).toContain('# Alignment Protocol');
    });

    it('contains three-tier routing section', () => {
      const rules = generateCopilotRules('/test/project');
      expect(rules).toContain('## Three-Tier Routing');
      expect(rules).toContain('### HIGH (High Risk)');
      expect(rules).toContain('### VAGUE (Unclear Target)');
      expect(rules).toContain('### CLEAR (Clear Instruction)');
    });

    it('contains required behavior rules', () => {
      const rules = generateCopilotRules('/test/project');
      expect(rules).toContain('## Required Behavior');
      expect(rules).toContain('ALWAYS read .align/lessons.md');
      expect(rules).toContain('NEVER skip verification');
    });

    it('contains verification section', () => {
      const rules = generateCopilotRules('/test/project');
      expect(rules).toContain('## Verification');
      expect(rules).toContain('.align/check-commands.txt');
    });
  });

  describe('generateAiderRules', () => {
    it('returns non-empty string', () => {
      const rules = generateAiderRules('/test/project');
      expect(rules).toBeTruthy();
      expect(typeof rules).toBe('string');
    });

    it('contains alignment protocol header', () => {
      const rules = generateAiderRules('/test/project');
      expect(rules).toContain('# Alignment Protocol');
    });

    it('contains three-tier routing section', () => {
      const rules = generateAiderRules('/test/project');
      expect(rules).toContain('## Three-Tier Routing');
      expect(rules).toContain('### HIGH (High Risk)');
      expect(rules).toContain('### VAGUE (Unclear Target)');
      expect(rules).toContain('### CLEAR (Clear Instruction)');
    });

    it('contains required behavior rules', () => {
      const rules = generateAiderRules('/test/project');
      expect(rules).toContain('## Required Behavior');
      expect(rules).toContain('ALWAYS read .align/lessons.md');
      expect(rules).toContain('NEVER skip verification');
    });

    it('contains verification section', () => {
      const rules = generateAiderRules('/test/project');
      expect(rules).toContain('## Verification');
      expect(rules).toContain('.align/check-commands.txt');
    });
  });

  describe('generateWindsurfRules', () => {
    it('returns non-empty string', () => {
      const rules = generateWindsurfRules('/test/project');
      expect(rules).toBeTruthy();
      expect(typeof rules).toBe('string');
    });

    it('contains alignment protocol header', () => {
      const rules = generateWindsurfRules('/test/project');
      expect(rules).toContain('# Alignment Protocol');
    });

    it('contains three-tier routing section', () => {
      const rules = generateWindsurfRules('/test/project');
      expect(rules).toContain('## Three-Tier Routing');
      expect(rules).toContain('### HIGH (High Risk)');
      expect(rules).toContain('### VAGUE (Unclear Target)');
      expect(rules).toContain('### CLEAR (Clear Instruction)');
    });

    it('contains required behavior rules', () => {
      const rules = generateWindsurfRules('/test/project');
      expect(rules).toContain('## Required Behavior');
      expect(rules).toContain('ALWAYS read .align/lessons.md');
      expect(rules).toContain('NEVER skip verification');
    });

    it('contains verification section', () => {
      const rules = generateWindsurfRules('/test/project');
      expect(rules).toContain('## Verification');
      expect(rules).toContain('.align/check-commands.txt');
    });
  });
});
