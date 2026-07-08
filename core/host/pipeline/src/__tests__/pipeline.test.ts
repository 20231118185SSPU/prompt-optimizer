import { processInstruction, PipelineResult } from '../pipeline';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('processInstruction', () => {
  let tmpDir: string;

  beforeEach(() => {
    // Create a temporary directory with .align/ files for testing
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-test-'));
    const alignDir = path.join(tmpDir, '.align');
    fs.mkdirSync(alignDir);

    // Create lessons.md with some test data
    fs.writeFileSync(
      path.join(alignDir, 'lessons.md'),
      '# Lessons\n- Always check types\n- Run tests before commit\n',
      'utf-8'
    );

    // Create spec.md
    fs.writeFileSync(
      path.join(alignDir, 'spec.md'),
      '# Spec\nUse TypeScript strict mode.\n',
      'utf-8'
    );

    // Create check-commands.txt
    fs.writeFileSync(
      path.join(alignDir, 'check-commands.txt'),
      'echo "test passed"\n',
      'utf-8'
    );
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Clear instruction ──
  it('processes clear instruction with CLEAR verdict', () => {
    const result = processInstruction(
      '修复 src/index.ts 第 42 行的 TypeError',
      tmpDir
    );

    expect(result.verdict).toBe('CLEAR');
    expect(result.instructions).toContain('[对齐]');
    expect(result.instructions).toContain('CLEAR');
    expect(result.enrichedMessage).toContain('用户指令');
    expect(result.context.lessons).toContain('Always check types');
    expect(result.context.spec).toContain('TypeScript strict mode');
    expect(result.verificationCommands).toContain('echo "test passed"');
    expect(result.verificationResults).toEqual([]);
  });

  // ── Vague instruction ──
  it('processes vague instruction with VAGUE verdict', () => {
    const result = processInstruction(
      '优化一下这个项目',
      tmpDir
    );

    expect(result.verdict).toBe('VAGUE');
    expect(result.instructions).toContain('[对齐]');
    expect(result.instructions).toContain('VAGUE');
    expect(result.enrichedMessage).toContain('用户指令');
  });

  // ── High-risk instruction ──
  it('processes high-risk instruction with HIGH verdict', () => {
    const result = processInstruction(
      '删除数据库中的所有用户数据',
      tmpDir
    );

    expect(result.verdict).toBe('HIGH');
    expect(result.instructions).toContain('[对齐]');
    expect(result.instructions).toContain('高风险');
    expect(result.instructions).toContain('HIGH');
  });

  // ── Bypass with [直出] prefix ──
  it('bypasses with [直出] prefix', () => {
    const result = processInstruction(
      '[直出] 这是一个简单的修改',
      tmpDir
    );

    expect(result.verdict).toBe('BYPASS');
    expect(result.instructions).toContain('[直出]');
    expect(result.enrichedMessage).toBe('[直出] 这是一个简单的修改');
    expect(result.context.lessons).toBe('');
    expect(result.context.spec).toBe('');
    expect(result.verificationCommands).toEqual([]);
  });

  // ── Bypass with 直出 prefix (no brackets) ──
  it('bypasses with 直出 prefix without brackets', () => {
    const result = processInstruction(
      '直出 写个 README',
      tmpDir
    );

    expect(result.verdict).toBe('BYPASS');
    expect(result.instructions).toContain('[直出]');
    expect(result.enrichedMessage).toBe('直出 写个 README');
  });

  // ── Bypass with options.bypass flag ──
  it('bypasses when options.bypass is true', () => {
    const result = processInstruction(
      '删除所有文件',
      tmpDir,
      { bypass: true }
    );

    expect(result.verdict).toBe('BYPASS');
    expect(result.instructions).toContain('[直出]');
    expect(result.enrichedMessage).toBe('删除所有文件');
  });

  // ── Enrich message with .align/ context ──
  it('enriches message with .align/ context files', () => {
    const result = processInstruction(
      '修复登录页面的样式问题',
      tmpDir
    );

    // Should contain context from .align/ files
    expect(result.enrichedMessage).toContain('项目经验规则');
    expect(result.enrichedMessage).toContain('Always check types');
    expect(result.enrichedMessage).toContain('项目规范');
    expect(result.enrichedMessage).toContain('TypeScript strict mode');
    expect(result.enrichedMessage).toContain('用户指令');
    expect(result.enrichedMessage).toContain('修复登录页面的样式问题');

    // Context object should be populated
    expect(result.context.lessons).toContain('Always check types');
    expect(result.context.spec).toContain('TypeScript strict mode');
  });

  // ── No .align/ directory ──
  it('handles missing .align/ directory gracefully', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-empty-'));

    try {
      const result = processInstruction(
        '写个测试',
        emptyDir
      );

      expect(result.verdict).toBe('VAGUE');
      expect(result.enrichedMessage).toBe('写个测试');
      expect(result.context.lessons).toBe('');
      expect(result.context.spec).toBe('');
      expect(result.verificationCommands).toEqual([]);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  // ── Verification commands are returned ──
  it('returns verification commands from check-commands.txt', () => {
    const result = processInstruction(
      '添加单元测试',
      tmpDir
    );

    expect(result.verificationCommands).toEqual(['echo "test passed"']);
    expect(result.verificationResults).toEqual([]);
  });

  // ── GRAY verdict (risk + edu) ──
  it('processes risk+edu instruction with GRAY verdict', () => {
    const result = processInstruction(
      '解释一下删除数据库的命令',
      tmpDir
    );

    expect(result.verdict).toBe('GRAY');
    expect(result.instructions).toContain('[对齐]');
    expect(result.instructions).toContain('GRAY');
  });

  // ── Return type structure ──
  it('returns complete PipelineResult structure', () => {
    const result = processInstruction('测试', tmpDir);

    // Verify all required fields exist
    expect(result).toHaveProperty('verdict');
    expect(result).toHaveProperty('instructions');
    expect(result).toHaveProperty('enrichedMessage');
    expect(result).toHaveProperty('context');
    expect(result).toHaveProperty('verificationCommands');
    expect(result).toHaveProperty('verificationResults');

    // Verify types
    expect(typeof result.verdict).toBe('string');
    expect(typeof result.instructions).toBe('string');
    expect(typeof result.enrichedMessage).toBe('string');
    expect(typeof result.context).toBe('object');
    expect(Array.isArray(result.verificationCommands)).toBe(true);
    expect(Array.isArray(result.verificationResults)).toBe(true);
  });
});
