import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { activateClaudeSession, readClaudeSessionActivation } from '../session-activation';

const SESSION_A = '0123456789abcdef01234567';
const SESSION_B = 'fedcba9876543210fedcba98';
const NOW = 1_700_000_000_000;

describe('Claude session activation state', () => {
  let projectDir: string;
  let stateHome: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-activation-project-'));
    stateHome = fs.mkdtempSync(path.join(os.tmpdir(), 'session-activation-state-'));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(stateHome, { recursive: true, force: true });
  });

  function options(now = NOW) {
    return { now, stateHome };
  }

  function onlyRecord(): string {
    return path.join(stateHome, fs.readdirSync(stateHome)[0]);
  }

  test('activates only the supplied Claude session', () => {
    expect(activateClaudeSession(projectDir, SESSION_A, options())).toEqual({
      status: 'active', expiresAtMs: NOW + 8 * 60 * 60 * 1000
    });
    expect(readClaudeSessionActivation(projectDir, SESSION_A, options())).toMatchObject({ status: 'active' });
    expect(readClaudeSessionActivation(projectDir, SESSION_B, options())).toEqual({ status: 'inactive' });
  });

  test('does not activate the same session ref in another project', () => {
    const otherProject = fs.mkdtempSync(path.join(os.tmpdir(), 'session-activation-other-project-'));
    try {
      activateClaudeSession(projectDir, SESSION_A, options());
      expect(readClaudeSessionActivation(otherProject, SESSION_A, options())).toEqual({ status: 'inactive' });
    } finally {
      fs.rmSync(otherProject, { recursive: true, force: true });
    }
  });

  test('expires after the fixed eight-hour TTL', () => {
    activateClaudeSession(projectDir, SESSION_A, options());
    expect(readClaudeSessionActivation(projectDir, SESSION_A, options(NOW + 8 * 60 * 60 * 1000)))
      .toEqual({ status: 'inactive' });
  });

  test.each(['UPPERCASE0123456789ABCDEF', '0123456789abcdef0123456', 'opaque-session-ref'])(
    'fails closed for invalid session ref %s', sessionRef => {
      expect(activateClaudeSession(projectDir, sessionRef, options()))
        .toEqual({ status: 'inactive', reason: 'invalid_session_ref' });
      expect(readClaudeSessionActivation(projectDir, sessionRef, options()))
        .toEqual({ status: 'inactive', reason: 'invalid_session_ref' });
      expect(fs.readdirSync(stateHome)).toEqual([]);
    }
  );

  test.each([
    ['malformed JSON', '{'],
    ['extra key', JSON.stringify({ kind: 'alignment.claude-session-activation', schemaVersion: '1.0.0', activatedAtMs: NOW, expiresAtMs: NOW + 8 * 60 * 60 * 1000, projectPath: 'forbidden' })],
    ['oversized', 'x'.repeat(4097)]
  ])('fails closed for %s record', (_name, contents) => {
    activateClaudeSession(projectDir, SESSION_A, options());
    fs.writeFileSync(onlyRecord(), contents, 'utf8');
    expect(readClaudeSessionActivation(projectDir, SESSION_A, options())).toEqual({ status: 'inactive' });
  });

  test('fails closed for a symlink activation record', () => {
    activateClaudeSession(projectDir, SESSION_A, options());
    const record = onlyRecord();
    const target = `${record}.target`;
    fs.renameSync(record, target);
    fs.symlinkSync(target, record, 'file');
    expect(readClaudeSessionActivation(projectDir, SESSION_A, options())).toEqual({ status: 'inactive' });
  });

  test('fails closed when the configured state home is a symlink', () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'session-activation-state-target-'));
    fs.rmSync(stateHome, { recursive: true, force: true });
    fs.symlinkSync(target, stateHome, 'dir');
    try {
      expect(activateClaudeSession(projectDir, SESSION_A, options()))
        .toEqual({ status: 'inactive', reason: 'storage_unavailable' });
      expect(readClaudeSessionActivation(projectDir, SESSION_A, options()))
        .toEqual({ status: 'inactive' });
      expect(fs.readdirSync(target)).toEqual([]);
    } finally {
      fs.rmSync(target, { recursive: true, force: true });
    }
  });

  test('does not persist raw project paths or session refs', () => {
    activateClaudeSession(projectDir, SESSION_A, options());
    const file = onlyRecord();
    const contents = fs.readFileSync(file, 'utf8');
    expect(path.basename(file)).not.toContain(SESSION_A);
    expect(path.basename(file)).not.toContain(path.basename(projectDir));
    expect(contents).not.toContain(SESSION_A);
    expect(contents).not.toContain(projectDir);
    expect(JSON.parse(contents)).toEqual({
      kind: 'alignment.claude-session-activation',
      schemaVersion: '1.0.0',
      activatedAtMs: NOW,
      expiresAtMs: NOW + 8 * 60 * 60 * 1000
    });
  });
});
