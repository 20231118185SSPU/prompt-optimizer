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
    { ...base, caseId: 'pass', expected: { ...base.expected, route: 'pass', sufficientLowRisk: true }, response: { action: 'proceed', questionCount: 0, hasRecommendation: false, hasExecutableAcceptance: false, makesDirectionDecision: false } }
  ];
  fs.writeFileSync(input, `${records.map(JSON.stringify).join('\n')}\n`);
  const result = spawnSync(process.execPath, [path.join(__dirname, 'score-eval.js'), input, output], { encoding: 'utf8' });
  assert.strictEqual(result.status, 0, result.stderr);
  const scored = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.strictEqual(scored.summary.selfReportedClarificationFormatPercent, 50);
  assert.strictEqual(scored.summary.unnecessaryClarificationRatePercent, 0);
  console.log('PASS: scorer uses only applicable clarify cases as its quality denominator');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
