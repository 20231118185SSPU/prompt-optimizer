import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import {
  checkReferenceHostBaseline,
  completeReferenceHostRun,
  issueReferenceHostHandoff,
  prepareReferenceHostBaseline,
  recordReferenceHostHandoff,
  ReferenceHostResult,
  ReferenceHostTransitionToken
} from '../reference-host';
import { alignInstruction } from '../alignment-interface';

const contractRoot = path.resolve(__dirname, '../../../../contracts');
const lifecycleSchema = JSON.parse(fs.readFileSync(
  path.join(contractRoot, 'lifecycle-event.schema.json'),
  'utf8'
));
const validateLifecycleEvent = new Ajv2020({ allErrors: true, strict: true }).compile(lifecycleSchema);

function requireTransition(result: ReferenceHostResult): ReferenceHostTransitionToken {
  expect(result.transition).toEqual({
    runId: expect.stringMatching(/^run-/),
    expectedRevision: expect.any(Number)
  });
  return result.transition!;
}

const baselineMismatchCases: Array<[string, (report: Record<string, any>) => void]> = [
  ['requestId', report => { report.requestId = 'request-mismatch'; }],
  ['decisionId', report => { report.decisionId = 'decision-mismatch'; }],
  ['runId', report => { report.runId = 'run-mismatch'; }],
  ['revision', report => { report.revision += 1; }],
  ['phase', report => { report.phase = 'completion'; }]
];

const baselinePlanMismatchCases: Array<[
  string,
  string,
  (decision: Record<string, any>) => void
]> = [
  ['Decision identity', 'decision-identity-bound', decision => { decision.requestId = 'request-mismatch'; }],
  ['scope snapshot', 'scope-snapshot-bound', decision => { decision.scope.exclude = ['changed-after-prepare']; }]
];

const lifecyclePairTamperCases: Array<[
  string,
  'baselineReportRef' | 'executionHandoffRef',
  (artifact: Record<string, any>) => void
]> = [
  ['BaselineReport revision', 'baselineReportRef', artifact => { artifact.revision += 1; }],
  ['ExecutionHandoff phase', 'executionHandoffRef', artifact => { artifact.phase = 'completion'; }]
];

describe('W5 Claude Code reference host lifecycle', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w5-reference-host-'));
    fs.mkdirSync(path.join(projectDir, '.align'), { recursive: true });
    fs.writeFileSync(path.join(projectDir, '.align', 'check-commands.txt'), 'bash -n .align/align-check.sh\nexit 1\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, '.align', 'align-check.sh'), '#!/usr/bin/env bash\ntrue\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, '.align', 'spec.md'), 'Project verification contract\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, '.align', 'facts.md'), 'Project facts\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test('never issues a handoff without a passed BaselineReport artifact', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;

    const result = recordReferenceHostHandoff(projectDir, prompt, decision);
    const state = JSON.parse(fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
      'utf8'
    ));

    expect(result.status).toBe('handoff_issued');
    expect(state.baselineReportRef).toEqual(expect.any(String));
    const reportRef = String(state.baselineReportRef);
    expect(reportRef).toMatch(/^artifact:\.align\/\.runtime\/lifecycle\//);
    const report = JSON.parse(fs.readFileSync(
      path.join(projectDir, reportRef.slice('artifact:'.length)),
      'utf8'
    ));
    expect(report).toMatchObject({
      kind: 'alignment.baseline-report',
      phase: 'baseline',
      status: 'passed',
      requestId: decision.requestId,
      decisionId: decision.decisionId,
      runId: state.runId,
      revision: state.revision
    });
  });

  test('binds schema-valid BaselineReport and ExecutionHandoff artifacts to one revision', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;

    expect(recordReferenceHostHandoff(projectDir, prompt, decision).status).toBe('handoff_issued');
    const state = JSON.parse(fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
      'utf8'
    ));
    expect(state).toEqual(expect.objectContaining({
      baselineReportRef: expect.any(String),
      executionHandoffRef: expect.any(String),
      acceptancePlanRef: expect.any(String),
      scopeFingerprint: expect.stringMatching(/^sha256:[0-9a-f]{64}$/)
    }));

    const readArtifact = (ref: string) => JSON.parse(fs.readFileSync(
      path.join(projectDir, ref.slice('artifact:'.length)),
      'utf8'
    ));
    const baseline = readArtifact(state.baselineReportRef);
    const handoff = readArtifact(state.executionHandoffRef);
    expect(validateLifecycleEvent(baseline)).toBe(true);
    expect(validateLifecycleEvent(handoff)).toBe(true);
    expect(baseline).toMatchObject({
      requestId: decision.requestId,
      decisionId: decision.decisionId,
      runId: state.runId,
      revision: state.revision,
      status: 'passed'
    });
    expect(baseline.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ conditionId: 'decision-identity-bound', status: 'satisfied' }),
      expect.objectContaining({ conditionId: 'acceptance-plan-bound', status: 'satisfied' }),
      expect.objectContaining({ conditionId: 'scope-snapshot-bound', status: 'satisfied' })
    ]));
    expect(handoff).toMatchObject({
      kind: 'alignment.execution-handoff',
      phase: 'handoff',
      requestId: baseline.requestId,
      decisionId: baseline.decisionId,
      runId: baseline.runId,
      revision: baseline.revision,
      baselineReportRef: state.baselineReportRef,
      acceptancePlanRef: state.acceptancePlanRef,
      scopeFingerprint: state.scopeFingerprint
    });
  });

  test('does not issue a handoff while the required BaselineReport is missing', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;

    const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
    expect(prepared.status).toBe('ready_for_baseline');
    const transition = requireTransition(prepared);
    expect(checkReferenceHostBaseline(projectDir, decision, transition).status).toBe('ready_for_handoff');
    const state = JSON.parse(fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
      'utf8'
    ));
    fs.rmSync(path.join(projectDir, state.baselineReportRef.slice('artifact:'.length)));
    expect(issueReferenceHostHandoff(projectDir, decision, transition).status).toBe('baseline_incomplete');
    expect(state.phase).toBe('ready_for_handoff');
    expect(state).not.toHaveProperty('executionHandoffRef');
    expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle')))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/handoff/)]));
  });

  test('rejects a stale expected revision before the baseline check', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
    expect(prepared.status).toBe('ready_for_baseline');
    expect(prepared.transition).toEqual({
      runId: expect.stringMatching(/^run-/),
      expectedRevision: 1
    });
    const statePath = path.join(projectDir, '.align', '.runtime', 'reference-host.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.revision += 1;
    fs.writeFileSync(statePath, `${JSON.stringify(state)}\n`, 'utf8');

    expect(checkReferenceHostBaseline(projectDir, decision, prepared.transition!).status)
      .toBe('invalid_transition');
    expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle')))
      .toHaveLength(0);
  });

  test('fails closed when an executable Decision does not require baseline', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const invalidDecision = {
      ...decision,
      lifecyclePlan: { ...decision.lifecyclePlan, baseline: 'not_required' as const }
    };

    expect(prepareReferenceHostBaseline(projectDir, prompt, invalidDecision).status).toBe('invalid_transition');
    expect(completeReferenceHostRun(projectDir).status).toBe('not_observable');
  });

  test('records a failed baseline and refuses handoff when the acceptance snapshot changes', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
    expect(prepared.status).toBe('ready_for_baseline');
    const transition = requireTransition(prepared);

    const changedDecision = {
      ...decision,
      acceptance: decision.acceptance.map(acceptance => ({
        ...acceptance,
        criterion: `${acceptance.criterion} changed after prepare`
      }))
    };
    expect(checkReferenceHostBaseline(projectDir, changedDecision, transition).status).toBe('baseline_failed');
    const state = JSON.parse(fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
      'utf8'
    ));
    const report = JSON.parse(fs.readFileSync(
      path.join(projectDir, state.baselineReportRef.slice('artifact:'.length)),
      'utf8'
    ));
    expect(validateLifecycleEvent(report)).toBe(true);
    expect(report).toMatchObject({
      status: 'failed',
      reasons: ['lifecycle.baseline_failed'],
      observations: expect.arrayContaining([
        expect.objectContaining({ conditionId: 'acceptance-plan-bound', status: 'failed' })
      ])
    });
    expect(issueReferenceHostHandoff(projectDir, changedDecision, transition).status).toBe('invalid_transition');
    expect(state).not.toHaveProperty('executionHandoffRef');
  });

  test('records an incomplete baseline and refuses handoff when the acceptance plan is missing', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
    expect(prepared.status).toBe('ready_for_baseline');
    const transition = requireTransition(prepared);

    const incompleteDecision = { ...decision, acceptance: [] };
    expect(checkReferenceHostBaseline(projectDir, incompleteDecision, transition).status).toBe('baseline_incomplete');
    const state = JSON.parse(fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
      'utf8'
    ));
    const report = JSON.parse(fs.readFileSync(
      path.join(projectDir, state.baselineReportRef.slice('artifact:'.length)),
      'utf8'
    ));
    expect(validateLifecycleEvent(report)).toBe(true);
    expect(report).toMatchObject({
      status: 'incomplete',
      reasons: ['runtime.degraded'],
      observations: expect.arrayContaining([
        expect.objectContaining({ conditionId: 'acceptance-plan-bound', status: 'not_observed' })
      ])
    });
    expect(issueReferenceHostHandoff(projectDir, incompleteDecision, transition).status).toBe('invalid_transition');
    expect(state).not.toHaveProperty('executionHandoffRef');
  });

  test.each(baselineMismatchCases)(
    'fails closed before handoff when BaselineReport %s does not match',
    (_field, mutateReport) => {
      const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
      const decision = alignInstruction(prompt, projectDir, {
        hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
      }).decision;
      const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
      expect(prepared.status).toBe('ready_for_baseline');
      const transition = requireTransition(prepared);
      expect(checkReferenceHostBaseline(projectDir, decision, transition).status).toBe('ready_for_handoff');
      const state = JSON.parse(fs.readFileSync(
        path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
        'utf8'
      ));
      const reportPath = path.join(projectDir, state.baselineReportRef.slice('artifact:'.length));
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      mutateReport(report);
      fs.writeFileSync(reportPath, `${JSON.stringify(report)}\n`, 'utf8');

      expect(issueReferenceHostHandoff(projectDir, decision, transition).status).toBe('invalid_transition');
      expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle')))
        .not.toEqual(expect.arrayContaining([expect.stringMatching(/handoff/)]));
    }
  );

  test('rejects a passed report that does not contain the fixed condition plan', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
    expect(prepared.status).toBe('ready_for_baseline');
    const transition = requireTransition(prepared);
    expect(checkReferenceHostBaseline(projectDir, decision, transition).status).toBe('ready_for_handoff');
    const state = JSON.parse(fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
      'utf8'
    ));
    const reportPath = path.join(projectDir, state.baselineReportRef.slice('artifact:'.length));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    report.observations[0].conditionId = 'unexpected-condition';
    fs.writeFileSync(reportPath, `${JSON.stringify(report)}\n`, 'utf8');

    expect(issueReferenceHostHandoff(projectDir, decision, transition).status).toBe('invalid_transition');
    expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle')))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/handoff/)]));
  });

  test('rejects a schema-invalid passed report before issuing a handoff', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
    expect(prepared.status).toBe('ready_for_baseline');
    const transition = requireTransition(prepared);
    expect(checkReferenceHostBaseline(projectDir, decision, transition).status).toBe('ready_for_handoff');
    const state = JSON.parse(fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
      'utf8'
    ));
    const reportPath = path.join(projectDir, state.baselineReportRef.slice('artifact:'.length));
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    report.observations[0].evidenceRefs.push({ ...report.observations[0].evidenceRefs[0] });
    expect(validateLifecycleEvent(report)).toBe(false);
    fs.writeFileSync(reportPath, `${JSON.stringify(report)}\n`, 'utf8');

    expect(issueReferenceHostHandoff(projectDir, decision, transition).status).toBe('invalid_transition');
    expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle')))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/handoff/)]));
  });

  test.each(baselinePlanMismatchCases)(
    'records a failed baseline when the %s changes before the check',
    (_label, conditionId, mutateDecision) => {
      const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
      const decision = alignInstruction(prompt, projectDir, {
        hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
      }).decision;
      const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
      expect(prepared.status).toBe('ready_for_baseline');
      const transition = requireTransition(prepared);
      const changedDecision = JSON.parse(JSON.stringify(decision));
      mutateDecision(changedDecision);

      expect(checkReferenceHostBaseline(projectDir, changedDecision, transition).status).toBe('baseline_failed');
      const state = JSON.parse(fs.readFileSync(
        path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
        'utf8'
      ));
      const report = JSON.parse(fs.readFileSync(
        path.join(projectDir, state.baselineReportRef.slice('artifact:'.length)),
        'utf8'
      ));
      expect(validateLifecycleEvent(report)).toBe(true);
      expect(report).toMatchObject({
        requestId: decision.requestId,
        decisionId: decision.decisionId,
        status: 'failed',
        observations: expect.arrayContaining([
          expect.objectContaining({ conditionId, status: 'failed' })
        ])
      });
      expect(issueReferenceHostHandoff(projectDir, changedDecision, transition).status).toBe('invalid_transition');
    }
  );

  test('uses canonical acceptance and scope snapshots independent of object key order', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const prepared = prepareReferenceHostBaseline(projectDir, prompt, decision);
    expect(prepared.status).toBe('ready_for_baseline');
    const transition = requireTransition(prepared);
    const reorderedDecision = {
      ...decision,
      acceptance: decision.acceptance.map(acceptance => ({
        method: { value: acceptance.method.value, kind: acceptance.method.kind },
        criterion: acceptance.criterion,
        id: acceptance.id
      })),
      scope: { exclude: [...decision.scope.exclude], include: [...decision.scope.include] }
    };

    expect(checkReferenceHostBaseline(projectDir, reorderedDecision, transition).status).toBe('ready_for_handoff');
    expect(issueReferenceHostHandoff(projectDir, reorderedDecision, transition).status).toBe('handoff_issued');
  });

  test('does not run completion acceptance during the baseline check', () => {
    const marker = path.join(projectDir, '.align', 'completion-marker');
    fs.writeFileSync(
      path.join(projectDir, '.align', 'acceptance-probe.js'),
      "require('node:fs').writeFileSync('.align/completion-marker', 'completed');\n",
      'utf8'
    );
    fs.writeFileSync(
      path.join(projectDir, '.align', 'check-commands.txt'),
      'node .align/acceptance-probe.js\n',
      'utf8'
    );
    const prompt = '只修改 parser；完成后验证并运行 node .align/acceptance-probe.js。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;

    expect(recordReferenceHostHandoff(projectDir, prompt, decision).status).toBe('handoff_issued');
    expect(fs.existsSync(marker)).toBe(false);
    expect(completeReferenceHostRun(projectDir, { kind: 'claude-code.stop' }).status).toBe('verified');
    expect(fs.readFileSync(marker, 'utf8')).toBe('completed');
  });

  test.each(lifecyclePairTamperCases)(
    'does not record a receipt when the %s no longer matches the handoff',
    (_label, refField, mutateArtifact) => {
      const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
      const decision = alignInstruction(prompt, projectDir, {
        hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
      }).decision;
      expect(recordReferenceHostHandoff(projectDir, prompt, decision).status).toBe('handoff_issued');
      const state = JSON.parse(fs.readFileSync(
        path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
        'utf8'
      ));
      const artifactPath = path.join(projectDir, state[refField].slice('artifact:'.length));
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      mutateArtifact(artifact);
      fs.writeFileSync(artifactPath, `${JSON.stringify(artifact)}\n`, 'utf8');

      expect(completeReferenceHostRun(projectDir, { kind: 'claude-code.stop' }).status).toBe('invalid_transition');
      const lifecycleLog = fs.readFileSync(
        path.join(projectDir, '.align', '.runtime', 'reference-host.log'),
        'utf8'
      );
      expect(lifecycleLog).not.toContain('execution-receipt');
      expect(lifecycleLog).not.toContain('completion-evidence');
    }
  );

  test('records a handoff and produces completion evidence only after a receipt', () => {
    const prompt = '只修改 parser；token=secret-value；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;

    const beforeExecution = recordReferenceHostHandoff(projectDir, prompt, decision);
    expect(beforeExecution.status).toBe('handoff_issued');
    const completion = completeReferenceHostRun(projectDir, { kind: 'claude-code.stop' });
    expect(completion.status).toBe('verified');
    expect(completion.evidenceCount).toBe(1);

    const lifecycleLog = fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.log'),
      'utf8'
    );
    expect(lifecycleLog.indexOf('baseline-check')).toBeGreaterThanOrEqual(0);
    expect(lifecycleLog.indexOf('execution-handoff')).toBeGreaterThan(
      lifecycleLog.indexOf('baseline-check')
    );
    expect(lifecycleLog.indexOf('execution-receipt')).toBeGreaterThanOrEqual(0);
    expect(lifecycleLog.indexOf('execution-receipt')).toBeGreaterThan(
      lifecycleLog.indexOf('execution-handoff')
    );
    expect(lifecycleLog.indexOf('completion-evidence')).toBeGreaterThan(
      lifecycleLog.indexOf('execution-receipt')
    );
    const events = lifecycleLog.trim().split('\n').map(line => JSON.parse(line));
    const request = events.find(event => event.event === 'hook-request');
    const handoff = events.find(event => event.event === 'execution-handoff');
    const receipt = events.find(event => event.event === 'execution-receipt');
    const evidence = events.find(event => event.event === 'completion-evidence');
    expect(handoff.requestRef).toBe(request.requestRef);
    expect(receipt.requestRef).toBe(request.requestRef);
    expect(receipt.handoffId).toBe(handoff.handoffId);
    expect(evidence.requestRef).toBe(request.requestRef);
    expect(evidence.handoffId).toBe(handoff.handoffId);
    expect(lifecycleLog).not.toContain(prompt);
    expect(lifecycleLog).not.toContain('secret-value');
    expect(lifecycleLog).not.toContain(projectDir);
    expect(lifecycleLog).not.toContain('session_id');
  });

  test('does not turn clarify into a permanent block or create a receipt', () => {
    const prompt = '优化登录。';
    const result = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    });

    expect(result.decision.route).toBe('clarify');
    expect(result.host.nextAction).toBe('ask');
    expect(result.host.shouldBlock).toBe(false);
    expect(recordReferenceHostHandoff(projectDir, prompt, result.decision).status).toBe('not_executable');
    expect(completeReferenceHostRun(projectDir).status).toBe('not_observable');
  });

  test('does not report completion evidence when no execution receipt exists', () => {
    expect(completeReferenceHostRun(projectDir)).toEqual({ status: 'not_observable' });
  });

  test('keeps Decision identity in restricted state without leaking it to the audit log', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;

    expect(recordReferenceHostHandoff(projectDir, prompt, decision).status).toBe('handoff_issued');
    const state = JSON.parse(fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.json'),
      'utf8'
    ));
    expect(state).toMatchObject({
      kind: 'alignment.reference-host-run',
      stateVersion: '1.0.0',
      requestId: decision.requestId,
      decisionId: decision.decisionId,
      phase: 'handoff_issued',
      revision: 1
    });
    expect(state.runId).toEqual(expect.stringMatching(/^run-/));

    const lifecycleLog = fs.readFileSync(
      path.join(projectDir, '.align', '.runtime', 'reference-host.log'),
      'utf8'
    );
    expect(lifecycleLog).not.toContain(decision.requestId);
    expect(lifecycleLog).not.toContain(decision.decisionId);
    expect(lifecycleLog).not.toContain(state.runId);
  });

  test('clears a pending handoff when a later non-executable decision arrives', () => {
    const executablePrompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const executableDecision = alignInstruction(executablePrompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    expect(recordReferenceHostHandoff(projectDir, executablePrompt, executableDecision).status).toBe('handoff_issued');

    const clarifyPrompt = '优化登录。';
    const clarifyDecision = alignInstruction(clarifyPrompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    expect(recordReferenceHostHandoff(projectDir, clarifyPrompt, clarifyDecision).status).toBe('not_executable');
    expect(completeReferenceHostRun(projectDir).status).toBe('not_observable');
  });

  test('does not replace an active run on a repeated executable transition', () => {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const sessionRef = 'opaque-session-ref';

    expect(recordReferenceHostHandoff(projectDir, prompt, decision, sessionRef).status).toBe('handoff_issued');
    const runtimeDir = path.join(projectDir, '.align', '.runtime');
    const stateFile = fs.readdirSync(runtimeDir)
      .map(file => path.join(runtimeDir, file))
      .find(file => path.basename(file).startsWith('reference-host-') && file.endsWith('.json'))!;
    const firstState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

    expect(recordReferenceHostHandoff(projectDir, prompt, decision, sessionRef).status).toBe('invalid_transition');
    const currentState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    expect(currentState).toMatchObject({
      runId: firstState.runId,
      revision: firstState.revision,
      baselineReportRef: firstState.baselineReportRef,
      executionHandoffRef: firstState.executionHandoffRef,
      phase: 'handoff_issued'
    });
  });
});
