import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { alignInstruction } from '../alignment-interface';
import {
  completionVerify,
  completeReferenceHostRun,
  ExecutionReceiptArtifact,
  recordReferenceHostHandoff,
  ReferenceHostTransitionToken,
  reportExecution
} from '../reference-host';

const contractRoot = path.resolve(__dirname, '../../../../contracts');
const lifecycleSchema = JSON.parse(fs.readFileSync(
  path.join(contractRoot, 'lifecycle-event.schema.json'),
  'utf8'
));
const validateLifecycleEvent = new Ajv2020({ allErrors: true, strict: true }).compile(lifecycleSchema);

interface IssuedRun {
  decision: ReturnType<typeof alignInstruction>['decision'];
  statePath: string;
  state: Record<string, any>;
  transition: ReferenceHostTransitionToken;
}

describe('W5 execution receipt and completion production contract', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w5-receipt-contract-'));
    fs.mkdirSync(path.join(projectDir, '.align'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, '.align', 'check-commands.txt'),
      'bash -n .align/align-check.sh\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(projectDir, '.align', 'align-check.sh'),
      '#!/usr/bin/env bash\ntrue\n',
      'utf8'
    );
    fs.writeFileSync(path.join(projectDir, '.align', 'spec.md'), 'Project verification contract\n', 'utf8');
    fs.writeFileSync(path.join(projectDir, '.align', 'facts.md'), 'Project facts\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  function issueRun(sessionRef?: string): IssuedRun {
    const prompt = '只修改 parser；完成后验证并运行 bash -n .align/align-check.sh。';
    const decision = alignInstruction(prompt, projectDir, {
      hostCapabilities: { adapter: 'claude-code', nativeBlocking: true }
    }).decision;
    const result = recordReferenceHostHandoff(projectDir, prompt, decision, sessionRef);
    expect(result.status).toBe('handoff_issued');
    expect(result.transition).toEqual({
      runId: expect.stringMatching(/^run-/),
      expectedRevision: 1
    });
    const statePath = sessionRef
      ? fs.readdirSync(path.join(projectDir, '.align', '.runtime'))
        .filter(file => /^reference-host-.*\.json$/.test(file))
        .map(file => path.join(projectDir, '.align', '.runtime', file))[0]
      : path.join(projectDir, '.align', '.runtime', 'reference-host.json');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return { decision, statePath, state, transition: result.transition! };
  }

  function executionReceipt(
    run: IssuedRun,
    status: ExecutionReceiptArtifact['status'] = 'completed'
  ): ExecutionReceiptArtifact {
    return {
      schemaVersion: '1.0.0',
      requestId: run.decision.requestId,
      decisionId: run.decision.decisionId,
      runId: run.state.runId,
      revision: run.state.revision + 1,
      kind: 'alignment.execution-receipt',
      phase: 'execution',
      handoffId: run.state.handoffId,
      status,
      executionRef: `claude-code:stop:${run.state.runId}`
    };
  }

  function readArtifact(ref: string): Record<string, any> {
    return JSON.parse(fs.readFileSync(
      path.join(projectDir, ref.slice('artifact:'.length)),
      'utf8'
    ));
  }

  test('does not synthesize completed when no execution observation is supplied', () => {
    const run = issueRun();

    expect(completeReferenceHostRun(projectDir)).toEqual({ status: 'not_observable' });
    expect(JSON.parse(fs.readFileSync(run.statePath, 'utf8')).phase).toBe('handoff_issued');
    expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle')))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/receipt|completion/)]));
  });

  test('persists schema-valid public receipt and completion artifacts on r1 -> r2 -> r3', () => {
    const run = issueRun();
    const receiptResult = reportExecution(
      projectDir,
      executionReceipt(run),
      run.transition
    );

    expect(receiptResult).toMatchObject({
      status: 'receipt_recorded',
      transition: { runId: run.state.runId, expectedRevision: 2 }
    });
    const receiptState = JSON.parse(fs.readFileSync(run.statePath, 'utf8'));
    const baseline = readArtifact(receiptState.baselineReportRef);
    const handoff = readArtifact(receiptState.executionHandoffRef);
    const receipt = readArtifact(receiptState.executionReceiptRef);
    expect(validateLifecycleEvent(receipt)).toBe(true);

    const completionResult = completionVerify(projectDir, receiptResult.transition!);
    expect(completionResult).toMatchObject({
      status: 'verified',
      evidenceCount: 1,
      transition: { runId: run.state.runId, expectedRevision: 3 }
    });
    const completionState = JSON.parse(fs.readFileSync(run.statePath, 'utf8'));
    const completion = readArtifact(completionState.completionReportRef);
    expect(validateLifecycleEvent(completion)).toBe(true);

    for (const artifact of [baseline, handoff, receipt, completion]) {
      expect(artifact).toMatchObject({
        requestId: run.decision.requestId,
        decisionId: run.decision.decisionId,
        runId: run.state.runId
      });
    }
    expect([baseline.revision, handoff.revision, receipt.revision, completion.revision])
      .toEqual([1, 1, 2, 3]);
    expect(receipt.handoffId).toBe(handoff.handoffId);
    expect(completion.executionRef).toBe(receipt.executionRef);
    expect(completion.checks).toEqual([
      expect.objectContaining({ acceptanceId: expect.any(String), status: 'passed' })
    ]);
  });

  test('rejects duplicate execution receipts as invalid_transition', () => {
    const run = issueRun();
    const receipt = executionReceipt(run);

    expect(reportExecution(projectDir, receipt, run.transition).status).toBe('receipt_recorded');
    expect(reportExecution(projectDir, receipt, run.transition).status).toBe('invalid_transition');
    expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle'))
      .filter(file => file.includes('receipt'))).toHaveLength(1);
  });

  test('rejects stale revision and wrong runId transitions without persisting an artifact', () => {
    const run = issueRun();
    const stale = { ...run.transition, expectedRevision: run.transition.expectedRevision + 1 };
    const wrongRun = { ...run.transition, runId: 'run-mismatch' };

    expect(reportExecution(projectDir, executionReceipt(run), stale).status).toBe('invalid_transition');
    expect(reportExecution(projectDir, executionReceipt(run), wrongRun).status).toBe('invalid_transition');
    expect(JSON.parse(fs.readFileSync(run.statePath, 'utf8')).phase).toBe('handoff_issued');
    expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle'))
      .filter(file => file.includes('receipt'))).toHaveLength(0);
  });

  test.each(['failed', 'cancelled'] as const)(
    'persists an explicit %s receipt without entering completion verification',
    status => {
      const run = issueRun();
      const receiptResult = reportExecution(
        projectDir,
        executionReceipt(run, status),
        run.transition
      );

      expect(receiptResult).toMatchObject({
        status: `execution_${status}`,
        transition: { runId: run.state.runId, expectedRevision: 2 }
      });
      const state = JSON.parse(fs.readFileSync(run.statePath, 'utf8'));
      const receipt = readArtifact(state.executionReceiptRef);
      expect(validateLifecycleEvent(receipt)).toBe(true);
      expect(receipt.status).toBe(status);
      expect(completionVerify(projectDir, receiptResult.transition!).status).toBe('invalid_transition');
      expect(fs.readdirSync(path.join(projectDir, '.align', '.runtime', 'lifecycle'))
        .filter(file => file.includes('completion'))).toHaveLength(0);
    }
  );

  test('requires the receipt transition before completion and rejects duplicate completion', () => {
    const run = issueRun();
    expect(completionVerify(projectDir, run.transition).status).toBe('invalid_transition');

    const receipt = reportExecution(projectDir, executionReceipt(run), run.transition);
    expect(completionVerify(projectDir, receipt.transition!).status).toBe('verified');
    expect(completionVerify(projectDir, receipt.transition!).status).toBe('invalid_transition');
  });
});
