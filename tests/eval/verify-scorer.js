#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-scorer-'));
try {
  const input = path.join(dir, 'raw.jsonl');
  const output = path.join(dir, 'score.json');
  const base = { status: 'completed', latencyMs: 1, expected: { highRisk: false, sufficientLowRisk: false, requiresAcceptance: false } };
  const records = [
    { ...base, caseId: 'good', expected: { ...base.expected, route: 'clarify' }, response: { action: 'ask', questionCount: 1, hasRecommendation: true, hasExecutableAcceptance: false, makesDirectionDecision: false } },
    { ...base, caseId: 'bad', expected: { ...base.expected, route: 'clarify' }, response: { action: 'ask', questionCount: 3, hasRecommendation: false, hasExecutableAcceptance: false, makesDirectionDecision: false } },
    { ...base, caseId: 'pass', expected: { ...base.expected, route: 'pass', sufficientLowRisk: true }, response: { action: 'proceed', questionCount: 0, hasRecommendation: false, hasExecutableAcceptance: false, makesDirectionDecision: false }, cleanupWarning: { failureType: 'cleanup_error' } },
    { ...base, status: 'failed', caseId: 'model-failure', failureType: 'invalid_json', expected: { ...base.expected, route: 'pass' }, response: null },
    { ...base, status: 'failed', caseId: 'runner-failure', failureType: 'timeout', expected: { ...base.expected, route: 'pass' }, response: null },
    { ...base, status: 'failed', caseId: 'legacy-cleanup', failureType: 'cleanup_error', expected: { ...base.expected, route: 'pass' }, response: null }
  ];
  fs.writeFileSync(input, `${records.map(JSON.stringify).join('\n')}\n`);
  const result = spawnSync(process.execPath, [path.join(__dirname, 'score-eval.js'), input, output], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr);
  const scored = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.strictEqual(scored.summary.selfReportedClarificationFormatPercent, 50);
  assert.strictEqual(scored.summary.unnecessaryClarificationRatePercent, 0);
  assert.strictEqual(scored.summary.completed, 3);
  assert.strictEqual(scored.summary.modelFailures, 1);
  assert.strictEqual(scored.summary.runnerFailures, 1);
  assert.strictEqual(scored.summary.cleanupWarnings, 2);
  assert.strictEqual(scored.summary.failed, 2);
  assert.deepStrictEqual(scored.records.slice(-3).map(record => record.outcome), ['model_failure', 'runner_failure', 'cleanup_warning']);
  console.log('PASS: scorer separates completed, model failures, runner failures, and cleanup warnings');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
