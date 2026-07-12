import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeContextProjection } from '../context-projection';

describe('context compatibility projection', () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'align-projection-'));
    fs.mkdirSync(path.join(projectDir, '.align'));
    fs.writeFileSync(path.join(projectDir, '.align', 'facts.md'), '# Facts\n\n- runtime: node');
    fs.writeFileSync(path.join(projectDir, '.align', 'glossary.md'), '# Terms\n\n- Decision: route contract');
    fs.writeFileSync(path.join(projectDir, '.align', 'state.md'), '# State\n\n- updatedAt: now\n- invalidWhen: release');
  });
  afterEach(() => fs.rmSync(projectDir, { recursive: true, force: true }));

  it('new-only: creates a deterministic legacy projection', () => {
    expect(writeContextProjection(projectDir).status).toBe('created');
    const projection = fs.readFileSync(path.join(projectDir, '.align', 'context.md'), 'utf8');
    expect(projection).toContain('# Facts\n\n- runtime: node');
    expect(projection).toContain('# Terms\n\n- Decision: route contract');
    expect(projection).toContain('- invalidWhen: release');
  });

  it('both-consistent and repeated upgrade: remains byte-identical', () => {
    writeContextProjection(projectDir);
    const first = fs.readFileSync(path.join(projectDir, '.align', 'context.md'), 'utf8');
    expect(writeContextProjection(projectDir).status).toBe('unchanged');
    expect(fs.readFileSync(path.join(projectDir, '.align', 'context.md'), 'utf8')).toBe(first);
  });

  it('updates an unmodified projection after a classified source changes', () => {
    writeContextProjection(projectDir);
    fs.appendFileSync(path.join(projectDir, '.align', 'facts.md'), '\n- host: codex');
    expect(writeContextProjection(projectDir).status).toBe('updated');
  });

  it('both-divergent: blocks manual projection edits unless review forces replacement', () => {
    writeContextProjection(projectDir);
    fs.appendFileSync(path.join(projectDir, '.align', 'context.md'), '\nmanual edit');
    expect(() => writeContextProjection(projectDir)).toThrow('Divergent legacy context projection');
    expect(writeContextProjection(projectDir, true).status).toBe('updated');
  });

  it('old-only or partial: refuses projection until every classified source exists', () => {
    fs.rmSync(path.join(projectDir, '.align', 'state.md'));
    fs.writeFileSync(path.join(projectDir, '.align', 'context.md'), 'legacy content');
    expect(() => writeContextProjection(projectDir)).toThrow('missing state.md');
    expect(fs.readFileSync(path.join(projectDir, '.align', 'context.md'), 'utf8')).toBe('legacy content');
  });

  it('old-only migration: requires force and preserves classified content in the projection', () => {
    const legacyPath = path.join(projectDir, '.align', 'context.md');
    fs.writeFileSync(legacyPath, 'legacy facts, terms, and state');
    expect(() => writeContextProjection(projectDir)).toThrow('Divergent legacy context projection');
    writeContextProjection(projectDir, true);
    const projection = fs.readFileSync(legacyPath, 'utf8');
    expect(projection).toContain('- runtime: node');
    expect(projection).toContain('- Decision: route contract');
    expect(projection).toContain('- updatedAt: now');
  });
});
