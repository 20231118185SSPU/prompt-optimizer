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
  it('derives the compatibility verdict from an enriched decision', () => {
    const result = processInstruction(
      '修复 src/index.ts 第 42 行的 TypeError',
      tmpDir
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.verdict).toBe('GRAY');
    expect(result.instructions).toContain('[对齐]');
    expect(result.instructions).toContain('route=enrich');
    expect(result.enrichedMessage).toContain('用户指令');
    expect(result.context.lessons).toContain('Always check types');
    expect(result.context.spec).toContain('TypeScript strict mode');
    expect(result.verificationCommands).toContain('echo "test passed"');
    expect(result.presentationMode).toBe('default');
    expect(result.alignmentDecision.appliedContext).toEqual([
      { kind: 'project', ref: '.align/lessons.md' },
      { kind: 'project', ref: '.align/spec.md' },
      { kind: 'project', ref: '.align/check-commands.txt' }
    ]);
    expect(result.hostProjection.enrichmentReceipt).toEqual({
      items: [
        expect.objectContaining({
          id: 'B1',
          addition: expect.stringContaining('项目上下文'),
          sources: [
            { kind: 'project', ref: '.align/lessons.md' },
            { kind: 'project', ref: '.align/spec.md' }
          ]
        }),
        expect.objectContaining({
          id: 'B2',
          addition: expect.stringContaining('命令通过：echo "test passed"'),
          sources: [{ kind: 'project', ref: '.align/check-commands.txt' }]
        })
      ],
      undo: {
        command: '撤销补全 <ID>',
        effect: expect.stringContaining('未经确认不自动回滚')
      }
    });
    expect(result.instructions).toContain('[B1]');
    expect(result.instructions).toContain('项目:.align/spec.md');
    expect(result.instructions).toContain('撤销补全 <ID>');
  });

  // ── Vague instruction ──
  it('processes vague instruction with VAGUE verdict', () => {
    const result = processInstruction(
      '优化一下这个项目',
      tmpDir
    );

    expect(result.verdict).toBe('VAGUE');
    expect(result.instructions).toContain('[对齐]');
    expect(result.instructions).toContain('route=clarify');
    expect(result.enrichedMessage).toContain('用户指令');
  });

  // ── High-risk instruction ──
  it('projects incomplete safety-critical requests as clarify instructions', () => {
    const result = processInstruction(
      '删除数据库中的所有用户数据',
      tmpDir
    );

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(result.alignmentDecision.next.action).toBe('ask');
    expect(result.verdict).toBe('VAGUE');
    expect(result.instructions).toContain('[对齐]');
    expect(result.instructions).toContain('一次只问一个问题');
    expect(result.instructions).not.toContain('等待用户明确确认后再执行');
  });

  // ── Direct output changes presentation only ──
  it('keeps [直出] inside the alignment pipeline', () => {
    const result = processInstruction(
      '[直出] 这是一个简单的修改',
      tmpDir
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.verdict).toBe('GRAY');
    expect(result.presentationMode).toBe('direct_output');
    expect(result.enrichedMessage).toContain('[直出] 这是一个简单的修改');
    expect(result.context.lessons).toContain('Always check types');
    expect(result.verificationCommands).toContain('echo "test passed"');
  });

  it('keeps direct output requests subject to clarification', () => {
    const result = processInstruction(
      '直出 写个 README',
      tmpDir
    );

    expect(result.verdict).toBe('VAGUE');
    expect(result.presentationMode).toBe('direct_output');
    expect(result.enrichedMessage).toContain('直出 写个 README');
  });

  it('does not let the legacy bypass option skip high-risk analysis', () => {
    const result = processInstruction(
      '删除所有文件',
      tmpDir,
      { bypass: true }
    );

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(result.verdict).toBe('VAGUE');
    expect(result.presentationMode).toBe('direct_output');
    expect(result.enrichedMessage).toContain('删除所有文件');
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

  it('attributes an authorized enrich receipt to the user without project context', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-authorized-'));

    try {
      const result = processInstruction(
        '在开发 fixture 中删除 3 个已列名的废弃测试用户，运行 fixture 测试；已授权。',
        emptyDir
      );

      expect(result.alignmentDecision.route).toBe('enrich');
      expect(result.hostProjection.enrichmentReceipt?.items[0]).toEqual({
        id: 'B1',
        addition: '执行边界：沿用用户请求中已声明的范围、恢复条件与授权。',
        sources: [{ kind: 'user', ref: 'request:text' }]
      });
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
  });

  it('does not execute completion verification during intake', () => {
    const markerPath = path.join(tmpDir, 'verification-ran.txt');
    fs.writeFileSync(
      path.join(tmpDir, '.align', 'check-commands.txt'),
      `node -e "require('fs').writeFileSync('${markerPath.replace(/\\/g, '\\\\')}', 'ran')"\n`,
      'utf-8'
    );

    const result = processInstruction('修改 src/index.ts', tmpDir);

    expect(result.verificationCommands).toHaveLength(1);
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  // ── GRAY verdict (risk + edu) ──
  it('derives a pass projection for a read-only risk explanation', () => {
    const result = processInstruction(
      '解释一下删除数据库的命令',
      tmpDir
    );

    expect(result.alignmentDecision.route).toBe('pass');
    expect(result.verdict).toBe('CLEAR');
    expect(result.instructions).toContain('[对齐]');
    expect(result.instructions).toContain('route=pass');
    expect(result.hostProjection.enrichmentReceipt).toBeUndefined();
    expect(result.instructions).not.toContain('补全回执');
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
    expect(result).toHaveProperty('presentationMode');
    expect(result).toHaveProperty('alignmentDecision');
    expect(result).toHaveProperty('hostProjection');
    expect(result).not.toHaveProperty('handoff');
    expect(result).not.toHaveProperty('verificationResults');

    // Verify types
    expect(typeof result.verdict).toBe('string');
    expect(typeof result.instructions).toBe('string');
    expect(typeof result.enrichedMessage).toBe('string');
    expect(typeof result.context).toBe('object');
    expect(Array.isArray(result.verificationCommands)).toBe(true);
    expect(['default', 'direct_output']).toContain(result.presentationMode);
  });

  it('adds a Matt handoff only when the ecosystem is explicitly requested', () => {
    const skillDir = path.join(tmpDir, '.agents', 'skills', 'implement');
    const setupDir = path.join(tmpDir, 'docs', 'agents');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.mkdirSync(setupDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Implement\n', 'utf-8');
    for (const file of ['issue-tracker.md', 'triage-labels.md', 'domain.md']) {
      fs.writeFileSync(path.join(setupDir, file), `# ${file}\n`, 'utf-8');
    }

    const instruction = '只修改 src/parser.ts 中的解析逻辑，不改 public API；实现后运行 npm test -- parser。';
    const plain = processInstruction(instruction, tmpDir);
    const withMatt = processInstruction(instruction, tmpDir, {
      ecosystem: 'matt-pocock-skills'
    });

    expect(plain).not.toHaveProperty('handoff');
    expect(withMatt.handoff).toEqual(expect.objectContaining({
      status: 'ready',
      selectedSkill: 'implement',
      invocation: '/implement',
      automatic: false
    }));
  });

  it('does not let a Matt handoff bypass clarification', () => {
    const result = processInstruction('优化一下这个项目', tmpDir, {
      ecosystem: 'matt-pocock-skills'
    });

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(result.handoff).toEqual(expect.objectContaining({
      status: 'deferred',
      selectedSkill: null,
      invocation: null,
      automatic: false
    }));
  });

  it.each([
    ['claude-code', true],
    ['codex', false],
    ['cursor', false]
  ] as const)('keeps route and action stable for the %s adapter', (adapter, nativeBlocking) => {
    const request = '删除生产库 90 天未登录用户；dry-run 与备份已完成，但我尚未批准执行。';
    const result = processInstruction(request, tmpDir, {
      hostCapabilities: { adapter, nativeBlocking }
    });

    expect(result.alignmentDecision.route).toBe('block');
    expect(result.alignmentDecision.next.action).toBe('wait_confirmation');
    expect(result.hostProjection.nextAction).toBe('wait_confirmation');
    expect(result.hostProjection.shouldBlock).toBe(nativeBlocking);
  });

  it.each(['claude-code', 'codex', 'cursor'])('executes a fully authorized safety-critical request through %s', adapter => {
    const result = processInstruction(
      '在开发 fixture 中删除 3 个已列名的废弃测试用户，运行 fixture 测试；已授权。',
      tmpDir,
      { hostCapabilities: { adapter, nativeBlocking: adapter === 'claude-code' } }
    );

    expect(result.alignmentDecision.route).toBe('enrich');
    expect(result.alignmentDecision.next.action).toBe('execute');
    expect(result.hostProjection.nextAction).toBe('execute');
    expect(result.hostProjection.shouldBlock).toBe(false);
    expect(result.instructions).not.toContain('停止执行');
  });
});
