import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { enrich, AlignContext, EnrichmentResult } from '../enricher';

describe('enricher', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enricher-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createAlignDir(files: Record<string, string>) {
    const alignDir = path.join(tmpDir, '.align');
    fs.mkdirSync(alignDir, { recursive: true });
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(alignDir, name), content, 'utf-8');
    }
  }

  // ── Basic enrichment ──
  it('reads .align/ files and enriches message with context', () => {
    createAlignDir({
      'lessons.md': '- Always use TypeScript\n- Never use any',
      'spec.md': 'This is a spec',
      'context.md': 'Project context here',
      'decisions.log.md': 'Decision 1',
    });

    const result = enrich('Fix the bug', tmpDir);

    expect(result.enrichedMessage).toContain('项目经验规则');
    expect(result.enrichedMessage).toContain('Always use TypeScript');
    expect(result.enrichedMessage).toContain('项目规范');
    expect(result.enrichedMessage).toContain('This is a spec');
    expect(result.enrichedMessage).toContain('项目上下文');
    expect(result.enrichedMessage).toContain('Project context here');
    expect(result.enrichedMessage).toContain('决策日志');
    expect(result.enrichedMessage).toContain('Decision 1');
    expect(result.enrichedMessage).toContain('用户指令');
    expect(result.enrichedMessage).toContain('Fix the bug');

    expect(result.context.lessons).toContain('Always use TypeScript');
    expect(result.context.spec).toBe('This is a spec');
    expect(result.context.facts).toBe('');
    expect(result.context.context).toBe('Project context here');
    expect(result.context.decisions).toBe('Decision 1');
  });

  // ── Missing .align/ directory ──
  it('returns original instruction when .align/ directory is missing', () => {
    const result = enrich('Fix the bug', tmpDir);

    expect(result.enrichedMessage).toBe('Fix the bug');
    expect(result.context.lessons).toBe('');
    expect(result.context.spec).toBe('');
    expect(result.context.facts).toBe('');
    expect(result.context.glossary).toBe('');
    expect(result.context.state).toBe('');
    expect(result.context.context).toBe('');
    expect(result.context.decisions).toBe('');
  });

  // ── Empty .align/ files ──
  it('handles empty .align/ files gracefully', () => {
    createAlignDir({
      'lessons.md': '',
      'spec.md': '',
      'context.md': '',
      'decisions.log.md': '',
    });

    const result = enrich('Fix the bug', tmpDir);

    // Should return original instruction when no meaningful context
    expect(result.enrichedMessage).toBe('Fix the bug');
    expect(result.context.lessons).toBe('');
    expect(result.context.spec).toBe('');
    expect(result.context.context).toBe('');
    expect(result.context.decisions).toBe('');
  });

  // ── Partial .align/ files ──
  it('enriches with only spec when lessons is missing', () => {
    createAlignDir({
      'spec.md': 'Project specification only',
    });

    const result = enrich('Implement feature', tmpDir);

    expect(result.enrichedMessage).toContain('项目规范');
    expect(result.enrichedMessage).toContain('Project specification only');
    expect(result.enrichedMessage).toContain('用户指令');
    expect(result.enrichedMessage).toContain('Implement feature');
    expect(result.context.lessons).toBe('');
    expect(result.context.spec).toBe('Project specification only');
  });

  // ── Limit lessons to last 30 entries ──
  it('limits lessons to last 30 entries', () => {
    const lessons = Array.from({ length: 50 }, (_, i) => `- Lesson ${i + 1}`).join('\n');
    createAlignDir({
      'lessons.md': lessons,
    });

    const result = enrich('Do something', tmpDir);

    // Should contain lesson 21-50 (last 30)
    expect(result.context.lessons).toContain('Lesson 21');
    expect(result.context.lessons).toContain('Lesson 50');
    // Should not contain first 20 lessons
    expect(result.context.lessons).not.toContain('Lesson 1');
    expect(result.context.lessons).not.toContain('Lesson 20');
  });

  // ── Lessons with mixed content ──
  it('extracts only list items from lessons.md', () => {
    createAlignDir({
      'lessons.md': '# Lessons\n\nSome intro text\n\n- Lesson one\n- Lesson two\n\nMore text\n- Lesson three',
    });

    const result = enrich('Test', tmpDir);

    expect(result.context.lessons).toContain('- Lesson one');
    expect(result.context.lessons).toContain('- Lesson two');
    expect(result.context.lessons).toContain('- Lesson three');
    expect(result.context.lessons).not.toContain('# Lessons');
    expect(result.context.lessons).not.toContain('Some intro text');
  });

  // ── Whitespace trimming ──
  it('trims whitespace from file contents', () => {
    createAlignDir({
      'spec.md': '  \n  Spec with whitespace  \n  ',
    });

    const result = enrich('Test', tmpDir);

    expect(result.context.spec).toBe('Spec with whitespace');
  });

  it('prefers classified context files over the legacy projection', () => {
    createAlignDir({
      'facts.md': '- Runtime: Node optional [source: package.json]',
      'glossary.md': '- Alignment Decision: machine route contract',
      'state.md': '- updatedAt: 2026-07-12\n- invalidWhen: G4 closes',
      'context.md': 'STALE LEGACY CONTENT',
    });

    const result = enrich('Continue', tmpDir);

    expect(result.context.facts).toContain('Node optional');
    expect(result.context.glossary).toContain('Alignment Decision');
    expect(result.context.state).toContain('updatedAt');
    expect(result.context.context).toBe('');
    expect(result.enrichedMessage).not.toContain('STALE LEGACY CONTENT');
  });

  it('falls back to legacy context when classified files are absent', () => {
    createAlignDir({ 'context.md': 'Legacy-only project context' });
    const result = enrich('Continue', tmpDir);
    expect(result.context.context).toBe('Legacy-only project context');
  });

  it('avoids duplicate legacy content when a complete projection is consistent', () => {
    createAlignDir({
      'facts.md': '- Runtime: Node optional',
      'glossary.md': '- Alignment Decision: machine route contract',
      'state.md': '- updatedAt: 2026-07-12\n- invalidWhen: G4 closes',
      'context.md': '- Runtime: Node optional',
    });
    const result = enrich('Continue', tmpDir);
    expect(result.context.context).toBe('');
    expect(result.enrichedMessage.match(/Runtime: Node optional/g)).toHaveLength(1);
  });

  it('keeps legacy content during a partial classified migration', () => {
    createAlignDir({
      'facts.md': '- Runtime: Node optional',
      'context.md': 'Legacy glossary and state not migrated yet',
    });
    const result = enrich('Continue', tmpDir);
    expect(result.context.facts).toContain('Node optional');
    expect(result.context.context).toContain('not migrated yet');
  });

  it('loads a completed migration consistently on repeated reads', () => {
    createAlignDir({
      'facts.md': '- Runtime: Node optional',
      'glossary.md': '- Alignment Decision: machine route contract',
      'state.md': '- updatedAt: 2026-07-12\n- invalidWhen: G4 closes',
      'context.md': 'Legacy projection',
    });
    const first = enrich('Continue', tmpDir);
    expect(enrich('Continue', tmpDir)).toEqual(first);
    expect(first.context.context).toBe('');
  });

  it('rollback: reads the preserved legacy projection when classified files are removed', () => {
    createAlignDir({
      'facts.md': '- Runtime: Node optional',
      'glossary.md': '- Alignment Decision: machine route contract',
      'state.md': '- updatedAt: 2026-07-12\n- invalidWhen: G4 closes',
      'context.md': 'Preserved rollback projection',
    });
    expect(enrich('Continue', tmpDir).context.context).toBe('');
    fs.rmSync(path.join(tmpDir, '.align', 'facts.md'));
    fs.rmSync(path.join(tmpDir, '.align', 'glossary.md'));
    fs.rmSync(path.join(tmpDir, '.align', 'state.md'));
    expect(enrich('Continue', tmpDir).context.context).toBe('Preserved rollback projection');
  });
});
