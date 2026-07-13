#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RUNNER = path.join(__dirname, 'run-eval.js');
const FAKE = path.join(__dirname, 'fixtures/fake-codex.js');

function loadJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function execCalls(file) {
  if (!fs.existsSync(file)) return [];
  return loadJsonl(file).filter(args => args.includes('exec'));
}

function makeCorpus(file, count = 1) {
  const cases = Array.from({ length: count }, (_, index) => ({
    id: `T${String(index + 1).padStart(2, '0')}`,
    category: 'runner',
    request: `只修改 fake-${index + 1}.ts 并运行测试。`,
    contextFixture: null,
    expected: { route: 'pass', highRisk: false, sufficientLowRisk: true, requiresAcceptance: true }
  }));
  fs.writeFileSync(file, `${cases.map(JSON.stringify).join('\n')}\n`, 'utf8');
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-runner-test-'));
try {
  const corpus = path.join(sandbox, 'corpus.jsonl');
  const fakeCli = path.join(sandbox, 'codex.js');
  fs.copyFileSync(FAKE, fakeCli);
  makeCorpus(corpus);

  function run(name, behavior, extraArgs = [], extraEnv = {}) {
    const output = path.join(sandbox, `${name}.jsonl`);
    const callLog = path.join(sandbox, `${name}-calls.jsonl`);
    const result = spawnSync(process.execPath, [RUNNER, '--arm', 'control', '--provider', 'codex',
      '--corpus', corpus, '--output', output, ...extraArgs], {
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        PROMPT_OPTIMIZER_CODEX_JS: fakeCli,
        FAKE_CLI_BEHAVIOR: behavior,
        FAKE_CLI_CALL_LOG: callLog,
        ...extraEnv
      }
    });
    return { result, output, callLog, records: fs.existsSync(output) ? loadJsonl(output) : [] };
  }

  for (const [behavior, failureType] of [
    ['empty', 'empty_output'],
    ['missing-output', 'missing_output_file'],
    ['invalid-json', 'invalid_json'],
    ['schema-mismatch', 'schema_mismatch'],
    ['exit-nonzero', 'cli_exit_nonzero'],
    ['credential-error', 'credential_error']
  ]) {
    const test = run(behavior, behavior);
    assert.notStrictEqual(test.result.status, 0, `${behavior} must fail the batch`);
    assert.strictEqual(test.records[0].status, 'failed');
    assert.strictEqual(test.records[0].failureType, failureType);
    assert.strictEqual(execCalls(test.callLog).length, 1, `${behavior} must not retry by default`);
  }

  const allowed = run('allow-failures', 'empty', ['--allow-failures']);
  assert.strictEqual(allowed.result.status, 0, '--allow-failures must preserve evidence without failing the shell');
  assert.strictEqual(allowed.records[0].failureType, 'empty_output');

  const timedOut = run('timeout', 'timeout', ['--timeout-ms', '500', '--heartbeat-ms', '50']);
  assert.notStrictEqual(timedOut.result.status, 0, 'timeout must fail the batch');
  assert.strictEqual(timedOut.records[0].failureType, 'timeout');
  assert.match(timedOut.result.stdout, /HEARTBEAT/);
  assert.strictEqual(execCalls(timedOut.callLog).length, 1, 'timeout must not duplicate an active call');

  const retryState = path.join(sandbox, 'retry-state');
  const retried = run('retry', 'fail-once', ['--retry-failures', '1'], { FAKE_CLI_STATE_FILE: retryState });
  assert.notStrictEqual(retried.result.status, 0, 'a recorded failed attempt keeps the batch failed');
  assert.deepStrictEqual(retried.records.map(record => record.status), ['failed', 'completed']);
  assert.strictEqual(execCalls(retried.callLog).length, 2, 'explicit retry runs exactly once');

  const cleanup = run('cleanup', 'success', ['--retry-failures', '1'], { PROMPT_OPTIMIZER_EVAL_TEST_CLEANUP_ERROR: '1' });
  assert.strictEqual(cleanup.result.status, 0, 'cleanup warning must not change model status');
  assert.strictEqual(cleanup.records[0].status, 'completed');
  assert.strictEqual(cleanup.records[0].cleanupWarning.failureType, 'cleanup_error');
  assert.strictEqual(execCalls(cleanup.callLog).length, 1, 'cleanup warning must not trigger retry');

  const resumeOutput = path.join(sandbox, 'resume.jsonl');
  fs.writeFileSync(resumeOutput, `${JSON.stringify({
    provider: 'codex-cli', model: 'cli-default', arm: 'control', caseId: 'T01', iteration: 1, status: 'completed'
  })}\n`, 'utf8');
  const resumeLog = path.join(sandbox, 'resume-calls.jsonl');
  const resumed = spawnSync(process.execPath, [RUNNER, '--arm', 'control', '--provider', 'codex',
    '--corpus', corpus, '--output', resumeOutput, '--resume'], {
    encoding: 'utf8',
    env: { ...process.env, PROMPT_OPTIMIZER_CODEX_JS: fakeCli, FAKE_CLI_CALL_LOG: resumeLog }
  });
  assert.strictEqual(resumed.status, 0, resumed.stderr);
  assert.strictEqual(execCalls(resumeLog).length, 0, '--resume must skip completed stable keys');
  assert.strictEqual(loadJsonl(resumeOutput).length, 1, '--resume must preserve existing evidence');

  const preservedOutput = path.join(sandbox, 'preserved.jsonl');
  fs.writeFileSync(preservedOutput, `${JSON.stringify({ marker: 'existing' })}\n`, 'utf8');
  const preserved = spawnSync(process.execPath, [RUNNER, '--arm', 'control', '--provider', 'codex',
    '--corpus', corpus, '--output', preservedOutput], {
    encoding: 'utf8', env: { ...process.env, PROMPT_OPTIMIZER_CODEX_JS: fakeCli }
  });
  assert.strictEqual(preserved.status, 0, preserved.stderr);
  assert.strictEqual(loadJsonl(preservedOutput)[0].marker, 'existing', 'default run must not truncate evidence');

  const budget = run('budget', 'success', ['--max-cost-usd', '0']);
  assert.notStrictEqual(budget.result.status, 0, 'exhausted budget must fail the batch');
  assert.strictEqual(budget.records[0].failureType, 'budget_exceeded');
  assert.strictEqual(execCalls(budget.callLog).length, 0, 'budget gate must stop before the next model call');

  const unsafeBudget = run('unsafe-budget', 'success', ['--max-cost-usd', '0.03']);
  assert.notStrictEqual(unsafeBudget.result.status, 0, 'finite cost budget without a call bound must fail closed');
  assert.match(unsafeBudget.result.stderr, /--max-cost-per-call-usd/);
  assert.strictEqual(execCalls(unsafeBudget.callLog).length, 0);

  makeCorpus(corpus, 2);
  const capped = run('max-cases', 'success', ['--max-cases', '1']);
  assert.notStrictEqual(capped.result.status, 0, 'case cap must record the unstarted case');
  assert.deepStrictEqual(capped.records.map(record => record.status), ['completed', 'failed']);
  assert.strictEqual(capped.records[1].failureType, 'budget_exceeded');
  assert.strictEqual(execCalls(capped.callLog).length, 1);
  assert.match(capped.result.stdout, /START control T01/);
  assert.match(capped.result.stdout, /RESULT control T01.*latencyMs=.*usage=.*failure=/);

  const costCapped = run('cost-capped', 'success', ['--max-cost-usd', '0.03', '--max-cost-per-call-usd', '0.02']);
  assert.notStrictEqual(costCapped.result.status, 0, 'conservative call bounds must stop before exceeding total cost');
  assert.deepStrictEqual(costCapped.records.map(record => record.status), ['completed', 'failed']);
  assert.strictEqual(costCapped.records[1].failureType, 'budget_exceeded');
  assert.strictEqual(execCalls(costCapped.callLog).length, 1);

  makeCorpus(corpus, 1);
  const retryWithinCaseCap = run('retry-within-case-cap', 'fail-once', ['--max-cases', '1', '--retry-failures', '1'], {
    FAKE_CLI_STATE_FILE: path.join(sandbox, 'retry-within-cap-state')
  });
  assert.strictEqual(execCalls(retryWithinCaseCap.callLog).length, 2, 'case cap must not consume the explicit retry allowance');

  console.log('PASS: eval runner fails closed, resumes safely, and enforces retry, timeout, cleanup, and budget gates');
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
