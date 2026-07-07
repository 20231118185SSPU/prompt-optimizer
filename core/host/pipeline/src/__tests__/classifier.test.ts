import { classify, Classification } from '../classifier';

describe('classify', () => {
  // ── Empty input ──
  it('returns all zeros for empty string', () => {
    const result = classify('');
    expect(result).toEqual({ risk: 0, vague: 0, specific: 0, edu: 0 });
  });

  // ── Risk signals ──
  it('detects risk signal: 删除', () => {
    expect(classify('删除这个文件').risk).toBeGreaterThanOrEqual(1);
  });

  it('detects risk signal: rm -rf', () => {
    expect(classify('运行 rm -rf /tmp').risk).toBeGreaterThanOrEqual(1);
  });

  it('detects risk signal: force push', () => {
    expect(classify('do a force push to main').risk).toBeGreaterThanOrEqual(1);
  });

  it('detects risk signal: drop table', () => {
    expect(classify('drop table users').risk).toBeGreaterThanOrEqual(1);
  });

  it('detects risk signal: 生产环境', () => {
    expect(classify('部署到生产环境').risk).toBeGreaterThanOrEqual(1);
  });

  // ── Vague signals ──
  it('detects vague signal: 优化一下', () => {
    expect(classify('优化一下').vague).toBeGreaterThanOrEqual(1);
  });

  it('detects vague signal: refactor', () => {
    expect(classify('refactor this code').vague).toBeGreaterThanOrEqual(1);
  });

  it('detects vague signal: 弄一下', () => {
    expect(classify('帮我弄一下').vague).toBeGreaterThanOrEqual(1);
  });

  it('detects vague signal: polish', () => {
    expect(classify('polish the code').vague).toBeGreaterThanOrEqual(1);
  });

  it('detects vague signal: 加个功能', () => {
    expect(classify('加个功能').vague).toBeGreaterThanOrEqual(1);
  });

  // ── Specific signals ──
  it('detects specific signal: file path', () => {
    expect(classify('修改 src/index.ts 的 main 函数').specific).toBeGreaterThanOrEqual(1);
  });

  it('detects specific signal: function call syntax', () => {
    expect(classify('修复 parseConfig() 的 bug').specific).toBeGreaterThanOrEqual(1);
  });

  it('detects specific signal: line number', () => {
    expect(classify('第 42 行有错误').specific).toBeGreaterThanOrEqual(1);
  });

  it('detects specific signal: line N English', () => {
    expect(classify('fix the error at line 10').specific).toBeGreaterThanOrEqual(1);
  });

  // ── Educational signals ──
  it('detects edu signal: 解释', () => {
    expect(classify('解释一下什么是 force push').edu).toBeGreaterThanOrEqual(1);
  });

  it('detects edu signal: what is', () => {
    expect(classify('what is a linked list').edu).toBeGreaterThanOrEqual(1);
  });

  it('detects edu signal: 介绍一下', () => {
    expect(classify('介绍一下 React hooks').edu).toBeGreaterThanOrEqual(1);
  });

  it('detects edu signal: translate', () => {
    expect(classify('translate this to English').edu).toBeGreaterThanOrEqual(1);
  });

  // ── Code block stripping ──
  it('strips code blocks before risk detection', () => {
    const input = '```\nrm -rf /\n```\n帮我看看这段代码';
    const result = classify(input);
    expect(result.risk).toBe(0);
    expect(result.vague).toBeGreaterThanOrEqual(1);
  });

  it('strips inline code before risk detection', () => {
    const input = '解释一下 `rm -rf` 命令';
    const result = classify(input);
    expect(result.risk).toBe(0);
    expect(result.edu).toBeGreaterThanOrEqual(1);
  });

  // ── Negation stripping ──
  it('strips negation clauses: 不要删除', () => {
    expect(classify('不要删除这个文件').risk).toBe(0);
  });

  it('strips negation clauses: do not delete', () => {
    expect(classify('do not delete this file').risk).toBe(0);
  });

  it('strips negation clauses: 禁止清空', () => {
    expect(classify('禁止清空数据库').risk).toBe(0);
  });

  // ── Specific signals run on original text (not stripped) ──
  it('detects specific signals from quoted content', () => {
    const input = '修改 `"config.json"` 里的端口号';
    expect(classify(input).specific).toBeGreaterThanOrEqual(1);
  });

  // ── Multiple signal types ──
  it('can detect multiple signal types simultaneously', () => {
    const result = classify('优化 src/utils.ts 的 parseConfig() 函数');
    expect(result.vague).toBeGreaterThanOrEqual(1);
    expect(result.specific).toBeGreaterThanOrEqual(1);
  });
});
