import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'path';

describe('JSON CLI channel separation', () => {
  const pipelineRoot = path.resolve(__dirname, '../..');
  const cli = path.resolve(__dirname, '../../dist/index.js');

  beforeAll(() => {
    execFileSync(process.execPath, [path.resolve(__dirname, '../../node_modules/typescript/bin/tsc')], {
      cwd: pipelineRoot
    });
  });

  test('writes parseable decision JSON to stdout and disclosure to stderr', () => {
    const result = spawnSync(process.execPath, [
      cli,
      'json',
      '只修改 src/parser.ts 中的 parseUser 名称，不改 public API；完成后运行 npm test -- parser。',
      '--project-dir',
      path.resolve(__dirname, '../../../..')
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).kind).toBe('alignment.decision');
    expect(result.stderr).toContain('[alignment] route=pass');
    expect(result.stdout).not.toContain('[alignment]');
  });

  test('keeps json mode decision-only even when Matt skills are discoverable', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matt-json-cli-'));

    try {
      const skillDir = path.join(projectDir, '.agents', 'skills', 'implement');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Implement\n', 'utf8');

      const result = spawnSync(process.execPath, [
        cli,
        'json',
        '只修改 src/parser.ts 中的解析逻辑，不改 public API；实现后运行 npm test -- parser。',
        '--project-dir',
        projectDir
      ], { encoding: 'utf8' });
      const output = JSON.parse(result.stdout);

      expect(result.status).toBe(0);
      expect(output.kind).toBe('alignment.decision');
      expect(output).not.toHaveProperty('handoff');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('writes a pure Matt handoff envelope to stdout and route/status to stderr', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'matt-cli-'));

    try {
      const skillDir = path.join(projectDir, '.agents', 'skills', 'implement');
      const setupDir = path.join(projectDir, 'docs', 'agents');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.mkdirSync(setupDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Implement\n', 'utf8');
      for (const file of ['issue-tracker.md', 'triage-labels.md', 'domain.md']) {
        fs.writeFileSync(path.join(setupDir, file), `# ${file}\n`, 'utf8');
      }

      const result = spawnSync(process.execPath, [
        cli,
        'matt',
        '只修改 src/parser.ts 中的解析逻辑，不改 public API；实现后运行 npm test -- parser。',
        '--project-dir',
        projectDir
      ], { encoding: 'utf8' });
      const output = JSON.parse(result.stdout);

      expect(result.status).toBe(0);
      expect(output).toEqual(expect.objectContaining({
        kind: 'alignment.ecosystem-handoff',
        ecosystem: 'matt-pocock-skills',
        status: 'ready',
        selectedSkill: 'implement',
        invocation: '/implement',
        automatic: false
      }));
      expect(output).not.toHaveProperty('skillBody');
      expect(result.stderr).toContain('[alignment] route=pass status=ready');
      expect(result.stdout).not.toContain('[alignment]');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('does not mechanically block an incomplete safety-critical clarification', () => {
    const result = spawnSync(process.execPath, [
      cli,
      'claude-code',
      '删除旧用户数据。',
      '--project-dir',
      path.resolve(__dirname, '../../../..')
    ], {
      encoding: 'utf8',
      env: { ...process.env, BLOCK_ON_HIGH: 'on' }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('route=clarify next.action=ask');
  });

  test('mechanically blocks only a wait_confirmation decision', () => {
    const result = spawnSync(process.execPath, [
      cli,
      'claude-code',
      '删除生产库中全部 90 天未登录用户；备份和回滚条件已定义，但尚未确认执行。',
      '--project-dir',
      path.resolve(__dirname, '../../../..')
    ], {
      encoding: 'utf8',
      env: { ...process.env, BLOCK_ON_HIGH: 'on' }
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('route=block next.action=wait_confirmation');
  });

  test('does not block a fully authorized safety-critical execution', () => {
    const result = spawnSync(process.execPath, [
      cli,
      'claude-code',
      '在开发 fixture 中删除 3 个已列名的废弃测试用户，运行 fixture 测试；已授权。',
      '--project-dir',
      path.resolve(__dirname, '../../../..')
    ], {
      encoding: 'utf8',
      env: { ...process.env, BLOCK_ON_HIGH: 'on' }
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('route=enrich next.action=execute');
  });
});
