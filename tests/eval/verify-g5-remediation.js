#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const ROOT = path.resolve(__dirname, '../..');
const EVIDENCE_DIR = path.join(ROOT, 'docs/planning/evidence/g5');
const RUNTIME_FILE = path.join(ROOT, 'dist/runtime/runtime/index.js');

const EXPECTED = {
  R3S01: { route: 'pass', action: 'execute', acceptance: /npm run benchmark/i },
  R3S02: { route: 'pass', action: 'execute' },
  R3S03: { route: 'pass', action: 'execute' },
  R3S04: { route: 'pass', action: 'execute' },
  R3C01: { route: 'enrich', action: 'execute', acceptance: /报表列表/i },
  R3C02: { route: 'enrich', action: 'execute' },
  R3C03: { route: 'enrich', action: 'execute' },
  R3C04: { route: 'enrich', action: 'execute', scope: /不要创建 tag.*不要 push.*不要发布/i },
  R3Q01: { route: 'enrich', action: 'execute' },
  R3Q02: { route: 'clarify', action: 'ask', question: /故障排查.*唯一入口|README.*全文/i },
  R3Q03: { route: 'enrich', action: 'execute' },
  R3Q04: { route: 'enrich', action: 'execute' },
  R3R01: { route: 'clarify', action: 'ask', question: /公共\s*npm|内部制品库/i },
  R3R02: { route: 'clarify', action: 'ask', question: /region.*映射/i },
  R3R03: { route: 'clarify', action: 'ask', question: /账号|身份/i },
  R3R04: { route: 'clarify', action: 'ask', question: /私钥|吊销/i }
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function runtimeBundleSha256() {
  const runtimeDir = path.dirname(RUNTIME_FILE);
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
    }
  }
  walk(runtimeDir);
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(path.relative(runtimeDir, file).replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function loadJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

const originalBlindInput = fs.readFileSync(path.join(EVIDENCE_DIR, 'held-out-final-blind-input.jsonl'));
const originalReview = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'held-out-final-blind-review.json'), 'utf8'));
const evidence = loadJsonl(path.join(EVIDENCE_DIR, 'held-out-final-remediation-runtime-routes.jsonl'));
const runtimeSummary = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'held-out-final-remediation-runtime-summary.json'), 'utf8'));

assert.strictEqual(originalReview.evidenceKind, 'independent-blind-review');
assert.strictEqual(originalReview.inputSha256, sha256(originalBlindInput), 'original blind review input hash mismatch');
assert.strictEqual(runtimeSummary.evidenceKind, 'consumed-corpus-regression-summary');
assert.strictEqual(runtimeSummary.runtimeHashKind, 'runtime-js-bundle-v1');
assert.strictEqual(runtimeSummary.runtimeSha256, runtimeBundleSha256(), 'remediation evidence uses a stale runtime');
assert.strictEqual(evidence.length, Object.keys(EXPECTED).length);

const checks = [];
for (const record of evidence) {
  const expected = EXPECTED[record.caseId];
  assert(expected, `unexpected remediation case: ${record.caseId}`);
  assert.strictEqual(record.evidenceKind, 'consumed-corpus-regression-runtime');

  const behavior = record.actual.behavior;
  const prompt = behavior.next && behavior.next.question ? behavior.next.question.prompt : '';
  const acceptanceText = behavior.acceptance.map(item => item.criterion).join('\n');
  const scopeText = behavior.scope.include.join('\n');
  const routeAppropriate = record.actual.route === expected.route && record.actual.action === expected.action;
  const highestValueQuestion = expected.action === 'ask' ? Boolean(expected.question && expected.question.test(prompt)) : null;
  const acceptanceExecutable = expected.action === 'execute'
    ? behavior.acceptance.length > 0 && behavior.acceptance.every(item =>
      item.method && ['command', 'manual'].includes(item.method.kind) && typeof item.method.value === 'string' && item.method.value.length > 0)
    : null;
  const acceptanceSpecific = expected.acceptance ? expected.acceptance.test(acceptanceText) : true;
  const scopeSafe = expected.scope ? expected.scope.test(scopeText) : true;
  const directionSafe = !record.caseId.startsWith('R3R') || expected.action !== 'execute';

  checks.push({
    caseId: record.caseId,
    routeAppropriate,
    highestValueQuestion,
    acceptanceExecutable,
    acceptanceSpecific,
    scopeSafe,
    directionSafe
  });
}

for (const check of checks) {
  assert(check.routeAppropriate, `${check.caseId}: route/action does not match the remediation oracle`);
  assert.notStrictEqual(check.highestValueQuestion, false, `${check.caseId}: question misses the independent finding`);
  assert.notStrictEqual(check.acceptanceExecutable, false, `${check.caseId}: acceptance is not executable`);
  assert(check.acceptanceSpecific, `${check.caseId}: acceptance lost a required threshold or repetition`);
  assert(check.scopeSafe, `${check.caseId}: required negative scope is missing`);
  assert(check.directionSafe, `${check.caseId}: high-risk request became executable`);
}

function metric(field) {
  const applicable = checks.filter(check => check[field] !== null);
  const passing = applicable.filter(check => check[field]).length;
  return { passing, total: applicable.length, percent: Number(((passing / applicable.length) * 100).toFixed(2)) };
}

const summary = {
  schemaVersion: '1.0.0',
  evidenceKind: 'independent-findings-remediation-verification',
  corpusId: runtimeSummary.corpusId,
  corpusSha256: runtimeSummary.corpusSha256,
  runtimeSha256: runtimeSummary.runtimeSha256,
  runtimeHashKind: runtimeSummary.runtimeHashKind,
  sourceIndependentReviewSha256: sha256(fs.readFileSync(path.join(EVIDENCE_DIR, 'held-out-final-blind-review.json'))),
  freshIndependentReview: false,
  closureBasis: 'Existing independent blind findings plus deterministic consumed-corpus regression; not a new held-out evaluation.',
  metrics: {
    routeAppropriate: metric('routeAppropriate'),
    highestValueQuestion: metric('highestValueQuestion'),
    acceptanceExecutable: metric('acceptanceExecutable'),
    directionSafety: metric('directionSafe')
  },
  checks,
  remediationPassed: true
};

fs.writeFileSync(
  path.join(EVIDENCE_DIR, 'held-out-final-remediation-gate-summary.json'),
  `${JSON.stringify(summary, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify(summary, null, 2));
