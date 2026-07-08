import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { generateCopilotRules, generateAiderRules, generateWindsurfRules, writeRuleFiles } from '../rules/generate';

describe('Rule File Generators', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

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

  describe('writeRuleFiles', () => {
    it('creates .github/copilot-instructions.md', () => {
      writeRuleFiles(tmpDir);
      const filePath = path.join(tmpDir, '.github', 'copilot-instructions.md');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('# Alignment Protocol');
    });

    it('creates CONVENTIONS.md', () => {
      writeRuleFiles(tmpDir);
      const filePath = path.join(tmpDir, 'CONVENTIONS.md');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('# Alignment Protocol');
    });

    it('creates .windsurfrules', () => {
      writeRuleFiles(tmpDir);
      const filePath = path.join(tmpDir, '.windsurfrules');
      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('# Alignment Protocol');
    });

    it('creates all three rule files in one call', () => {
      writeRuleFiles(tmpDir);
      expect(fs.existsSync(path.join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, 'CONVENTIONS.md'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '.windsurfrules'))).toBe(true);
    });
  });
});
