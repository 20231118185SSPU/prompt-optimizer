import { classify } from '../classifier';
import { route } from '../router';
import { enrich } from '../enricher';
import { getVerificationCommands } from '../verifier';
import { processInstruction } from '../pipeline';
import * as path from 'path';
import * as fs from 'fs';

describe('Integration Tests — real .align/ directory', () => {
  // Resolve to the project root (5 levels up from src/__tests__/)
  const realProjectDir = path.resolve(__dirname, '../../../../../');

  // Sanity: the real .align/ directory must exist
  beforeAll(() => {
    const alignDir = path.join(realProjectDir, '.align');
    expect(fs.existsSync(alignDir)).toBe(true);
    expect(fs.existsSync(path.join(alignDir, 'lessons.md'))).toBe(true);
    expect(fs.existsSync(path.join(alignDir, 'spec.md'))).toBe(true);
    expect(fs.existsSync(path.join(alignDir, 'context.md'))).toBe(true);
  });

  // ── Classifier with real-world instructions ──

  describe('classifier', () => {
    test('classifies clear instruction', () => {
      const result = classify('修改 src/index.ts 的 main 函数');
      expect(result.specific).toBeGreaterThan(0);
      expect(result.risk).toBe(0);
    });

    test('classifies vague instruction', () => {
      const result = classify('优化一下');
      expect(result.vague).toBeGreaterThan(0);
      expect(result.specific).toBe(0);
    });

    test('classifies high-risk instruction', () => {
      const result = classify('删除这个文件');
      expect(result.risk).toBeGreaterThan(0);
    });

    test('classifies educational instruction', () => {
      const result = classify('解释一下删除数据库的命令');
      expect(result.risk).toBeGreaterThan(0);
      expect(result.edu).toBeGreaterThan(0);
    });
  });

  // ── Router ──

  describe('router', () => {
    test('clear signal → CLEAR verdict', () => {
      const classification = classify('修改 src/index.ts 的 main 函数');
      const result = route(classification);
      expect(result.verdict).toBe('CLEAR');
      expect(result.instructions).toContain('[对齐]');
      expect(result.instructions).toContain('CLEAR');
    });

    test('vague signal → VAGUE verdict', () => {
      const classification = classify('优化一下');
      const result = route(classification);
      expect(result.verdict).toBe('VAGUE');
      expect(result.instructions).toContain('[对齐]');
      expect(result.instructions).toContain('VAGUE');
    });

    test('risk signal → HIGH verdict', () => {
      const classification = classify('删除这个文件');
      const result = route(classification);
      expect(result.verdict).toBe('HIGH');
      expect(result.instructions).toContain('高风险');
      expect(result.instructions).toContain('HIGH');
    });

    test('risk + edu signal → GRAY verdict', () => {
      const classification = classify('解释一下删除数据库的命令');
      const result = route(classification);
      expect(result.verdict).toBe('GRAY');
      expect(result.instructions).toContain('[对齐]');
      expect(result.instructions).toContain('GRAY');
    });
  });

  // ── Enricher with real .align/ files ──

  describe('enricher', () => {
    test('enriches message with real lessons', () => {
      const result = enrich('帮我优化这个项目', realProjectDir);

      expect(result.enrichedMessage).toContain('用户指令');
      expect(result.enrichedMessage).toContain('帮我优化这个项目');
      expect(result.context.lessons).toBeTruthy();
      expect(result.context.lessons).toContain('[安装验收]');
    });

    test('enriches message with real spec', () => {
      const result = enrich('修复一个 bug', realProjectDir);

      expect(result.context.spec).toBeTruthy();
      expect(result.context.spec).toContain('项目开发规范');
      expect(result.enrichedMessage).toContain('项目规范');
    });

    test('enriches message with real context', () => {
      const result = enrich('重构模块', realProjectDir);

      expect(result.context.context).toBeTruthy();
      expect(result.context.context).toContain('项目目标');
      expect(result.enrichedMessage).toContain('项目上下文');
    });

    test('enriches message with real decisions', () => {
      const result = enrich('修改架构', realProjectDir);

      expect(result.context.decisions).toBeTruthy();
      expect(result.context.decisions).toContain('缺陷确认');
      expect(result.enrichedMessage).toContain('决策日志');
    });
  });

  // ── Verifier with real check-commands.txt ──

  describe('verifier', () => {
    test('reads verification commands from real .align/', () => {
      const commands = getVerificationCommands(realProjectDir);

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some(cmd => cmd.includes('bash -n'))).toBe(true);
      expect(commands.some(cmd => cmd.includes('build/build.sh'))).toBe(true);
    });

    test('filters comments and empty lines', () => {
      const commands = getVerificationCommands(realProjectDir);

      for (const cmd of commands) {
        expect(cmd.startsWith('#')).toBe(false);
        expect(cmd.trim()).not.toBe('');
      }
    });
  });

  // ── Full pipeline intake does not execute completion verification ──

  describe('pipeline direct presentation', () => {
    test('[直出] prefix keeps routing active', () => {
      const result = processInstruction('[直出] 简单修改', realProjectDir);

      expect(result.verdict).not.toBe('BYPASS');
      expect(result.presentationMode).toBe('direct_output');
      expect(result.context.lessons).toBeTruthy();
    });

    test('legacy bypass option cannot skip high-risk routing', () => {
      const result = processInstruction('删除所有文件', realProjectDir, { bypass: true });

      expect(result.verdict).toBe('HIGH');
      expect(result.presentationMode).toBe('direct_output');
    });
  });
});
