import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { probeHostFeasibility } from '../index';

function hash(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const CANONICAL_CLAUDE_PROMPT_HOOK =
  'if [ -f "$HOME/.prompt-optimizer/adapters/claude-code.sh" ]; then ALIGN_SESSION_ACTIVATION=on BLOCK_ON_HIGH=on bash "$HOME/.prompt-optimizer/adapters/claude-code.sh"; ' +
  'elif [ -f "$CLAUDE_PROJECT_DIR/.align/align-route.sh" ]; then bash "$CLAUDE_PROJECT_DIR/.align/align-route.sh"; ' +
  'elif [ -f "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt" ]; then cat "$CLAUDE_PROJECT_DIR/.align/HOOK-REMINDER.txt"; ' +
  'else printf "%s\\n" "[对齐] 未检测到 Prompt Optimizer runtime。请重新安装并运行 /align-init。"; fi';

describe('Phase 1 read-only host feasibility probe', () => {
  test('reports a blocked hook setup without changing config, rules, or existing hooks', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-host-probe-'));
    const alignDir = path.join(projectDir, '.align');
    const claudeDir = path.join(projectDir, '.claude');
    const scriptsDir = path.join(projectDir, 'scripts');
    fs.mkdirSync(alignDir);
    fs.mkdirSync(claudeDir);
    fs.mkdirSync(scriptsDir);
    const specFile = path.join(alignDir, 'spec.md');
    const settingsFile = path.join(claudeDir, 'settings.json');
    const hookFile = path.join(scriptsDir, 'generic-hook.sh');
    fs.writeFileSync(specFile, '- 禁止安装、修改或替换项目 hook。\n', 'utf8');
    fs.writeFileSync(settingsFile, JSON.stringify({ hooks: { UserPromptSubmit: [] } }, null, 2), 'utf8');
    fs.writeFileSync(hookFile, '#!/usr/bin/env bash\necho existing\n', 'utf8');
    const before = new Map([
      [specFile, hash(specFile)],
      [settingsFile, hash(settingsFile)],
      [hookFile, hash(hookFile)]
    ]);
    const beforeFiles = fs.readdirSync(projectDir, { recursive: true }).map(String).sort();

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: '1.2.3' },
        requestedIngress: 'hook',
        homeDir: projectDir
      });

      expect(report).toEqual(expect.objectContaining({
        schemaVersion: '1.0.0',
        kind: 'alignment.host-feasibility',
        readOnly: true,
        host: { name: 'claude-code', version: '1.2.3', status: 'supported' },
        plannedChanges: []
      }));
      expect(report.configuration).toContainEqual(expect.objectContaining({
        path: '.claude/settings.json',
        status: 'available'
      }));
      expect(report.capabilities.promptIngress.status).toBe('blocked');
      expect(report.capabilities.mechanicalBlocking.status).toBe('blocked');
      expect(report.capabilities.completion.status).toBe('unknown');
      expect(report.capabilities.session.status).toBe('unknown');
      expect(report.conflicts).toContainEqual(expect.objectContaining({
        kind: 'project_policy',
        status: 'blocked',
        ref: '.align/spec.md'
      }));
      expect(report.dependencies).toContainEqual(expect.objectContaining({ name: 'node', status: 'available' }));
      expect(report.degradedPath).toEqual(expect.objectContaining({
        status: 'available',
        mode: 'explicit',
        activationLevel: 'advisory'
      }));

      for (const [file, digest] of before) expect(hash(file)).toBe(digest);
      expect(fs.readdirSync(projectDir, { recursive: true }).map(String).sort()).toEqual(beforeFiles);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('reports a recognized host as supported without inferring its unobserved capabilities', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-host-name-only-'));

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: '1.2.3' },
        requestedIngress: 'hook',
        homeDir: projectDir
      });

      expect(report.host.status).toBe('supported');
      expect(report.capabilities.promptIngress.status).toBe('unknown');
      expect(report.capabilities.mechanicalBlocking.status).toBe('unknown');
      expect(report.capabilities.completion.status).toBe('unknown');
      expect(report.capabilities.session.status).toBe('unknown');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('offers explicit invocation as the side-effect-free fallback', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-host-explicit-'));
    const beforeFiles = fs.readdirSync(projectDir, { recursive: true }).map(String).sort();

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'codex', version: 'test' },
        requestedIngress: 'explicit'
      });

      expect(report.capabilities.promptIngress).toEqual(expect.objectContaining({ status: 'available' }));
      expect(report.degradedPath).toEqual(expect.objectContaining({
        status: 'available',
        mode: 'explicit',
        activationLevel: 'advisory'
      }));
      expect(fs.readdirSync(projectDir, { recursive: true }).map(String).sort()).toEqual(beforeFiles);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('does not treat malformed hook entries as observed host capabilities', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-host-malformed-hook-'));
    const settingsDir = path.join(projectDir, '.claude');
    fs.mkdirSync(settingsDir);
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [{}], Stop: [{}] } }),
      'utf8'
    );

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: '1.2.3' },
        requestedIngress: 'hook',
        homeDir: projectDir
      });

      expect(report.capabilities.promptIngress.status).toBe('unknown');
      expect(report.capabilities.mechanicalBlocking.status).toBe('unknown');
      expect(report.capabilities.completion.status).toBe('unknown');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('does not treat a missing hook command as an available capability', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-host-missing-command-'));
    const settingsDir = path.join(projectDir, '.claude');
    fs.mkdirSync(settingsDir);
    const missingHook = { hooks: [{ type: 'command', command: 'definitely-missing-command-xyz' }] };
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [missingHook], Stop: [missingHook] } }),
      'utf8'
    );

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: '1.2.3' },
        requestedIngress: 'hook',
        homeDir: projectDir
      });

      expect(report.capabilities.promptIngress.status).toBe('unknown');
      expect(report.capabilities.mechanicalBlocking.status).toBe('unknown');
      expect(report.capabilities.completion.status).toBe('unknown');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('detects the installed user-level Claude hook without leaking its absolute path or writing files', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-session-feasibility-'));
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-session-home-'));
    const globalClaudeDir = path.join(homeDir, '.claude');
    const adapterFile = path.join(homeDir, '.prompt-optimizer', 'adapters', 'claude-code.sh');
    const settingsFile = path.join(globalClaudeDir, 'settings.json');
    fs.mkdirSync(globalClaudeDir, { recursive: true });
    fs.mkdirSync(path.dirname(adapterFile), { recursive: true });
    fs.writeFileSync(adapterFile, '#!/usr/bin/env bash\nexit 0\n', 'utf8');
    fs.writeFileSync(settingsFile, JSON.stringify({
      hooks: {
        UserPromptSubmit: [{
          hooks: [{ type: 'command', command: CANONICAL_CLAUDE_PROMPT_HOOK }]
        }]
      }
    }), 'utf8');
    const before = [hash(adapterFile), hash(settingsFile)];
    const beforeProjectFiles = fs.readdirSync(projectDir, { recursive: true }).map(String).sort();
    const beforeHomeFiles = fs.readdirSync(homeDir, { recursive: true }).map(String).sort();

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: 'test' },
        requestedIngress: 'hook',
        homeDir
      });

      expect(report.configuration).toContainEqual(expect.objectContaining({
        path: '.claude/settings.json',
        status: 'unknown'
      }));
      expect(report.configuration).toContainEqual(expect.objectContaining({
        path: '~/.claude/settings.json',
        status: 'available'
      }));
      expect(JSON.stringify(report)).not.toContain(homeDir);
      expect(report.capabilities.promptIngress.status).toBe('available');
      expect(report.capabilities.session).toEqual(expect.objectContaining({
        status: 'available'
      }));
      expect(report.capabilities.session.detail).toContain('session_id');
      expect([hash(adapterFile), hash(settingsFile)]).toEqual(before);
      expect(fs.readdirSync(projectDir, { recursive: true }).map(String).sort()).toEqual(beforeProjectFiles);
      expect(fs.readdirSync(homeDir, { recursive: true }).map(String).sort()).toEqual(beforeHomeFiles);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });

  test.each([
    ['claude-code', 'node ./session-hook.js'],
    ['codex', 'ALIGN_SESSION_ACTIVATION=on node ./session-hook.js'],
    ['cursor', 'ALIGN_SESSION_ACTIVATION=on node ./session-hook.js']
  ])(
    'does not infer session activation for %s from an ineligible hook configuration',
    (hostName, command) => {
      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-session-unobserved-'));
      const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-session-unobserved-home-'));
      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir);
      const hookFile = path.join(projectDir, 'session-hook.js');
      fs.writeFileSync(hookFile, 'process.exit(0);\n', 'utf8');
      fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({
        hooks: {
          UserPromptSubmit: [{ hooks: [{ type: 'command', command }] }]
        }
      }), 'utf8');

      try {
        const report = probeHostFeasibility(projectDir, {
          host: { name: hostName, version: 'test' },
          requestedIngress: 'hook',
          homeDir
        });

        expect(report.capabilities.session.status).toBe('unknown');
      } finally {
        fs.rmSync(projectDir, { recursive: true, force: true });
        fs.rmSync(homeDir, { recursive: true, force: true });
      }
    }
  );

  test('does not claim an installed hook when its canonical adapter is absent', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-missing-adapter-project-'));
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-missing-adapter-home-'));
    const settingsDir = path.join(homeDir, '.claude');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({
      hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: CANONICAL_CLAUDE_PROMPT_HOOK }] }] }
    }), 'utf8');

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: 'test' },
        requestedIngress: 'hook',
        homeDir
      });

      expect(report.capabilities.promptIngress.status).toBe('unknown');
      expect(report.capabilities.session.status).toBe('unknown');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });

  test('keeps ingress available for the legacy canonical hook without inferring session activation', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-legacy-hook-project-'));
    const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p2-legacy-hook-home-'));
    const settingsDir = path.join(homeDir, '.claude');
    const adapterFile = path.join(homeDir, '.prompt-optimizer', 'adapters', 'claude-code.sh');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.mkdirSync(path.dirname(adapterFile), { recursive: true });
    fs.writeFileSync(adapterFile, '#!/usr/bin/env bash\nexit 0\n', 'utf8');
    fs.writeFileSync(path.join(settingsDir, 'settings.json'), JSON.stringify({
      hooks: {
        UserPromptSubmit: [{
          hooks: [{ type: 'command', command: CANONICAL_CLAUDE_PROMPT_HOOK.replace('ALIGN_SESSION_ACTIVATION=on ', '') }]
        }]
      }
    }), 'utf8');

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: 'test' },
        requestedIngress: 'hook',
        homeDir
      });

      expect(report.capabilities.promptIngress.status).toBe('available');
      expect(report.capabilities.session.status).toBe('unknown');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(homeDir, { recursive: true, force: true });
    }
  });

  test('reports a parallel standalone router without modifying either implementation', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-parallel-router-'));
    const hostDir = path.join(projectDir, 'core', 'host');
    fs.mkdirSync(hostDir, { recursive: true });
    const standalone = path.join(projectDir, 'core', 'hook-router.sh');
    const canonical = path.join(hostDir, 'align-route.sh');
    fs.writeFileSync(standalone, '#!/usr/bin/env bash\necho standalone\n', 'utf8');
    fs.writeFileSync(canonical, '#!/usr/bin/env bash\necho canonical\n', 'utf8');
    const before = [hash(standalone), hash(canonical)];

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: 'test' },
        requestedIngress: 'hook',
        homeDir: projectDir
      });

      expect(report.conflicts).toContainEqual(expect.objectContaining({
        kind: 'parallel_router',
        status: 'blocked',
        ref: 'core/hook-router.sh'
      }));
      expect(report.capabilities.promptIngress.status).toBe('blocked');
      expect(report.capabilities.mechanicalBlocking.status).toBe('blocked');
      expect([hash(standalone), hash(canonical)]).toEqual(before);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('recognizes a marked canonical wrapper without modifying either implementation', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p1-canonical-wrapper-'));
    const hostDir = path.join(projectDir, 'core', 'host');
    fs.mkdirSync(hostDir, { recursive: true });
    const wrapper = path.join(projectDir, 'core', 'hook-router.sh');
    const canonical = path.join(hostDir, 'align-route.sh');
    fs.writeFileSync(
      wrapper,
      '#!/usr/bin/env bash\n' +
        '# prompt-optimizer: canonical-router-wrapper v1\n' +
        'SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\n' +
        'CANONICAL_ROUTER="$SCRIPT_DIR/host/align-route.sh"\n' +
        'exec bash "$CANONICAL_ROUTER" "$@"\n',
      'utf8'
    );
    fs.writeFileSync(canonical, '#!/usr/bin/env bash\necho canonical\n', 'utf8');
    const before = [hash(wrapper), hash(canonical)];
    const beforeFiles = fs.readdirSync(projectDir, { recursive: true }).map(String).sort();

    try {
      const report = probeHostFeasibility(projectDir, {
        host: { name: 'claude-code', version: 'test' },
        requestedIngress: 'hook',
        homeDir: projectDir
      });

      expect(report.conflicts).not.toContainEqual(expect.objectContaining({ kind: 'parallel_router' }));
      expect(report.capabilities.promptIngress.status).toBe('unknown');
      expect(report.capabilities.mechanicalBlocking.status).toBe('unknown');
      expect([hash(wrapper), hash(canonical)]).toEqual(before);
      expect(fs.readdirSync(projectDir, { recursive: true }).map(String).sort()).toEqual(beforeFiles);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
