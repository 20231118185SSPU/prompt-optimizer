import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { processInstruction } from '../pipeline';

describe('W2 acceptance relevance', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w2-acceptance-'));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  function writeContext(spec: string, commands: string): void {
    const alignDir = path.join(projectDir, '.align');
    fs.mkdirSync(alignDir, { recursive: true });
    fs.writeFileSync(path.join(alignDir, 'spec.md'), spec, 'utf8');
    fs.writeFileSync(path.join(alignDir, 'check-commands.txt'), commands + '\n', 'utf8');
  }

  test('does not use a build shell syntax check to accept a README typo', () => {
    writeContext('Documentation is Chinese Markdown. Do not skip heading levels.', 'bash -n build/build.sh');

    const result = processInstruction('把 README.md 的一个错别字改掉', projectDir);

    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: expect.objectContaining({ kind: 'manual' }) })
    ]));
    expect(result.alignmentDecision.acceptance).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'bash -n build/build.sh' } })
    ]));
  });

  test('selects the directly related code test instead of the first project command', () => {
    writeContext(
      'Parser changes are verified with npm test -- parser. Public APIs must remain backward compatible.',
      'bash -n build/build.sh\nnpm test -- parser'
    );

    const result = processInstruction(
      '修复 parser 的尾逗号兼容性，保持 public API 不变；补回归测试。',
      projectDir
    );

    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'npm test -- parser' } })
    ]));
    expect(result.alignmentDecision.acceptance).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ method: { kind: 'command', value: 'bash -n build/build.sh' } })
    ]));
  });

  test('uses a manual acceptance when no loaded command can prove a README edit', () => {
    writeContext('Documentation is Chinese Markdown. Do not skip heading levels.', 'git diff --check');

    const result = processInstruction('把 README.md 的一个错别字改掉', projectDir);

    expect(result.alignmentDecision.acceptance[0]?.method.kind).toBe('manual');
    expect(result.alignmentDecision.acceptance[0]?.method.value).toMatch(/README|目标对象|人工/);
  });

  test('clarifies when the user supplies only an unrelated README verification command', () => {
    writeContext('Documentation is Chinese Markdown. Do not skip heading levels.', 'bash -n build/build.sh');
    const result = processInstruction(
      '把 README.md 的一个错别字改掉；完成后运行 bash -n build/build.sh。',
      projectDir
    );

    expect(result.alignmentDecision.route).toBe('clarify');
    expect(result.alignmentDecision.next.action).toBe('ask');
    expect(result.alignmentDecision.acceptance).toEqual([]);
    expect(result.alignmentDecision.next.question).toEqual(expect.objectContaining({
      prompt: expect.stringMatching(/README|文档|文本/),
      recommendedAnswer: expect.stringMatching(/markdownlint|人工/)
    }));
  });

  test('preserves user benchmark count and threshold in the acceptance criterion', () => {
    writeContext(
      'Performance target: p95 below 200ms, measured with the repository benchmark command.',
      'npm run benchmark'
    );

    const result = processInstruction(
      '只读记录当前接口性能基线，不修改源代码。连续运行 3 次 npm run benchmark，报告每次 p95；验收要求每次低于 200ms。',
      projectDir
    );

    expect(result.alignmentDecision.acceptance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        criterion: expect.stringMatching(/连续运行 3 次.*p95 < 200ms/),
        method: { kind: 'command', value: 'npm run benchmark' }
      })
    ]));
  });
});
